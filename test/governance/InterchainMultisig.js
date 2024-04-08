const chai = require('chai');
const { ethers, network } = require('hardhat');
const { sortBy } = require('lodash');
const { expectRevert } = require('../utils');
const { getWeightedSignersProof, encodeInterchainCallsBatch } = require('../../scripts/utils');
const {
    constants: { AddressZero },
    utils: { keccak256, formatBytes32String },
} = ethers;
const { expect } = chai;

describe('InterchainMultisig', () => {
    const threshold = 2;
    const nativeValue = 100;
    const domainSeparator = formatBytes32String('0x');

    let wallets;
    let owner;
    let signers;
    let newSigners = [];
    let weightedSigners;

    let interchainMultisigFactory;
    let interchainMultisig;
    let targetFactory;
    let targetContract;
    let calldata;

    const executeCalls = async (batchId, calls, txOptions = {}) => {
        const proof = await getWeightedSignersProof(
            encodeInterchainCallsBatch(batchId, calls),
            domainSeparator,
            weightedSigners,
            signers,
        );

        return interchainMultisig.executeCalls(batchId, calls, proof, txOptions);
    };

    before(async () => {
        wallets = await ethers.getSigners();

        owner = wallets[0];
        signers = sortBy(wallets.slice(1, 3), (wallet) => wallet.address.toLowerCase());
        newSigners = sortBy(wallets.slice(0, 2), (wallet) => wallet.address.toLowerCase());
        weightedSigners = {
            signers: signers.map(({ address }) => {
                return { signer: address, weight: 1 };
            }),
            threshold,
            nonce: formatBytes32String('0'),
        };

        interchainMultisigFactory = await ethers.getContractFactory('InterchainMultisig', owner);
        targetFactory = await ethers.getContractFactory('Target', owner);

        // new multisig and target contracts for each test
        interchainMultisig = await interchainMultisigFactory.deploy('Ethereum', domainSeparator, weightedSigners);
        await interchainMultisig.deployTransaction.wait(network.config.confirmations);

        targetContract = await targetFactory.deploy().then((d) => d.deployed());

        calldata = targetContract.interface.encodeFunctionData('callTarget');
    });

    it('should validate storage constants', async () => {
        const testMultisigFactory = await ethers.getContractFactory('TestInterchainMultisig', owner);

        await testMultisigFactory.deploy('Ethereum', domainSeparator, weightedSigners);
    });

    it('should revert on invalid chain name', async () => {
        await expectRevert(
            async (gasOptions) => interchainMultisigFactory.deploy('', domainSeparator, weightedSigners, gasOptions),
            interchainMultisigFactory,
            'InvalidChainName',
        );
    });

    it('should revert on execute with insufficient value sent', async () => {
        const call = ['Ethereum', interchainMultisig.address, targetContract.address, calldata, nativeValue];

        await expectRevert(
            async (gasOptions) => executeCalls(formatBytes32String('5'), [call], gasOptions),
            interchainMultisig,
            'InsufficientBalance',
        );
    });

    it('should revert on execute if call to target fails', async () => {
        // Invalid function selector that does not exist on target
        const invalidCalldata = '0x12345678';

        const call = ['Ethereum', interchainMultisig.address, targetContract.address, invalidCalldata, nativeValue];

        await expectRevert(
            async (gasOptions) =>
                executeCalls(formatBytes32String('6'), [call], {
                    ...gasOptions,
                    value: nativeValue,
                }),
            interchainMultisig,
            'ExecutionFailed',
        );
    });

    it('should revert if onlySelf methods are called directly', async () => {
        await expectRevert(
            async (gasOptions) => interchainMultisig.rotateSigners(weightedSigners, gasOptions),
            interchainMultisig,
            'NotSelf',
        );

        await expectRevert(
            async (gasOptions) => interchainMultisig.withdraw(owner.address, 100, gasOptions),
            interchainMultisig,
            'NotSelf',
        );

        await expectRevert(async (gasOptions) => interchainMultisig.noop(gasOptions), interchainMultisig, 'NotSelf');
    });

    it('should revert on invalid withdraw', async () => {
        const recipient = signers[0].address;

        const call = [
            'Ethereum',
            interchainMultisig.address,
            interchainMultisig.address,
            interchainMultisig.interface.encodeFunctionData('withdraw', [recipient, nativeValue]),
            0,
        ];
        const invalidCall = [
            'Ethereum',
            interchainMultisig.address,
            interchainMultisig.address,
            interchainMultisig.interface.encodeFunctionData('withdraw', [AddressZero, nativeValue]),
            0,
        ];

        await expectRevert(
            async (gasOptions) => executeCalls(formatBytes32String('7'), [call], gasOptions),
            interchainMultisig,
            'ExecutionFailed',
        );

        await expectRevert(
            async (gasOptions) => executeCalls(formatBytes32String('7'), [invalidCall], gasOptions),
            interchainMultisig,
            'ExecutionFailed',
        );
    });

    it('should not execute if different chain or executor', async () => {
        const call1 = ['Ethereum', targetContract.address, targetContract.address, calldata, nativeValue];
        const call2 = ['Polygon', interchainMultisig.address, targetContract.address, calldata, nativeValue];

        await expectRevert(
            async (gasOptions) =>
                executeCalls(formatBytes32String('7'), [call1], {
                    ...gasOptions,
                    value: nativeValue,
                }),
            interchainMultisig,
            'EmptyBatch',
        );

        await expectRevert(
            async (gasOptions) =>
                executeCalls(formatBytes32String('8'), [call2], {
                    ...gasOptions,
                    value: nativeValue,
                }),
            interchainMultisig,
            'EmptyBatch',
        );
    });

    it('should not execute same batch twice', async () => {
        const call = ['Ethereum', interchainMultisig.address, targetContract.address, calldata, nativeValue];

        expect(await interchainMultisig.isBatchExecuted(formatBytes32String('9'))).to.be.equal(false);

        await expect(
            executeCalls(formatBytes32String('9'), [call], {
                value: nativeValue,
            }),
        ).to.emit(targetContract, 'TargetCalled');

        expect(await interchainMultisig.isBatchExecuted(formatBytes32String('9'))).to.be.equal(true);

        await expectRevert(
            async (gasOptions) =>
                executeCalls(formatBytes32String('9'), [call], {
                    ...gasOptions,
                    value: nativeValue,
                }),
            interchainMultisig,
            'AlreadyExecuted',
        );
    });

    it('should execute function on target contract', async () => {
        const calls = [
            ['Ethereum', interchainMultisig.address, targetContract.address, calldata, nativeValue],
            ['Optimism', interchainMultisig.address, targetContract.address, calldata, nativeValue],
        ];
        const batchId = formatBytes32String('10');
        const dataHash = keccak256(encodeInterchainCallsBatch(batchId, calls));
        const proof = await getWeightedSignersProof(
            encodeInterchainCallsBatch(batchId, calls),
            domainSeparator,
            weightedSigners,
            signers,
        );

        expect(await interchainMultisig.validateProof(dataHash, proof)).to.be.true;

        await expect(
            await executeCalls(batchId, calls, {
                value: nativeValue,
            }),
        )
            .to.emit(targetContract, 'TargetCalled')
            .and.to.emit(interchainMultisig, 'CallExecuted')
            .withArgs(formatBytes32String('10'), targetContract.address, calldata, nativeValue)
            .and.to.emit(interchainMultisig, 'BatchExecuted')
            .withArgs(batchId, dataHash, 1, 2);
    });

    it('should withdraw native value', async () => {
        const recipient = signers[0].address;

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

        await executeCalls(formatBytes32String('11'), [call]).then((tx) => tx.wait());

        const newBalance = await ethers.provider.getBalance(recipient);
        expect(newBalance).to.equal(oldBalance.add(nativeValue));
    });

    it('should void a batch id', async () => {
        const call = [
            'Ethereum',
            interchainMultisig.address,
            interchainMultisig.address,
            interchainMultisig.interface.encodeFunctionData('noop'),
            0,
        ];
        const anotherCall = [
            'Ethereum',
            interchainMultisig.address,
            interchainMultisig.address,
            interchainMultisig.interface.encodeFunctionData('withdraw', [signers[0].address, 0]),
            0,
        ];

        await executeCalls(formatBytes32String('24'), [call]).then((tx) => tx.wait());

        await expectRevert(
            async (gasOptions) => executeCalls(formatBytes32String('24'), [anotherCall], gasOptions),
            interchainMultisig,
            'AlreadyExecuted',
        );
    });

    it('should rotate signers', async () => {
        const newWeightedSigners = {
            signers: newSigners.map(({ address }) => {
                return { signer: address, weight: 1 };
            }),
            threshold,
            nonce: formatBytes32String('0'),
        };
        const call = [
            'Ethereum',
            interchainMultisig.address,
            interchainMultisig.address,
            interchainMultisig.interface.encodeFunctionData('rotateSigners', [newWeightedSigners]),
            0,
        ];

        await expect(executeCalls(formatBytes32String('21'), [call])).to.emit(interchainMultisig, 'SignersRotated');

        await expectRevert(
            async (gasOptions) => executeCalls(formatBytes32String('22'), [call], gasOptions),
            interchainMultisig,
            'InvalidSigners',
        );
    });
});
