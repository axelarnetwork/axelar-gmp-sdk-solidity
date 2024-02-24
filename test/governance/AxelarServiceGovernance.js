'use strict';

const chai = require('chai');
const { ethers } = require('hardhat');
const {
    utils: { defaultAbiCoder, Interface, keccak256 },
    constants: { HashZero },
    Wallet,
} = ethers;
const { expect } = chai;
const { isHardhat, getPayloadAndProposalHash, getEVMVersion } = require('../utils');

describe('AxelarServiceGovernance', () => {
    let ownerWallet;
    let governanceAddress;
    let gateway;
    let signer1, signer2, signer3;
    let signers;

    let serviceGovernanceFactory;
    let serviceGovernance;
    const govCommandID = HashZero;

    let targetFactory;
    let targetContract;

    let targetInterface;
    let calldata;

    const governanceChain = 'Governance Chain';
    const timeDelay = isHardhat ? 12 * 60 * 60 : 45;
    const threshold = 2;

    before(async () => {
        [ownerWallet, signer1, signer2] = await ethers.getSigners();
        signer3 = Wallet.createRandom().connect(ethers.provider);
        signers = [signer1, signer2, signer3].map((signer) => signer.address);
        governanceAddress = signer1;

        serviceGovernanceFactory = await ethers.getContractFactory('AxelarServiceGovernance', ownerWallet);
        targetFactory = await ethers.getContractFactory('Target', ownerWallet);

        const mockGatewayFactory = await ethers.getContractFactory('MockGatewayValidation', ownerWallet);
        gateway = await mockGatewayFactory.deploy().then((d) => d.deployed());

        targetContract = await targetFactory.deploy().then((d) => d.deployed());

        targetInterface = new ethers.utils.Interface(targetContract.interface.fragments);
        calldata = targetInterface.encodeFunctionData('callTarget');
    });

    beforeEach(async () => {
        const minimumTimeDelay = isHardhat ? 10 * 60 * 60 : 15;

        serviceGovernance = await serviceGovernanceFactory
            .deploy(gateway.address, governanceChain, governanceAddress.address, minimumTimeDelay, signers, threshold)
            .then((d) => d.deployed());
    });

    it('should initialize the service governance with correct parameters', async () => {
        expect(await serviceGovernance.gateway()).to.equal(gateway.address);
        expect(await serviceGovernance.governanceChain()).to.equal(governanceChain);
        expect(await serviceGovernance.governanceAddress()).to.equal(governanceAddress.address);
        expect(await serviceGovernance.signerThreshold()).to.equal(threshold);
        expect(await serviceGovernance.signerAccounts()).to.deep.equal(signers);
    });

    it('should revert on invalid command', async () => {
        const commandID = 4;
        const target = targetContract.address;
        const nativeValue = 100;

        const [payload] = await getPayloadAndProposalHash(commandID, target, nativeValue, calldata, timeDelay);

        await expect(
            serviceGovernance.execute(govCommandID, governanceChain, governanceAddress.address, payload),
        ).to.be.revertedWithCustomError(serviceGovernance, 'InvalidCommand');
    });

    it('should schedule a proposal', async () => {
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

        await expect(serviceGovernance.execute(govCommandID, governanceChain, governanceAddress.address, payload))
            .to.emit(serviceGovernance, 'ProposalScheduled')
            .withArgs(proposalHash, target, calldata, nativeValue, eta);
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

        await expect(serviceGovernance.execute(govCommandID, governanceChain, governanceAddress.address, payload))
            .to.emit(serviceGovernance, 'ProposalScheduled')
            .withArgs(proposalHash, target, calldata, nativeValue, eta);

        const cancelPayload = defaultAbiCoder.encode(
            ['uint256', 'address', 'bytes', 'uint256', 'uint256'],
            [commandIDCancel, target, calldata, nativeValue, eta],
        );

        await expect(serviceGovernance.execute(govCommandID, governanceChain, governanceAddress.address, cancelPayload))
            .to.emit(serviceGovernance, 'ProposalCancelled')
            .withArgs(proposalHash, target, calldata, nativeValue, eta);
    });

    it('should approve a multisig proposal', async () => {
        const commandID = 2;
        const target = targetContract.address;
        const nativeValue = 100;

        const [payload, proposalHash] = await getPayloadAndProposalHash(commandID, target, nativeValue, calldata);

        await expect(serviceGovernance.execute(govCommandID, governanceChain, governanceAddress.address, payload))
            .to.emit(serviceGovernance, 'MultisigApproved')
            .withArgs(proposalHash, target, calldata, nativeValue);
    });

    it('should return whether or not a multisig proposal is approved', async () => {
        const commandID = 2;
        const target = targetContract.address;
        const nativeValue = 100;

        const [payload, proposalHash] = await getPayloadAndProposalHash(commandID, target, nativeValue, calldata);

        let isApproved = await serviceGovernance.isMultisigProposalApproved(target, calldata, nativeValue);
        expect(isApproved).to.be.false;

        await expect(serviceGovernance.execute(govCommandID, governanceChain, governanceAddress.address, payload))
            .to.emit(serviceGovernance, 'MultisigApproved')
            .withArgs(proposalHash, target, calldata, nativeValue);

        isApproved = await serviceGovernance.isMultisigProposalApproved(target, calldata, nativeValue);
        expect(isApproved).to.be.true;
    });

    it('should re-approve a multisig proposal after cancelling it', async () => {
        const commandID = 2;
        const commandIDCancel = 3;
        const target = targetContract.address;
        const nativeValue = 100;

        const [payload, proposalHash] = await getPayloadAndProposalHash(commandID, target, nativeValue, calldata);

        const payloadCancel = defaultAbiCoder.encode(
            ['uint256', 'address', 'bytes', 'uint256', 'uint256'],
            [commandIDCancel, target, calldata, nativeValue, 0],
        );

        await expect(serviceGovernance.execute(govCommandID, governanceChain, governanceAddress.address, payload))
            .to.emit(serviceGovernance, 'MultisigApproved')
            .withArgs(proposalHash, target, calldata, nativeValue);

        await expect(serviceGovernance.execute(govCommandID, governanceChain, governanceAddress.address, payloadCancel))
            .to.emit(serviceGovernance, 'MultisigCancelled')
            .withArgs(proposalHash, target, calldata, nativeValue);

        await expect(serviceGovernance.execute(govCommandID, governanceChain, governanceAddress.address, payload))
            .to.emit(serviceGovernance, 'MultisigApproved')
            .withArgs(proposalHash, target, calldata, nativeValue);
    });

    it('should revert on executing a multisig proposal if called by non-signer', async () => {
        const target = targetContract.address;

        await expect(
            serviceGovernance.connect(ownerWallet).executeMultisigProposal(target, calldata, 0),
        ).to.be.revertedWithCustomError(serviceGovernance, 'NotSigner');
    });

    it('should revert on executing a multisig proposal if proposal is not approved', async () => {
        const target = targetContract.address;

        await serviceGovernance
            .connect(signer1)
            .executeMultisigProposal(target, calldata, 0)
            .then((tx) => tx.wait());

        await expect(
            serviceGovernance.connect(signer2).executeMultisigProposal(target, calldata, 0),
        ).to.be.revertedWithCustomError(serviceGovernance, 'NotApproved');
    });

    it('should revert on executing a multisig proposal if call to target fails', async () => {
        const commandID = 2;
        const target = targetContract.address;
        const nativeValue = 0;

        // Encode function that does not exist on target
        const invalidTargetInterface = new Interface(['function set() external']);
        const invalidCalldata = invalidTargetInterface.encodeFunctionData('set');

        const [payload, proposalHash] = await getPayloadAndProposalHash(
            commandID,
            target,
            nativeValue,
            invalidCalldata,
        );

        await expect(serviceGovernance.execute(govCommandID, governanceChain, governanceAddress.address, payload))
            .to.emit(serviceGovernance, 'MultisigApproved')
            .withArgs(proposalHash, target, invalidCalldata, nativeValue);

        await serviceGovernance
            .connect(signer1)
            .executeMultisigProposal(target, invalidCalldata, nativeValue)
            .then((tx) => tx.wait());

        await expect(
            serviceGovernance.connect(signer2).executeMultisigProposal(target, invalidCalldata, nativeValue),
        ).to.be.revertedWithCustomError(serviceGovernance, 'ExecutionFailed');
    });

    it('should not execute a multisig proposal if only one signer votes', async () => {
        const commandID = 2;
        const target = targetContract.address;
        const nativeValue = 0;

        const [payload, proposalHash] = await getPayloadAndProposalHash(commandID, target, nativeValue, calldata);

        await expect(serviceGovernance.execute(govCommandID, governanceChain, governanceAddress.address, payload))
            .to.emit(serviceGovernance, 'MultisigApproved')
            .withArgs(proposalHash, target, calldata, nativeValue);

        await expect(serviceGovernance.connect(signer1).executeMultisigProposal(target, calldata, 0)).to.not.emit(
            serviceGovernance,
            'MultisigExecuted',
        );
    });

    it('should execute a multisig proposal', async () => {
        const commandID = 2;
        const target = targetContract.address;
        const nativeValue = 0;

        const [payload, proposalHash] = await getPayloadAndProposalHash(commandID, target, nativeValue, calldata);

        const msgData = serviceGovernance.interface.encodeFunctionData('executeMultisigProposal', [
            target,
            calldata,
            nativeValue,
        ]);
        const msgDataHash = keccak256(msgData);

        expect(await serviceGovernance.getSignerVotesCount(msgDataHash)).to.equal(0);
        expect(await serviceGovernance.hasSignerVoted(signer1.address, msgDataHash)).to.equal(false);

        await serviceGovernance
            .connect(signer1)
            .executeMultisigProposal(target, calldata, nativeValue)
            .then((tx) => tx.wait());

        expect(await serviceGovernance.getSignerVotesCount(msgDataHash)).to.equal(1);
        expect(await serviceGovernance.hasSignerVoted(signer1.address, msgDataHash)).to.equal(true);

        await expect(serviceGovernance.execute(govCommandID, governanceChain, governanceAddress.address, payload))
            .to.emit(serviceGovernance, 'MultisigApproved')
            .withArgs(proposalHash, target, calldata, nativeValue);

        expect(await serviceGovernance.getSignerVotesCount(msgDataHash)).to.equal(0);
        expect(await serviceGovernance.hasSignerVoted(signer1.address, msgDataHash)).to.equal(false);

        await serviceGovernance
            .connect(signer1)
            .executeMultisigProposal(target, calldata, nativeValue)
            .then((tx) => tx.wait());

        await expect(serviceGovernance.connect(signer2).executeMultisigProposal(target, calldata, nativeValue))
            .to.emit(serviceGovernance, 'MultisigExecuted')
            .withArgs(proposalHash, target, calldata, nativeValue)
            .and.to.emit(targetContract, 'TargetCalled');
    });

    it('should cancel an approved multisig proposal', async () => {
        const target = targetContract.address;
        const nativeValue = 100;

        let [payload, proposalHash] = await getPayloadAndProposalHash(2, target, nativeValue, calldata);

        await expect(serviceGovernance.execute(govCommandID, governanceChain, governanceAddress.address, payload))
            .to.emit(serviceGovernance, 'MultisigApproved')
            .withArgs(proposalHash, target, calldata, nativeValue);

        [payload, proposalHash] = await getPayloadAndProposalHash(3, target, nativeValue, calldata);

        await expect(serviceGovernance.execute(govCommandID, governanceChain, governanceAddress.address, payload))
            .to.emit(serviceGovernance, 'MultisigCancelled')
            .withArgs(proposalHash, target, calldata, nativeValue);
    });

    it('should execute a multisig proposal and increase balance of target', async () => {
        const commandID = 2;
        const target = targetContract.address;
        const nativeValue = 100;

        const [payload, proposalHash] = await getPayloadAndProposalHash(commandID, target, nativeValue, calldata);

        await expect(serviceGovernance.execute(govCommandID, governanceChain, governanceAddress.address, payload))
            .to.emit(serviceGovernance, 'MultisigApproved')
            .withArgs(proposalHash, target, calldata, nativeValue);

        await serviceGovernance
            .connect(signer1)
            .executeMultisigProposal(target, calldata, nativeValue)
            .then((tx) => tx.wait());

        await ownerWallet
            .sendTransaction({
                to: serviceGovernance.address,
                value: nativeValue,
            })
            .then((tx) => tx.wait());

        const oldBalance = await ethers.provider.getBalance(target);

        const tx = await serviceGovernance.connect(signer2).executeMultisigProposal(target, calldata, nativeValue);

        await expect(tx)
            .to.emit(serviceGovernance, 'MultisigExecuted')
            .withArgs(proposalHash, target, calldata, nativeValue)
            .and.to.emit(targetContract, 'TargetCalled');

        const newBalance = await ethers.provider.getBalance(target);
        expect(newBalance).to.equal(oldBalance.add(nativeValue));
    });

    it('should preserve the bytecode [ @skip-on-coverage ]', async () => {
        const bytecode = serviceGovernanceFactory.bytecode;
        const bytecodeHash = keccak256(bytecode);

        const expected = {
            istanbul: '0x319301da0b03f0811bc506a7c251a4a8277de0959a64485ee834b4e33c6be302',
            berlin: '0x9528162b0e350e8bc3d181949c8b91e41750a7e8740b4b3d69edb49ff1e7e2b1',
            london: '0xb763a5922bb74458426c83bea5205fd371418c220d896f9f1e500841c6134904',
        }[getEVMVersion()];

        expect(bytecodeHash).to.be.equal(expected);
    });
});
