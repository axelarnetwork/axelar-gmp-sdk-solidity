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
const ERC721MintableBurnable = require('../artifacts/contracts/test/ERC721MintableBurnable.sol/ERC721MintableBurnable.json');
const Create3Deployer = require('../dist/Create3Deployer.json');
const NftLinkerProxy = require('../artifacts/contracts/nft-linker/NftLinkerProxy.sol/NftLinkerProxy.json');
const NftLinkerLockUnlock = require('../artifacts/contracts/nft-linker/NftLinkerLockUnlock.sol/NftLinkerLockUnlock.json');
const NftLinkerMintBurn = require('../artifacts/contracts/nft-linker/NftLinkerMintBurn.sol/NftLinkerMintBurn.json');

const getRandomID = () => id(Math.floor(Math.random() * 1e10).toString());

describe('NftLinker', () => {
  const [ownerWallet, userWallet] = new MockProvider().getWallets();

  let gateway;
  let gasService;
  let nftLinker;
  let token;
  let constAddressDeployer;

  const sourceChain = 'chainA';
  const destinationChain = 'chainB';
  const tokenName = 'testToken';
  const tokenSymbol = 'TEST';

  const approve = (payloadHash, commandId, txHash, txIndex) => {
    const approveData = defaultAbiCoder.encode(
      ['string', 'string', 'address', 'bytes32', 'bytes32', 'uint256'],
      [
        sourceChain,
        nftLinker.address,
        nftLinker.address,
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
        [gateway.address, gasService.address, token.address],
      );
    });
    it('should lock nft', async () => {
      const tokenid = 1e6;
      await token.connect(userWallet).mint(userWallet.address, tokenid);
      await token.connect(userWallet).approve(nftLinker.address, tokenid);
      const payload = defaultAbiCoder.encode(
        ['address', 'uint256'],
        [userWallet.address, tokenid],
      );
      const payloadHash = keccak256(payload);
      await expect(
        nftLinker
          .connect(userWallet)
          .sendNft(
            destinationChain,
            userWallet.address,
            tokenid,
            userWallet.address,
          ),
      )
        .to.emit(token, 'Transfer')
        .withArgs(userWallet.address, nftLinker.address, tokenid)
        .and.to.emit(gateway, 'ContractCall')
        .withArgs(
          nftLinker.address,
          destinationChain,
          nftLinker.address.toLowerCase(),
          payloadHash,
          payload,
        );
    });
    it('should unlock nft', async () => {
      const tokenid = 1e5;
      const payload = defaultAbiCoder.encode(
        ['address', 'uint256'],
        [userWallet.address, tokenid],
      );
      const payloadHash = keccak256(payload);
      const commandId = getRandomID();
      const txHash = getRandomID();
      const txIndex = 0;

      await (
        await token.connect(userWallet).mint(nftLinker.address, tokenid)
      ).wait();

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

      await expect(
        nftLinker
          .connect(userWallet)
          .execute(commandId, sourceChain, nftLinker.address, payload),
      )
        .to.emit(token, 'Transfer')
        .withArgs(nftLinker.address, userWallet.address, tokenid);
    });
  });

  describe('Mint-Burn', () => {
    beforeEach(async () => {
      nftLinker = await deployUpgradable(
        constAddressDeployer.address,
        ownerWallet,
        NftLinkerMintBurn,
        NftLinkerProxy,
        [gateway.address, gasService.address, token.address],
      );
    });
    it('should burn nft', async () => {
      const tokenid = 1e6;
      await token.connect(userWallet).mint(userWallet.address, tokenid);
      await token.connect(userWallet).approve(nftLinker.address, tokenid);
      const payload = defaultAbiCoder.encode(
        ['address', 'uint256'],
        [userWallet.address, tokenid],
      );
      const payloadHash = keccak256(payload);

      await expect(
        nftLinker
          .connect(userWallet)
          .sendNft(
            destinationChain,
            userWallet.address,
            tokenid,
            userWallet.address,
          ),
      )
        .to.emit(token, 'Transfer')
        .withArgs(userWallet.address, AddressZero, tokenid)
        .and.to.emit(gateway, 'ContractCall')
        .withArgs(
          nftLinker.address,
          destinationChain,
          nftLinker.address.toLowerCase(),
          payloadHash,
          payload,
        );
    });
    it('should mint nft', async () => {
      const tokenid = 1e6;
      const payload = defaultAbiCoder.encode(
        ['address', 'uint256'],
        [userWallet.address, tokenid],
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
          nftLinker.address,
          nftLinker.address,
          payloadHash,
          txHash,
          txIndex,
        );

      await expect(
        nftLinker
          .connect(userWallet)
          .execute(commandId, sourceChain, nftLinker.address, payload),
      )
        .to.emit(token, 'Transfer')
        .withArgs(AddressZero, userWallet.address, tokenid);
    });
  });
});
