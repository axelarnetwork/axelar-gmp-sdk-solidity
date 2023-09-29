'use strict';

const chai = require('chai');
const { ethers } = require('hardhat');
const { expect } = chai;
const { deployContract } = require('../utils.js');

let ownerWallet, otherWallet;
before(async () => {
    const wallets = await ethers.getSigners();
    ownerWallet = wallets[0];
    otherWallet = wallets[1];
});

describe('Distributable', () => {
    let test;
    before(async () => {
        test = await deployContract(ownerWallet, 'DistributableTest', [ownerWallet.address]);
    });

    it('Should be able to run the onlyDistributor function as the distributor', async () => {
        await (await test.testDistributable()).wait();
        expect(await test.nonce()).to.equal(1);
    });

    it('Should not be able to run the onlyDistributor function as not the distributor', async () => {
        await expect(test.connect(otherWallet).testDistributable()).to.be.revertedWithCustomError(test, 'NotDistributor');
    });

    it('Should be able to change the distributor only as the distributor', async () => {
        expect(await test.distributor()).to.equal(ownerWallet.address);
        await expect(test.transferDistributorship(otherWallet.address))
            .to.emit(test, 'DistributorshipTransferred')
            .withArgs(otherWallet.address);
        expect(await test.distributor()).to.equal(otherWallet.address);
        await expect(test.transferDistributorship(otherWallet.address)).to.be.revertedWithCustomError(test, 'NotDistributor');
    });
});

