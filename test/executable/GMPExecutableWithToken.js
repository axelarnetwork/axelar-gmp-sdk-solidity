'use strict';

const chai = require('chai');
const {
  utils: { defaultAbiCoder, keccak256, id },
} = require('ethers');
const { expect } = chai;
const { ethers } = require('hardhat');
const getRandomID = () => id(Math.floor(Math.random() * 1e10).toString());

describe('GMPExecutableWithToken', () => {
  let gatewayFactory;
  let tokenFactory;

  let sourceChainGateway;
  let destinationChainGateway;
  let sourceChainSwapCaller;
  let destinationChainTokenSwapper;
  let tokenA;
  let tokenB;

  let sourceChainSender;
  let GMPExecutableFactory;
  let GMPExecutable;
  let GMPExecutableWithTokenFactory;
  let GMPExecutableWithToken;

  let ownerWallet;
  let userWallet;

  const sourceChain = 'chainA';
  const nameA = 'testTokenX';
  const symbolA = 'testTokenX';
  const decimals = 16;
  const capacity = 0;
  const num = 10;

  before(async () => {
    [ownerWallet, userWallet] = await ethers.getSigners();

    gatewayFactory = await ethers.getContractFactory(
      'MockGateway',
      ownerWallet,
    );
    tokenFactory = await ethers.getContractFactory(
      'ERC20MintableBurnable',
      ownerWallet,
    );
    GMPExecutableFactory = await ethers.getContractFactory(
      'GMPExecutableTest',
      ownerWallet,
    );
    GMPExecutableWithTokenFactory = await ethers.getContractFactory(
      'GMPExecutableWithTokenTest',
      ownerWallet,
    );
  });

  describe('AxelarGMPExecutableWithToken', () => {
    describe('Call Contract with Token', () => {
      beforeEach(async () => {
        destinationChainGateway = await gatewayFactory
          .deploy()
          .then((d) => d.deployed());

        tokenA = await tokenFactory
          .deploy(nameA, symbolA, decimals)
          .then((d) => d.deployed());

        await destinationChainGateway.deployToken(
          defaultAbiCoder.encode(
            ['string', 'string', 'uint8', 'uint256', ' address', 'uint256'],
            [nameA, symbolA, decimals, capacity, tokenA.address, 0],
          ),
          keccak256('0x'),
        );

        GMPExecutableWithToken =
          await GMPExecutableWithTokenFactory
            .deploy(
              destinationChainGateway.address,
            )
            .then((d) => d.deployed());

        await tokenA.mint(destinationChainGateway.address, 1e9);
        await tokenB.mint(destinationChainTokenSwapper.address, 1e9);

        await (
          await tokenA.connect(ownerWallet).mint(userWallet.address, 1e9)
        ).wait();
      });

      it('should revert without gateway approval', async () => {
        const swapAmount = 1e6;
        const payload = defaultAbiCoder.encode(
          ['uint256'],
          [num],
        );

        const sourceChainTokenA = tokenFactory
          .connect(userWallet)
          .attach(await sourceChainGateway.tokenAddresses(symbolA));

        await sourceChainTokenA.approve(
          sourceChainSwapCaller.address,
          swapAmount,
        );

        const approveCommandId = getRandomID();

        const swap = GMPExecutableWithToken.executeWithToken(
          approveCommandId,
          sourceChain,
          sourceChainSwapCaller.address.toString(),
          payload,
          symbolA,
          swapAmount,
        );
        await expect(swap).to.be.revertedWithCustomError(
          GMPExecutableWithToken,
          'NotApprovedByGateway',
        );
      });

      it('should swap tokens on remote chain', async () => {
        const swapAmount = 1e6;
        const payload = defaultAbiCoder.encode(['uint256'], [num]);
        const payloadHash = keccak256(payload);

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
            GMPExecutableWithToken.address,
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
            GMPExecutableWithToken.address,
            payloadHash,
            symbolA,
            swapAmount,
            sourceTxHash,
            sourceEventIndex,
          );

        await expect(GMPExecutableWithToken.executeWithToken(
          approveCommandId,
          sourceChain,
          sourceChainSwapCaller.address.toString(),
          payload,
          symbolA,
          swapAmount,
        ))
          .to.emit(GMPExecutableWithToken, 'ReceivedWithToken')
          .withArgs(
            num,
            tokenA.address,
            swapAmount,
          )
          .to.emit(tokenA, 'Transfer')
          .withArgs(
            destinationChainGateway.address,
            GMPExecutableWithToken.address,
            swapAmount,
          );
      });
    });

    describe('Call Contract', () => {
      beforeEach(async () => {
        destinationChainGateway = await gatewayFactory
          .deploy()
          .then((d) => d.deployed());

        GMPExecutable = await GMPExecutableFactory
          .deploy(destinationChainGateway.address)
          .then((d) => d.deployed());
      });

      it('should revert without gateway approval', async () => {
        const payload = defaultAbiCoder.encode(['uint256'], [num]);

        const approveCommandId = getRandomID();

        const receive = GMPExecutable.execute(
          approveCommandId,
          sourceChain,
          sourceChainSender.address.toString(),
          payload,
        );

        await expect(receive).to.be.revertedWithCustomError(
          GMPExecutable,
          'NotApprovedByGateway',
        );
      });

      it('should call contract on another chain', async () => {
        const payload = defaultAbiCoder.encode(['uint256'], [num]);
        const payloadHash = keccak256(payload);

        const approveCommandId = getRandomID();
        const sourceTxHash = keccak256('0x123abc123abc');
        const sourceEventIndex = 17;

        const approveData = defaultAbiCoder.encode(
          ['string', 'string', 'address', 'bytes32', 'bytes32', 'uint256'],
          [
            sourceChain,
            sourceChainSender.address,
            GMPExecutable.address,
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
            GMPExecutable.address,
            payloadHash,
            sourceTxHash,
            sourceEventIndex,
          );

        const receive = GMPExecutable.execute(
          approveCommandId,
          sourceChain,
          sourceChainSender.address.toString(),
          payload,
        );

        await expect(receive)
          .to.emit(GMPExecutable, 'Received')
          .withArgs(num);
      });
    });
  });
});
