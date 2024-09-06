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
    let operator;

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
    const ApproveOperatorProposal = 2;
    const CancelOperatorApproval = 3;
    const InvalidCommand = 4;

    before(async () => {
        [ownerWallet, governanceAddress, operator] = await ethers.getSigners();

        serviceGovernanceFactory = await ethers.getContractFactory('AxelarServiceGovernance', ownerWallet);
        targetFactory = await ethers.getContractFactory('Target', ownerWallet);

        const mockGatewayFactory = await ethers.getContractFactory('MockGatewayValidation', ownerWallet);
        gateway = await mockGatewayFactory.deploy().then((d) => d.deployed());

        targetContract = await targetFactory.deploy().then((d) => d.deployed());
        target = targetContract.address;

        targetInterface = new ethers.utils.Interface(targetContract.interface.fragments);
        calldata = targetInterface.encodeFunctionData('callTarget');

        serviceGovernance = await serviceGovernanceFactory
            .deploy(gateway.address, governanceChain, governanceAddress.address, minimumTimeDelay, operator.address)
            .then((d) => d.deployed());
    });

    it('should initialize the service governance with correct parameters', async () => {
        expect(await serviceGovernance.gateway()).to.equal(gateway.address);
        expect(await serviceGovernance.governanceChain()).to.equal(governanceChain);
        expect(await serviceGovernance.governanceAddress()).to.equal(governanceAddress.address);
        expect(await serviceGovernance.operator()).to.equal(operator.address);
    });

    it('should revert on invalid operator address', async () => {
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
            'InvalidOperator',
        );
    });

    it('should revert on invalid operator transfer', async () => {
        await expectRevert(
            async (gasOptions) => serviceGovernance.connect(operator).transferOperatorship(AddressZero, gasOptions),
            serviceGovernance,
            'InvalidOperator',
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

    it('should approve a operator proposal', async () => {
        const govCommandID = formatBytes32String('4');
        const nativeValue = 400;

        const [payload, proposalHash] = await getPayloadAndProposalHash(
            ApproveOperatorProposal,
            target,
            nativeValue,
            calldata,
        );

        await expect(serviceGovernance.execute(govCommandID, governanceChain, governanceAddress.address, payload))
            .to.emit(serviceGovernance, 'OperatorProposalApproved')
            .withArgs(proposalHash, target, calldata, nativeValue);
    });

    it('should return whether or not a operator proposal is approved', async () => {
        const govCommandID = formatBytes32String('5');
        const nativeValue = 500;

        const [payload, proposalHash] = await getPayloadAndProposalHash(
            ApproveOperatorProposal,
            target,
            nativeValue,
            calldata,
        );

        let isApproved = await serviceGovernance.isOperatorProposalApproved(target, calldata, nativeValue);
        expect(isApproved).to.be.false;

        await expect(serviceGovernance.execute(govCommandID, governanceChain, governanceAddress.address, payload))
            .to.emit(serviceGovernance, 'OperatorProposalApproved')
            .withArgs(proposalHash, target, calldata, nativeValue);

        isApproved = await serviceGovernance.isOperatorProposalApproved(target, calldata, nativeValue);
        expect(isApproved).to.be.true;
    });

    it('should re-approve a operator proposal after cancelling it', async () => {
        const govCommandID = formatBytes32String('6');
        const nativeValue = 600;

        const [payload, proposalHash] = await getPayloadAndProposalHash(
            ApproveOperatorProposal,
            target,
            nativeValue,
            calldata,
        );

        const payloadCancel = defaultAbiCoder.encode(
            ['uint256', 'address', 'bytes', 'uint256', 'uint256'],
            [CancelOperatorApproval, target, calldata, nativeValue, 0],
        );

        await expect(serviceGovernance.execute(govCommandID, governanceChain, governanceAddress.address, payload))
            .to.emit(serviceGovernance, 'OperatorProposalApproved')
            .withArgs(proposalHash, target, calldata, nativeValue);

        await expect(serviceGovernance.execute(govCommandID, governanceChain, governanceAddress.address, payloadCancel))
            .to.emit(serviceGovernance, 'OperatorProposalCancelled')
            .withArgs(proposalHash, target, calldata, nativeValue);

        await expect(serviceGovernance.execute(govCommandID, governanceChain, governanceAddress.address, payload))
            .to.emit(serviceGovernance, 'OperatorProposalApproved')
            .withArgs(proposalHash, target, calldata, nativeValue);
    });

    it('should revert on executing a operator proposal if called by non-operator', async () => {
        await expectRevert(
            async (gasOptions) =>
                serviceGovernance.connect(ownerWallet).executeOperatorProposal(target, calldata, 0, gasOptions),
            serviceGovernance,
            'NotAuthorized',
        );
    });

    it('should revert on executing a operator proposal if proposal is not approved', async () => {
        await expectRevert(
            async (gasOptions) =>
                serviceGovernance.connect(operator).executeOperatorProposal(target, calldata, 0, gasOptions),
            serviceGovernance,
            'NotApproved',
        );
    });

    it('should revert on executing a operator proposal if call to target fails', async () => {
        const ApproveOperatorProposal = 2;
        const govCommandID = formatBytes32String('7');
        const nativeValue = 700;

        // Encode function that does not exist on target
        const invalidTargetInterface = new Interface(['function set() external']);
        const invalidCalldata = invalidTargetInterface.encodeFunctionData('set');

        const [payload, proposalHash] = await getPayloadAndProposalHash(
            ApproveOperatorProposal,
            target,
            nativeValue,
            invalidCalldata,
        );

        await expect(serviceGovernance.execute(govCommandID, governanceChain, governanceAddress.address, payload))
            .to.emit(serviceGovernance, 'OperatorProposalApproved')
            .withArgs(proposalHash, target, invalidCalldata, nativeValue);

        await expectRevert(
            async (gasOptions) =>
                serviceGovernance.connect(operator).executeOperatorProposal(target, invalidCalldata, nativeValue, {
                    value: nativeValue,
                    ...gasOptions,
                }),
            serviceGovernance,
            'ExecutionFailed',
        );
    });

    it('should execute a operator proposal', async () => {
        const govCommandID = formatBytes32String('8');
        const nativeValue = 800;

        const [payload, proposalHash] = await getPayloadAndProposalHash(
            ApproveOperatorProposal,
            target,
            nativeValue,
            calldata,
        );

        await expect(serviceGovernance.execute(govCommandID, governanceChain, governanceAddress.address, payload))
            .to.emit(serviceGovernance, 'OperatorProposalApproved')
            .withArgs(proposalHash, target, calldata, nativeValue);

        await expect(
            serviceGovernance
                .connect(operator)
                .executeOperatorProposal(target, calldata, nativeValue, { value: nativeValue }),
        )
            .to.emit(serviceGovernance, 'OperatorProposalExecuted')
            .withArgs(proposalHash, target, calldata, nativeValue)
            .and.to.emit(targetContract, 'TargetCalled');
    });

    it('should cancel an approved operator proposal', async () => {
        const govCommandID = formatBytes32String('9');
        const nativeValue = 900;

        let [payload, proposalHash] = await getPayloadAndProposalHash(
            ApproveOperatorProposal,
            target,
            nativeValue,
            calldata,
        );

        await expect(serviceGovernance.execute(govCommandID, governanceChain, governanceAddress.address, payload))
            .to.emit(serviceGovernance, 'OperatorProposalApproved')
            .withArgs(proposalHash, target, calldata, nativeValue);

        [payload, proposalHash] = await getPayloadAndProposalHash(
            CancelOperatorApproval,
            target,
            nativeValue,
            calldata,
        );

        await expect(serviceGovernance.execute(govCommandID, governanceChain, governanceAddress.address, payload))
            .to.emit(serviceGovernance, 'OperatorProposalCancelled')
            .withArgs(proposalHash, target, calldata, nativeValue);
    });

    it('should execute a operator proposal and increase balance of target', async () => {
        const govCommandID = formatBytes32String('10');
        const nativeValue = 1000;

        const [payload, proposalHash] = await getPayloadAndProposalHash(
            ApproveOperatorProposal,
            target,
            nativeValue,
            calldata,
        );

        await expect(serviceGovernance.execute(govCommandID, governanceChain, governanceAddress.address, payload))
            .to.emit(serviceGovernance, 'OperatorProposalApproved')
            .withArgs(proposalHash, target, calldata, nativeValue);

        await ownerWallet
            .sendTransaction({
                to: serviceGovernance.address,
                value: nativeValue,
            })
            .then((tx) => tx.wait());

        const oldBalance = await ethers.provider.getBalance(target);

        const tx = await serviceGovernance.connect(operator).executeOperatorProposal(target, calldata, nativeValue);

        await expect(tx)
            .to.emit(serviceGovernance, 'OperatorProposalExecuted')
            .withArgs(proposalHash, target, calldata, nativeValue)
            .and.to.emit(targetContract, 'TargetCalled');

        const newBalance = await ethers.provider.getBalance(target);
        expect(newBalance).to.equal(oldBalance.add(nativeValue));
    });

    it('should transfer operator address to new address', async () => {
        const newOperator = governanceAddress.address;
        await expect(serviceGovernance.connect(operator).transferOperatorship(newOperator))
            .to.emit(serviceGovernance, 'OperatorshipTransferred')
            .withArgs(operator.address, newOperator);
        await expect(await serviceGovernance.operator()).to.equal(newOperator);

        await expectRevert(
            async (gasOptions) => serviceGovernance.connect(operator).transferOperatorship(newOperator, gasOptions),
            serviceGovernance,
            'NotAuthorized',
        );
    });

    it('should transfer operatorship by a governance proposal', async () => {
        const govCommandID = formatBytes32String('10');
        const newOperator = serviceGovernance.address;
        const transferCalldata = serviceGovernance.interface.encodeFunctionData('transferOperatorship', [newOperator]);

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
            .and.to.emit(serviceGovernance, 'OperatorshipTransferred')
            .withArgs(governanceAddress.address, newOperator);

        await expect(await serviceGovernance.operator()).to.equal(newOperator);

        await expectRevert(
            async (gasOptions) =>
                serviceGovernance.connect(governanceAddress).transferOperatorship(newOperator, gasOptions),
            serviceGovernance,
            'NotAuthorized',
        );
    });

    it('should preserve the bytecode [ @skip-on-coverage ]', async () => {
        const bytecode = serviceGovernanceFactory.bytecode;
        const bytecodeHash = keccak256(bytecode);

        const expected = {
            london: '0x87891d8e17e62bddae5afa47c6231b236207b7c9cfff0810bc62b226a3765600',
        }[getEVMVersion()];

        expect(bytecodeHash).to.be.equal(expected);
    });
});
