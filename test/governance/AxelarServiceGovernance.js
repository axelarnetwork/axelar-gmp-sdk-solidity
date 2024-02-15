'use strict';

const chai = require('chai');
const { ethers } = require('hardhat');
const {
    utils: { defaultAbiCoder, Interface, keccak256 },
    constants: { HashZero },
} = ethers;
const { expect } = chai;
const { isHardhat, getPayloadAndProposalHash, getEVMVersion, expectRevert } = require('../utils');

describe('AxelarServiceGovernance', () => {
    let ownerWallet;
    let governanceAddress;
    let gateway;
    let multisig;

    let serviceGovernanceFactory;
    let serviceGovernance;
    const govCommandID = HashZero;

    let targetFactory;
    let targetContract;

    let targetInterface;
    let calldata;

    const governanceChain = 'Governance Chain';
    const timeDelay = isHardhat ? 12 * 60 * 60 : 45;

    before(async () => {
        [ownerWallet, governanceAddress, multisig] = await ethers.getSigners();

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
            .deploy(gateway.address, governanceChain, governanceAddress.address, minimumTimeDelay, multisig.address)
            .then((d) => d.deployed());
    });

    it('should initialize the service governance with correct parameters', async () => {
        expect(await serviceGovernance.gateway()).to.equal(gateway.address);
        expect(await serviceGovernance.governanceChain()).to.equal(governanceChain);
        expect(await serviceGovernance.governanceAddress()).to.equal(governanceAddress.address);
        expect(await serviceGovernance.multisig()).to.equal(multisig.address);
    });

    it('should revert on invalid command', async () => {
        const commandID = 4;
        const target = targetContract.address;
        const nativeValue = 100;

        const [payload] = await getPayloadAndProposalHash(commandID, target, nativeValue, calldata, timeDelay);

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

    it('should revert on executing a multisig proposal if called by non-multisig', async () => {
        const target = targetContract.address;

        await expectRevert(
            async (gasOptions) =>
                serviceGovernance.connect(ownerWallet).executeMultisigProposal(target, calldata, 0, gasOptions),
            serviceGovernance,
            'NotAuthorized',
        );
    });

    it('should revert on executing a multisig proposal if proposal is not approved', async () => {
        const target = targetContract.address;

        await expectRevert(
            async (gasOptions) =>
                serviceGovernance.connect(multisig).executeMultisigProposal(target, calldata, 0, gasOptions),
            serviceGovernance,
            'NotApproved',
        );
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

        await expectRevert(
            async (gasOptions) =>
                serviceGovernance
                    .connect(multisig)
                    .executeMultisigProposal(target, invalidCalldata, nativeValue, gasOptions),
            serviceGovernance,
            'ExecutionFailed',
        );
    });

    it('should execute a multisig proposal', async () => {
        const commandID = 2;
        const target = targetContract.address;
        const nativeValue = 0;

        const [payload, proposalHash] = await getPayloadAndProposalHash(commandID, target, nativeValue, calldata);

        await expect(serviceGovernance.execute(govCommandID, governanceChain, governanceAddress.address, payload))
            .to.emit(serviceGovernance, 'MultisigApproved')
            .withArgs(proposalHash, target, calldata, nativeValue);

        await expect(serviceGovernance.connect(multisig).executeMultisigProposal(target, calldata, nativeValue))
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

    it('should trasfer multisig address to new address', async () => {
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

    it('should preserve the bytecode [ @skip-on-coverage ]', async () => {
        const bytecode = serviceGovernanceFactory.bytecode;
        const bytecodeHash = keccak256(bytecode);

        const expected = {
            istanbul: '0x822333c15344149010ff8a33bb12d460681c7585d302e367820efbddc09bbf0e',
            berlin: '0x60dcb279614f8daf90b85ccf0418299eeda348b5b912c962f716a875e2dea99f',
            london: '0xc698cd3f78aad337f11d2711ab771f548e6e43b279f5d6420563a633edec0f90',
        }[getEVMVersion()];

        expect(bytecodeHash).to.be.equal(expected);
    });
});
