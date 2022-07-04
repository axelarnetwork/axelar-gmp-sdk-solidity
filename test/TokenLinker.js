'use strict';

const chai = require('chai');
const {
  utils: { defaultAbiCoder, keccak256, id },
  constants: { AddressZero },
} = require('ethers');
const { deployContract, MockProvider, solidity } = require('ethereum-waffle');
const { deployUpgradable } = require('../index.js');
chai.use(solidity);
const { expect } = chai;

const AxelarGateway = require('../build/MockGateway.json');
const ERC20MintableBurnable = require('../build/ERC20MintableBurnable.json');
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
  let constAddressDeployer;

  const sourceChain = 'chainA';
  const destinationChain = 'chainB';
  const tokenName = 'testToken';
  const tokenSymbol = 'TEST';
  const decimals = 16;
  const capacity = 0;

  const approve = (payloadHash, commandId, txHash, txIndex) => {
    const approveData = defaultAbiCoder.encode(
      [
        'string',
        'string',
        'address',
        'bytes32',
        'bytes32',
        'uint256',
      ],
      [
        sourceChain,
        tokenLinker.address,
        tokenLinker.address,
        payloadHash,
        txHash,
        txIndex,
      ],
    );

    return gateway.approveContractCall(
        approveData,
        commandId,
      );
  }

  beforeEach(async () => {
    gateway = await deployContract(ownerWallet, AxelarGateway);
    constAddressDeployer = await deployContract(
      ownerWallet,
      ConstAddressDeployer,
    );

    token = await deployContract(ownerWallet, ERC20MintableBurnable, [
      tokenName,
      tokenSymbol,
      decimals,
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
      await token.connect(userWallet).mint(userWallet.address, amount);
      await token.connect(userWallet).approve(tokenLinker.address, amount);
      const payload = defaultAbiCoder.encode(['address', 'uint256'], [userWallet.address, amount]);
      const payloadHash = keccak256(payload);
      await expect(tokenLinker.connect(userWallet).sendToken(destinationChain, userWallet.address, amount))
          .to.emit(token, 'Transfer')
          .withArgs(
            userWallet.address,
            tokenLinker.address,
            amount,
          )
          .and.to.emit(gateway, 'ContractCall')
          .withArgs(
            tokenLinker.address,
            destinationChain,
            tokenLinker.address.toLowerCase(),
            payloadHash,
            payload,
          )
    });
    it('should unlock token', async () => {
      const amount = 1e6;
      const payload = defaultAbiCoder.encode(['address', 'uint256'], [userWallet.address, amount]);
      const payloadHash = keccak256(payload);
      const commandId = getRandomID();
      const txHash = getRandomID();
      const txIndex = 0;

      await (await token.connect(userWallet).mint(tokenLinker.address, amount)).wait();
      
      await expect(approve(payloadHash, commandId, txHash, txIndex))
        .to.emit(gateway, 'ContractCallApproved')
        .withArgs(
          commandId,
          sourceChain,
          tokenLinker.address,
          tokenLinker.address,
          payloadHash,
          txHash,
          txIndex,
        );
        
      await expect(tokenLinker.connect(userWallet).execute(commandId, sourceChain, tokenLinker.address, payload))
          .to.emit(token, 'Transfer')
          .withArgs(
            tokenLinker.address,
            userWallet.address,
            amount,
          )
    });
  });

  describe('Mint-Burn', () => {
    beforeEach(async () => {
      tokenLinker = await deployUpgradable(
        constAddressDeployer.address, 
        ownerWallet, 
        TokenLinkerMintBurn,
        TokenLinkerProxy,
        [gateway.address, token.address],
      );
    });
    it('should burn token', async () => {
      const amount = 1e6;
      await token.connect(userWallet).mint(userWallet.address, amount);
      await token.connect(userWallet).approve(tokenLinker.address, amount);
      const payload = defaultAbiCoder.encode(['address', 'uint256'], [userWallet.address, amount]);
      const payloadHash = keccak256(payload);
      await expect(tokenLinker.connect(userWallet).sendToken(destinationChain, userWallet.address, amount))
          .to.emit(token, 'Transfer')
          .withArgs(
            userWallet.address,
            AddressZero,
            amount,
          )
          .and.to.emit(gateway, 'ContractCall')
          .withArgs(
            tokenLinker.address,
            destinationChain,
            tokenLinker.address.toLowerCase(),
            payloadHash,
            payload,
          )
    });
    it('should mint token', async () => {
      const amount = 1e6;
      const payload = defaultAbiCoder.encode(['address', 'uint256'], [userWallet.address, amount]);
      const payloadHash = keccak256(payload);
      const commandId = getRandomID();
      const txHash = getRandomID();
      const txIndex = 0;

      await (await token.connect(userWallet).mint(tokenLinker.address, amount)).wait();
      
      await expect(approve(payloadHash, commandId, txHash, txIndex))
        .to.emit(gateway, 'ContractCallApproved')
        .withArgs(
          commandId,
          sourceChain,
          tokenLinker.address,
          tokenLinker.address,
          payloadHash,
          txHash,
          txIndex,
        );
        
      await expect(tokenLinker.connect(userWallet).execute(commandId, sourceChain, tokenLinker.address, payload))
          .to.emit(token, 'Transfer')
          .withArgs(
            AddressZero,
            userWallet.address,
            amount,
          )
    });
  });

  describe('Native', () => {
    beforeEach(async () => {
      tokenLinker = await deployUpgradable(
        constAddressDeployer.address, 
        ownerWallet, 
        TokenLinkerNative,
        TokenLinkerProxy,
        [gateway.address],
      );
    });
    it('should lock native token', async () => {
      const amount = 1e6;
      const payload = defaultAbiCoder.encode(['address', 'uint256'], [userWallet.address, amount]);
      const payloadHash = keccak256(payload);
      const linkerBalanceBefore = await tokenLinker.provider.getBalance(tokenLinker.address);
      await expect(
        tokenLinker.connect(userWallet).sendToken(destinationChain, userWallet.address, amount, {value: amount})
      ).to.emit(gateway, 'ContractCall')
          .withArgs(
            tokenLinker.address,
            destinationChain,
            tokenLinker.address.toLowerCase(),
            payloadHash,
            payload,
          );

      const linkerBalanceAfter = await tokenLinker.provider.getBalance(tokenLinker.address);
      expect(linkerBalanceAfter - linkerBalanceBefore).to.equal(amount);
    });
    
    it('should unlock native token', async () => {
      const amount = 1e6;
      const payload = defaultAbiCoder.encode(['address', 'uint256'], [userWallet.address, amount]);
      const payloadHash = keccak256(payload);
      const commandId = getRandomID();
      const txHash = getRandomID();
      const txIndex = 0;

      await tokenLinker.connect(ownerWallet).updateBalance({value: amount});

      await expect(approve(payloadHash, commandId, txHash, txIndex))
        .to.emit(gateway, 'ContractCallApproved')
        .withArgs(
          commandId,
          sourceChain,
          tokenLinker.address,
          tokenLinker.address,
          payloadHash,
          txHash,
          txIndex,
        );
      
      const linkerBalanceBefore = await tokenLinker.provider.getBalance(tokenLinker.address);
     
      await (await tokenLinker.connect(userWallet).execute(commandId, sourceChain, tokenLinker.address, payload)).wait();
      
      const linkerBalanceAfter = await tokenLinker.provider.getBalance(tokenLinker.address);
      expect(linkerBalanceBefore - linkerBalanceAfter).to.equal(amount);
    });
  });
});
