'use strict';

const chai = require('chai');
const { ethers } = require('hardhat');
const { expect } = chai;
const { deployContract } = require('../utils.js');

let ownerWallet;
before(async () => {
    const wallets = await ethers.getSigners();
    ownerWallet = wallets[0];
});

describe('Pausable', () => {
    let test;
    before(async () => {
        test = await deployContract(ownerWallet, 'PausableTest');
    });

    it('Should be able to set paused to true or false', async () => {
        await expect(test.setPaused(true)).to.emit(test, 'PausedSet').withArgs(true);
        expect(await test.isPaused()).to.equal(true);
        await expect(test.setPaused(false)).to.emit(test, 'PausedSet').withArgs(false);
        expect(await test.isPaused()).to.equal(false);
    });

    it('Should be able to execute notPaused functions only when not paused', async () => {
        await expect(test.setPaused(false)).to.emit(test, 'PausedSet').withArgs(false);
        await expect(test.testPaused()).to.emit(test, 'TestEvent');

        await expect(test.setPaused(true)).to.emit(test, 'PausedSet').withArgs(true);
        await expect(test.testPaused()).to.be.revertedWithCustomError(test, 'Paused');
    });
});

