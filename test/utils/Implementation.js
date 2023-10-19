'use strict';

const chai = require('chai');
const { ethers, network } = require('hardhat');
const { defaultAbiCoder } = ethers.utils;
const { expect } = chai;
const { deployContract } = require('../utils.js');

describe('Implementation', () => {
  let implementation, proxy;
  let ownerWallet;

  const val = 123;

  before(async () => {
    const wallets = await ethers.getSigners();
    ownerWallet = wallets[0];

    implementation = await deployContract(ownerWallet, 'TestImplementation');
    proxy = await deployContract(ownerWallet, 'InitProxy', []);

    const params = defaultAbiCoder.encode(['uint256'], [val]);
    await proxy
      .init(implementation.address, ownerWallet.address, params)
      .then((d) => d.wait(network.config.confirmations));

    const factory = await ethers.getContractFactory(
      'TestImplementation',
      ownerWallet,
    );

    proxy = factory.attach(proxy.address);
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
