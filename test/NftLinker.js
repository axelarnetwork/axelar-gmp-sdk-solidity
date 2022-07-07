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
const ERC721MintableBurnable = require('../build/ERC721MintableBurnable.json');
const ConstAddressDeployer = require('../build/ConstAddressDeployer.json');
const NftLinkerProxy = require('../build/NftLinkerProxy.json');
const NftLinkerLockUnlock = require('../build/NftLinkerLockUnlockExample.json');
const NftLinkerMintBurn = require('../build/NftLinkerMintBurnExample.json');

const getRandomID = () => id(Math.floor(Math.random() * 1e10).toString());

describe('NftLinker', () => {
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
  let nftLinker;
  let token;
  let constAddressDeployer;

  const sourceChain = 'chainA';
  const destinationChain = 'chainB';
  const tokenName = 'testToken';
  const tokenSymbol = 'TEST';

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
        nftLinker.address,
        nftLinker.address,
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

    token = await deployContract(ownerWallet, ERC721MintableBurnable, [
      tokenName,
      tokenSymbol,
    ]);
  });

  describe('Lock-Unlock', () => {
    beforeEach(async () => {
      nftLinker = await deployUpgradable(
        constAddressDeployer.address, 
        ownerWallet, 
        NftLinkerLockUnlock,
        NftLinkerProxy,
        [gateway.address, token.address],
      );
    });
    it('should lock nft', async () => {
      const tokenid = 1e6;
      await token.connect(userWallet).mint(userWallet.address, tokenid);
      await token.connect(userWallet).approve(nftLinker.address, tokenid);
      const payload = defaultAbiCoder.encode(['address', 'uint256'], [userWallet.address, tokenid]);
      const payloadHash = keccak256(payload);
      await expect(nftLinker.connect(userWallet).sendNft(destinationChain, userWallet.address, tokenid))
          .to.emit(token, 'Transfer')
          .withArgs(
            userWallet.address,
            nftLinker.address,
            tokenid,
          )
          .and.to.emit(gateway, 'ContractCall')
          .withArgs(
            nftLinker.address,
            destinationChain,
            nftLinker.address.toLowerCase(),
            payloadHash,
            payload,
          )
    });
    it('should unlock nft', async () => {
      const tokenid = 1e5;
      const payload = defaultAbiCoder.encode(['address', 'uint256'], [userWallet.address, tokenid]);
      const payloadHash = keccak256(payload);
      const commandId = getRandomID();
      const txHash = getRandomID();
      const txIndex = 0;

      await (await token.connect(userWallet).mint(nftLinker.address, tokenid)).wait();
      
      await expect(approve(payloadHash, commandId, txHash, txIndex))
        .to.emit(gateway, 'ContractCallApproved')
        .withArgs(
          commandId,
          sourceChain,
          nftLinker.address,
          nftLinker.address,
          payloadHash,
          txHash,
          txIndex,
        );
        
      await expect(nftLinker.connect(userWallet).execute(commandId, sourceChain, nftLinker.address, payload))
          .to.emit(token, 'Transfer')
          .withArgs(
            nftLinker.address,
            userWallet.address,
            tokenid,
          )
    });
  });

  describe('Mint-Burn', () => {
    beforeEach(async () => {
      nftLinker = await deployUpgradable(
        constAddressDeployer.address, 
        ownerWallet, 
        NftLinkerMintBurn,
        NftLinkerProxy,
        [gateway.address, token.address],
      );
    });
    it('should burn nft', async () => {
      const tokenid = 1e6;
      await token.connect(userWallet).mint(userWallet.address, tokenid);
      await token.connect(userWallet).approve(nftLinker.address, tokenid);
      const payload = defaultAbiCoder.encode(['address', 'uint256'], [userWallet.address, tokenid]);
      const payloadHash = keccak256(payload);

      await expect(nftLinker.connect(userWallet).sendNft(destinationChain, userWallet.address, tokenid))
          .to.emit(token, 'Transfer')
          .withArgs(
            userWallet.address,
            AddressZero,
            tokenid,
          )
          .and.to.emit(gateway, 'ContractCall')
          .withArgs(
            nftLinker.address,
            destinationChain,
            nftLinker.address.toLowerCase(),
            payloadHash,
            payload,
          )
    });
    it('should mint nft', async () => {
      const tokenid = 1e6;
      const payload = defaultAbiCoder.encode(['address', 'uint256'], [userWallet.address, tokenid]);
      const payloadHash = keccak256(payload);
      const commandId = getRandomID();
      const txHash = getRandomID();
      const txIndex = 0;
      
      await expect(approve(payloadHash, commandId, txHash, txIndex))
        .to.emit(gateway, 'ContractCallApproved')
        .withArgs(
          commandId,
          sourceChain,
          nftLinker.address,
          nftLinker.address,
          payloadHash,
          txHash,
          txIndex,
        );
        
      await expect(nftLinker.connect(userWallet).execute(commandId, sourceChain, nftLinker.address, payload))
          .to.emit(token, 'Transfer')
          .withArgs(
            AddressZero,
            userWallet.address,
            tokenid,
          )
    });
  });

});
