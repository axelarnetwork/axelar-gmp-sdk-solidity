'use strict';

const chai = require('chai');
const { ethers } = require('hardhat');
const {
    utils: { defaultAbiCoder, Interface, keccak256, formatBytes32String },
    constants: { AddressZero },
} = ethers;
const { expect } = chai;
const { isHardhat, getPayloadAndProposalHash, getEVMVersion, expectRevert, waitFor } = require('../utils');

describe('AxelarServiceGovernance', () => {
    let ownerWallet;
    let governanceAddress;
    let gateway;
    let multisig;

    let serviceGovernanceFactory;
    let serviceGovernance;

    let targetFactory;
    let targetContract;
    let target;

    let targetInterface;
    let calldata;

    const governanceChain = 'Governance Chain';
    const minimumTimeDelay = isHardhat ? 10 * 60 * 60 : 15;
    const timeDelay = isHardhat ? 12 * 60 * 60 : 45;

    const ScheduleTimeLockProposal = 0;
    const CancelTimeLockProposal = 1;
    const ApproveMultisigProposal = 2;
    const CancelMultisigApproval = 3;
    const InvalidCommand = 4;

    before(async () => {
        [ownerWallet, governanceAddress, multisig] = await ethers.getSigners();

        serviceGovernanceFactory = await ethers.getContractFactory('AxelarServiceGovernance', ownerWallet);
        targetFactory = await ethers.getContractFactory('Target', ownerWallet);

        const mockGatewayFactory = await ethers.getContractFactory('MockGatewayValidation', ownerWallet);
        gateway = await mockGatewayFactory.deploy().then((d) => d.deployed());

        targetContract = await targetFactory.deploy().then((d) => d.deployed());
        target = targetContract.address;

        targetInterface = new ethers.utils.Interface(targetContract.interface.fragments);
        calldata = targetInterface.encodeFunctionData('callTarget');

        serviceGovernance = await serviceGovernanceFactory
            .deploy(gateway.address, governanceChain, governanceAddress.address, minimumTimeDelay, multisig.address)
            .then((d) => d.deployed());
    });

    it('should initialize the service governance with correct parameters', async () => {
        expect(await serviceGovernance.gateway()).to.equal(gateway.address);
        expect(await serviceGovernance.governanceChain()).to.equal(governanceChain);
        expect(await serviceGovernance.governanceAddress()).to.equal(governanceAddress.address);
        expect(await serviceGovernance.multisig()).to.equal(multisig.address);
    });

    it('should revert on invalid multisig address', async () => {
        await expectRevert(
            async (gasOptions) =>
                serviceGovernanceFactory.deploy(
                    gateway.address,
                    governanceChain,
                    governanceAddress.address,
                    minimumTimeDelay,
                    AddressZero,
                    gasOptions,
                ),
            serviceGovernanceFactory,
            'InvalidMultisigAddress',
        );
    });

    it('should revert on invalid multisig transfer', async () => {
        await expectRevert(
            async (gasOptions) => serviceGovernance.connect(multisig).transferMultisig(AddressZero, gasOptions),
            serviceGovernance,
            'InvalidMultisigAddress',
        );
    });

    it('should revert on invalid command', async () => {
        const govCommandID = formatBytes32String('1');
        const nativeValue = 100;

        const [payload] = await getPayloadAndProposalHash(InvalidCommand, target, nativeValue, calldata, timeDelay);

        await expectRevert(
            async (gasOptions) =>
                serviceGovernance.execute(
                    govCommandID,
                    governanceChain,
                    governanceAddress.address,
                    payload,
                    gasOptions,
                ),
            serviceGovernance,
            'InvalidCommand',
        );
    });

    it('should schedule a proposal', async () => {
        const govCommandID = formatBytes32String('2');
        const nativeValue = 200;

        const [payload, proposalHash, eta] = await getPayloadAndProposalHash(
            ScheduleTimeLockProposal,
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
        const govCommandID = formatBytes32String('3');
        const nativeValue = 300;

        const [payload, proposalHash, eta] = await getPayloadAndProposalHash(
            ScheduleTimeLockProposal,
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
            [CancelTimeLockProposal, target, calldata, nativeValue, eta],
        );

        await expect(serviceGovernance.execute(govCommandID, governanceChain, governanceAddress.address, cancelPayload))
            .to.emit(serviceGovernance, 'ProposalCancelled')
            .withArgs(proposalHash, target, calldata, nativeValue, eta);
    });

    it('should approve a multisig proposal', async () => {
        const govCommandID = formatBytes32String('4');
        const nativeValue = 400;

        const [payload, proposalHash] = await getPayloadAndProposalHash(
            ApproveMultisigProposal,
            target,
            nativeValue,
            calldata,
        );

        await expect(serviceGovernance.execute(govCommandID, governanceChain, governanceAddress.address, payload))
            .to.emit(serviceGovernance, 'MultisigApproved')
            .withArgs(proposalHash, target, calldata, nativeValue);
    });

    it('should return whether or not a multisig proposal is approved', async () => {
        const govCommandID = formatBytes32String('5');
        const nativeValue = 500;

        const [payload, proposalHash] = await getPayloadAndProposalHash(
            ApproveMultisigProposal,
            target,
            nativeValue,
            calldata,
        );

        let isApproved = await serviceGovernance.isMultisigProposalApproved(target, calldata, nativeValue);
        expect(isApproved).to.be.false;

        await expect(serviceGovernance.execute(govCommandID, governanceChain, governanceAddress.address, payload))
            .to.emit(serviceGovernance, 'MultisigApproved')
            .withArgs(proposalHash, target, calldata, nativeValue);

        isApproved = await serviceGovernance.isMultisigProposalApproved(target, calldata, nativeValue);
        expect(isApproved).to.be.true;
    });

    it('should re-approve a multisig proposal after cancelling it', async () => {
        const govCommandID = formatBytes32String('6');
        const nativeValue = 600;

        const [payload, proposalHash] = await getPayloadAndProposalHash(
            ApproveMultisigProposal,
            target,
            nativeValue,
            calldata,
        );

        const payloadCancel = defaultAbiCoder.encode(
            ['uint256', 'address', 'bytes', 'uint256', 'uint256'],
            [CancelMultisigApproval, target, calldata, nativeValue, 0],
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

    it('should revert on executing a multisig proposal if called by non-multisig', async () => {
        await expectRevert(
            async (gasOptions) =>
                serviceGovernance.connect(ownerWallet).executeMultisigProposal(target, calldata, 0, gasOptions),
            serviceGovernance,
            'NotAuthorized',
        );
    });

    it('should revert on executing a multisig proposal if proposal is not approved', async () => {
        await expectRevert(
            async (gasOptions) =>
                serviceGovernance.connect(multisig).executeMultisigProposal(target, calldata, 0, gasOptions),
            serviceGovernance,
            'NotApproved',
        );
    });

    it('should revert on executing a multisig proposal if call to target fails', async () => {
        const ApproveMultisigProposal = 2;
        const govCommandID = formatBytes32String('7');
        const nativeValue = 700;

        // Encode function that does not exist on target
        const invalidTargetInterface = new Interface(['function set() external']);
        const invalidCalldata = invalidTargetInterface.encodeFunctionData('set');

        const [payload, proposalHash] = await getPayloadAndProposalHash(
            ApproveMultisigProposal,
            target,
            nativeValue,
            invalidCalldata,
        );

        await expect(serviceGovernance.execute(govCommandID, governanceChain, governanceAddress.address, payload))
            .to.emit(serviceGovernance, 'MultisigApproved')
            .withArgs(proposalHash, target, invalidCalldata, nativeValue);

        await expectRevert(
            async (gasOptions) =>
                serviceGovernance.connect(multisig).executeMultisigProposal(target, invalidCalldata, nativeValue, {
                    value: nativeValue,
                    ...gasOptions,
                }),
            serviceGovernance,
            'ExecutionFailed',
        );
    });

    it('should execute a multisig proposal', async () => {
        const govCommandID = formatBytes32String('8');
        const nativeValue = 800;

        const [payload, proposalHash] = await getPayloadAndProposalHash(
            ApproveMultisigProposal,
            target,
            nativeValue,
            calldata,
        );

        await expect(serviceGovernance.execute(govCommandID, governanceChain, governanceAddress.address, payload))
            .to.emit(serviceGovernance, 'MultisigApproved')
            .withArgs(proposalHash, target, calldata, nativeValue);

        await expect(
            serviceGovernance
                .connect(multisig)
                .executeMultisigProposal(target, calldata, nativeValue, { value: nativeValue }),
        )
            .to.emit(serviceGovernance, 'MultisigExecuted')
            .withArgs(proposalHash, target, calldata, nativeValue)
            .and.to.emit(targetContract, 'TargetCalled');
    });

    it('should cancel an approved multisig proposal', async () => {
        const govCommandID = formatBytes32String('9');
        const nativeValue = 900;

        let [payload, proposalHash] = await getPayloadAndProposalHash(
            ApproveMultisigProposal,
            target,
            nativeValue,
            calldata,
        );

        await expect(serviceGovernance.execute(govCommandID, governanceChain, governanceAddress.address, payload))
            .to.emit(serviceGovernance, 'MultisigApproved')
            .withArgs(proposalHash, target, calldata, nativeValue);

        [payload, proposalHash] = await getPayloadAndProposalHash(
            CancelMultisigApproval,
            target,
            nativeValue,
            calldata,
        );

        await expect(serviceGovernance.execute(govCommandID, governanceChain, governanceAddress.address, payload))
            .to.emit(serviceGovernance, 'MultisigCancelled')
            .withArgs(proposalHash, target, calldata, nativeValue);
    });

    it('should execute a multisig proposal and increase balance of target', async () => {
        const govCommandID = formatBytes32String('10');
        const nativeValue = 1000;

        const [payload, proposalHash] = await getPayloadAndProposalHash(
            ApproveMultisigProposal,
            target,
            nativeValue,
            calldata,
        );

        await expect(serviceGovernance.execute(govCommandID, governanceChain, governanceAddress.address, payload))
            .to.emit(serviceGovernance, 'MultisigApproved')
            .withArgs(proposalHash, target, calldata, nativeValue);

        await ownerWallet
            .sendTransaction({
                to: serviceGovernance.address,
                value: nativeValue,
            })
            .then((tx) => tx.wait());

        const oldBalance = await ethers.provider.getBalance(target);

        const tx = await serviceGovernance.connect(multisig).executeMultisigProposal(target, calldata, nativeValue);

        await expect(tx)
            .to.emit(serviceGovernance, 'MultisigExecuted')
            .withArgs(proposalHash, target, calldata, nativeValue)
            .and.to.emit(targetContract, 'TargetCalled');

        const newBalance = await ethers.provider.getBalance(target);
        expect(newBalance).to.equal(oldBalance.add(nativeValue));
    });

    it('should transfer multisig address to new address', async () => {
        const newMultisig = governanceAddress.address;
        await expect(serviceGovernance.connect(multisig).transferMultisig(newMultisig))
            .to.emit(serviceGovernance, 'MultisigTransferred')
            .withArgs(multisig.address, newMultisig);
        await expect(await serviceGovernance.multisig()).to.equal(newMultisig);

        await expectRevert(
            async (gasOptions) => serviceGovernance.connect(multisig).transferMultisig(newMultisig, gasOptions),
            serviceGovernance,
            'NotAuthorized',
        );
    });

    it('should transfer multisig by a governance proposal', async () => {
        const govCommandID = formatBytes32String('10');
        const newMultisig = serviceGovernance.address;
        const transferCalldata = serviceGovernance.interface.encodeFunctionData('transferMultisig', [newMultisig]);

        const [payload, proposalHash, eta] = await getPayloadAndProposalHash(
            ScheduleTimeLockProposal,
            serviceGovernance.address,
            0,
            transferCalldata,
            timeDelay,
        );

        await expect(serviceGovernance.execute(govCommandID, governanceChain, governanceAddress.address, payload))
            .to.emit(serviceGovernance, 'ProposalScheduled')
            .withArgs(proposalHash, serviceGovernance.address, transferCalldata, 0, eta);

        await waitFor(timeDelay);

        const tx = await serviceGovernance.executeProposal(serviceGovernance.address, transferCalldata, 0);

        const block = await ethers.provider.getBlock(tx.blockNumber);
        const executionTimestamp = block.timestamp;

        await expect(tx)
            .to.emit(serviceGovernance, 'ProposalExecuted')
            .withArgs(proposalHash, serviceGovernance.address, transferCalldata, 0, executionTimestamp)
            .and.to.emit(serviceGovernance, 'MultisigTransferred')
            .withArgs(governanceAddress.address, newMultisig);

        await expect(await serviceGovernance.multisig()).to.equal(newMultisig);

        await expectRevert(
            async (gasOptions) =>
                serviceGovernance.connect(governanceAddress).transferMultisig(newMultisig, gasOptions),
            serviceGovernance,
            'NotAuthorized',
        );
    });

    it('should preserve the bytecode [ @skip-on-coverage ]', async () => {
        const bytecode = serviceGovernanceFactory.bytecode;
        const bytecodeHash = keccak256(bytecode);

        const expected = {
            london: '0x5e40ac38c1162aa207054ab1f4d6f9205cdde1627f644eb6dfdb0fbfe17445fd',
        }[getEVMVersion()];

        expect(bytecodeHash).to.be.equal(expected);
    });
});
