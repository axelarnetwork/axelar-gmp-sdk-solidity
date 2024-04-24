'use strict';

const path = require('path');
const chai = require('chai');
const { expect } = chai;
const { ethers, config } = require('hardhat');
const {
    utils: { keccak256, defaultAbiCoder },
    constants: { AddressZero },
} = ethers;

const { deployCreate2InitUpgradable, deployCreate3Upgradable, upgradeUpgradable } = require('../../scripts/upgradable');
const { expectRevert } = require('../utils');

describe('Upgradable', () => {
    let upgradable;
    let implementation;
    let implementationCodeHash;
    let upgradableFactory;
    let proxyFactory;

    let ownerWallet;
    let userWallet;

    before(async () => {
        [ownerWallet, userWallet] = await ethers.getSigners();

        proxyFactory = await ethers.getContractFactory('TestProxy', ownerWallet);
        upgradableFactory = await ethers.getContractFactory('TestUpgradable', ownerWallet);
    });

    describe('positive tests', () => {
        beforeEach(async () => {
            implementation = await upgradableFactory.deploy().then((d) => d.deployed());
            implementationCodeHash = keccak256(await ethers.provider.getCode(implementation.address));

            const proxy = await proxyFactory
                .deploy(implementation.address, ownerWallet.address, '0x')
                .then((d) => d.deployed());
            upgradable = upgradableFactory.attach(proxy.address);
        });

        it('should store implementation address in the proxy, not the implementation', async () => {
            const implementationAddress = await upgradable.implementation();

            const implementation = upgradableFactory.attach(implementationAddress);

            expect(await implementation.implementation()).to.eq(AddressZero);
        });

        it('should upgrade to a new implementation', async () => {
            const newImplementation = await upgradableFactory.deploy().then((d) => d.deployed());
            const newImplementationCodeHash = keccak256(await ethers.provider.getCode(newImplementation.address));

            await expect(upgradable.upgrade(newImplementation.address, newImplementationCodeHash, '0x'))
                .to.emit(upgradable, 'Upgraded')
                .withArgs(newImplementation.address);

            expect(await upgradable.implementation()).to.be.equal(newImplementation.address);
        });

        it('should upgrade to a new implementation with setup params', async () => {
            const setupParams = defaultAbiCoder.encode(['uint256'], [10]);
            const newImplementation = await upgradableFactory.deploy().then((d) => d.deployed());
            const newImplementationCodeHash = keccak256(await ethers.provider.getCode(newImplementation.address));

            await expect(upgradable.upgrade(newImplementation.address, newImplementationCodeHash, setupParams))
                .to.emit(upgradable, 'Upgraded')
                .withArgs(newImplementation.address);

            expect(await upgradable.implementation()).to.be.equal(newImplementation.address);
        });

        it('should upgrade to the same implementation', async () => {
            await expect(upgradable.upgrade(implementation.address, implementationCodeHash, '0x'))
                .to.emit(upgradable, 'Upgraded')
                .withArgs(implementation.address);

            expect(await upgradable.implementation()).to.be.equal(implementation.address);
        });

        it('should upgrade to the same implementation with setup params', async () => {
            const setupParams = defaultAbiCoder.encode(['uint256'], [10]);

            await expect(upgradable.upgrade(implementation.address, implementationCodeHash, setupParams))
                .to.emit(upgradable, 'Upgraded')
                .withArgs(implementation.address);

            expect(await upgradable.implementation()).to.be.equal(implementation.address);
        });

        it('should transfer ownership', async () => {
            await upgradable.connect(ownerWallet).transferOwnership(userWallet.address);

            expect(await upgradable.owner()).to.be.equal(userWallet.address);
        });

        describe('with Deployers', () => {
            it('should deploy upgradable contract with create2 deployer', async () => {
                const create2DeployerFactory = await ethers.getContractFactory('Create2Deployer', ownerWallet);
                const deployer = await create2DeployerFactory.deploy().then((d) => d.deployed());

                const Proxy = require(path.join(
                    config.paths.artifacts,
                    'contracts/test/upgradable/TestInitProxy.sol/TestInitProxy.json',
                ));
                const Upgradable = require(path.join(
                    config.paths.artifacts,
                    'contracts/test/upgradable/TestUpgradable.sol/TestUpgradable.json',
                ));

                const upgradable = await deployCreate2InitUpgradable(
                    deployer.address,
                    ownerWallet,
                    Upgradable,
                    Proxy,
                    [],
                );

                const oldImplementation = await upgradable.implementation();

                await upgradeUpgradable(upgradable.address, ownerWallet, Upgradable, []);

                const newImplementation = await upgradable.implementation();

                expect(newImplementation).not.to.be.equal(oldImplementation);
            });

            it('should deploy upgradable contract with create3 deployer', async () => {
                const create3DeployerFactory = await ethers.getContractFactory('Create3Deployer', ownerWallet);
                const deployer = await create3DeployerFactory.deploy().then((d) => d.deployed());

                const Proxy = require(path.join(
                    config.paths.artifacts,
                    'contracts/test/upgradable/TestInitProxy.sol/TestProxy.json',
                ));
                const Upgradable = require(path.join(
                    config.paths.artifacts,
                    'contracts/test/upgradable/TestUpgradable.sol/TestUpgradable.json',
                ));

                const upgradable = await deployCreate3Upgradable(deployer.address, ownerWallet, Upgradable, Proxy, []);

                const oldImplementation = await upgradable.implementation();

                await upgradeUpgradable(upgradable.address, ownerWallet, Upgradable, []);

                const newImplementation = await upgradable.implementation();

                expect(newImplementation).not.to.be.equal(oldImplementation);
            });
        });
    });

    describe('negative tests', () => {
        before(async () => {
            const implementation = await upgradableFactory.deploy().then((d) => d.deployed());
            const proxy = await proxyFactory
                .deploy(implementation.address, ownerWallet.address, '0x')
                .then((d) => d.deployed());
            upgradable = upgradableFactory.attach(proxy.address);
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
            const newImplementation = await upgradableFactory.deploy().then((d) => d.deployed());

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

            const implementation = await upgradableFactory.attach(implementationAddress);

            // call setup on the implementation
            await expect(implementation.setup(setupParams)).to.be.revertedWithCustomError(implementation, 'NotProxy');
        });

        it('should revert if upgrade is called by non owner', async () => {
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
