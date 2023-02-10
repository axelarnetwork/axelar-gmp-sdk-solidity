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

const AxelarGateway = require('../artifacts/contracts/test/MockGateway.sol/MockGateway.json');
const GasService = require('../artifacts/contracts/test/MockGasService.sol/MockGasService.json');
const ERC20MintableBurnable = require('../artifacts/contracts/test/ERC20MintableBurnable.sol/ERC20MintableBurnable.json');
const Create3Deployer = require('../dist/Create3Deployer.json');
const TokenLinkerProxy = require('../artifacts/contracts/token-linker/TokenLinkerProxy.sol/TokenLinkerProxy.json');
const TokenLinkerLockUnlock = require('../artifacts/contracts/token-linker/TokenLinkerLockUnlock.sol/TokenLinkerLockUnlock.json');
const TokenLinkerMintBurn = require('../artifacts/contracts/token-linker/TokenLinkerMintBurn.sol/TokenLinkerMintBurn.json');
const TokenLinkerNative = require('../artifacts/contracts/token-linker/TokenLinkerNative.sol/TokenLinkerNative.json');

const getRandomID = () => id(Math.floor(Math.random() * 1e10).toString());

describe('TokenLinker', () => {
  const [ownerWallet, userWallet] = new MockProvider().getWallets();

  let gateway;
  let gasService;
  let tokenLinker;
  let token;
  let constAddressDeployer;

  const sourceChain = 'chainA';
  const destinationChain = 'chainB';
  const tokenName = 'testToken';
  const tokenSymbol = 'TEST';
  const decimals = 16;

  const approve = (payloadHash, commandId, txHash, txIndex) => {
    const approveData = defaultAbiCoder.encode(
      ['string', 'string', 'address', 'bytes32', 'bytes32', 'uint256'],
      [
        sourceChain,
        tokenLinker.address,
        tokenLinker.address,
        payloadHash,
        txHash,
        txIndex,
      ],
    );

    return gateway.approveContractCall(approveData, commandId);
  };

  beforeEach(async () => {
    gateway = await deployContract(ownerWallet, AxelarGateway);
    gasService = await deployContract(ownerWallet, GasService);
    constAddressDeployer = await deployContract(ownerWallet, Create3Deployer);

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
        [gateway.address, gasService.address, token.address],
      );
    });
    it('should lock token', async () => {
      const amount = 1e6;
      await token.connect(userWallet).mint(userWallet.address, amount);
      await token.connect(userWallet).approve(tokenLinker.address, amount);
      const payload = defaultAbiCoder.encode(
        ['address', 'uint256'],
        [userWallet.address, amount],
      );
      const payloadHash = keccak256(payload);
      await expect(
        tokenLinker
          .connect(userWallet)
          .sendToken(
            destinationChain,
            userWallet.address,
            amount,
            userWallet.address,
          ),
      )
        .to.emit(token, 'Transfer')
        .withArgs(userWallet.address, tokenLinker.address, amount)
        .and.to.emit(gateway, 'ContractCall')
        .withArgs(
          tokenLinker.address,
          destinationChain,
          tokenLinker.address.toLowerCase(),
          payloadHash,
          payload,
        );
    });
    it('should unlock token', async () => {
      const amount = 1e6;
      const payload = defaultAbiCoder.encode(
        ['address', 'uint256'],
        [userWallet.address, amount],
      );
      const payloadHash = keccak256(payload);
      const commandId = getRandomID();
      const txHash = getRandomID();
      const txIndex = 0;

      await (
        await token.connect(userWallet).mint(tokenLinker.address, amount)
      ).wait();

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

      await expect(
        tokenLinker
          .connect(userWallet)
          .execute(commandId, sourceChain, tokenLinker.address, payload),
      )
        .to.emit(token, 'Transfer')
        .withArgs(tokenLinker.address, userWallet.address, amount);
    });
  });

  describe('Mint-Burn', () => {
    beforeEach(async () => {
      tokenLinker = await deployUpgradable(
        constAddressDeployer.address,
        ownerWallet,
        TokenLinkerMintBurn,
        TokenLinkerProxy,
        [gateway.address, gasService.address, token.address],
      );
    });
    it('should burn token', async () => {
      const amount = 1e6;
      await token.connect(userWallet).mint(userWallet.address, amount);
      await token.connect(userWallet).approve(tokenLinker.address, amount);
      const payload = defaultAbiCoder.encode(
        ['address', 'uint256'],
        [userWallet.address, amount],
      );
      const payloadHash = keccak256(payload);
      await expect(
        tokenLinker
          .connect(userWallet)
          .sendToken(
            destinationChain,
            userWallet.address,
            amount,
            userWallet.address,
          ),
      )
        .to.emit(token, 'Transfer')
        .withArgs(userWallet.address, AddressZero, amount)
        .and.to.emit(gateway, 'ContractCall')
        .withArgs(
          tokenLinker.address,
          destinationChain,
          tokenLinker.address.toLowerCase(),
          payloadHash,
          payload,
        );
    });
    it('should mint token', async () => {
      const amount = 1e6;
      const payload = defaultAbiCoder.encode(
        ['address', 'uint256'],
        [userWallet.address, amount],
      );
      const payloadHash = keccak256(payload);
      const commandId = getRandomID();
      const txHash = getRandomID();
      const txIndex = 0;

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

      await expect(
        tokenLinker
          .connect(userWallet)
          .execute(commandId, sourceChain, tokenLinker.address, payload),
      )
        .to.emit(token, 'Transfer')
        .withArgs(AddressZero, userWallet.address, amount);
    });
  });

  describe('Native', () => {
    beforeEach(async () => {
      tokenLinker = await deployUpgradable(
        constAddressDeployer.address,
        ownerWallet,
        TokenLinkerNative,
        TokenLinkerProxy,
        [gateway.address, gasService.address],
      );
    });
    it('should lock native token', async () => {
      const amount = 1e6;
      const payload = defaultAbiCoder.encode(
        ['address', 'uint256'],
        [userWallet.address, amount],
      );
      const payloadHash = keccak256(payload);
      const linkerBalanceBefore = await tokenLinker.provider.getBalance(
        tokenLinker.address,
      );
      await expect(
        tokenLinker
          .connect(userWallet)
          .sendToken(
            destinationChain,
            userWallet.address,
            amount,
            userWallet.address,
            {
              value: amount,
            },
          ),
      )
        .to.emit(gateway, 'ContractCall')
        .withArgs(
          tokenLinker.address,
          destinationChain,
          tokenLinker.address.toLowerCase(),
          payloadHash,
          payload,
        );

      const linkerBalanceAfter = await tokenLinker.provider.getBalance(
        tokenLinker.address,
      );
      expect(linkerBalanceAfter - linkerBalanceBefore).to.equal(amount);
    });

    it('should unlock native token', async () => {
      const amount = 1e6;
      const payload = defaultAbiCoder.encode(
        ['address', 'uint256'],
        [userWallet.address, amount],
      );
      const payloadHash = keccak256(payload);
      const commandId = getRandomID();
      const txHash = getRandomID();
      const txIndex = 0;

      await tokenLinker.connect(ownerWallet).updateBalance({ value: amount });

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

      const linkerBalanceBefore = await tokenLinker.provider.getBalance(
        tokenLinker.address,
      );

      await (
        await tokenLinker
          .connect(userWallet)
          .execute(commandId, sourceChain, tokenLinker.address, payload)
      ).wait();

      const linkerBalanceAfter = await tokenLinker.provider.getBalance(
        tokenLinker.address,
      );
      expect(linkerBalanceBefore - linkerBalanceAfter).to.equal(amount);
    });
  });
});
