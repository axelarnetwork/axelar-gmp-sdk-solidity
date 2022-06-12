'use strict';

const chai = require('chai');
const {
  Contract,
  ContractFactory,
  utils: { keccak256, defaultAbiCoder },
} = require('ethers');
const { deployContract, MockProvider, solidity } = require('ethereum-waffle');
chai.use(solidity);
const { expect } = chai;
const {
  estimateGasForDeploy,
  estimateGasForDeployAndInit,
  deployContractConstant,
  deployAndInitContractConstant,
  predictContractConstant,
} = require('../index.js');
const ConstAddressDeployer = require('../dist/ConstAddressDeployer.json');
const BurnableMintableCappedERC20 = require('../build/BurnableMintableCappedERC20.json');
const BurnableMintableCappedERC20Init = require('../build/BurnableMintableCappedERC20Init.json');

const { it } = require('mocha');

describe('ConstAddressDeployer', () => {
  const [deployerWallet, userWallet] = new MockProvider().getWallets();
  let deployer;
  const name = 'test';
  const symbol = 'test';
  const decimals = 16;
  const capacity = 0;

  beforeEach(async () => {
    deployer = await deployContract(deployerWallet, ConstAddressDeployer);
  });

  describe('deploy', () => {
    it('should deploy to the predicted address', async () => {
      const key = 'a test key';
      const address = await predictContractConstant(
        deployer,
        userWallet,
        BurnableMintableCappedERC20,
        key,
        [name, symbol, decimals, capacity],
      );
      const contract = await deployContractConstant(
        deployer,
        userWallet,
        BurnableMintableCappedERC20,
        key,
        [name, symbol, decimals, capacity],
      );
      expect(contract.address).to.equal(address);
      expect(await contract.name()).to.equal(name);
      expect(await contract.symbol()).to.equal(symbol);
      expect(await contract.decimals()).to.equal(decimals);
      expect(await contract.cap()).to.equal(capacity);
    });

    it('should deploy to the predicted address even with a different nonce', async () => {
      const key = 'a test key';
      const address = await predictContractConstant(
        deployer,
        userWallet,
        BurnableMintableCappedERC20,
        key,
        [name, symbol, decimals, capacity],
      );
      const contract = await deployContractConstant(
        deployer,
        userWallet,
        BurnableMintableCappedERC20,
        key,
        [name, symbol, decimals, capacity],
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
      expect(await contract.cap()).to.equal(capacity);
    });

    it('should deploy the same contract twice to different addresses with different salts', async () => {
      const keys = ['a test key', 'another test key'];
      const addresses = [];

      for (const key of keys) {
        const address = await predictContractConstant(
          deployer,
          userWallet,
          BurnableMintableCappedERC20,
          key,
          [name, symbol, decimals, capacity],
        );
        addresses.push(address);
        const contract = await deployContractConstant(
          deployer,
          userWallet,
          BurnableMintableCappedERC20,
          key,
          [name, symbol, decimals, capacity],
        );
        expect(await contract.address).to.equal(address);
        expect(await contract.name()).to.equal(name);
        expect(await contract.symbol()).to.equal(symbol);
        expect(await contract.decimals()).to.equal(decimals);
        expect(await contract.cap()).to.equal(capacity);
      }

      expect(addresses[0]).to.not.equal(addresses[1]);
    });
  });

  describe('deployAndInit', () => {
    it('should deploy to the predicted address regardless of init data', async () => {
      const key = 'a test key';
      const address = await predictContractConstant(
        deployer,
        userWallet,
        BurnableMintableCappedERC20Init,
        key,
        [decimals, capacity],
      );
      const contract = await deployAndInitContractConstant(
        deployer,
        userWallet,
        BurnableMintableCappedERC20Init,
        key,
        [decimals, capacity],
        [name, symbol],
      );
      expect(await contract.address).to.equal(address);
      expect(await contract.name()).to.equal(name);
      expect(await contract.symbol()).to.equal(symbol);
      expect(await contract.decimals()).to.equal(decimals);
      expect(await contract.cap()).to.equal(capacity);
    });
  });
});
