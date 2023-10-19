'use strict';

const chai = require('chai');
const { ethers } = require('hardhat');
const { deployContract } = require('../utils');
const { expect } = chai;

describe('guard', () => {
  let guard;
  let ownerWallet;

  before(async () => {
    const wallets = await ethers.getSigners();
    ownerWallet = wallets[0];

    guard = await deployContract(ownerWallet, 'TestReentrancyGuard');
  });

  it('Should revert on reentrancy', async function () {
    await expect(guard.testFunction()).to.be.revertedWithCustomError(
      guard,
      'ReentrantCall',
    );
  });
});
