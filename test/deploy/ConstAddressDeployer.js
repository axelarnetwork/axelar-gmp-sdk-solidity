'use strict';

const chai = require('chai');
const { ethers } = require('hardhat');
const { expect } = chai;
const {
  utils: { keccak256 },
} = ethers;
const {
  deployContractConstant,
  deployAndInitContractConstant,
  predictContractConstant,
} = require('../../index.js');
const BurnableMintableCappedERC20 = require('../../artifacts/contracts/test/ERC20MintableBurnable.sol/ERC20MintableBurnable.json');
const BurnableMintableCappedERC20Init = require('../../artifacts/contracts/test/ERC20MintableBurnableInit.sol/ERC20MintableBurnableInit.json');

const { getEVMVersion } = require('../utils.js');

describe('ConstAddressDeployer', () => {
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
      'ConstAddressDeployer',
      deployerWallet,
    );
  });

  beforeEach(async () => {
    deployer = (await deployerFactory.deploy().then((d) => d.deployed()))
      .address;
  });

  describe('deploy', () => {
    it('should deploy to the predicted address', async () => {
      const key = 'a test key';
      const address = await predictContractConstant(
        deployer,
        userWallet,
        BurnableMintableCappedERC20,
        key,
        [name, symbol, decimals],
      );
      const contract = await deployContractConstant(
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

      const contract = await deployContractConstant(
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
      const address = await predictContractConstant(
        deployer,
        userWallet,
        BurnableMintableCappedERC20,
        key,
        [name, symbol, decimals],
      );
      const contract = await deployContractConstant(
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
        const address = await predictContractConstant(
          deployer,
          userWallet,
          BurnableMintableCappedERC20,
          key,
          [name, symbol, decimals],
        );
        addresses.push(address);
        const contract = await deployContractConstant(
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
      const address = await predictContractConstant(
        deployer,
        userWallet,
        BurnableMintableCappedERC20Init,
        key,
        [decimals],
      );
      const contract = await deployAndInitContractConstant(
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
          '0xdddda3fa728d84caf2ddd6bfe62cdf3fb4855a0727196f960e063e34cfda42bc',
        berlin:
          '0x764c43af7e84275bd41d395b1157a078622f4b90cb6576e8f43f64c0f858d30d',
        london:
          '0x5da43f595ea8cbe4194e557647e99331a18af4b6386df9ac0b6d9392c72e4a6e',
      }[getEVMVersion()];

      expect(deployerBytecodeHash).to.be.equal(expected);
    });
  });
});
