'use strict';

const chai = require('chai');
const {
  Contract,
  utils: { defaultAbiCoder, keccak256, id },
} = require('ethers');
const { expect } = chai;
const { ethers } = require('hardhat');

const ADDRESS_ZERO = '0x0000000000000000000000000000000000000000';

const { deployCreate3Upgradable } = require('../index');

const MintableCappedERC20 = require('../artifacts/contracts/test/ERC20MintableBurnable.sol/ERC20MintableBurnable.json');
const ExpressProxy = require('../artifacts/contracts/express/ExpressProxy.sol/ExpressProxy.json');
const ExpressRegistry = require('../artifacts/contracts/express/ExpressRegistry.sol/ExpressRegistry.json');
const DestinationChainSwapExpress = require('../artifacts/contracts/test/gmp/DestinationChainSwapExpress.sol/DestinationChainSwapExpress.json');
const DestinationChainSwapExpressDisabled = require('../artifacts/contracts/test/gmp/DestinationChainSwapExpressDisabled.sol/DestinationChainSwapExpressDisabled.json');
const ExecutableSample = require('../artifacts/contracts/test/gmp/ExecutableSample.sol/ExecutableSample.json');

const getRandomID = () => id(Math.floor(Math.random() * 1e10).toString());

describe('GMPE', async () => {
  let gatewayFactory;
  let gmpExpressServiceFactory;
  let sourceChainSwapCallerFactory;
  let destinationChainTokenSwapperFactory;
  let destinationChainSwapExpressFactory;
  let destinationChainSwapExpressProxyFactory;
  let destinationChainSwapExpressDisabledFactory;
  let tokenFactory;
  let create3DeployerFactory;
  let expressProxyDeployerFactory;
  let executableSampleFactory;

  let sourceChainGateway;
  let sourceChainSwapCaller;
  let destinationChainGateway;
  let destinationChainSwapExpress;
  let destinationChainSwapExpressProxy;
  let tokenA;
  let tokenB;
  let expressProxyDeployer;
  let create3Deployer;
  let gmpExpressService;
  let destinationChainTokenSwapper;
  let destinationChainSwapExpressDisabled;

  let wallets;
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

  before(async () => {
    wallets = await ethers.getSigners();
    ownerWallet = wallets[0];
    userWallet = wallets[1];

    gatewayFactory = await ethers.getContractFactory(
      'MockGateway',
      ownerWallet,
    );
    gmpExpressServiceFactory = await ethers.getContractFactory(
      'MockGMPExpressService',
      ownerWallet,
    );
    sourceChainSwapCallerFactory = await ethers.getContractFactory(
      'SourceChainSwapCaller',
      ownerWallet,
    );
    destinationChainSwapExpressFactory = await ethers.getContractFactory(
      'DestinationChainSwapExpress',
      ownerWallet,
    );
    destinationChainSwapExpressProxyFactory = await ethers.getContractFactory(
      'ExpressProxy',
      ownerWallet,
    );
    destinationChainSwapExpressDisabledFactory =
      await ethers.getContractFactory(
        'DestinationChainSwapExpressDisabled',
        ownerWallet,
      );
    destinationChainTokenSwapperFactory = await ethers.getContractFactory(
      'DestinationChainTokenSwapper',
      ownerWallet,
    );
    tokenFactory = await ethers.getContractFactory(
      'ERC20MintableBurnable',
      ownerWallet,
    );
    create3DeployerFactory = await ethers.getContractFactory(
      'Create3Deployer',
      ownerWallet,
    );
    expressProxyDeployerFactory = await ethers.getContractFactory(
      'ExpressProxyDeployer',
      ownerWallet,
    );
    executableSampleFactory = await ethers.getContractFactory(
      'ExecutableSample',
      ownerWallet,
    );
  });

  beforeEach(async () => {
    create3Deployer = await create3DeployerFactory
      .deploy()
      .then((d) => d.deployed());

    sourceChainGateway = await gatewayFactory
      .deploy()
      .then((d) => d.deployed());
    destinationChainGateway = await gatewayFactory
      .deploy()
      .then((d) => d.deployed());

    expressProxyDeployer = await expressProxyDeployerFactory
      .deploy(destinationChainGateway.address)
      .then((d) => d.deployed());

    gmpExpressService = await gmpExpressServiceFactory
      .deploy(
        destinationChainGateway.address,
        ownerWallet.address,
        expressProxyDeployer.address,
      )
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

    destinationChainTokenSwapper = await destinationChainTokenSwapperFactory
      .deploy(tokenA.address.toString(), tokenB.address.toString())
      .then((d) => d.deployed());

    destinationChainSwapExpress = await deployCreate3Upgradable(
      create3Deployer.address,
      ownerWallet,
      DestinationChainSwapExpress,
      ExpressProxy,
      [destinationChainGateway.address, destinationChainTokenSwapper.address],
      [destinationChainGateway.address],
    );

    destinationChainSwapExpressProxy = new Contract(
      destinationChainSwapExpress.address,
      ExpressProxy.abi,
      ownerWallet,
    );
    await destinationChainSwapExpressProxy.deployRegistry(
      ExpressRegistry.bytecode,
    );

    sourceChainSwapCaller = await sourceChainSwapCallerFactory
      .deploy(
        sourceChainGateway.address,
        destinationChain,
        destinationChainSwapExpress.address,
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

  describe('ExpressExecutable', () => {
    it('should expressCallWithToken a swap on remote chain', async () => {
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
          destinationChainSwapExpress.address.toString(),
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

  describe('ExpressProxy', () => {
    it('should revert if expressCallWithToken is disabled', async () => {
      // Deploy swap express executable with express call disabled
      destinationChainSwapExpressDisabled = await deployCreate3Upgradable(
        create3Deployer.address,
        ownerWallet,
        DestinationChainSwapExpressDisabled,
        ExpressProxy,
        [destinationChainGateway.address, destinationChainTokenSwapper.address],
        [destinationChainGateway.address],
      );

      const destinationChainSwapExpressProxy = new Contract(
        destinationChainSwapExpressDisabled.address,
        ExpressProxy.abi,
        ownerWallet,
      );
      await destinationChainSwapExpressProxy.deployRegistry(
        ExpressRegistry.bytecode,
      );

      sourceChainSwapCaller = await sourceChainSwapCallerFactory
        .deploy(
          sourceChainGateway.address,
          destinationChain,
          destinationChainSwapExpressDisabled.address.toString(),
        )
        .then((d) => d.deployed());

      // Attempt to perform interchain token swap
      const swapAmount = 1e6;
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
          destinationChainSwapExpressDisabled.address.toString(),
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
            destinationChainSwapExpressDisabled.address,
            payload,
            symbolA,
            swapAmount,
            { gasLimit: 250000 },
          ),
      ).to.be.revertedWithCustomError(
        destinationChainSwapExpressProxy,
        'ExpressCallNotEnabled',
      );
    });

    it('should revert if registry is deployed twice', async () => {
      await expect(
        destinationChainSwapExpressProxy
          .connect(ownerWallet)
          .deployRegistry(ExpressRegistry.bytecode, { gasLimit: 250000 }),
      ).to.be.revertedWithCustomError(create3Deployer, 'AlreadyDeployed');
    });

    it('should not execute if not approved by gateway', async () => {
      const value = 'test';
      const payload = defaultAbiCoder.encode(['string'], [value]);
      const payloadHash = keccak256(payload);

      // const executableSampleSource = await deployContract(
      //   ownerWallet,
      //   ExecutableSample,
      //   [sourceChainGateway.address],
      // );

      const executableSampleSource = await executableSampleFactory
        .deploy(sourceChainGateway.address)
        .then((d) => d.deployed());

      const executableSampleDest = await deployCreate3Upgradable(
        create3Deployer.address,
        ownerWallet,
        ExecutableSample,
        ExpressProxy,
        [destinationChainGateway.address],
        [destinationChainGateway.address],
      );

      const destinationChainSampleExpressProxy = new Contract(
        executableSampleDest.address,
        ExpressProxy.abi,
        ownerWallet,
      );
      await destinationChainSampleExpressProxy.deployRegistry(
        ExpressRegistry.bytecode,
      );

      await expect(
        executableSampleSource
          .connect(ownerWallet)
          .setRemoteValue(
            destinationChain,
            executableSampleDest.address.toString(),
            value,
          ),
      )
        .to.emit(sourceChainGateway, 'ContractCall')
        .withArgs(
          executableSampleSource.address,
          destinationChain,
          executableSampleDest.address,
          payloadHash,
          payload,
        );

      // skip gateway approval

      const commandId = getRandomID();

      await expect(
        executableSampleDest
          .connect(ownerWallet)
          .execute(
            commandId,
            sourceChain,
            executableSampleSource.address.toString(),
            payload,
          ),
      ).to.be.revertedWithCustomError(
        destinationChainSampleExpressProxy,
        'NotApprovedByGateway',
      );
    });

    it('should not execute with token if not approved by gateway', async () => {
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
          destinationChainSwapExpress.address.toString(),
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

      // skip gateway approval

      await expect(
        destinationChainSwapExpress.executeWithToken(
          approveCommandId,
          sourceChain,
          sourceChainSwapCaller.address.toString(),
          payload,
          symbolA,
          swapAmount,
        ),
      ).to.be.revertedWithCustomError(
        destinationChainSwapExpressProxy,
        'NotApprovedByGateway',
      );
    });

    it('should only complete execute with token if called by registry', async () => {
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
          destinationChainSwapExpress.address.toString(),
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

      // Jump to completeExecuteWithToken, call from owner address

      await expect(
        destinationChainSwapExpressProxy
          .connect(ownerWallet)
          .completeExecuteWithToken(
            gmpExpressService.address.toString(),
            approveCommandId,
            sourceChain,
            sourceChainSwapCaller.address.toString(),
            payload,
            symbolA,
            swapAmount,
          ),
      ).to.be.revertedWithCustomError(
        destinationChainSwapExpressProxy,
        'NotExpressRegistry',
      );
    });

    it('should execute non-express token transfer normally', async () => {
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
          destinationChainSwapExpress.address.toString(),
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
        .to.emit(tokenA, 'Transfer')
        .withArgs(
          destinationChainGateway.address,
          destinationChainSwapExpress.address,
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
    });

    // it('should fail upgrade if it is the final implementation', async () => {});
  });

  describe('Registry', () => {
    it('should only pay back token amount once', async () => {
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
          destinationChainSwapExpress.address.toString(),
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

      // Call execute again and ensure that it reverts

      await expect(
        destinationChainSwapExpress.executeWithToken(
          approveCommandId,
          sourceChain,
          sourceChainSwapCaller.address.toString(),
          payload,
          symbolA,
          swapAmount,
        ),
      ).to.be.revertedWithCustomError(
        destinationChainSwapExpressProxy,
        'NotApprovedByGateway',
      );
    });

    it('should not register concurrent identical express calls', async () => {
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
          destinationChainSwapExpress.address.toString(),
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

      const destinationChainSwapExpressRegistryAddress =
        await destinationChainSwapExpressProxy.connect(ownerWallet).registry();

      const destinationChainSwapExpressRegistry = new Contract(
        destinationChainSwapExpressRegistryAddress,
        ExpressRegistry.abi,
        ownerWallet,
      );

      // Directly call expressExecuteWithToken on ExpressProxy with identical parameters
      await expect(
        destinationChainSwapExpressProxy
          .connect(ownerWallet)
          .expressExecuteWithToken(
            sourceChain,
            sourceChainSwapCaller.address,
            payload,
            symbolA,
            swapAmount,
          ),
      ).to.be.revertedWithCustomError(
        destinationChainSwapExpressRegistry,
        'AlreadyExpressCalled',
      );
    });

    it('should only execute calls from the proxy', async () => {
      const swapAmount = 1e6;
      const payload = defaultAbiCoder.encode(
        ['string', 'string'],
        [symbolB, userWallet.address.toString()],
      );
      const payloadHash = keccak256(payload);

      const destinationChainSwapExpressRegistryAddress =
        await destinationChainSwapExpressProxy.connect(ownerWallet).registry();

      const destinationChainSwapExpressRegistry = new Contract(
        destinationChainSwapExpressRegistryAddress,
        ExpressRegistry.abi,
        ownerWallet,
      );

      // Should revert if called directly by an EOA with no custom error (Line 91 of ExpressRegistry)

      await expect(
        destinationChainSwapExpressRegistry
          .connect(ownerWallet)
          .registerExpressCallWithToken(
            gmpExpressService.address,
            sourceChain,
            sourceChainSwapCaller.address.toString(),
            payloadHash,
            tokenA,
            swapAmount,
          ),
      ).to.be.reverted;
    });
  });

  // describe('ExpressProxyDeployer', () => {
  //   it('should predict the correct address of deployed proxy', async () => {});
  //   it('should deploy proxy and registry correctly', async () => {});
  //   it('should revert on proxy or registry bytecode mismatch', async () => {});
  // });
});
