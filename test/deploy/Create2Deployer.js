'use strict';

const chai = require('chai');
const { ethers } = require('hardhat');
const { expect } = chai;
const {
  utils: { keccak256 },
  ContractFactory,
} = ethers;
const {
  create2DeployContract,
  create2DeployAndInitContract,
  getCreate2Address,
} = require('../../index.js');
const { getSaltFromKey } = require('../../scripts/utils');
const BurnableMintableCappedERC20 = require('../../artifacts/contracts/test/token/ERC20MintableBurnable.sol/ERC20MintableBurnable.json');
const BurnableMintableCappedERC20Init = require('../../artifacts/contracts/test/token/ERC20MintableBurnableInit.sol/ERC20MintableBurnableInit.json');

const { getEVMVersion } = require('../utils.js');

describe('Create2Deployer', () => {
  let deployerWallet;
  let userWallet;

  let deployerFactory;
  let deployer;
  const name = 'test';
  const symbol = 'test';
  const decimals = 16;

  before(async () => {
    [deployerWallet, userWallet] = await ethers.getSigners();

    deployerFactory = await ethers.getContractFactory(
      'Create2Deployer',
      deployerWallet,
    );
  });

  beforeEach(async () => {
    deployer = (await deployerFactory.deploy().then((d) => d.deployed()))
      .address;
  });

  describe('deploy', () => {
    it('should revert on deploy with empty bytecode', async () => {
      const key = 'a test key';
      const salt = getSaltFromKey(key);
      const bytecode = '0x';
      const deployerContract = deployerFactory.attach(deployer);

      await expect(
        deployerContract.connect(userWallet).deploy(bytecode, salt),
      ).to.be.revertedWithCustomError(deployerContract, 'EmptyBytecode');
    });

    it('should deploy to the predicted address', async () => {
      const key = 'a test key';
      const address = await getCreate2Address(
        deployer,
        userWallet,
        BurnableMintableCappedERC20,
        key,
        [name, symbol, decimals],
      );

      const contract = await create2DeployContract(
        deployer,
        userWallet,
        BurnableMintableCappedERC20,
        key,
        [name, symbol, decimals],
      );
      expect(contract.address).to.equal(address);
      expect(await contract.name()).to.equal(name);
      expect(await contract.symbol()).to.equal(symbol);
      expect(await contract.decimals()).to.equal(decimals);
    });

    it('should deploy with native value passed to the constructor', async () => {
      const key = 'a test key';
      // Send eth to address
      const amount = 10;

      const contract = await create2DeployContract(
        deployer,
        userWallet,
        BurnableMintableCappedERC20,
        key,
        [name, symbol, decimals],
        { value: amount },
      );

      expect(await ethers.provider.getBalance(contract.address)).to.equal(
        amount,
      );
    });

    it('should deploy to the predicted address even with a different nonce', async () => {
      const key = 'a test key';
      const address = await getCreate2Address(
        deployer,
        userWallet,
        BurnableMintableCappedERC20,
        key,
        [name, symbol, decimals],
      );
      const contract = await create2DeployContract(
        deployer,
        userWallet,
        BurnableMintableCappedERC20,
        key,
        [name, symbol, decimals],
      );
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
        const address = await getCreate2Address(
          deployer,
          userWallet,
          BurnableMintableCappedERC20,
          key,
          [name, symbol, decimals],
        );
        addresses.push(address);
        const contract = await create2DeployContract(
          deployer,
          userWallet,
          BurnableMintableCappedERC20,
          key,
          [name, symbol, decimals],
        );
        expect(await contract.address).to.equal(address);
        expect(await contract.name()).to.equal(name);
        expect(await contract.symbol()).to.equal(symbol);
        expect(await contract.decimals()).to.equal(decimals);
      }

      expect(addresses[0]).to.not.equal(addresses[1]);
    });

    it('should revert when deployed twice with the same salt', async () => {
      const key = 'a test key';
      const address = await getCreate2Address(
        deployer,
        userWallet,
        BurnableMintableCappedERC20,
        key,
        [name, symbol, decimals],
      );

      const contract = await create2DeployContract(
        deployer,
        userWallet,
        BurnableMintableCappedERC20,
        key,
        [name, symbol, decimals],
      );
      expect(contract.address).to.equal(address);

      const deployerContract = deployerFactory.attach(deployer);

      const salt = getSaltFromKey(key);
      const factory = new ContractFactory(
        BurnableMintableCappedERC20.abi,
        BurnableMintableCappedERC20.bytecode,
      );
      const bytecode = factory.getDeployTransaction(
        name,
        symbol,
        decimals,
      ).data;

      await expect(
        deployerContract.connect(userWallet).deploy(bytecode, salt),
      ).to.be.revertedWithCustomError(deployerContract, 'AlreadyDeployed');
    });
  });

  describe('deployAndInit', () => {
    it('should deploy to the predicted address regardless of init data', async () => {
      const key = 'a test key';
      const address = await getCreate2Address(
        deployer,
        userWallet,
        BurnableMintableCappedERC20Init,
        key,
        [decimals],
      );
      const contract = await create2DeployAndInitContract(
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
  });

  describe('should preserve the bytecode [ @skip-on-coverage ]', () => {
    it('should preserve the deployer bytecode', async () => {
      const deployerBytecode = deployerFactory.bytecode;
      const deployerBytecodeHash = keccak256(deployerBytecode);

      const expected = {
        istanbul:
          '0xf6e2e62b8a59986a33bbb0de7bfc3a72de07f58984437068e8120dd164db40fa',
        berlin:
          '0xc1ee109720604e0bc559db0d54f901e14d78203ad696c20a3fa77e8b0ff909e5',
        london:
          '0x4d518217bf48fc4e4fab6c50182f088407a6f19388cab1e0a701313291e6b196',
      }[getEVMVersion()];

      expect(deployerBytecodeHash).to.be.equal(expected);
    });
  });
});
