const { sortBy } = require('lodash');
const chai = require('chai');
const { ethers, network } = require('hardhat');
const {
    utils: { arrayify, keccak256, hashMessage, toUtf8Bytes, id },
    constants: { AddressZero, HashZero },
    Wallet,
} = ethers;
const { expect } = chai;

const { expectRevert, getRandomInt, getRandomSubarray } = require('../utils');
const { getWeightedSignersProof, encodeWeightedSigners } = require('../../scripts/utils');

describe('AxelarAmplifierAuth', () => {
    const numSigners = 3;
    const threshold = 2;
    const domainSeparator = keccak256(toUtf8Bytes('chain'));
    const previousSignersRetention = 0;
    const data = '0x123abc123abc';
    const dataHash = keccak256(arrayify(data));
    const defaultNonce = HashZero;

    let owner;
    let signers;

    let multisigFactory;
    let multisig;
    let weightedSigners;
    let weightedSignersHash;

    before(async () => {
        const wallets = await ethers.getSigners();

        owner = wallets[0];
        signers = sortBy(wallets.slice(0, numSigners), (wallet) => wallet.address.toLowerCase());

        multisigFactory = await ethers.getContractFactory('AxelarAmplifierAuth', owner);

        multisig = await multisigFactory.deploy(owner.address, domainSeparator, previousSignersRetention, []);
        await multisig.deployTransaction.wait(network.config.confirmations);

        weightedSigners = {
            signers: signers.map((signer) => {
                return { signer: signer.address, weight: 1 };
            }),
            threshold,
            nonce: defaultNonce,
        };
        weightedSignersHash = keccak256(encodeWeightedSigners(weightedSigners));

        await multisig.rotateSigners(encodeWeightedSigners(weightedSigners)).then((tx) => tx.wait());
    });

    describe('queries', () => {
        it('previousSignersRetention', async () => {
            expect(await multisig.previousSignersRetention()).to.be.equal(previousSignersRetention);
        });

        it('hashMessage', async () => {
            const data = '0x123abc123abc';
            const dataHash = keccak256(arrayify(data));

            const expectedMessageHash = hashMessage(
                arrayify(domainSeparator + weightedSignersHash.slice(2) + dataHash.slice(2)),
            );
            const messageHash = await multisig.messageHashToSign(weightedSignersHash, dataHash);

            expect(messageHash).to.be.equal(expectedMessageHash);
        });

        it('signerHashByEpoch and epochBySignerHash', async () => {
            const hash = keccak256(encodeWeightedSigners(weightedSigners));
            expect(await multisig.signerHashByEpoch(1)).to.be.equal(hash);
            expect(await multisig.epochBySignerHash(hash)).to.be.equal(1);
        });
    });

    describe('rotateSigners', () => {
        describe('positive tests', () => {
            let multisig;

            beforeEach(async () => {
                multisig = await multisigFactory.deploy(owner.address, domainSeparator, previousSignersRetention, []);
                await multisig.deployTransaction.wait(network.config.confirmations);
            });

            it('should allow signer rotation', async () => {
                const newSigners = {
                    signers: [
                        {
                            signer: '0x6D4017D4b1DCd36e6EA88b7900e8eC64A1D1315b',
                            weight: 1,
                        },
                        {
                            signer: '0xb7900E8Ec64A1D1315B6D4017d4b1dcd36E6Ea88',
                            weight: 1,
                        },
                    ],
                    threshold: 2,
                    nonce: defaultNonce,
                };
                const signersHash = keccak256(encodeWeightedSigners(newSigners));

                const prevEpoch = (await multisig.epoch()).toNumber();

                await expect(multisig.rotateSigners(encodeWeightedSigners(newSigners)))
                    .to.emit(multisig, 'SignersRotated')
                    .withArgs(prevEpoch + 1, signersHash);

                expect(await multisig.epoch()).to.be.equal(prevEpoch + 1);
            });

            it('should allow rotation to duplicate signers with the same nonce', async () => {
                const newSigners = {
                    signers: [
                        {
                            signer: '0x6D4017D4b1DCd36e6EA88b7900e8eC64A1D1315b',
                            weight: 1,
                        },
                    ],
                    threshold: 1,
                    nonce: defaultNonce,
                };
                const newSignersHash = keccak256(encodeWeightedSigners(newSigners));

                const prevEpoch = (await multisig.epoch()).toNumber();

                await expect(multisig.rotateSigners(encodeWeightedSigners(newSigners)))
                    .to.emit(multisig, 'SignersRotated')
                    .withArgs(prevEpoch + 1, newSignersHash);

                expect(await multisig.epochBySignerHash(newSignersHash)).to.be.equal(prevEpoch + 1);

                await expect(multisig.rotateSigners(encodeWeightedSigners(newSigners)))
                    .to.emit(multisig, 'SignersRotated')
                    .withArgs(prevEpoch + 2, newSignersHash);

                // Duplicate weighted signers should point to the new epoch
                expect(await multisig.epochBySignerHash(newSignersHash)).to.be.equal(prevEpoch + 2);
            });

            it('should allow rotation to duplicate signers with different nonce', async () => {
                const newSigners = {
                    signers: [
                        {
                            signer: '0x6D4017D4b1DCd36e6EA88b7900e8eC64A1D1315b',
                            weight: 1,
                        },
                    ],
                    threshold: 1,
                    nonce: id('0'),
                };
                const newSignersHash = keccak256(encodeWeightedSigners(newSigners));

                const prevEpoch = (await multisig.epoch()).toNumber();

                await expect(multisig.rotateSigners(encodeWeightedSigners(newSigners)))
                    .to.emit(multisig, 'SignersRotated')
                    .withArgs(prevEpoch + 1, newSignersHash);

                const newSigners2 = { ...newSigners, nonce: id('1') };
                const newSigners2Hash = keccak256(encodeWeightedSigners(newSigners2));

                await expect(multisig.rotateSigners(encodeWeightedSigners(newSigners2)))
                    .to.emit(multisig, 'SignersRotated')
                    .withArgs(prevEpoch + 2, newSigners2Hash);

                // Both weighted signer should be available
                expect(await multisig.epochBySignerHash(newSignersHash)).to.be.equal(prevEpoch + 1);
                expect(await multisig.epochBySignerHash(newSigners2Hash)).to.be.equal(prevEpoch + 2);
            });
        });

        describe('negative tests', () => {
            it('should revert if rotation is not from owner', async () => {
                await expectRevert(
                    (gasOptions) =>
                        multisig
                            .connect(signers[1])
                            .rotateSigners(
                                encodeWeightedSigners({ signers: [], threshold: 1, nonce: defaultNonce }),
                                gasOptions,
                            ),
                    multisig,
                    'NotOwner',
                );
            });

            it('should revert if new signers length is zero', async () => {
                await expectRevert(
                    (gasOptions) =>
                        multisig.rotateSigners(
                            encodeWeightedSigners({ signers: [], threshold: 1, nonce: defaultNonce }),
                            gasOptions,
                        ),
                    multisig,
                    'InvalidSigners',
                );
            });

            it('should not allow transferring signers to address zero', async () => {
                await expectRevert(
                    (gasOptions) =>
                        multisig.rotateSigners(
                            encodeWeightedSigners(
                                {
                                    signers: [
                                        {
                                            signer: AddressZero,
                                            weight: 1,
                                        },
                                    ],
                                    threshold: 1,
                                    nonce: defaultNonce,
                                },
                                gasOptions,
                            ),
                        ),
                    multisig,
                    'InvalidSigners',
                );
            });

            it('should not allow transferring signers to duplicated signers', async () => {
                await expectRevert(
                    (gasOptions) =>
                        multisig.rotateSigners(
                            encodeWeightedSigners(
                                {
                                    signers: [
                                        { signer: '0x6D4017D4b1DCd36e6EA88b7900e8eC64A1D1315b', weight: 1 },
                                        { signer: '0x6D4017D4b1DCd36e6EA88b7900e8eC64A1D1315b', weight: 1 },
                                    ],
                                    threshold: 1,
                                    nonce: defaultNonce,
                                },
                                gasOptions,
                            ),
                        ),
                    multisig,
                    'InvalidSigners',
                );
            });

            it('should not allow transferring signers to unsorted signers', async () => {
                await expectRevert(
                    (gasOptions) =>
                        multisig.rotateSigners(
                            encodeWeightedSigners(
                                {
                                    signers: [
                                        { signer: '0xb7900E8Ec64A1D1315B6D4017d4b1dcd36E6Ea88', weight: 1 },
                                        { signer: '0x6D4017D4b1DCd36e6EA88b7900e8eC64A1D1315b', weight: 1 },
                                    ],
                                    threshold: 1,
                                    nonce: defaultNonce,
                                },
                                gasOptions,
                            ),
                        ),
                    multisig,
                    'InvalidSigners',
                );
            });

            it('should not allow transferring signers with zero weights', async () => {
                await expectRevert(
                    (gasOptions) =>
                        multisig.rotateSigners(
                            encodeWeightedSigners(
                                {
                                    signers: [
                                        { signer: '0x6D4017D4b1DCd36e6EA88b7900e8eC64A1D1315b', weight: 1 },
                                        { signer: '0xb7900E8Ec64A1D1315B6D4017d4b1dcd36E6Ea88', weight: 0 },
                                    ],
                                    threshold: 1,
                                    nonce: defaultNonce,
                                },
                                gasOptions,
                            ),
                        ),
                    multisig,
                    'InvalidWeights',
                );
            });

            it('should not allow transferring signers with zero threshold', async () => {
                await expectRevert(
                    (gasOptions) =>
                        multisig.rotateSigners(
                            encodeWeightedSigners(
                                {
                                    signers: [{ signer: '0x6D4017D4b1DCd36e6EA88b7900e8eC64A1D1315b', weight: 1 }],
                                    threshold: 0,
                                    nonce: defaultNonce,
                                },
                                gasOptions,
                            ),
                        ),
                    multisig,
                    'InvalidThreshold',
                );
            });

            it('should not allow transferring signers with threshold greater than sum of weights', async () => {
                await expectRevert(
                    (gasOptions) =>
                        multisig.rotateSigners(
                            encodeWeightedSigners(
                                {
                                    signers: [{ signer: '0x6D4017D4b1DCd36e6EA88b7900e8eC64A1D1315b', weight: 1 }],
                                    threshold: 2,
                                    nonce: defaultNonce,
                                },
                                gasOptions,
                            ),
                        ),
                    multisig,
                    'InvalidThreshold',
                );

                await expectRevert(
                    (gasOptions) =>
                        multisig.rotateSigners(
                            encodeWeightedSigners(
                                {
                                    signers: [
                                        { signer: '0x6D4017D4b1DCd36e6EA88b7900e8eC64A1D1315b', weight: 1 },
                                        { signer: '0xb7900E8Ec64A1D1315B6D4017d4b1dcd36E6Ea88', weight: 2 },
                                    ],
                                    threshold: 4,
                                    nonce: defaultNonce,
                                },
                                gasOptions,
                            ),
                        ),
                    multisig,
                    'InvalidThreshold',
                );
            });
        });
    });

    describe('validateProof', () => {
        describe('positive tests', () => {
            it('validate the proof from the current signers', async () => {
                const proof = await getWeightedSignersProof(
                    data,
                    domainSeparator,
                    weightedSigners,
                    signers.slice(0, threshold),
                );

                const isCurrentSigners = await multisig.validateProof(dataHash, proof);

                expect(isCurrentSigners).to.be.true;
            });

            it('validate the proof from the current signers with extra signatures', async () => {
                // sign with all signers, i.e more than threshold
                const proof = await getWeightedSignersProof(data, domainSeparator, weightedSigners, signers);

                const isCurrentSigners = await multisig.validateProof(dataHash, proof);
                expect(isCurrentSigners).to.be.true;
            });

            it('validate the proof with last threshold signers', async () => {
                const proof = await getWeightedSignersProof(
                    data,
                    domainSeparator,
                    weightedSigners,
                    signers.slice(-threshold),
                );

                const isCurrentSigners = await multisig.validateProof(dataHash, proof);

                expect(isCurrentSigners).to.be.true;
            });

            it('validate the proof with different signer combinations', async () => {
                const proof = await getWeightedSignersProof(
                    data,
                    domainSeparator,
                    weightedSigners,
                    signers.slice(0, 1).concat(signers.slice(-(threshold - 1))),
                );

                const isCurrentSigners = await multisig.validateProof(dataHash, proof);

                expect(isCurrentSigners).to.be.true;
            });

            it('validate the proof from a single signer', async () => {
                const multisig = await multisigFactory.deploy(
                    owner.address,
                    domainSeparator,
                    previousSignersRetention,
                    [],
                );
                await multisig.deployTransaction.wait(network.config.confirmations);

                const newSigners = {
                    signers: [{ signer: signers[0].address, weight: 1 }],
                    threshold: 1,
                    nonce: defaultNonce,
                };
                const encodedSigners = encodeWeightedSigners(newSigners);

                await expect(multisig.rotateSigners(encodedSigners))
                    .to.emit(multisig, 'SignersRotated')
                    .withArgs(1, keccak256(encodedSigners));

                const proof = await getWeightedSignersProof(data, domainSeparator, newSigners, [signers[0]]);

                const isLatestSigners = await multisig.validateProof(dataHash, proof);
                expect(isLatestSigners).to.be.true;
            });
        });

        describe('negative tests', () => {
            it('reject the proof from a non-existent signers hash', async () => {
                const proof = await getWeightedSignersProof(
                    data,
                    domainSeparator,
                    {
                        signers: [{ signer: owner.address, weight: 1 }],
                        threshold: 1,
                        nonce: defaultNonce,
                    },
                    [owner],
                );

                await expectRevert(
                    async (gasOptions) => multisig.validateProof(dataHash, proof, gasOptions),
                    multisig,
                    'InvalidSigners',
                );
            });

            it('reject the proof if signatures are insufficient', async () => {
                const proof = await getWeightedSignersProof(
                    data,
                    domainSeparator,
                    weightedSigners,
                    signers.slice(0, threshold - 1),
                );

                await expectRevert(
                    async (gasOptions) => multisig.validateProof(dataHash, proof, gasOptions),
                    multisig,
                    'LowSignaturesWeight',
                );
            });

            it('reject the proof if signatures are invalid', async () => {
                const proof = await getWeightedSignersProof(data, domainSeparator, weightedSigners, [
                    Wallet.createRandom(),
                ]);

                await expectRevert(
                    async (gasOptions) => multisig.validateProof(dataHash, proof, gasOptions),
                    multisig,
                    'MalformedSignatures',
                );
            });

            it('reject the proof if signatures are missing', async () => {
                const proof = await getWeightedSignersProof(data, domainSeparator, weightedSigners, []);

                await expectRevert(
                    async (gasOptions) => multisig.validateProof(dataHash, proof, gasOptions),
                    multisig,
                    'LowSignaturesWeight',
                );
            });
        });
    });

    describe('validateProof with multiple signer sets', () => {
        const previousSignersRetention = 2;
        let multisig;

        before(async () => {
            multisig = await multisigFactory.deploy(owner.address, domainSeparator, previousSignersRetention, []);
            await multisig.deployTransaction.wait(network.config.confirmations);

            for (let i = 0; i <= previousSignersRetention + 1; i++) {
                const newSigners = {
                    ...weightedSigners,
                    nonce: id(`${i}`),
                };

                await multisig
                    .rotateSigners(encodeWeightedSigners(newSigners))
                    .then((tx) => tx.wait(network.config.confirmations));

                const proof = await getWeightedSignersProof(
                    data,
                    domainSeparator,
                    newSigners,
                    signers.slice(0, threshold),
                );

                const isCurrentSigners = await multisig.validateProof(dataHash, proof);

                expect(isCurrentSigners).to.be.equal(true);
            }
        });

        it('validate the proof from all recent signers', async () => {
            for (let i = 1; i <= previousSignersRetention + 1; i++) {
                const proof = await getWeightedSignersProof(
                    data,
                    domainSeparator,
                    {
                        ...weightedSigners,
                        nonce: id(`${i}`),
                    },
                    signers.slice(0, threshold),
                );

                const isCurrentSigners = await multisig.validateProof(dataHash, proof);

                expect(isCurrentSigners).to.be.equal(i === previousSignersRetention + 1);
            }
        });

        it('reject proof from outdated signers', async () => {
            const proof = await getWeightedSignersProof(
                data,
                domainSeparator,
                {
                    ...weightedSigners,
                    nonce: id('0'),
                },
                signers.slice(0, threshold),
            );

            await expectRevert(
                (gasOptions) => multisig.validateProof(dataHash, proof, gasOptions),
                multisig,
                'InvalidSigners',
            );
        });
    });

    it('should allow rotateSigners and validateProof with a randomized signer set', async () => {
        const multisig = await multisigFactory.deploy(owner.address, domainSeparator, previousSignersRetention, []);
        await multisig.deployTransaction.wait(network.config.confirmations);

        const maxSigners = 20;
        const numSigners = 1 + getRandomInt(maxSigners);
        const weightedWallets = sortBy(
            Array.from({ length: numSigners }, () => {
                return { wallet: Wallet.createRandom(), weight: 1 + getRandomInt(1000) };
            }),
            (weightedWallet) => weightedWallet.wallet.address.toLowerCase(),
        );

        // Select a random subset of wallets to define the threshold
        const subsetSize = getRandomInt(numSigners) + 1;
        const participatingWallets = sortBy(getRandomSubarray(weightedWallets, subsetSize), (weightedWallet) =>
            weightedWallet.wallet.address.toLowerCase(),
        );
        const threshold = participatingWallets
            .map((weightedWallet) => weightedWallet.weight)
            .reduce((a, b) => a + b, 0);

        const newSigners = {
            signers: weightedWallets.map((weightedWallet) => {
                return { signer: weightedWallet.wallet.address, weight: weightedWallet.weight };
            }),
            threshold,
            nonce: defaultNonce,
        };
        const signersHash = keccak256(encodeWeightedSigners(newSigners));

        try {
            const prevEpoch = (await multisig.epoch()).toNumber();

            await expect(multisig.rotateSigners(encodeWeightedSigners(newSigners)))
                .to.emit(multisig, 'SignersRotated')
                .withArgs(prevEpoch + 1, signersHash);

            expect(await multisig.epoch()).to.be.equal(prevEpoch + 1);

            // Validate a proof with the new signers
            const proof = await getWeightedSignersProof(
                data,
                domainSeparator,
                newSigners,
                participatingWallets.map((weightedWallet) => weightedWallet.wallet),
            );

            const isCurrentSigners = await multisig.validateProof(dataHash, proof);
            expect(isCurrentSigners).to.be.true;

            // A proof with a smaller participating set should fail due to not reaching the threshold
            const invalidProof = await getWeightedSignersProof(
                data,
                domainSeparator,
                newSigners,
                participatingWallets.slice(1).map((weightedWallet) => weightedWallet.wallet),
            );

            await expectRevert(
                (gasOptions) => multisig.validateProof(dataHash, invalidProof, gasOptions),
                multisig,
                'LowSignaturesWeight',
            );
        } catch (err) {
            console.error(
                `Test failed with the following random signer set: ${JSON.stringify(
                    newSigners,
                    ' ',
                    2,
                )}\nparticipants: ${JSON.stringify(participatingWallets, ' ', 2)}`,
            );
            throw err;
        }
    });
});
