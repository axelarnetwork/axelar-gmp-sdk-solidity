'use strict';

const chai = require('chai');
const {
  utils: { defaultAbiCoder, keccak256, id },
} = require('ethers');
const { expect } = chai;
const { ethers } = require('hardhat');
const getRandomID = () => id(Math.floor(Math.random() * 1e10).toString());

describe('GMP', () => {
  let gatewayFactory;
  let sourceChainSwapCallerFactory;
  let destinationChainSwapExecutableFactory;
  let destinationChainTokenSwapperFactory;
  let tokenFactory;

  let sourceChainGateway;
  let destinationChainGateway;
  let sourceChainSwapCaller;
  let destinationChainSwapExecutable;
  let destinationChainTokenSwapper;
  let tokenA;
  let tokenB;

  let sourceChainSenderFactory;
  let sourceChainSender;
  let destinationChainReceiverFactory;
  let destinationChainReceiver;

  let ownerWallet;
  let userWallet;

  const sourceChain = 'chainA';
  const destinationChain = 'chainB';
  const nameA = 'testTokenX';
  const symbolA = 'testTokenX';
  const nameB = 'testTokenY';
  const symbolB = 'testTokenY';
  const decimals = 16;
  const capacity = 0;
  const num = 10;

  before(async () => {
    [ownerWallet, userWallet] = await ethers.getSigners();

    gatewayFactory = await ethers.getContractFactory(
      'MockGateway',
      ownerWallet,
    );
    sourceChainSwapCallerFactory = await ethers.getContractFactory(
      'SourceChainSwapCaller',
      ownerWallet,
    );
    destinationChainTokenSwapperFactory = await ethers.getContractFactory(
      'DestinationChainTokenSwapper',
      ownerWallet,
    );
    destinationChainSwapExecutableFactory = await ethers.getContractFactory(
      'DestinationChainSwapExecutable',
      ownerWallet,
    );
    tokenFactory = await ethers.getContractFactory(
      'ERC20MintableBurnable',
      ownerWallet,
    );
    sourceChainSenderFactory = await ethers.getContractFactory(
      'SourceChainSender',
      ownerWallet,
    );
    destinationChainReceiverFactory = await ethers.getContractFactory(
      'DestinationChainReceiver',
      ownerWallet,
    );
  });

  describe('AxelarExecutable', () => {
    describe('Call Contract with Token', () => {
      beforeEach(async () => {
        sourceChainGateway = await gatewayFactory
          .deploy()
          .then((d) => d.deployed());
        destinationChainGateway = await gatewayFactory
          .deploy()
          .then((d) => d.deployed());

        tokenA = await tokenFactory
          .deploy(nameA, symbolA, decimals)
          .then((d) => d.deployed());

        tokenB = await tokenFactory
          .deploy(nameB, symbolB, decimals)
          .then((d) => d.deployed());

        await sourceChainGateway.deployToken(
          defaultAbiCoder.encode(
            ['string', 'string', 'uint8', 'uint256', ' address', 'uint256'],
            [
              nameA,
              symbolA,
              decimals,
              capacity,
              ethers.constants.AddressZero,
              0,
            ],
          ),
          keccak256('0x'),
        );
        await sourceChainGateway.deployToken(
          defaultAbiCoder.encode(
            ['string', 'string', 'uint8', 'uint256', ' address', 'uint256'],
            [
              nameB,
              symbolB,
              decimals,
              capacity,
              ethers.constants.AddressZero,
              0,
            ],
          ),
          keccak256('0x'),
        );

        await destinationChainGateway.deployToken(
          defaultAbiCoder.encode(
            ['string', 'string', 'uint8', 'uint256', ' address', 'uint256'],
            [nameA, symbolA, decimals, capacity, tokenA.address, 0],
          ),
          keccak256('0x'),
        );
        await destinationChainGateway.deployToken(
          defaultAbiCoder.encode(
            ['string', 'string', 'uint8', 'uint256', ' address', 'uint256'],
            [nameB, symbolB, decimals, capacity, tokenB.address, 0],
          ),
          keccak256('0x'),
        );

        destinationChainTokenSwapper = await destinationChainTokenSwapperFactory
          .deploy(tokenA.address.toString(), tokenB.address.toString())
          .then((d) => d.deployed());

        destinationChainSwapExecutable =
          await destinationChainSwapExecutableFactory
            .deploy(
              destinationChainGateway.address,
              destinationChainTokenSwapper.address,
            )
            .then((d) => d.deployed());

        sourceChainSwapCaller = await sourceChainSwapCallerFactory
          .deploy(
            sourceChainGateway.address,
            destinationChain,
            destinationChainSwapExecutable.address,
          )
          .then((d) => d.deployed());

        await tokenA.mint(destinationChainGateway.address, 1e9);
        await tokenB.mint(destinationChainTokenSwapper.address, 1e9);

        await sourceChainGateway.mintToken(
          defaultAbiCoder.encode(
            ['string', 'address', 'uint256'],
            [symbolA, userWallet.address, 1e9],
            keccak256('0x'),
          ),
          keccak256('0x'),
        );
        await (
          await tokenA.connect(ownerWallet).mint(userWallet.address, 1e9)
        ).wait();
      });

      it('should revert without gateway approval', async () => {
        const swapAmount = 1e6;
        const payload = defaultAbiCoder.encode(
          ['string', 'string'],
          [symbolB, userWallet.address.toString()],
        );
        const payloadHash = keccak256(payload);

        const sourceChainTokenA = tokenFactory
          .connect(userWallet)
          .attach(await sourceChainGateway.tokenAddresses(symbolA));

        await sourceChainTokenA.approve(
          sourceChainSwapCaller.address,
          swapAmount,
        );

        await expect(
          sourceChainSwapCaller
            .connect(userWallet)
            .swapToken(symbolA, symbolB, swapAmount, userWallet.address),
        )
          .to.emit(sourceChainGateway, 'ContractCallWithToken')
          .withArgs(
            sourceChainSwapCaller.address.toString(),
            destinationChain,
            destinationChainSwapExecutable.address.toString(),
            payloadHash,
            payload,
            symbolA,
            swapAmount,
          );

        const approveCommandId = getRandomID();

        const swap = destinationChainSwapExecutable.executeWithToken(
          approveCommandId,
          sourceChain,
          sourceChainSwapCaller.address.toString(),
          payload,
          symbolA,
          swapAmount,
        );
        await expect(swap).to.be.revertedWithCustomError(
          destinationChainSwapExecutable,
          'NotApprovedByGateway',
        );
      });

      it('should swap tokens on remote chain', async () => {
        const swapAmount = 1e6;
        const convertedAmount = 2 * swapAmount;
        const payload = defaultAbiCoder.encode(
          ['string', 'string'],
          [symbolB, userWallet.address.toString()],
        );
        const payloadHash = keccak256(payload);

        const sourceChainTokenA = tokenFactory
          .connect(userWallet)
          .attach(await sourceChainGateway.tokenAddresses(symbolA));

        await sourceChainTokenA.approve(
          sourceChainSwapCaller.address,
          swapAmount,
        );

        await expect(
          sourceChainSwapCaller
            .connect(userWallet)
            .swapToken(symbolA, symbolB, swapAmount, userWallet.address),
        )
          .to.emit(sourceChainGateway, 'ContractCallWithToken')
          .withArgs(
            sourceChainSwapCaller.address.toString(),
            destinationChain,
            destinationChainSwapExecutable.address.toString(),
            payloadHash,
            payload,
            symbolA,
            swapAmount,
          );
        const approveCommandId = getRandomID();
        const sourceTxHash = keccak256('0x123abc123abc');
        const sourceEventIndex = 17;

        const approveWithMintData = defaultAbiCoder.encode(
          [
            'string',
            'string',
            'address',
            'bytes32',
            'string',
            'uint256',
            'bytes32',
            'uint256',
          ],
          [
            sourceChain,
            sourceChainSwapCaller.address,
            destinationChainSwapExecutable.address,
            payloadHash,
            symbolA,
            swapAmount,
            sourceTxHash,
            sourceEventIndex,
          ],
        );

        const approveExecute =
          await destinationChainGateway.approveContractCallWithMint(
            approveWithMintData,
            approveCommandId,
          );

        await expect(approveExecute)
          .to.emit(destinationChainGateway, 'ContractCallApprovedWithMint')
          .withArgs(
            approveCommandId,
            sourceChain,
            sourceChainSwapCaller.address.toString(),
            destinationChainSwapExecutable.address,
            payloadHash,
            symbolA,
            swapAmount,
            sourceTxHash,
            sourceEventIndex,
          );

        const swap = destinationChainSwapExecutable.executeWithToken(
          approveCommandId,
          sourceChain,
          sourceChainSwapCaller.address.toString(),
          payload,
          symbolA,
          swapAmount,
        );
        await expect(swap)
          .to.emit(tokenA, 'Transfer')
          .withArgs(
            destinationChainGateway.address,
            destinationChainSwapExecutable.address,
            swapAmount,
          )
          .and.to.emit(tokenB, 'Transfer')
          .withArgs(
            destinationChainTokenSwapper.address,
            destinationChainSwapExecutable.address,
            convertedAmount,
          )
          .and.to.emit(tokenB, 'Transfer')
          .withArgs(
            destinationChainSwapExecutable.address,
            destinationChainGateway.address,
            convertedAmount,
          )
          .and.to.emit(destinationChainGateway, 'TokenSent')
          .withArgs(
            destinationChainSwapExecutable.address,
            sourceChain,
            userWallet.address.toString(),
            symbolB,
            convertedAmount,
          );
      });
    });

    describe('Call Contract', () => {
      beforeEach(async () => {
        sourceChainGateway = await gatewayFactory
          .deploy()
          .then((d) => d.deployed());
        destinationChainGateway = await gatewayFactory
          .deploy()
          .then((d) => d.deployed());

        destinationChainReceiver = await destinationChainReceiverFactory
          .deploy(destinationChainGateway.address)
          .then((d) => d.deployed());

        sourceChainSender = await sourceChainSenderFactory
          .deploy(
            sourceChainGateway.address,
            destinationChain,
            destinationChainReceiver.address,
          )
          .then((d) => d.deployed());
      });

      it('should revert without gateway approval', async () => {
        const payload = defaultAbiCoder.encode(['uint256'], [num]);
        const payloadHash = keccak256(payload);

        await expect(sourceChainSender.connect(userWallet).send(num))
          .to.emit(sourceChainGateway, 'ContractCall')
          .withArgs(
            sourceChainSender.address.toString(),
            destinationChain,
            destinationChainReceiver.address.toString(),
            payloadHash,
            payload,
          );

        const approveCommandId = getRandomID();

        const receive = destinationChainReceiver.execute(
          approveCommandId,
          sourceChain,
          sourceChainSender.address.toString(),
          payload,
        );

        await expect(receive).to.be.revertedWithCustomError(
          destinationChainReceiver,
          'NotApprovedByGateway',
        );
      });

      it('should call contract on another chain', async () => {
        const payload = defaultAbiCoder.encode(['uint256'], [num]);
        const payloadHash = keccak256(payload);

        await expect(sourceChainSender.connect(userWallet).send(num))
          .to.emit(sourceChainGateway, 'ContractCall')
          .withArgs(
            sourceChainSender.address.toString(),
            destinationChain,
            destinationChainReceiver.address.toString(),
            payloadHash,
            payload,
          );

        const approveCommandId = getRandomID();
        const sourceTxHash = keccak256('0x123abc123abc');
        const sourceEventIndex = 17;

        const approveData = defaultAbiCoder.encode(
          ['string', 'string', 'address', 'bytes32', 'bytes32', 'uint256'],
          [
            sourceChain,
            sourceChainSender.address,
            destinationChainReceiver.address,
            payloadHash,
            sourceTxHash,
            sourceEventIndex,
          ],
        );

        const approveExecute =
          await destinationChainGateway.approveContractCall(
            approveData,
            approveCommandId,
          );

        await expect(approveExecute)
          .to.emit(destinationChainGateway, 'ContractCallApproved')
          .withArgs(
            approveCommandId,
            sourceChain,
            sourceChainSender.address.toString(),
            destinationChainReceiver.address,
            payloadHash,
            sourceTxHash,
            sourceEventIndex,
          );

        const receive = destinationChainReceiver.execute(
          approveCommandId,
          sourceChain,
          sourceChainSender.address.toString(),
          payload,
        );

        await expect(receive)
          .to.emit(destinationChainReceiver, 'Received')
          .withArgs(num);
      });
    });
  });
});
