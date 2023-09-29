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

describe('Operatable', () => {
    let test;
    before(async () => {
        test = await deployContract(ownerWallet, 'OperatorableTest', [ownerWallet.address]);
    });

    it('Should be able to run the onlyOperatorable function as the operator', async () => {
        await (await test.testOperatorable()).wait();
        expect(await test.nonce()).to.equal(1);
    });

    it('Should not be able to run the onlyOperatorable function as not the operator', async () => {
        await expect(test.connect(otherWallet).testOperatorable()).to.be.revertedWithCustomError(test, 'NotOperator');
    });

    it('Should be able to change the operator only as the operator', async () => {
        expect(await test.operator()).to.equal(ownerWallet.address);
        await expect(test.transferOperatorship(otherWallet.address)).to.emit(test, 'OperatorshipTransferred').withArgs(otherWallet.address);
        expect(await test.operator()).to.equal(otherWallet.address);
        await expect(test.transferOperatorship(otherWallet.address)).to.be.revertedWithCustomError(test, 'NotOperator');
    });
});

