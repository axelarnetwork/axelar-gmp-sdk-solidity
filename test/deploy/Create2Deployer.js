'use strict';

const chai = require('chai');
const { ethers } = require('hardhat');
const { expect } = chai;
const {
  utils: { keccak256 },
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
      const amount = ethers.utils.parseEther('0.00000001');

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
          '0x23d8aca292a77d60d3f4a128c454d067b8a6fa75c085857ebcf1124d1d3ed96b',
        berlin:
          '0x90349117f1e33e18eba59b7114d4bfc391b26cd5b1cf3be55319605944c5bec1',
        london:
          '0xaba2c6b6d3382b7ba32fe614a13d558fe52b744d5ceeb4d6ac50b6aa23d778e7',
      }[getEVMVersion()];

      expect(deployerBytecodeHash).to.be.equal(expected);
    });
  });
});
