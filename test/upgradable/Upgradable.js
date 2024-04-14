'use strict';

const chai = require('chai');
const { expect } = chai;
const { ethers } = require('hardhat');
const {
    utils: { keccak256, defaultAbiCoder },
    constants: { AddressZero },
} = ethers;

const { deployCreate3Upgradable, upgradeUpgradable } = require('../../scripts/upgradable');
const { expectRevert } = require('../utils');

const Proxy = require('../../artifacts/contracts/test/upgradable/TestProxy.sol/TestProxy.json');
const Upgradable = require('../../artifacts/contracts/test/upgradable/TestUpgradable.sol/TestUpgradable.json');

describe('Upgradable', () => {
    let upgradable;
    let create3DeployerFactory;
    let upgradableTestFactory;

    let ownerWallet;
    let userWallet;

    before(async () => {
        [ownerWallet, userWallet] = await ethers.getSigners();

        upgradableTestFactory = await ethers.getContractFactory('TestUpgradable', ownerWallet);

        create3DeployerFactory = await ethers.getContractFactory('Create3Deployer', ownerWallet);
    });

    describe('positive tests', () => {
        beforeEach(async () => {
            const create3Deployer = await create3DeployerFactory.deploy().then((d) => d.deployed());

            upgradable = await deployCreate3Upgradable(create3Deployer.address, ownerWallet, Upgradable, Proxy, []);
        });

        it('should store implementation address in the proxy, not the implementation', async () => {
            const implementationAddress = await upgradable.implementation();

            const implementation = upgradableTestFactory.attach(implementationAddress);

            expect(await implementation.implementation()).to.eq(AddressZero);
        });

        it('should upgrade to a new implementation', async () => {
            const oldImplementation = await upgradable.implementation();

            await upgradeUpgradable(upgradable.address, ownerWallet, Upgradable, []);

            const newImplementation = await upgradable.implementation();

            expect(newImplementation).not.to.be.equal(oldImplementation);
        });

        it('should upgrade to a new implementation with setup params', async () => {
            const oldImplementation = await upgradable.implementation();

            const setupParams = defaultAbiCoder.encode(['uint256'], [10]);

            await upgradeUpgradable(upgradable.address, ownerWallet, Upgradable, [], setupParams);

            const newImplementation = await upgradable.implementation();

            expect(newImplementation).not.to.be.equal(oldImplementation);
        });

        it('should transfer ownership', async () => {
            await upgradable.connect(ownerWallet).transferOwnership(userWallet.address);

            expect(await upgradable.owner()).to.be.equal(userWallet.address);
        });
    });

    describe('negative tests', () => {
        before(async () => {
            const create3Deployer = await create3DeployerFactory.deploy().then((d) => d.deployed());

            upgradable = await deployCreate3Upgradable(create3Deployer.address, ownerWallet, Upgradable, Proxy, []);
        });

        it('should revert on upgrade with invalid contract ID', async () => {
            const invalidUpgradableTestFactory = await ethers.getContractFactory('InvalidUpgradableTest', ownerWallet);

            const invalidUpgradableTest = await invalidUpgradableTestFactory.deploy().then((d) => d.deployed());

            const implementationCode = await ethers.provider.getCode(invalidUpgradableTest.address);

            const implementationCodeHash = keccak256(implementationCode);

            await expect(
                upgradable.upgrade(invalidUpgradableTest.address, implementationCodeHash, '0x'),
            ).to.be.revertedWithCustomError(upgradable, 'InvalidImplementation');
        });

        it('should revert on upgrade with invalid code hash', async () => {
            const invalidCodeHash = keccak256(0);

            await expect(upgradable.upgrade(upgradable.address, invalidCodeHash, '0x')).to.be.revertedWithCustomError(
                upgradable,
                'InvalidCodeHash',
            );
        });

        it('should revert on upgrade if setup fails', async () => {
            const newImplementation = await upgradableTestFactory.deploy().then((d) => d.deployed());

            const setupParams = '0x00';

            const implementationCode = await ethers.provider.getCode(newImplementation.address);

            const implementationCodeHash = keccak256(implementationCode);

            await expect(
                upgradable.upgrade(newImplementation.address, implementationCodeHash, setupParams),
            ).to.be.revertedWithCustomError(upgradable, 'SetupFailed');
        });

        it('should revert if setup is called on the implementation', async () => {
            const implementationAddress = await upgradable.implementation();
            const setupParams = '0x';

            const implementation = await upgradableTestFactory.attach(implementationAddress);

            // call setup on the implementation
            await expect(implementation.setup(setupParams)).to.be.revertedWithCustomError(implementation, 'NotProxy');
        });

        it.only('should revert if upgrade is called by non owner', async () => {
            const implementation = await upgradable.implementation();
            const implementationCode = await ethers.provider.getCode(implementation);
            const implementationCodeHash = keccak256(implementationCode);

            await expectRevert(
                (gasOptions) =>
                upgradable.connect(userWallet).upgrade(implementation, implementationCodeHash, '0x', gasOptions),
                upgradable,
                'NotOwner',
            );
        });
    });
});
