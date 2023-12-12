'use strict';

const chai = require('chai');
const { expect } = chai;
const { ethers } = require('hardhat');

const { getSaltFromKey } = require('../../scripts/utils');
const BurnableMintableCappedERC20 = require('../../artifacts/contracts/test/token/ERC20MintableBurnable.sol/ERC20MintableBurnable.json');
const { ContractFactory } = require('ethers');

describe('Create3Deployer', () => {
    let deployerWallet;
    let userWallet;

    let deployerFactory;
    let deployer;
    const name = 'test';
    const symbol = 'test';
    const decimals = 16;

    before(async () => {
        [deployerWallet, userWallet] = await ethers.getSigners();

        deployerFactory = await ethers.getContractFactory('TestCreate3', deployerWallet);
    });

    beforeEach(async () => {
        deployer = await deployerFactory.deploy().then((d) => d.deployed());
    });

    describe('deploy', () => {
        it('should revert on deploy with empty bytecode', async () => {
            const key = 'a test key';
            const salt = getSaltFromKey(key);
            const bytecode = '0x';

            await expect(deployer.connect(userWallet).deploy(bytecode, salt)).to.be.revertedWithCustomError(
                deployer,
                'EmptyBytecode',
            );
        });

        it('should deploy to the predicted address', async () => {
            const key = 'a test key';
            const salt = getSaltFromKey(key);

            const address = await deployer.deployedAddress(salt);

            const factory = new ContractFactory(BurnableMintableCappedERC20.abi, BurnableMintableCappedERC20.bytecode);
            const bytecode = factory.getDeployTransaction(name, symbol, decimals).data;

            await expect(deployer.deploy(bytecode, salt)).to.emit(deployer, 'Deployed').withArgs(address);
        });

        it('should not forward native value', async () => {
            const key = 'a test key';
            const salt = getSaltFromKey(key);

            const address = await deployer.deployedAddress(salt);

            const factory = new ContractFactory(BurnableMintableCappedERC20.abi, BurnableMintableCappedERC20.bytecode);
            const bytecode = factory.getDeployTransaction(name, symbol, decimals).data;

            await expect(deployer.deploy(bytecode, salt, { value: 10 }))
                .to.emit(deployer, 'Deployed')
                .withArgs(address);

            expect(await ethers.provider.getBalance(address)).to.equal(0);
            expect(await ethers.provider.getBalance(deployer.address)).to.equal(10);
        });
    });
});
