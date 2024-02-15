const { sortBy } = require('lodash');
const chai = require('chai');
const { ethers, network } = require('hardhat');
const {
    utils: { arrayify, keccak256, hashMessage },
} = ethers;
const { expect } = chai;

const { getAddresses, getWeightedSignersSet, getWeightedSignaturesProof, expectRevert } = require('../utils');

describe('AxelarGatewayWeightedAuth', () => {
    const threshold = 2;

    let wallets;
    let owner;
    let signers;
    const previousSigners = [];

    let multisigFactory;

    let multisig;

    before(async () => {
        wallets = await ethers.getSigners();

        owner = wallets[0];
        signers = sortBy(wallets.slice(1, 3), (wallet) => wallet.address.toLowerCase());
        previousSigners.push(sortBy(wallets.slice(0, 2), (wallet) => wallet.address.toLowerCase()));

        multisigFactory = await ethers.getContractFactory('AxelarGatewayWeightedAuth', owner);
    });

    beforeEach(async () => {
        const initialSigners = [...previousSigners, signers];
        const initialSignerSets = initialSigners.map((signers) =>
            getWeightedSignersSet(
                getAddresses(signers),
                signers.map(() => 1),
                threshold,
            ),
        );

        multisig = await multisigFactory.deploy(owner.address, initialSignerSets);
        await multisig.deployTransaction.wait(network.config.confirmations);
    });

    describe('validateProof', () => {
        it('validate the proof from the current signers', async () => {
            const data = '0x123abc123abc';

            const message = hashMessage(arrayify(keccak256(data)));

            const isCurrentSigners = await multisig.validateProof(
                message,
                await getWeightedSignaturesProof(
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
                    multisig.validateProof(
                        message,
                        await getWeightedSignaturesProof(
                            data,
                            invalidSigners,
                            invalidSigners.map(() => 1),
                            threshold,
                            invalidSigners.slice(0, threshold - 1),
                        ),
                        gasOptions,
                    ),
                multisig,
                'InvalidSigners',
            );
        });

        it('reject the proof if weights are not matching the threshold', async () => {
            const data = '0x123abc123abc';

            const message = hashMessage(arrayify(keccak256(data)));

            await expectRevert(
                async (gasOptions) =>
                    multisig.validateProof(
                        message,
                        await getWeightedSignaturesProof(
                            data,
                            signers,
                            signers.map(() => 1),
                            threshold,
                            signers.slice(0, threshold - 1),
                        ),
                        gasOptions,
                    ),
                multisig,
                'LowSignaturesWeight',
            );
        });

        it('reject the proof if signatures are invalid', async () => {
            const data = '0x123abc123abc';

            const message = hashMessage(arrayify(keccak256(data)));

            await expectRevert(
                async (gasOptions) =>
                    multisig.validateProof(
                        message,
                        await getWeightedSignaturesProof(
                            data,
                            signers,
                            signers.map(() => 1),
                            threshold,
                            wallets.slice(0, threshold),
                        ),
                        gasOptions,
                    ),
                multisig,
                'MalformedSignatures',
            );
        });

        it('validate the proof for a single signer', async () => {
            await expect(
                multisig.transferOperatorship(
                    getWeightedSignersSet(
                        getAddresses(signers),
                        signers.map(() => 1),
                        1,
                    ),
                ),
            ).to.emit(multisig, 'SignersRotated');

            const data = '0x123abc123abc';

            const message = hashMessage(arrayify(keccak256(data)));

            const isCurrentSigners = await multisig.validateProof(
                message,
                await getWeightedSignaturesProof(
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

    describe('validateProof with OLD_KEY_RETENTION as 15', () => {
        const OLD_KEY_RETENTION = 15;
        let newMultisig;
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

            newMultisig = await multisigFactory.deploy(owner.address, initialSignerSets);
            await newMultisig.deployTransaction.wait(network.config.confirmations);
        });

        it('validate the proof from the recent signers', async () => {
            const data = '0x123abc123abc';

            const message = hashMessage(arrayify(keccak256(data)));

            const validPreviousSigners = previousSigners.slice(-OLD_KEY_RETENTION);

            expect(validPreviousSigners.length).to.be.equal(OLD_KEY_RETENTION);

            await Promise.all(
                validPreviousSigners.map(async (signers, index) => {
                    const isCurrentSigners = await newMultisig.validateProof(
                        message,
                        await getWeightedSignaturesProof(
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
                            newMultisig.validateProof(
                                message,
                                await getWeightedSignaturesProof(
                                    data,
                                    signers,
                                    signers.map(() => 1),
                                    threshold,
                                    signers.slice(0, threshold),
                                ),
                                gasOptions,
                            ),
                        multisig,
                        'InvalidSigners',
                    );
                }),
            );
        });
    });

    describe('transferSignership', () => {
        it('should allow owner to transfer signership', async () => {
            const newSigners = [
                '0x6D4017D4b1DCd36e6EA88b7900e8eC64A1D1315b',
                '0xb7900E8Ec64A1D1315B6D4017d4b1dcd36E6Ea88',
            ];

            await expect(
                multisig.transferOperatorship(
                    getWeightedSignersSet(
                        newSigners,
                        newSigners.map(() => 1),
                        2,
                    ),
                ),
            ).to.emit(multisig, 'SignersRotated');
        });

        it('should revert if new signers length is zero', async () => {
            const newSigners = [];

            await expectRevert(
                (gasOptions) =>
                    multisig.transferOperatorship(
                        getWeightedSignersSet(
                            newSigners,
                            newSigners.map(() => 1),
                            2,
                        ),
                        gasOptions,
                    ),
                multisig,
                'InvalidSigners',
            );
        });

        it('should not allow transferring signership to address zero', async () => {
            const newSigners = [AddressZero, '0x6D4017D4b1DCd36e6EA88b7900e8eC64A1D1315b'];

            await expectRevert(
                (gasOptions) =>
                    multisig.transferOperatorship(
                        getWeightedSignersSet(
                            newSigners,
                            newSigners.map(() => 1),
                            2,
                        ),
                        gasOptions,
                    ),
                multisig,
                'InvalidSigners',
            );
        });

        it('should not allow transferring signership to duplicated signers', async () => {
            const newSigners = [
                '0x6D4017D4b1DCd36e6EA88b7900e8eC64A1D1315b',
                '0x6D4017D4b1DCd36e6EA88b7900e8eC64A1D1315b',
            ];

            await expectRevert(
                (gasOptions) =>
                    multisig.transferOperatorship(
                        getWeightedSignersSet(
                            newSigners,
                            newSigners.map(() => 1),
                            2,
                        ),
                        gasOptions,
                    ),
                multisig,
                'InvalidSigners',
            );
        });

        it('should not allow transferring signership to unsorted signers', async () => {
            const newSigners = [
                '0xb7900E8Ec64A1D1315B6D4017d4b1dcd36E6Ea88',
                '0x6D4017D4b1DCd36e6EA88b7900e8eC64A1D1315b',
            ];

            await expectRevert(
                (gasOptions) =>
                    multisig.transferOperatorship(
                        getWeightedSignersSet(
                            newSigners,
                            newSigners.map(() => 1),
                            2,
                        ),
                        gasOptions,
                    ),
                multisig,
                'InvalidSigners',
            );
        });

        it('should not allow signership transfer to the previous signers ', async () => {
            const updatedSigners = getAddresses(signers.slice(0, threshold));

            await expect(
                multisig.transferOperatorship(
                    getWeightedSignersSet(
                        updatedSigners,
                        updatedSigners.map(() => 2),
                        threshold,
                    ),
                ),
            ).to.emit(multisig, 'SignersRotated');
        });

        it('should not allow transferring signership with invalid threshold', async () => {
            const newSigners = [
                '0x6D4017D4b1DCd36e6EA88b7900e8eC64A1D1315b',
                '0xb7900E8Ec64A1D1315B6D4017d4b1dcd36E6Ea88',
            ];

            await expectRevert(
                (gasOptions) =>
                    multisig.transferOperatorship(
                        getWeightedSignersSet(
                            newSigners,
                            newSigners.map(() => 1),
                            0,
                        ),
                        gasOptions,
                    ),
                multisig,
                'InvalidThreshold',
            );
            await expectRevert(
                (gasOptions) =>
                    multisig.transferOperatorship(
                        getWeightedSignersSet(
                            newSigners,
                            newSigners.map(() => 1),
                            3,
                        ),
                        gasOptions,
                    ),
                multisig,
                'InvalidThreshold',
            );
        });

        it('should not allow transferring signership with invalid number of weights', async () => {
            const newSigners = [
                '0x6D4017D4b1DCd36e6EA88b7900e8eC64A1D1315b',
                '0xb7900E8Ec64A1D1315B6D4017d4b1dcd36E6Ea88',
            ];

            await expectRevert(
                (gasOptions) =>
                    multisig.transferOperatorship(
                        getWeightedSignersSet(
                            newSigners,
                            newSigners.map(() => 1),
                            0,
                        ),
                        gasOptions,
                    ),
                multisig,
                'InvalidThreshold',
            );
            await expectRevert(
                (gasOptions) =>
                    multisig.transferOperatorship(
                        getWeightedSignersSet(
                            newSigners,
                            newSigners.map(() => 1),
                            3,
                        ),
                        gasOptions,
                    ),
                multisig,
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
                    expect(await multisig.signerHashByEpoch(i + 1)).to.be.equal(hash);
                    expect(await multisig.epochBySignerHash(hash)).to.be.equal(i + 1);
                }),
            );
        });
    });
});
