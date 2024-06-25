const { sortBy } = require('lodash');
const chai = require('chai');
const { ethers, network } = require('hardhat');
const {
    utils: { arrayify, keccak256, hashMessage, toUtf8Bytes, id },
    constants: { AddressZero, HashZero },
    Wallet,
} = ethers;
const { expect } = chai;

const { expectRevert, getRandomInt, getRandomSubarray, waitFor } = require('../utils');
const { getWeightedSignersProof, encodeWeightedSigners } = require('../../scripts/utils');

describe('BaseWeightedMultisig', () => {
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

        weightedSigners = {
            signers: signers.map((signer) => {
                return { signer: signer.address, weight: 1 };
            }),
            threshold,
            nonce: defaultNonce,
        };
        weightedSignersHash = keccak256(encodeWeightedSigners(weightedSigners));

        multisigFactory = await ethers.getContractFactory('TestBaseWeightedMultisig', owner);

        multisig = await multisigFactory.deploy(previousSignersRetention, domainSeparator, weightedSigners);
        await multisig.deployTransaction.wait(network.config.confirmations);
    });

    it('should validate storage constants', async () => {
        multisig = await multisigFactory.deploy(previousSignersRetention, domainSeparator, weightedSigners);
        await multisig.deployTransaction.wait(network.config.confirmations);
    });

    describe('queries', () => {
        it('previousSignersRetention', async () => {
            expect(await multisig.previousSignersRetention()).to.be.equal(previousSignersRetention);
        });

        it('domainSeparator', async () => {
            expect(await multisig.domainSeparator()).to.be.equal(domainSeparator);
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

        it('lastRotationTimestamp', async () => {
            const currentTimestamp = Math.floor(Date.now() / 1000);
            const delta = 30;

            expect(await multisig.lastRotationTimestamp()).to.be.gt(currentTimestamp - delta);
        });

        it('timeSinceRotation', async () => {
            const currentTimestamp = Math.floor(Date.now() / 1000);
            const lastRotationTimestamp = await multisig.lastRotationTimestamp();
            const delta = 30;

            expect(await multisig.timeSinceRotation()).to.be.gt(currentTimestamp - lastRotationTimestamp - delta);
        });
    });

    describe('rotateSigners', () => {
        describe('positive tests', () => {
            beforeEach(async () => {
                multisig = await multisigFactory.deploy(previousSignersRetention, domainSeparator, weightedSigners);
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

                await expect(multisig.rotateSigners(newSigners))
                    .to.emit(multisig, 'SignersRotated')
                    .withArgs(prevEpoch + 1, signersHash, encodeWeightedSigners(newSigners));

                expect(await multisig.epoch()).to.be.equal(prevEpoch + 1);
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

                await expect(multisig.rotateSigners(newSigners))
                    .to.emit(multisig, 'SignersRotated')
                    .withArgs(prevEpoch + 1, newSignersHash, encodeWeightedSigners(newSigners));

                const timeDelay = 5;
                await waitFor(timeDelay);

                const newSigners2 = { ...newSigners, nonce: id('1') };
                const newSigners2Hash = keccak256(encodeWeightedSigners(newSigners2));

                await expect(multisig.rotateSigners(newSigners2))
                    .to.emit(multisig, 'SignersRotated')
                    .withArgs(prevEpoch + 2, newSigners2Hash, encodeWeightedSigners(newSigners2));

                // Both weighted signer should be available
                expect(await multisig.epochBySignerHash(newSignersHash)).to.be.equal(prevEpoch + 1);
                expect(await multisig.epochBySignerHash(newSigners2Hash)).to.be.equal(prevEpoch + 2);
            });

            it('should allow signer rotation to a large set of 40 signers', async () => {
                const numSigners = 40;

                const defaultNonce = HashZero;
                const threshold = Math.floor(numSigners / 2) + 1;

                const wallets = sortBy(
                    Array(numSigners)
                        .fill(0)
                        .map(() => Wallet.createRandom()),
                    (wallet) => wallet.address.toLowerCase(),
                );
                const signers = wallets.map((wallet) => {
                    return { signer: wallet.address, weight: 1 };
                });
                const newSigners = {
                    signers,
                    threshold,
                    nonce: defaultNonce,
                };
                const encodedSigners = encodeWeightedSigners(newSigners);
                const signersHash = keccak256(encodedSigners);

                const prevEpoch = (await multisig.epoch()).toNumber();

                await expect(multisig.rotateSigners(newSigners))
                    .to.emit(multisig, 'SignersRotated')
                    .withArgs(prevEpoch + 1, signersHash, encodedSigners);

                const proof = await getWeightedSignersProof(
                    data,
                    domainSeparator,
                    newSigners,
                    wallets.slice(0, threshold),
                );

                await multisig.validateProofCall(dataHash, proof).then((tx) => tx.wait());
            });
        });

        describe('negative tests', () => {
            before(async () => {
                multisig = await multisigFactory.deploy(previousSignersRetention, domainSeparator, weightedSigners);
                await multisig.deployTransaction.wait(network.config.confirmations);
            });

            it('should revert if new signers length is zero', async () => {
                await expectRevert(
                    (gasOptions) =>
                        multisig.rotateSigners({ signers: [], threshold: 1, nonce: defaultNonce }, gasOptions),
                    multisig,
                    'InvalidSigners',
                );
            });

            it('should not allow transferring signers to address zero', async () => {
                await expectRevert(
                    (gasOptions) =>
                        multisig.rotateSigners(
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
                    multisig,
                    'InvalidSigners',
                );
            });

            it('should not allow transferring signers to duplicated signers', async () => {
                await expectRevert(
                    (gasOptions) =>
                        multisig.rotateSigners(
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
                    multisig,
                    'InvalidSigners',
                );
            });

            it('should not allow rotation to duplicate signers with the same nonce', async () => {
                await expectRevert(
                    (gasOptions) => multisig.rotateSigners(weightedSigners, gasOptions),
                    multisig,
                    'DuplicateSigners',
                    [keccak256(encodeWeightedSigners(weightedSigners))],
                );
            });

            it('should not allow transferring signers to unsorted signers', async () => {
                await expectRevert(
                    (gasOptions) =>
                        multisig.rotateSigners(
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
                    multisig,
                    'InvalidSigners',
                );
            });

            it('should not allow transferring signers with zero weights', async () => {
                await expectRevert(
                    (gasOptions) =>
                        multisig.rotateSigners(
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
                    multisig,
                    'InvalidWeights',
                );
            });

            it('should not allow transferring signers with zero threshold', async () => {
                await expectRevert(
                    (gasOptions) =>
                        multisig.rotateSigners(
                            {
                                signers: [{ signer: '0x6D4017D4b1DCd36e6EA88b7900e8eC64A1D1315b', weight: 1 }],
                                threshold: 0,
                                nonce: defaultNonce,
                            },
                            gasOptions,
                        ),
                    multisig,
                    'InvalidThreshold',
                );
            });

            it('should not allow transferring signers with threshold greater than sum of weights', async () => {
                await expectRevert(
                    (gasOptions) =>
                        multisig.rotateSigners(
                            {
                                signers: [{ signer: '0x6D4017D4b1DCd36e6EA88b7900e8eC64A1D1315b', weight: 1 }],
                                threshold: 2,
                                nonce: defaultNonce,
                            },
                            gasOptions,
                        ),
                    multisig,
                    'InvalidThreshold',
                );

                await expectRevert(
                    (gasOptions) =>
                        multisig.rotateSigners(
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

                // validate as an external call for gas usage reporting
                await multisig.validateProofCall(dataHash, proof).then((tx) => tx.wait());
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
                const newSigners = {
                    signers: [{ signer: signers[0].address, weight: 1 }],
                    threshold: 1,
                    nonce: defaultNonce,
                };

                const multisig = await multisigFactory.deploy(previousSignersRetention, domainSeparator, newSigners);
                await multisig.deployTransaction.wait(network.config.confirmations);

                const proof = await getWeightedSignersProof(data, domainSeparator, newSigners, signers.slice(0, 1));

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

            it('reject the proof if number of total signatures exceed required signatures', async () => {
                // sign with all signers, i.e more than threshold
                const proof = await getWeightedSignersProof(data, domainSeparator, weightedSigners, signers);

                await expectRevert(
                    async (gasOptions) => multisig.validateProof(dataHash, proof),
                    multisig,
                    'InvalidSignaturesLength',
                    [proof.signatures.length, signers.slice(0, threshold)],
                );
            });
        });
    });

    describe('validateProof with multiple signer sets', () => {
        const previousSignersRetention = 2;
        let multisig;

        before(async () => {
            multisig = await multisigFactory.deploy(previousSignersRetention, domainSeparator, weightedSigners);
            await multisig.deployTransaction.wait(network.config.confirmations);

            for (let i = 0; i <= previousSignersRetention + 1; i++) {
                const newSigners = {
                    ...weightedSigners,
                    nonce: id(`${i}`),
                };

                await multisig.rotateSigners(newSigners).then((tx) => tx.wait(network.config.confirmations));

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
        const multisig = await multisigFactory.deploy(previousSignersRetention, domainSeparator, weightedSigners);
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

            await expect(multisig.rotateSigners(newSigners))
                .to.emit(multisig, 'SignersRotated')
                .withArgs(prevEpoch + 1, signersHash, encodeWeightedSigners(newSigners));

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
