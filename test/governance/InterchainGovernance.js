'use strict';

const chai = require('chai');
const { ethers } = require('hardhat');
const {
    utils: { defaultAbiCoder, Interface, keccak256 },
    constants: { AddressZero, HashZero },
} = ethers;
const { expect } = chai;
const { isHardhat, waitFor, getPayloadAndProposalHash, getGasOptions, getEVMVersion } = require('../utils');

describe('InterchainGovernance', () => {
    let ownerWallet;
    let governanceAddress;
    let gatewayAddress;

    let interchainGovernanceFactory;
    let interchainGovernance;

    let targetFactory;
    let targetContract;

    let targetInterface;
    let calldata;
    let govCommandID;

    const governanceChain = 'Governance Chain';
    const timeDelay = isHardhat ? 12 * 60 * 60 : 45;
    const minimumTimeDelay = isHardhat ? 10 * 60 * 60 : 15;

    before(async () => {
        [ownerWallet, governanceAddress] = await ethers.getSigners();

        interchainGovernanceFactory = await ethers.getContractFactory('InterchainGovernance', ownerWallet);

        targetFactory = await ethers.getContractFactory('Target', ownerWallet);
        targetInterface = new ethers.utils.Interface(targetFactory.interface.fragments);
        targetContract = await targetFactory.deploy().then((d) => d.deployed());
        calldata = targetInterface.encodeFunctionData('callTarget');

        govCommandID = HashZero;

        const mockGatewayFactory = await ethers.getContractFactory('MockGatewayValidation', ownerWallet);
        gatewayAddress = await mockGatewayFactory.deploy().then((d) => d.deployed());
    });

    describe('contructor checks', () => {
        it('should revert on invalid constructor args', async () => {
            await expect(
                interchainGovernanceFactory.deploy(AddressZero, governanceChain, governanceAddress.address, timeDelay),
            ).to.be.revertedWithCustomError(interchainGovernanceFactory, 'InvalidAddress');

            await expect(
                interchainGovernanceFactory.deploy(gatewayAddress.address, '', governanceAddress.address, timeDelay),
            ).to.be.revertedWithCustomError(interchainGovernanceFactory, 'InvalidAddress');

            await expect(
                interchainGovernanceFactory.deploy(gatewayAddress.address, governanceChain, '', timeDelay),
            ).to.be.revertedWithCustomError(interchainGovernanceFactory, 'InvalidAddress');
        });
    });

    describe('negative tests', () => {
        before(async () => {
            interchainGovernance = await interchainGovernanceFactory
                .deploy(gatewayAddress.address, governanceChain, governanceAddress.address, minimumTimeDelay)
                .then((d) => d.deployed());
        });

        it('should revert on invalid command', async () => {
            const commandID = 2;
            const target = targetContract.address;
            const nativeValue = 100;

            const [payload] = await getPayloadAndProposalHash(commandID, target, nativeValue, calldata, timeDelay);

            await expect(
                interchainGovernance.execute(govCommandID, governanceChain, governanceAddress.address, payload),
            ).to.be.revertedWithCustomError(interchainGovernance, 'InvalidCommand');
        });

        it('should revert on scheduling a proposal if source chain is not the governance chain', async () => {
            const commandID = 0;
            const target = targetContract.address;
            const nativeValue = 100;
            const sourceChain = 'Source Chain';

            const [payload] = await getPayloadAndProposalHash(commandID, target, nativeValue, calldata, timeDelay);

            await expect(
                interchainGovernance.execute(govCommandID, sourceChain, governanceAddress.address, payload),
            ).to.be.revertedWithCustomError(interchainGovernance, 'NotGovernance');
        });

        it('should revert on scheduling a proposal if source address is not the governance address', async () => {
            const commandID = 0;
            const target = targetContract.address;
            const nativeValue = 100;

            const [payload] = await getPayloadAndProposalHash(commandID, target, nativeValue, calldata, timeDelay);

            await expect(
                interchainGovernance.execute(govCommandID, governanceChain, ownerWallet.address, payload),
            ).to.be.revertedWithCustomError(interchainGovernance, 'NotGovernance');
        });

        it('should revert on scheduling a proposal if the target address is invalid', async () => {
            const commandID = 0;
            const target = AddressZero;
            const nativeValue = 100;

            const [payload] = await getPayloadAndProposalHash(commandID, target, nativeValue, calldata, timeDelay);

            await expect(
                interchainGovernance.execute(govCommandID, governanceChain, governanceAddress.address, payload),
            ).to.be.revertedWithCustomError(interchainGovernance, 'InvalidTarget');
        });

        it('should revert on calling withdraw directly', async () => {
            const recipient = ownerWallet.address;
            const nativeValue = 100;
            await expect(interchainGovernance.withdraw(recipient, nativeValue)).to.be.revertedWithCustomError(
                interchainGovernance,
                'NotSelf',
            );
        });

        it('should revert on executing a proposal if target is not a contract', async () => {
            const commandID = 0;
            const target = ownerWallet.address;
            const nativeValue = 100;

            const [payload] = await getPayloadAndProposalHash(commandID, target, nativeValue, calldata, timeDelay);

            await interchainGovernance
                .execute(govCommandID, governanceChain, governanceAddress.address, payload, getGasOptions())
                .then((tx) => tx.wait());

            await waitFor(timeDelay);

            await expect(
                interchainGovernance.executeProposal(target, calldata, nativeValue, {
                    value: nativeValue,
                }),
            ).to.be.revertedWithCustomError(interchainGovernance, 'InvalidContract');
        });

        it('should revert on executing a proposal if governance time lock has not passed', async () => {
            const commandID = 0;
            const target = targetContract.address;
            const nativeValue = 0;

            const [payload] = await getPayloadAndProposalHash(commandID, target, nativeValue, calldata, timeDelay);

            await interchainGovernance
                .execute(govCommandID, governanceChain, governanceAddress.address, payload, getGasOptions())
                .then((tx) => tx.wait());

            await expect(
                interchainGovernance.executeProposal(target, calldata, nativeValue),
            ).to.be.revertedWithCustomError(interchainGovernance, 'TimeLockNotReady');
        });

        it('should revert on executing a proposal if governance has insufficient balance', async () => {
            const commandID = 0;
            const target = targetContract.address;
            const nativeValue = 100;

            const [payload] = await getPayloadAndProposalHash(commandID, target, nativeValue, calldata, timeDelay);

            await interchainGovernance
                .execute(govCommandID, governanceChain, governanceAddress.address, payload, getGasOptions())
                .then((tx) => tx.wait());

            await waitFor(timeDelay + 15);

            await expect(
                interchainGovernance.executeProposal(target, calldata, nativeValue),
            ).to.be.revertedWithCustomError(interchainGovernance, 'InsufficientBalance');
        });

        it('should revert on executing a proposal if call to target fails', async () => {
            const commandID = 0;
            const target = targetContract.address;
            const nativeValue = 100;

            // Encode function that does not exist on target
            const invalidTargetInterface = new Interface(['function set() external']);
            const invalidCalldata = invalidTargetInterface.encodeFunctionData('set');

            const [payload] = await getPayloadAndProposalHash(
                commandID,
                target,
                nativeValue,
                invalidCalldata,
                timeDelay,
            );

            await interchainGovernance
                .execute(govCommandID, governanceChain, governanceAddress.address, payload, getGasOptions())
                .then((tx) => tx.wait());

            await waitFor(timeDelay);

            await expect(
                interchainGovernance.executeProposal(target, invalidCalldata, nativeValue, { value: nativeValue }),
            ).to.be.revertedWithCustomError(interchainGovernance, 'ExecutionFailed');
        });
    });

    describe('positive tests', () => {
        beforeEach(async () => {
            interchainGovernance = await interchainGovernanceFactory
                .deploy(gatewayAddress.address, governanceChain, governanceAddress.address, minimumTimeDelay)
                .then((d) => d.deployed());
        });

        it('should schedule a proposal and get the correct eta', async () => {
            const commandID = 0;
            const target = targetContract.address;
            const nativeValue = 100;

            const [payload, proposalHash, eta] = await getPayloadAndProposalHash(
                commandID,
                target,
                nativeValue,
                calldata,
                timeDelay,
            );

            await expect(
                interchainGovernance.execute(
                    govCommandID,
                    governanceChain,
                    governanceAddress.address,
                    payload,
                    getGasOptions(),
                ),
            )
                .to.emit(interchainGovernance, 'ProposalScheduled')
                .withArgs(proposalHash, target, calldata, nativeValue, eta);

            const proposalEta = await interchainGovernance.getProposalEta(target, calldata, nativeValue);
            expect(proposalEta).to.eq(eta);
        });

        it('should withdraw native ether from governance', async () => {
            const commandID = 0;
            const target = targetContract.address;
            const nativeValue = 100;
            const calldata = '0x';

            const [payload] = await getPayloadAndProposalHash(commandID, target, nativeValue, calldata, timeDelay);

            await ownerWallet
                .sendTransaction({
                    to: interchainGovernance.address,
                    value: nativeValue,
                })
                .then((tx) => tx.wait());

            await interchainGovernance
                .execute(govCommandID, governanceChain, governanceAddress.address, payload, getGasOptions())
                .then((tx) => tx.wait());

            await waitFor(timeDelay);

            const tx = await interchainGovernance.executeProposal(target, calldata, nativeValue);

            await expect(tx).to.emit(interchainGovernance, 'ProposalExecuted');

            expect(await ethers.provider.getBalance(interchainGovernance.address)).to.equal(0);
        });

        it('should withdraw native ether from governance to recipient via withdraw method', async () => {
            const commandID = 0;
            const target = interchainGovernance.address;
            const nativeValue = 100;
            const recipient = ownerWallet.address;

            const withdrawInterface = new ethers.utils.Interface(interchainGovernance.interface.fragments);
            const withdrawCalldata = withdrawInterface.encodeFunctionData('withdraw', [recipient, nativeValue]);

            const [payload] = await getPayloadAndProposalHash(commandID, target, 0, withdrawCalldata, timeDelay);

            await ownerWallet
                .sendTransaction({
                    to: interchainGovernance.address,
                    value: nativeValue,
                })
                .then((tx) => tx.wait());

            expect(await ethers.provider.getBalance(interchainGovernance.address)).to.equal(nativeValue);

            await interchainGovernance
                .execute(govCommandID, governanceChain, governanceAddress.address, payload)
                .then((tx) => tx.wait());

            await waitFor(timeDelay);

            const tx = await interchainGovernance.executeProposal(target, withdrawCalldata, 0);

            await expect(tx).to.emit(interchainGovernance, 'ProposalExecuted');

            expect(await ethers.provider.getBalance(interchainGovernance.address)).to.equal(0);
        });

        it('should cancel an existing proposal', async () => {
            const commandID = 0;
            const commandIDCancel = 1;
            const target = targetContract.address;
            const nativeValue = 100;

            const [payload, proposalHash, eta] = await getPayloadAndProposalHash(
                commandID,
                target,
                nativeValue,
                calldata,
                timeDelay,
            );

            await interchainGovernance
                .execute(govCommandID, governanceChain, governanceAddress.address, payload, getGasOptions())
                .then((tx) => tx.wait());

            const cancelPayload = defaultAbiCoder.encode(
                ['uint256', 'address', 'bytes', 'uint256', 'uint256'],
                [commandIDCancel, target, calldata, nativeValue, eta],
            );

            await expect(
                interchainGovernance.execute(
                    govCommandID,
                    governanceChain,
                    governanceAddress.address,
                    cancelPayload,
                    getGasOptions(),
                ),
            )
                .to.emit(interchainGovernance, 'ProposalCancelled')
                .withArgs(proposalHash, target, calldata, nativeValue, eta);
        });

        it('should execute an existing proposal', async () => {
            const commandID = 0;
            const target = targetContract.address;
            const nativeValue = 100;

            const [payload, proposalHash] = await getPayloadAndProposalHash(
                commandID,
                target,
                nativeValue,
                calldata,
                timeDelay,
            );

            await interchainGovernance
                .execute(govCommandID, governanceChain, governanceAddress.address, payload, getGasOptions())
                .then((tx) => tx.wait());

            await waitFor(timeDelay);

            const tx = await interchainGovernance.executeProposal(target, calldata, nativeValue, {
                value: nativeValue,
            });
            await tx.wait();

            const block = await ethers.provider.getBlock(tx.blockNumber);
            const executionTimestamp = block.timestamp;

            await expect(tx)
                .to.emit(interchainGovernance, 'ProposalExecuted')
                .withArgs(proposalHash, target, calldata, nativeValue, executionTimestamp)
                .and.to.emit(targetContract, 'TargetCalled');
        });
    });

    it('should preserve the bytecode [ @skip-on-coverage ]', async () => {
        const bytecode = interchainGovernanceFactory.bytecode;
        const bytecodeHash = keccak256(bytecode);

        const expected = {
            london: '0x034b9b57bed553b7c9cfa5e4a14304776b65d8a3caefc87df9339203b04df56e',
        }[getEVMVersion()];

        expect(bytecodeHash).to.be.equal(expected);
    });
});
