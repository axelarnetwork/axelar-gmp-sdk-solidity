'use strict';

const chai = require('chai');
const { expect } = chai;
const { ethers } = require('hardhat');

const { deployCreate3Upgradable, upgradeUpgradable } = require('../index');
const Proxy = require('../artifacts/contracts/test/ProxyTest.sol/ProxyTest.json');
const Upgradable = require('../artifacts/contracts/test/UpgradableTest.sol/UpgradableTest.json');

describe('Upgradable', () => {
  let upgradable;
  let create3DeployerFactory;
  let upgradableTestFactory;

  let ownerWallet;
  let userWallet;

  before(async () => {
    [ownerWallet, userWallet] = await ethers.getSigners();

    upgradableTestFactory = await ethers.getContractFactory(
      'UpgradableTest',
      ownerWallet,
    );

    create3DeployerFactory = await ethers.getContractFactory(
      'Create3Deployer',
      ownerWallet,
    );
  });

  beforeEach(async () => {
    const create3Deployer = await create3DeployerFactory
      .deploy()
      .then((d) => d.deployed());

    upgradable = await deployCreate3Upgradable(
      create3Deployer.address,
      ownerWallet,
      Upgradable,
      Proxy,
      [ownerWallet.address],
    );
  });

  it('should upgrade to a new implementation', async () => {
    const oldImplementation = await upgradable.implementation();

    await upgradeUpgradable(upgradable.address, ownerWallet, Upgradable, [
      ownerWallet.address,
    ]);

    const newImplementation = await upgradable.implementation();

    expect(newImplementation).not.to.be.equal(oldImplementation);
  });

  it('should transfer ownership', async () => {
    await upgradable.connect(ownerWallet).transferOwnership(userWallet.address);

    expect(await upgradable.owner()).to.be.equal(userWallet.address);
  });

  it('should revert if setup is called on the implementation', async () => {
    const implementationAddress = await upgradable.implementation();
    const setupParams = '0x';

    const implementation = await upgradableTestFactory.attach(
      implementationAddress,
    );

    // call setup on the implementation
    await expect(
      implementation.setup(setupParams),
    ).to.be.revertedWithCustomError(implementation, 'NotProxy');
  });
});
