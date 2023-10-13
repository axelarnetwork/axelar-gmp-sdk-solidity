'use strict';

const chai = require('chai');
const { ethers } = require('hardhat');
const { expect } = chai;

let ownerWallet;
before(async () => {
  const wallets = await ethers.getSigners();
  ownerWallet = wallets[0];
});

describe('NoReEntrancy', () => {
  let noReEntrancy;

  before(async () => {
    const factory = await ethers.getContractFactory(
      'TestNoReEntrancy',
      ownerWallet,
    );
    noReEntrancy = await factory.deploy().then((d) => d.deployed());
  });

  it('Should revert on reentrancy', async function () {
    await expect(noReEntrancy.testFunction()).to.be.revertedWithCustomError(
      noReEntrancy,
      'ReEntrancy',
    );
  });
});
