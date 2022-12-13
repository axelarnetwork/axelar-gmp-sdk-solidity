'use strict';

const chai = require('chai');
const { deployContract, MockProvider, solidity } = require('ethereum-waffle');
chai.use(solidity);
const { expect } = chai;

const { deployUpgradable, upgradeUpgradable } = require('../index');
const ConstAddressDeployer = require('../dist/ConstAddressDeployer.json');
const Proxy = require('../artifacts/contracts/test/ProxyTest.sol/ProxyTest.json');
const Upgradable = require('../artifacts/contracts/test/UpgradableTest.sol/UpgradableTest.json');

describe('Upgradable', () => {
  const [ownerWallet, userWallet] = new MockProvider().getWallets();
  let upgradable;

  beforeEach(async () => {
    const constAddressDeployer = await deployContract(
      ownerWallet,
      ConstAddressDeployer,
    );

    upgradable = await deployUpgradable(
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
    console.log('transferOwnership');

    await upgradable.connect(userWallet).acceptOwnership();

    expect(await upgradable.owner()).to.be.equal(userWallet.address);
  });
});
