'use strict';

const chai = require('chai');
const { ethers } = require('hardhat');
const { expect } = chai;
const { deployContract } = require('../utils.js');

describe('Pausable', () => {
  let test;
  let ownerWallet;

  before(async () => {
    const wallets = await ethers.getSigners();
    ownerWallet = wallets[0];

    test = await deployContract(ownerWallet, 'TestPausable');
  });

  it('Should be able to set paused to true or false', async () => {
    await expect(test.pause())
      .to.emit(test, 'Paused')
      .withArgs(ownerWallet.address);
    expect(await test.paused()).to.equal(true);
    await expect(test.unpause())
      .to.emit(test, 'Unpaused')
      .withArgs(ownerWallet.address);
    expect(await test.paused()).to.equal(false);
  });

  it('Should be able to execute notPaused functions only when not paused', async () => {
    await expect(test.pause())
      .to.emit(test, 'Paused')
      .withArgs(ownerWallet.address);
    await expect(test.testPaused()).to.be.revertedWithCustomError(
      test,
      'Pause',
    );

    await expect(test.unpause())
      .to.emit(test, 'Unpaused')
      .withArgs(ownerWallet.address);
    await expect(test.testPaused()).to.emit(test, 'TestEvent');
  });
});
