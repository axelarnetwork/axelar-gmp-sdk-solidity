const { sortBy } = require('lodash');
const chai = require('chai');
const { ethers, network } = require('hardhat');
const {
    utils: { arrayify, keccak256, toUtf8Bytes },
    constants: { HashZero },
    Wallet,
} = ethers;
const { expect } = chai;

const { getWeightedSignersProof, encodeWeightedSigners } = require('../../scripts/utils');

describe('BaseWeightedMultisig', () => {
    const previousSignersRetention = 0;
    const domainSeparator = keccak256(toUtf8Bytes('chain'));

    let owner;
    let testMultisigFactory;

    before(async () => {
        const wallets = await ethers.getSigners();

        owner = wallets[0];

        testMultisigFactory = await ethers.getContractFactory('TestBaseWeightedMultisig', owner);
    });

    it('should validate storage constants', async () => {
        const multisig = await testMultisigFactory.deploy(previousSignersRetention, domainSeparator);
        await multisig.deployTransaction.wait(network.config.confirmations);
    });

    it.only('should allow signer rotation to a large set of 40 signers', async () => {
        const numSigners = 40;

        const multisig = await testMultisigFactory.deploy(previousSignersRetention, domainSeparator);
        await multisig.deployTransaction.wait(network.config.confirmations);

        const data = '0x123abc123abc';
        const dataHash = keccak256(arrayify(data));
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
            .withArgs(prevEpoch + 1, signersHash);

        const proof = await getWeightedSignersProof(data, domainSeparator, newSigners, wallets.slice(0, threshold));

        await multisig.validateProof(dataHash, proof).then((tx) => tx.wait());
    });
});
