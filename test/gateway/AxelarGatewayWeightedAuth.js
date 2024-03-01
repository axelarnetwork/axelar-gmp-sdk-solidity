const { sortBy } = require('lodash');
const chai = require('chai');
const { ethers, network } = require('hardhat');
const {
    constants: { AddressZero },
    utils: { arrayify, keccak256, hashMessage },
} = ethers;
const { expect } = chai;

const { getAddresses, getWeightedSignersSet, getWeightedSignersProof, expectRevert } = require('../utils');

describe('AxelarGatewayWeightedAuth', () => {
    const threshold = 2;

    let wallets;
    let owner;
    let signers;
    const previousSigners = [];

    let gatewayAuthFactory;

    let gatewayAuth;

    before(async () => {
        wallets = await ethers.getSigners();

        owner = wallets[0];
        signers = sortBy(wallets.slice(1, 3), (wallet) => wallet.address.toLowerCase());
        previousSigners.push(sortBy(wallets.slice(0, 2), (wallet) => wallet.address.toLowerCase()));

        gatewayAuthFactory = await ethers.getContractFactory('AxelarGatewayWeightedAuth', owner);

        const initialSigners = [...previousSigners, signers];
        const initialSignerSets = initialSigners.map((signers) =>
            getWeightedSignersSet(
                getAddresses(signers),
                signers.map(() => 1),
                threshold,
            ),
        );

        gatewayAuth = await gatewayAuthFactory.deploy(owner.address, initialSignerSets);
        await gatewayAuth.deployTransaction.wait(network.config.confirmations);
    });

    describe('validateProof', () => {
        it('validate the proof from the current signers', async () => {
            const data = '0x123abc123abc';

            const message = hashMessage(arrayify(keccak256(data)));

            const isCurrentSigners = await gatewayAuth.validateProof(
                message,
                await getWeightedSignersProof(
                    data,
                    signers,
                    signers.map(() => 1),
                    threshold,
                    signers.slice(0, threshold),
                ),
            );

            expect(isCurrentSigners).to.be.true;
        });

        it('reject the proof for a non-existant epoch hash', async () => {
            const data = '0x123abc123abc';

            const message = hashMessage(arrayify(keccak256(data)));

            const invalidSigners = [owner, owner, owner];

            await expectRevert(
                async (gasOptions) =>
                    gatewayAuth.validateProof(
                        message,
                        await getWeightedSignersProof(
                            data,
                            invalidSigners,
                            invalidSigners.map(() => 1),
                            threshold,
                            invalidSigners.slice(0, threshold - 1),
                        ),
                        gasOptions,
                    ),
                gatewayAuth,
                'InvalidSigners',
            );
        });

        it('reject the proof if weights are not matching the threshold', async () => {
            const data = '0x123abc123abc';

            const message = hashMessage(arrayify(keccak256(data)));

            await expectRevert(
                async (gasOptions) =>
                    gatewayAuth.validateProof(
                        message,
                        await getWeightedSignersProof(
                            data,
                            signers,
                            signers.map(() => 1),
                            threshold,
                            signers.slice(0, threshold - 1),
                        ),
                        gasOptions,
                    ),
                gatewayAuth,
                'LowSignaturesWeight',
            );
        });

        it('reject the proof if signatures are invalid', async () => {
            const data = '0x123abc123abc';

            const message = hashMessage(arrayify(keccak256(data)));

            await expectRevert(
                async (gasOptions) =>
                    gatewayAuth.validateProof(
                        message,
                        await getWeightedSignersProof(
                            data,
                            signers,
                            signers.map(() => 1),
                            threshold,
                            wallets.slice(0, threshold),
                        ),
                        gasOptions,
                    ),
                gatewayAuth,
                'MalformedSignatures',
            );
        });

        it('validate the proof for a single signer', async () => {
            await expect(
                gatewayAuth.transferOperatorship(
                    getWeightedSignersSet(
                        getAddresses(signers),
                        signers.map(() => 1),
                        1,
                    ),
                ),
            ).to.emit(gatewayAuth, 'SignersRotated');

            const data = '0x123abc123abc';

            const message = hashMessage(arrayify(keccak256(data)));

            const isCurrentSigners = await gatewayAuth.validateProof(
                message,
                await getWeightedSignersProof(
                    data,
                    signers,
                    signers.map(() => 1),
                    1,
                    signers.slice(0, 1),
                ),
            );

            await expect(isCurrentSigners).to.be.true;
        });
    });

    describe('transferSigners', () => {
        it('should allow owner to transfer signers', async () => {
            const newSigners = [
                '0x6D4017D4b1DCd36e6EA88b7900e8eC64A1D1315b',
                '0xb7900E8Ec64A1D1315B6D4017d4b1dcd36E6Ea88',
            ];

            const prevEpoch = Number(await gatewayAuth.epoch());

            await expect(
                gatewayAuth.transferOperatorship(
                    getWeightedSignersSet(
                        newSigners,
                        newSigners.map(() => 1),
                        2,
                    ),
                ),
            ).to.emit(gatewayAuth, 'SignersRotated');

            const currentEpoch = Number(await gatewayAuth.epoch());
            expect(currentEpoch).to.be.equal(prevEpoch + 1);
        });

        it('should revert if new signers length is zero', async () => {
            const newSigners = [];

            await expectRevert(
                (gasOptions) =>
                    gatewayAuth.transferOperatorship(
                        getWeightedSignersSet(
                            newSigners,
                            newSigners.map(() => 1),
                            2,
                        ),
                        gasOptions,
                    ),
                gatewayAuth,
                'InvalidSigners',
            );
        });

        it('should not allow transferring signers to address zero', async () => {
            const newSigners = [AddressZero, '0x6D4017D4b1DCd36e6EA88b7900e8eC64A1D1315b'];

            await expectRevert(
                (gasOptions) =>
                    gatewayAuth.transferOperatorship(
                        getWeightedSignersSet(
                            newSigners,
                            newSigners.map(() => 1),
                            2,
                        ),
                        gasOptions,
                    ),
                gatewayAuth,
                'InvalidSigners',
            );
        });

        it('should not allow transferring signers to duplicated signers', async () => {
            const newSigners = [
                '0x6D4017D4b1DCd36e6EA88b7900e8eC64A1D1315b',
                '0x6D4017D4b1DCd36e6EA88b7900e8eC64A1D1315b',
            ];

            await expectRevert(
                (gasOptions) =>
                    gatewayAuth.transferOperatorship(
                        getWeightedSignersSet(
                            newSigners,
                            newSigners.map(() => 1),
                            2,
                        ),
                        gasOptions,
                    ),
                gatewayAuth,
                'InvalidSigners',
            );
        });

        it('should not allow transferring signers to unsorted signers', async () => {
            const newSigners = [
                '0xb7900E8Ec64A1D1315B6D4017d4b1dcd36E6Ea88',
                '0x6D4017D4b1DCd36e6EA88b7900e8eC64A1D1315b',
            ];

            await expectRevert(
                (gasOptions) =>
                    gatewayAuth.transferOperatorship(
                        getWeightedSignersSet(
                            newSigners,
                            newSigners.map(() => 1),
                            2,
                        ),
                        gasOptions,
                    ),
                gatewayAuth,
                'InvalidSigners',
            );
        });

        it('should not allow signers transfer to the previous signers ', async () => {
            const updatedSigners = getAddresses(signers.slice(0, threshold));

            await expect(
                gatewayAuth.transferOperatorship(
                    getWeightedSignersSet(
                        updatedSigners,
                        updatedSigners.map(() => 2),
                        threshold,
                    ),
                ),
            ).to.emit(gatewayAuth, 'SignersRotated');
        });

        it('should not allow transferring signers with invalid threshold', async () => {
            const newSigners = [
                '0x6D4017D4b1DCd36e6EA88b7900e8eC64A1D1315b',
                '0xb7900E8Ec64A1D1315B6D4017d4b1dcd36E6Ea88',
            ];

            await expectRevert(
                (gasOptions) =>
                    gatewayAuth.transferOperatorship(
                        getWeightedSignersSet(
                            newSigners,
                            newSigners.map(() => 1),
                            0,
                        ),
                        gasOptions,
                    ),
                gatewayAuth,
                'InvalidThreshold',
            );
            await expectRevert(
                (gasOptions) =>
                    gatewayAuth.transferOperatorship(
                        getWeightedSignersSet(
                            newSigners,
                            newSigners.map(() => 1),
                            3,
                        ),
                        gasOptions,
                    ),
                gatewayAuth,
                'InvalidThreshold',
            );
        });

        it('should not allow transferring signers with invalid number of weights', async () => {
            const newSigners = [
                '0x6D4017D4b1DCd36e6EA88b7900e8eC64A1D1315b',
                '0xb7900E8Ec64A1D1315B6D4017d4b1dcd36E6Ea88',
            ];

            await expectRevert(
                (gasOptions) =>
                    gatewayAuth.transferOperatorship(
                        getWeightedSignersSet(
                            newSigners,
                            newSigners.map(() => 1),
                            0,
                        ),
                        gasOptions,
                    ),
                gatewayAuth,
                'InvalidThreshold',
            );
            await expectRevert(
                (gasOptions) =>
                    gatewayAuth.transferOperatorship(
                        getWeightedSignersSet(
                            newSigners,
                            newSigners.map(() => 1),
                            3,
                        ),
                        gasOptions,
                    ),
                gatewayAuth,
                'InvalidThreshold',
            );
        });
    });

    describe('signerHashByEpoch and epochBySignerHash', () => {
        it('should expose correct hashes and epoch', async () => {
            const signersHistory = [...previousSigners, signers];

            await Promise.all(
                signersHistory.map(async (signers, i) => {
                    const hash = keccak256(
                        getWeightedSignersSet(
                            getAddresses(signers),
                            signers.map(() => 1),
                            threshold,
                        ),
                    );
                    expect(await gatewayAuth.signerHashByEpoch(i + 1)).to.be.equal(hash);
                    expect(await gatewayAuth.epochBySignerHash(hash)).to.be.equal(i + 1);
                }),
            );
        });
    });

    describe('validateProof with OLD_KEY_RETENTION as 15', () => {
        const OLD_KEY_RETENTION = 15;
        let newGatewayAuth;
        const previousSigners = [];

        before(async () => {
            for (let i = 0; i <= OLD_KEY_RETENTION; i++) {
                previousSigners.push(sortBy(wallets.slice(0, 2), (wallet) => wallet.address.toLowerCase()));
            }

            const initialSigners = [...previousSigners, signers];

            const initialSignerSets = initialSigners.map((signers, i) =>
                getWeightedSignersSet(
                    getAddresses(signers),
                    signers.map(() => i + 1),
                    (i + 1) * 2,
                ),
            );

            newGatewayAuth = await gatewayAuthFactory.deploy(owner.address, initialSignerSets);
            await newGatewayAuth.deployTransaction.wait(network.config.confirmations);
        });

        it('validate the proof from the recent signers', async () => {
            const data = '0x123abc123abc';

            const message = hashMessage(arrayify(keccak256(data)));

            const validPreviousSigners = previousSigners.slice(-OLD_KEY_RETENTION);

            expect(validPreviousSigners.length).to.be.equal(OLD_KEY_RETENTION);

            await Promise.all(
                validPreviousSigners.map(async (signers, index) => {
                    const isCurrentSigners = await newGatewayAuth.validateProof(
                        message,
                        await getWeightedSignersProof(
                            data,
                            signers,
                            signers.map(() => index + 2),
                            (index + 2) * 2,
                            signers,
                        ),
                    );
                    expect(isCurrentSigners).to.be.false;
                }),
            );
        });

        it('reject the proof from the signers older than key retention', async () => {
            const data = '0x123abc123abc';
            const message = hashMessage(arrayify(keccak256(data)));
            const invalidPreviousSigners = previousSigners.slice(0, -OLD_KEY_RETENTION);

            await Promise.all(
                invalidPreviousSigners.map(async (signers) => {
                    await expectRevert(
                        async (gasOptions) =>
                            newGatewayAuth.validateProof(
                                message,
                                await getWeightedSignersProof(
                                    data,
                                    signers,
                                    signers.map(() => 1),
                                    threshold,
                                    signers.slice(0, threshold),
                                ),
                                gasOptions,
                            ),
                        gatewayAuth,
                        'InvalidSigners',
                    );
                }),
            );
        });
    });
});
