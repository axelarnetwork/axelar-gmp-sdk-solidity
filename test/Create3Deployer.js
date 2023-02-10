'use strict';

const chai = require('chai');
const { deployContract, MockProvider, solidity } = require('ethereum-waffle');
chai.use(solidity);
const { expect } = chai;
const {
  deployContractConstant,
  predictContractConstant,
} = require('../index.js');
const Create3Deployer = require('../dist/Create3Deployer.json');
const BurnableMintableCappedERC20 = require('../artifacts/contracts/test/ERC20MintableBurnable.sol/ERC20MintableBurnable.json');

describe('Create3Deployer', () => {
  const [deployerWallet, userWallet] = new MockProvider().getWallets();
  let deployer;
  const name = 'test';
  const symbol = 'test';
  const decimals = 16;

  beforeEach(async () => {
    deployer = (await deployContract(deployerWallet, Create3Deployer)).address;
  });

  describe('deploy', () => {
    it('should deploy to the predicted address', async () => {
      const key = 'a test key';
      const address = await predictContractConstant(deployer, userWallet, key);
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

    it('should deploy to the predicted address even with a different nonce', async () => {
      const key = 'a test key';
      const address = await predictContractConstant(deployer, userWallet, key);
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
          key,
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
});
