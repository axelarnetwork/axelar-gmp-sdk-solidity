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

const { deployUpgradable } = require('../index');

const AxelarGateway = require('../artifacts/contracts/test/MockGateway.sol/MockGateway.json');
const GMPExpressService = require('../artifacts/contracts/test/MockGMPExpressService.sol/MockGMPExpressService.json');
const MintableCappedERC20 = require('../artifacts/contracts/test/ERC20MintableBurnable.sol/ERC20MintableBurnable.json');
const SourceChainSwapCaller = require('../artifacts/contracts/test/gmp/SourceChainSwapCaller.sol/SourceChainSwapCaller.json');
const DestinationChainSwapExecutable = require('../artifacts/contracts/test/gmp/DestinationChainSwapExecutable.sol/DestinationChainSwapExecutable.json');
const ExpressExecutableProxy = require('../artifacts/contracts/express/ExpressExecutableProxy.sol/ExpressExecutableProxy.json');
const ExpressRegistry = require('../artifacts/contracts/express/ExpressRegistry.sol/ExpressRegistry.json');
const DestinationChainSwapExpress = require('../artifacts/contracts/test/gmp/DestinationChainSwapExpress.sol/DestinationChainSwapExpress.json');
const DestinationChainTokenSwapper = require('../artifacts/contracts/test/gmp/DestinationChainTokenSwapper.sol/DestinationChainTokenSwapper.json');
const ConstAddressDeployer = require('../dist/ConstAddressDeployer.json');

const getRandomID = () => id(Math.floor(Math.random() * 1e10).toString());

describe('GeneralMessagePassing', () => {
  const [ownerWallet, userWallet] = new MockProvider().getWallets();

  let sourceChainGateway;
  let destinationChainGateway;
  let gmpExpressService;
  let sourceChainSwapCaller;
  let destinationChainSwapExecutable;
  let destinationChainSwapExpress;
  let destinationChainExpressRegistry;
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
    const constAddressDeployer = await deployContract(
      ownerWallet,
      ConstAddressDeployer,
    );

    sourceChainGateway = await deployContract(ownerWallet, AxelarGateway);
    destinationChainGateway = await deployContract(ownerWallet, AxelarGateway);
    gmpExpressService = await deployContract(ownerWallet, GMPExpressService, [
      destinationChainGateway.address,
      ownerWallet.address,
    ]);

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

    destinationChainSwapExpress = await deployUpgradable(
      constAddressDeployer.address,
      ownerWallet,
      DestinationChainSwapExpress,
      ExpressExecutableProxy,
      [destinationChainGateway.address, destinationChainTokenSwapper.address],
      [gmpExpressService.address, ADDRESS_ZERO],
    );

    const destinationChainSwapExpressProxy = new Contract(
      destinationChainSwapExpress.address,
      ExpressExecutableProxy.abi,
      ownerWallet,
    );
    destinationChainExpressRegistry = new Contract(
      await destinationChainSwapExpressProxy.registry(),
      ExpressRegistry.abi,
      ownerWallet,
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

  describe('AxelarExecutable', () => {
    it('should swap tokens on remote chain', async () => {
      const swapAmount = 1e6;
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
  });

  describe('AxelarForecallable', () => {
    it('should forecallWithToken a swap on remote chain', async () => {
      const swapAmount = 1e6;
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
        swapAmount,
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
        .transfer(gmpExpressService.address, swapAmount);

      await expect(
        gmpExpressService
          .connect(ownerWallet)
          .callWithToken(
            getRandomID(),
            sourceChain,
            sourceChainSwapCaller.address,
            destinationChainSwapExpress.address,
            payload,
            symbolA,
            swapAmount,
          ),
      )
        .to.emit(destinationChainExpressRegistry, 'ExpressCallWithToken')
        .withArgs(
          gmpExpressService.address,
          sourceChain,
          sourceChainSwapCaller.address.toString(),
          payloadHash,
          symbolA,
          swapAmount,
        )
        .to.emit(tokenA, 'Transfer')
        .withArgs(
          gmpExpressService.address,
          destinationChainSwapExpress.address,
          swapAmount,
        )
        .and.to.emit(tokenA, 'Transfer')
        .withArgs(
          destinationChainSwapExpress.address,
          destinationChainTokenSwapper.address,
          swapAmount,
        )
        .and.to.emit(tokenB, 'Transfer')
        .withArgs(
          destinationChainTokenSwapper.address,
          destinationChainSwapExpress.address,
          convertedAmount,
        )
        .and.to.emit(tokenB, 'Transfer')
        .withArgs(
          destinationChainSwapExpress.address,
          destinationChainGateway.address,
          convertedAmount,
        )
        .and.to.emit(destinationChainGateway, 'TokenSent')
        .withArgs(
          destinationChainSwapExpress.address,
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
          destinationChainSwapExpress.address,
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
          destinationChainSwapExpress.address,
          payloadHash,
          symbolA,
          swapAmount,
          sourceTxHash,
          sourceEventIndex,
        );

      const execute = await destinationChainSwapExpress.executeWithToken(
        approveCommandId,
        sourceChain,
        sourceChainSwapCaller.address.toString(),
        payload,
        symbolA,
        swapAmount,
      );

      await expect(execute)
        .to.emit(
          destinationChainExpressRegistry,
          'ExpressCallWithTokenCompleted',
        )
        .withArgs(
          gmpExpressService.address,
          approveCommandId,
          sourceChain,
          sourceChainSwapCaller.address.toString(),
          payloadHash,
          symbolA,
          swapAmount,
        )
        .to.emit(tokenA, 'Transfer')
        .withArgs(
          destinationChainGateway.address,
          destinationChainSwapExpress.address,
          swapAmount,
        )
        .and.to.emit(tokenA, 'Transfer')
        .withArgs(
          destinationChainSwapExpress.address,
          gmpExpressService.address,
          swapAmount,
        );
    });
  });
});
