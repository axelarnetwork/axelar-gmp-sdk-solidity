const chai = require('chai');
const { ethers, network } = require('hardhat');
const { sortBy } = require('lodash');
const { getAddresses, encodeInterchainCallsBatch, getWeightedSignaturesProof } = require('../utils');
const {
    utils: { Interface },
} = ethers;
const { expect } = chai;

describe('InterchainMultisig', () => {
    const threshold = 2;

    let wallets;
    let owner;
    let signers;
    let newSigners = [];

    let interchainMultisigFactory;
    let interchainMultisig;
    let targetFactory;
    let targetContract;
    let calldata;

    before(async () => {
        wallets = await ethers.getSigners();

        owner = wallets[0];
        signers = sortBy(wallets.slice(1, 3), (wallet) => wallet.address.toLowerCase());
        newSigners = sortBy(wallets.slice(0, 2), (wallet) => wallet.address.toLowerCase());

        interchainMultisigFactory = await ethers.getContractFactory('TestInterchainMultisig', owner);
        targetFactory = await ethers.getContractFactory('Target', owner);

        const targetInterface = new Interface(['function callTarget() external']);
        calldata = targetInterface.encodeFunctionData('callTarget');
    });

    beforeEach(async () => {
        // new multisig and target contracts for each test
        interchainMultisig = await interchainMultisigFactory.deploy('Ethereum', [
            getAddresses(signers),
            signers.map(() => 1),
            threshold,
        ]);

        await interchainMultisig.deployTransaction.wait(network.config.confirmations);

        targetContract = await targetFactory.deploy().then((d) => d.deployed());
    });

    it('should revert on execute with insufficient value sent', async () => {
        const nativeValue = 100;
        const call = ['Ethereum', interchainMultisig.address, targetContract.address, calldata, nativeValue];

        await expect(
            interchainMultisig.executeCalls(
                1,
                [call],
                getWeightedSignaturesProof(
                    encodeInterchainCallsBatch(1, [call]),
                    signers,
                    signers.map(() => 1),
                    2,
                    signers,
                ),
            ),
        ).to.be.revertedWithCustomError(interchainMultisig, 'InsufficientBalance');
    });

    it('should revert on execute if call to target fails', async () => {
        // Invalid function selector that does not exist on target
        const invalidCalldata = '0x12345678';
        const nativeValue = 100;
        const call = ['Ethereum', interchainMultisig.address, targetContract.address, invalidCalldata, nativeValue];

        await expect(
            interchainMultisig.executeCalls(
                1,
                [call],
                getWeightedSignaturesProof(
                    encodeInterchainCallsBatch(1, [call]),
                    signers,
                    signers.map(() => 1),
                    2,
                    signers,
                ),
                {
                    value: nativeValue,
                },
            ),
        ).to.be.revertedWithCustomError(interchainMultisig, 'ExecutionFailed');
    });

    it('should not execute if different chain or executor', async () => {
        const nativeValue = 100;
        const call1 = ['Ethereum', targetContract.address, targetContract.address, calldata, nativeValue];
        const call2 = ['Polygon', interchainMultisig.address, targetContract.address, calldata, nativeValue];

        await expect(
            interchainMultisig.executeCalls(
                1,
                [call1],
                getWeightedSignaturesProof(
                    encodeInterchainCallsBatch(1, [call1]),
                    signers,
                    signers.map(() => 1),
                    2,
                    signers,
                ),
                {
                    value: nativeValue,
                },
            ),
        ).not.to.emit(targetContract, 'TargetCalled');

        await expect(
            interchainMultisig.executeCalls(
                2,
                [call2],
                getWeightedSignaturesProof(
                    encodeInterchainCallsBatch(2, [call2]),
                    signers,
                    signers.map(() => 1),
                    2,
                    signers,
                ),
                {
                    value: nativeValue,
                },
            ),
        ).not.to.emit(targetContract, 'TargetCalled');
    });

    it('should not execute same batch twice', async () => {
        const nativeValue = 100;
        const call = ['Ethereum', interchainMultisig.address, targetContract.address, calldata, nativeValue];

        await expect(
            interchainMultisig.executeCalls(
                1,
                [call],
                getWeightedSignaturesProof(
                    encodeInterchainCallsBatch(1, [call]),
                    signers,
                    signers.map(() => 1),
                    2,
                    signers,
                ),
                {
                    value: nativeValue,
                },
            ),
        ).to.emit(targetContract, 'TargetCalled');

        await expect(
            interchainMultisig.executeCalls(
                1,
                [call],
                getWeightedSignaturesProof(
                    encodeInterchainCallsBatch(1, [call]),
                    signers,
                    signers.map(() => 1),
                    2,
                    signers,
                ),
                {
                    value: nativeValue,
                },
            ),
        ).to.be.revertedWithCustomError(interchainMultisig, 'AlreadyExecuted');
    });

    it('should execute function on target contract', async () => {
        const nativeValue = 100;
        const call = ['Ethereum', interchainMultisig.address, targetContract.address, calldata, nativeValue];

        await expect(
            await interchainMultisig.executeCalls(
                1,
                [call],
                getWeightedSignaturesProof(
                    encodeInterchainCallsBatch(1, [call]),
                    signers,
                    signers.map(() => 1),
                    2,
                    signers,
                ),
                {
                    value: nativeValue,
                },
            ),
        ).to.emit(targetContract, 'TargetCalled');
    });

    it('should withdraw native value', async () => {
        const recipient = signers[0].address;
        const nativeValue = 100;
        const call = [
            'Ethereum',
            interchainMultisig.address,
            interchainMultisig.address,
            interchainMultisig.interface.encodeFunctionData('withdraw', [recipient, nativeValue]),
            0,
        ];

        await owner
            .sendTransaction({
                to: interchainMultisig.address,
                value: nativeValue,
            })
            .then((tx) => tx.wait());

        const oldBalance = await ethers.provider.getBalance(recipient);

        await interchainMultisig.executeCalls(
            1,
            [call],
            getWeightedSignaturesProof(
                encodeInterchainCallsBatch(1, [call]),
                signers,
                signers.map(() => 1),
                2,
                signers,
            ),
        );

        const newBalance = await ethers.provider.getBalance(recipient);
        expect(newBalance).to.equal(oldBalance.add(nativeValue));
    });

    it('should rotate signers', async () => {
        const call = [
            'Ethereum',
            interchainMultisig.address,
            interchainMultisig.address,
            interchainMultisig.interface.encodeFunctionData('rotateSigners', [
                [getAddresses(newSigners), newSigners.map(() => 1), threshold],
            ]),
            0,
        ];

        await expect(
            interchainMultisig.executeCalls(
                1,
                [call],
                getWeightedSignaturesProof(
                    encodeInterchainCallsBatch(1, [call]),
                    signers,
                    signers.map(() => 1),
                    2,
                    signers,
                ),
            ),
        ).to.emit(interchainMultisig, 'SignersRotated');
    });
});
