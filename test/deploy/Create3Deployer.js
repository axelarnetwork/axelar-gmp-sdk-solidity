'use strict';

const chai = require('chai');
const { expect } = chai;
const { ethers } = require('hardhat');
const {
    utils: { keccak256 },
} = ethers;
const { create3DeployContract, create3DeployAndInitContract, getCreate3Address } = require('../../index.js');
const { getSaltFromKey } = require('../../scripts/utils');
const BurnableMintableCappedERC20 = require('../../artifacts/contracts/test/token/ERC20MintableBurnable.sol/ERC20MintableBurnable.json');
const BurnableMintableCappedERC20Init = require('../../artifacts/contracts/test/token/ERC20MintableBurnableInit.sol/ERC20MintableBurnableInit.json');
const { getEVMVersion } = require('../utils');

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

        deployerFactory = await ethers.getContractFactory('Create3Deployer', deployerWallet);
    });

    beforeEach(async () => {
        deployer = (await deployerFactory.deploy().then((d) => d.deployed())).address;
    });

    describe('deploy', () => {
        it('should revert on deploy with empty bytecode', async () => {
            const key = 'a test key';
            const salt = getSaltFromKey(key);
            const bytecode = '0x';
            const deployerContract = deployerFactory.attach(deployer);

            await expect(deployerContract.connect(userWallet).deploy(bytecode, salt)).to.be.revertedWithCustomError(
                deployerContract,
                'EmptyBytecode',
            );
        });

        it('should deploy to the predicted address', async () => {
            const key = 'a test key';
            const address = await getCreate3Address(deployer, userWallet, key);
            const contract = await create3DeployContract(deployer, userWallet, BurnableMintableCappedERC20, key, [
                name,
                symbol,
                decimals,
            ]);
            expect(contract.address).to.equal(address);
            expect(await contract.name()).to.equal(name);
            expect(await contract.symbol()).to.equal(symbol);
            expect(await contract.decimals()).to.equal(decimals);
        });

        it('should deploy to the predicted address even with a different nonce', async () => {
            const key = 'a test key';
            const address = await getCreate3Address(deployer, userWallet, key);
            const contract = await create3DeployContract(deployer, userWallet, BurnableMintableCappedERC20, key, [
                name,
                symbol,
                decimals,
            ]);
            // Send an empty transaction to increase nonce.
            await userWallet.sendTransaction({
                to: userWallet.address,
                value: 0,
            });
            expect(await contract.address).to.equal(address);
            expect(await contract.name()).to.equal(name);
            expect(await contract.symbol()).to.equal(symbol);
            expect(await contract.decimals()).to.equal(decimals);
        });

        it('should deploy the same contract twice to different addresses with different salts', async () => {
            const keys = ['a test key', 'another test key'];
            const addresses = [];

            for (const key of keys) {
                const address = await getCreate3Address(deployer, userWallet, key);
                addresses.push(address);
                const contract = await create3DeployContract(deployer, userWallet, BurnableMintableCappedERC20, key, [
                    name,
                    symbol,
                    decimals,
                ]);
                expect(await contract.address).to.equal(address);
                expect(await contract.name()).to.equal(name);
                expect(await contract.symbol()).to.equal(symbol);
                expect(await contract.decimals()).to.equal(decimals);
            }

            expect(addresses[0]).to.not.equal(addresses[1]);
        });

        it('should revert if contract is deployed to an address where a contract already exists', async () => {
            const key = 'a test key';
            const address = await getCreate3Address(deployer, userWallet, key);
            const contract = await create3DeployContract(deployer, userWallet, BurnableMintableCappedERC20, key, [
                name,
                symbol,
                decimals,
            ]);
            expect(contract.address).to.equal(address);
            expect(await contract.name()).to.equal(name);
            expect(await contract.symbol()).to.equal(symbol);
            expect(await contract.decimals()).to.equal(decimals);

            const deployerContract = await deployerFactory.attach(deployer);

            await expect(
                create3DeployContract(deployer, userWallet, BurnableMintableCappedERC20, key, [name, symbol, decimals]),
            ).to.be.revertedWithCustomError(deployerContract, 'AlreadyDeployed');
        });

        it('should not revert if contract is deployed to address with preexisting ether balance', async () => {
            const key = 'a test key';
            const address = await getCreate3Address(deployer, userWallet, key);

            // Send eth to address
            const amount = 10;

            await userWallet.sendTransaction({
                to: address,
                value: amount,
            });

            const balance = await ethers.provider.getBalance(address);
            expect(balance).to.equal(amount);

            const contract = await create3DeployContract(deployer, userWallet, BurnableMintableCappedERC20, key, [
                name,
                symbol,
                decimals,
            ]);
            expect(contract.address).to.equal(address);
            expect(await contract.name()).to.equal(name);
            expect(await contract.symbol()).to.equal(symbol);
            expect(await contract.decimals()).to.equal(decimals);
        });

        it('should deploy with native value passed to the constructor', async () => {
            const key = 'a test key';
            // Send eth to address
            const amount = 10;

            const contract = await create3DeployContract(
                deployer,
                userWallet,
                BurnableMintableCappedERC20,
                key,
                [name, symbol, decimals],
                {
                    value: amount,
                },
            );

            expect(await ethers.provider.getBalance(contract.address)).to.equal(amount);
        });

        it('should revert if a contract is deployed a second time', async () => {
            const key = 'a test key';

            await create3DeployContract(deployer, userWallet, BurnableMintableCappedERC20, key, [
                name,
                symbol,
                decimals,
            ]);

            // Attempt to deploy contract again, should fail
            await expect(
                create3DeployContract(deployer, userWallet, BurnableMintableCappedERC20, key, [name, symbol, decimals]),
            ).to.be.reverted;
        });
    });

    describe('deployAndInit', () => {
        it('should deploy to the predicted address regardless of init data', async () => {
            const key = 'a test key';
            const address = await getCreate3Address(deployer, userWallet, key);
            const contract = await create3DeployAndInitContract(
                deployer,
                userWallet,
                BurnableMintableCappedERC20Init,
                key,
                [decimals],
                [name, symbol],
            );
            expect(await contract.address).to.equal(address);
            expect(await contract.name()).to.equal(name);
            expect(await contract.symbol()).to.equal(symbol);
            expect(await contract.decimals()).to.equal(decimals);
        });

        it('should deploy and init with native value passed to the constructor', async () => {
            const key = 'a test key';
            // Send eth to address
            const amount = 10;

            const contract = await create3DeployAndInitContract(
                deployer,
                userWallet,
                BurnableMintableCappedERC20Init,
                key,
                [decimals],
                [name, symbol],
                { value: amount },
            );

            expect(await ethers.provider.getBalance(contract.address)).to.equal(amount);
        });
    });

    describe('should preserve the bytecode [ @skip-on-coverage ]', () => {
        it('should preserve the deployer bytecode', async () => {
            const deployerBytecode = deployerFactory.bytecode;
            const deployerBytecodeHash = keccak256(deployerBytecode);

            const expected = {
                istanbul: '0xef1c5bd50bd5a182aaad6ae50f9ea02191f724a8b55fc0520644081ce4c7c7c2',
                berlin: '0xaa10718895071e0fa6ae05a3f2ee5f86d93128b213da45b5d6d83486e57e4521',
                london: '0xc67870e42bf359ea299318f3e3e78c16eb53da6e60224848e393de9ae872a220',
            }[getEVMVersion()];

            expect(deployerBytecodeHash).to.be.equal(expected);
        });
    });
});
