'use strict';

const chai = require('chai');
const {
  Contract,
  utils: { defaultAbiCoder, keccak256, id },
} = require('ethers');
const { deployContract, MockProvider, solidity } = require('ethereum-waffle');
const { deployUpgradable } = require('../index.js');
chai.use(solidity);
const { expect } = chai;

const AxelarGateway = require('../build/MockGateway.json');
const BurnableMintableCappedERC20 = require('../build/BurnableMintableCappedERC20.json');
const ConstAddressDeployer = require('../build/ConstAddressDeployer.json');
const TokenLinkerProxy = require('../build/TokenLinkerProxy.json');
const TokenLinkerLockUnlock = require('../build/TokenLinkerLockUnlockExample.json');
const TokenLinkerMintBurn = require('../build/TokenLinkerMintBurnExample.json');
const TokenLinkerNative = require('../build/TokenLinkerNativeExample.json');

const getRandomID = () => id(Math.floor(Math.random() * 1e10).toString());

describe('TokenLinker', () => {
  const [
    ownerWallet,
    operatorWallet,
    userWallet,
    adminWallet1,
    adminWallet2,
    adminWallet3,
    adminWallet4,
    adminWallet5,
    adminWallet6,
  ] = new MockProvider().getWallets();
  const adminWallets = [
    adminWallet1,
    adminWallet2,
    adminWallet3,
    adminWallet4,
    adminWallet5,
    adminWallet6,
  ];

  let gateway;
  let tokenLinker;
  let token;
  let constAddressDeployer

  const sourceChain = 'chainA';
  const destinationChain = 'chainB';
  const tokenName = 'testToken';
  const tokenSymbol = 'TEST';
  const decimals = 16;
  const capacity = 0;

  beforeEach(async () => {
    gateway = await deployContract(ownerWallet, AxelarGateway);
    constAddressDeployer = await deployContract(
      ownerWallet,
      ConstAddressDeployer,
    );

    token = await deployContract(ownerWallet, BurnableMintableCappedERC20, [
      tokenName,
      tokenSymbol,
      decimals,
      capacity,
    ]);
  });

  describe('Lock-Unlock', () => {
    beforeEach(async () => {
      tokenLinker = await deployUpgradable(
        constAddressDeployer.address, 
        ownerWallet, 
        TokenLinkerLockUnlock, 
        TokenLinkerProxy,
        [gateway.address, token.address],
      );
    });
    it('should lock token', async () => {
      const amount = 1e6;
      await token.connect(userWallet).mint(amount);
      await token.connect(userWallet).approve(tokenLinker.address, amount);
      const payload = defaultAbiCoder.encode(['address', 'uint256'], [userWallet.address, amount]);
      expect(tokenLinker.connect(userWallet).sendToken(destinationChain, userWallet.address, amount))
          .to.emmit(token, 'Transfer')
          .withArgs(
            userWallet.address,
            tokenLinker.address,
            amount,
          )
          .and.to.emmit(gateway, 'CallContract')
          .withArgs(
            tokenLinker.address,
            destinationChain,
            tokenLinker.address,
            payloadHash,
            payload,
          )
    });
  });

});
