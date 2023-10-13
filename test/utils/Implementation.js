'use strict';

const chai = require('chai');
const { ethers } = require('hardhat');
const { Contract } = ethers;
const { defaultAbiCoder } = ethers.utils;
const { expect } = chai;
const { deployContract } = require('../utils.js');

const TestImplementation = require('../../artifacts/contracts/test/upgradable/TestImplementation.sol/TestImplementation.json');

let ownerWallet;
before(async () => {
  const wallets = await ethers.getSigners();
  ownerWallet = wallets[0];
});

describe('Implementation', () => {
  let implementation, proxy;

  const val = 123;

  before(async () => {
    implementation = await deployContract(ownerWallet, 'TestImplementation');
    proxy = await deployContract(ownerWallet, 'InitProxy', []);

    const params = defaultAbiCoder.encode(['uint256'], [val]);
    proxy.init(implementation.address, ownerWallet.address, params);

    proxy = new Contract(proxy.address, TestImplementation.abi, ownerWallet);
  });

  it('Should test the implementation contract', async () => {
    expect(await proxy.val()).to.equal(val);

    const params = defaultAbiCoder.encode(['uint256'], [val]);
    await expect(implementation.setup(params)).to.be.revertedWithCustomError(
      implementation,
      'NotProxy',
    );
  });
});
