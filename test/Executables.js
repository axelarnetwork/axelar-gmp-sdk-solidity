'use strict';

const chai = require('chai');
const {
  Contract,
  utils: { defaultAbiCoder, keccak256, id },
} = require('ethers');
const { deployContract, MockProvider, solidity } = require('ethereum-waffle');
chai.use(solidity);
const { expect } = chai;

const ADDRESS_ZERO = '0x0000000000000000000000000000000000000000';

const AxelarGateway = require('../artifacts/contracts/test/MockGateway.sol/MockGateway.json');
const MintableCappedERC20 = require('../artifacts/contracts/test/ERC20MintableBurnable.sol/ERC20MintableBurnable.json');
const SourceChainSwapCaller = require('../artifacts/contracts/test/gmp/SourceChainSwapCaller.sol/SourceChainSwapCaller.json');
const DestinationChainSwapExecutable = require('../artifacts/contracts/test/gmp/DestinationChainSwapExecutable.sol/DestinationChainSwapExecutable.json');
const DestinationChainSwapForecallable = require('../artifacts/contracts/test/gmp/DestinationChainSwapForecallable.sol/DestinationChainSwapForecallable.json');
const DestinationChainTokenSwapper = require('../artifacts/contracts/test/gmp/DestinationChainTokenSwapper.sol/DestinationChainTokenSwapper.json');

const getRandomID = () => id(Math.floor(Math.random() * 1e10).toString());

describe('GeneralMessagePassing', () => {
  const [
    ownerWallet,
    userWallet,
  ] = new MockProvider().getWallets();


  let sourceChainGateway;
  let destinationChainGateway;
  let sourceChainSwapCaller;
  let destinationChainSwapExecutable;
  let destinationChainSwapForecallable;
  let destinationChainTokenSwapper;
  let tokenA;
  let tokenB;

  const sourceChain = 'chainA';
  const destinationChain = 'chainB';
  const nameA = 'testTokenX';
  const symbolA = 'testTokenX';
  const nameB = 'testTokenY';
  const symbolB = 'testTokenY';
  const decimals = 16;
  const capacity = 0;

  beforeEach(async () => {
    sourceChainGateway = await deployContract(ownerWallet, AxelarGateway);
    destinationChainGateway = await deployContract(ownerWallet, AxelarGateway);

    tokenA = await deployContract(ownerWallet, MintableCappedERC20, [
      nameA,
      symbolA,
      decimals,
    ]);

    tokenB = await deployContract(ownerWallet, MintableCappedERC20, [
      nameB,
      symbolB,
      decimals,
    ]);
    await sourceChainGateway.deployToken(
      defaultAbiCoder.encode(
        ['string', 'string', 'uint8', 'uint256', ' address', 'uint256'],
        [nameA, symbolA, decimals, capacity, ADDRESS_ZERO, 0],
      ),
      keccak256('0x'),
    );
    await sourceChainGateway.deployToken(
      defaultAbiCoder.encode(
        ['string', 'string', 'uint8', 'uint256', ' address', 'uint256'],
        [nameB, symbolB, decimals, capacity, ADDRESS_ZERO, 0],
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

    destinationChainTokenSwapper = await deployContract(
      ownerWallet,
      DestinationChainTokenSwapper,
      [tokenA.address, tokenB.address],
    );

    destinationChainSwapExecutable = await deployContract(
      ownerWallet,
      DestinationChainSwapExecutable,
      [destinationChainGateway.address, destinationChainTokenSwapper.address],
    );

    destinationChainSwapForecallable = await deployContract(
      ownerWallet,
      DestinationChainSwapForecallable,
      [destinationChainGateway.address, destinationChainTokenSwapper.address],
    );
    sourceChainSwapCaller = await deployContract(
      ownerWallet,
      SourceChainSwapCaller,
      [
        sourceChainGateway.address,
        destinationChain,
        destinationChainSwapExecutable.address.toString(),
      ],
    );
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

  describe('general message passing', () => {
    it('should swap tokens on remote chain', async () => {
      const swapAmount = 1e6;
      const gasFeeAmount = 1e3;
      const convertedAmount = 2 * swapAmount;
      const payload = defaultAbiCoder.encode(
        ['string', 'string'],
        [symbolB, userWallet.address.toString()],
      );
      const payloadHash = keccak256(payload);

      const sourceChainTokenA = new Contract(
        await sourceChainGateway.tokenAddresses(symbolA),
        MintableCappedERC20.abi,
        userWallet,
      );
      await sourceChainTokenA.approve(
        sourceChainSwapCaller.address,
        swapAmount + gasFeeAmount,
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

      const swap = await destinationChainSwapExecutable.executeWithToken(
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

    it('should forecall a swap on remote chain', async () => {
      const swapAmount = 1e6;
      const gasFeeAmount = 1e3;
      const convertedAmount = 2 * swapAmount;
      const payload = defaultAbiCoder.encode(
        ['string', 'string'],
        [symbolB, userWallet.address.toString()],
      );
      const payloadHash = keccak256(payload);

      const sourceChainTokenA = new Contract(
        await sourceChainGateway.tokenAddresses(symbolA),
        MintableCappedERC20.abi,
        userWallet,
      );
      await sourceChainTokenA.approve(
        sourceChainSwapCaller.address,
        swapAmount + gasFeeAmount,
      );

      await expect(
        sourceChainSwapCaller
          .connect(userWallet)
          .swapToken(
            symbolA,
            symbolB,
            swapAmount,
            userWallet.address.toString(),
          ),
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

      await tokenA
        .connect(userWallet)
        .approve(destinationChainSwapForecallable.address, swapAmount);

      await expect(
        destinationChainSwapForecallable
          .connect(userWallet)
          .forecallWithToken(
            sourceChain,
            sourceChainSwapCaller.address,
            payload,
            symbolA,
            swapAmount,
            userWallet.address,
          ),
      )
        .to.emit(tokenA, 'Transfer')
        .withArgs(
          userWallet.address,
          destinationChainSwapForecallable.address,
          swapAmount,
        )
        .and.to.emit(tokenB, 'Transfer')
        .withArgs(
          destinationChainTokenSwapper.address,
          destinationChainSwapForecallable.address,
          convertedAmount,
        )
        .and.to.emit(tokenB, 'Transfer')
        .withArgs(
          destinationChainSwapForecallable.address,
          destinationChainGateway.address,
          convertedAmount,
        )
        .and.to.emit(destinationChainGateway, 'TokenSent')
        .withArgs(
          destinationChainSwapForecallable.address,
          sourceChain,
          userWallet.address.toString(),
          symbolB,
          convertedAmount,
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
          sourceChainSwapCaller.address.toString(),
          destinationChainSwapForecallable.address,
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
          destinationChainSwapForecallable.address,
          payloadHash,
          symbolA,
          swapAmount,
          sourceTxHash,
          sourceEventIndex,
        );

      const execute = await destinationChainSwapForecallable.executeWithToken(
        approveCommandId,
        sourceChain,
        sourceChainSwapCaller.address.toString(),
        payload,
        symbolA,
        swapAmount,
      );

      await expect(execute)
        .to.emit(tokenA, 'Transfer')
        .withArgs(
          destinationChainGateway.address,
          destinationChainSwapForecallable.address,
          swapAmount,
        )
        .and.to.emit(tokenA, 'Transfer')
        .withArgs(
          destinationChainSwapForecallable.address,
          userWallet.address,
          swapAmount,
        );
    });
  });
});
