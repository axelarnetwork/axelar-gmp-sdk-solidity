const { sortBy } = require('lodash');
const chai = require('chai');
const { ethers, network } = require('hardhat');
const {
    utils: { arrayify, keccak256, hashMessage, toUtf8Bytes, id },
    constants: { AddressZero, HashZero },
    Wallet,
} = ethers;
const { expect } = chai;

const { expectRevert } = require('../utils');
const { getWeightedSignersProof, encodeWeightedSigners } = require('../../scripts/utils');

describe('BaseWeightedMultisig', () => {
    const threshold = 2;
    const domainSeparator = keccak256(toUtf8Bytes('chain'));
    const previousSignersRetention = 0;
    const data = '0x123abc123abc';
    const dataHash = keccak256(arrayify(data));
    const defaultNonce = HashZero;

    let owner;
    let signers;

    let multisigFactory;
    let testMultisigFactory;
    let multisig;
    let weightedSigners;
    let weightedSignersHash;

    before(async () => {
        const wallets = await ethers.getSigners();

        owner = wallets[0];
        signers = sortBy(wallets.slice(0, 3), (wallet) => wallet.address.toLowerCase());

        multisigFactory = await ethers.getContractFactory('AxelarGatewayWeightedAuth', owner);
        testMultisigFactory = await ethers.getContractFactory('TestBaseWeightedMultisig', owner);

        multisig = await multisigFactory.deploy(owner.address, domainSeparator, []);
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

    it('should validate storage constants', async () => {
        const testMultisigFactory = await ethers.getContractFactory('TestBaseWeightedMultisig', owner);

        const multisig = await testMultisigFactory.deploy(previousSignersRetention, domainSeparator);
        await multisig.deployTransaction.wait(network.config.confirmations);
    });

    describe('queries', () => {
        it('previousSignersRetention', async () => {
            expect(await multisig.previousSignersRetention()).to.be.equal(15);
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
                multisig = await multisigFactory.deploy(owner.address, domainSeparator, []);
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

            it('validate the proof from a single signer', async () => {
                const multisig = await testMultisigFactory.deploy(previousSignersRetention, domainSeparator);
                await multisig.deployTransaction.wait(network.config.confirmations);

                const newSigners = {
                    signers: [{ signer: signers[0].address, weight: 1 }],
                    threshold: 1,
                    nonce: defaultNonce,
                };

                await expect(multisig.rotateSigners(newSigners)).to.emit(multisig, 'SignersRotated');

                const proof = await getWeightedSignersProof(data, domainSeparator, newSigners, [signers[0]]);

                const isCurrentSigners = await multisig.validateProof(dataHash, proof);

                expect(isCurrentSigners).to.be.true;

                // validate with a tx to estimate gas cost
                await multisig.validate(dataHash, proof).then((tx) => tx.wait());
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
                    'MalformedSignatures',
                );
            });
        });
    });

    describe('validateProof with multiple signer sets', () => {
        const previousSignersRetention = 2;
        let multisig;

        before(async () => {
            multisig = await testMultisigFactory.deploy(previousSignersRetention, domainSeparator);
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

    it('should allow signer rotation to a large set', async () => {
        const multisig = await testMultisigFactory.deploy(previousSignersRetention, domainSeparator);
        await multisig.deployTransaction.wait(network.config.confirmations);

        const numSigners = 40;
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
            .withArgs(prevEpoch + 1, signersHash);

        const proof = await getWeightedSignersProof(data, domainSeparator, newSigners, wallets.slice(0, threshold));

        await multisig.validate(dataHash, proof).then((tx) => tx.wait());
    });
});
