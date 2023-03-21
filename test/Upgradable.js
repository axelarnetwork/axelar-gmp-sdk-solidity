'use strict';

const chai = require('chai');
const { expect } = chai;
const { ethers } = require('hardhat');

const { deployCreate3Upgradable, upgradeUpgradable } = require('../index');
const Proxy = require('../artifacts/contracts/test/ProxyTest.sol/ProxyTest.json');
const Upgradable = require('../artifacts/contracts/test/UpgradableTest.sol/UpgradableTest.json');

describe('Upgradable', () => {
  let upgradable;
  let constAddressDeployerFactory;

  let wallets;
  let ownerWallet;
  let userWallet;

  before(async () => {
    wallets = await ethers.getSigners();
    ownerWallet = wallets[0];
    userWallet = wallets[1];

    constAddressDeployerFactory = await ethers.getContractFactory(
      'Create3Deployer',
      ownerWallet,
    );
  });

  beforeEach(async () => {
    const constAddressDeployer = await constAddressDeployerFactory
      .deploy()
      .then((d) => d.deployed());

    upgradable = await deployCreate3Upgradable(
      constAddressDeployer.address,
      ownerWallet,
      Upgradable,
      Proxy,
      [],
    );
  });

  it('should upgrade to a new implementation', async () => {
    const oldImplementation = await upgradable.implementation();

    await upgradeUpgradable(upgradable.address, ownerWallet, Upgradable, []);

    const newImplementation = await upgradable.implementation();

    expect(newImplementation).not.to.be.equal(oldImplementation);
  });

  it('should transfer ownership', async () => {
    await upgradable.connect(ownerWallet).transferOwnership(userWallet.address);

    await upgradable.connect(userWallet).acceptOwnership();

    expect(await upgradable.owner()).to.be.equal(userWallet.address);
  });
});
