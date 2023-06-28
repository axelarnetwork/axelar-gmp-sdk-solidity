'use strict';

const chai = require('chai');
const {
  utils: { defaultAbiCoder, keccak256, id, formatBytes32String },
} = require('ethers');
const { expect } = chai;
const { ethers } = require('hardhat');

const { deployCreate3Upgradable } = require('../index');

const ExpressProxy = require('../artifacts/contracts/express/ExpressProxy.sol/ExpressProxy.json');
const ExpressRegistry = require('../artifacts/contracts/express/ExpressRegistry.sol/ExpressRegistry.json');
const ExpressService = require('../artifacts/contracts/express/ExpressService.sol/ExpressService.json');
const ExpressServiceProxy = require('../artifacts/contracts/express/ExpressServiceProxy.sol/ExpressServiceProxy.json');
const DestinationChainSwapExpress = require('../artifacts/contracts/test/gmp/DestinationChainSwapExpress.sol/DestinationChainSwapExpress.json');
const DestinationChainSwapExpressDisabled = require('../artifacts/contracts/test/gmp/DestinationChainSwapExpressDisabled.sol/DestinationChainSwapExpressDisabled.json');
const ExecutableSample = require('../artifacts/contracts/test/gmp/ExecutableSample.sol/ExecutableSample.json');
const InvalidExpressRegistry = require('../artifacts/contracts/test/gmp/InvalidExpressRegistry.sol/InvalidExpressRegistry.json');

const getRandomID = () => id(Math.floor(Math.random() * 1e10).toString());

describe('GMPE', async () => {
  let gatewayFactory;
  let sourceChainSwapCallerFactory;
  let destinationChainTokenSwapperFactory;
  let tokenFactory;
  let create3DeployerFactory;
  let expressProxyDeployerFactory;
  let executableSampleFactory;
  let expressProxyFactory;
  let expressRegistryFactory;
  let destinationChainSwapExpressFactory;
  let destinationChainSwapExpressDisabledFactory;

  let sourceChainGateway;
  let sourceChainSwapCaller;
  let destinationChainGateway;
  let destinationChainSwapExpress;
  let destinationChainSwapExpressProxy;
  let tokenA;
  let tokenB;
  let expressProxyDeployer;
  let create3Deployer;
  let expressService;
  let destinationChainTokenSwapper;
  let destinationChainSwapExpressDisabled;

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
    expressProxyFactory = await ethers.getContractFactory(
      'ExpressProxy',
      ownerWallet,
    );
    expressRegistryFactory = await ethers.getContractFactory(
      'ExpressRegistry',
      ownerWallet,
    );
    destinationChainSwapExpressFactory = await ethers.getContractFactory(
      'DestinationChainSwapExpress',
      ownerWallet,
    );
    destinationChainSwapExpressDisabledFactory =
      await ethers.getContractFactory(
        'DestinationChainSwapExpressDisabled',
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

    expressService = await deployCreate3Upgradable(
      create3Deployer.address,
      ownerWallet,
      ExpressService,
      ExpressServiceProxy,
      [
        destinationChainGateway.address,
        expressProxyDeployer.address,
        ownerWallet.address,
      ],
    );

    tokenA = await tokenFactory
      .deploy(nameA, symbolA, decimals)
      .then((d) => d.deployed());

    tokenB = await tokenFactory
      .deploy(nameB, symbolB, decimals)
      .then((d) => d.deployed());

    await sourceChainGateway.deployToken(
      defaultAbiCoder.encode(
        ['string', 'string', 'uint8', 'uint256', ' address', 'uint256'],
        [nameA, symbolA, decimals, capacity, ethers.constants.AddressZero, 0],
      ),
      keccak256('0x'),
    );
    await sourceChainGateway.deployToken(
      defaultAbiCoder.encode(
        ['string', 'string', 'uint8', 'uint256', ' address', 'uint256'],
        [nameB, symbolB, decimals, capacity, ethers.constants.AddressZero, 0],
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

    destinationChainSwapExpressProxy = await expressProxyFactory.attach(
      destinationChainSwapExpress.address,
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
        .transfer(expressService.address, swapAmount);
      await expect(
        expressService
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
          expressService.address,
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
          expressService.address,
          swapAmount,
        );
    });
  });

  describe('ExpressProxy', () => {
    it('should fail upgrade if it is the final implementation', async () => {
      // Check that current implementation is not final
      expect(
        await destinationChainSwapExpressProxy.connect(ownerWallet).isFinal(),
      ).to.be.false;

      const implementationAddress = await destinationChainSwapExpressProxy
        .connect(ownerWallet)
        .implementation();

      let bytecode =
        await destinationChainSwapExpressDisabledFactory.getDeployTransaction(
          destinationChainGateway.address,
          destinationChainTokenSwapper.address,
        ).data;

      await destinationChainSwapExpressProxy
        .connect(ownerWallet)
        .finalUpgrade(bytecode, '0x');

      const updatedImplementationAddress =
        await destinationChainSwapExpressProxy
          .connect(ownerWallet)
          .implementation();

      // Sanity check to make sure update occured
      expect(implementationAddress).to.not.equal(updatedImplementationAddress);

      bytecode = await destinationChainSwapExpressFactory.getDeployTransaction(
        destinationChainGateway.address,
        destinationChainTokenSwapper.address,
      ).data;

      // Attempt final upgrade again, should fail
      await expect(
        destinationChainSwapExpressProxy
          .connect(ownerWallet)
          .finalUpgrade(bytecode, '0x'),
      ).to.be.revertedWithCustomError(
        destinationChainSwapExpressProxy,
        'AlreadyDeployed',
      );
    });

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

      const destinationChainSwapExpressProxy = await expressProxyFactory.attach(
        destinationChainSwapExpressDisabled.address,
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
        .transfer(expressService.address, swapAmount);

      await expect(
        expressService
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
        'ExpressCallNotAccepted',
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

      const destinationChainSampleExpressProxy =
        await expressProxyFactory.attach(executableSampleDest.address);
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
        .transfer(expressService.address, swapAmount);

      await expect(
        expressService
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
          expressService.address,
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
        .transfer(expressService.address, swapAmount);

      await expect(
        expressService
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
          expressService.address,
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
            expressService.address.toString(),
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
        .transfer(expressService.address, swapAmount);

      await expect(
        expressService
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
          expressService.address,
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
          expressService.address,
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
        .transfer(expressService.address, swapAmount);
      await expect(
        expressService
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
          expressService.address,
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

      const destinationChainSwapExpressRegistry =
        await expressRegistryFactory.attach(
          destinationChainSwapExpressRegistryAddress,
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

      const destinationChainSwapExpressRegistry =
        await expressRegistryFactory.attach(
          destinationChainSwapExpressRegistryAddress,
        );

      // Should revert if called directly by an EOA with no custom error (Line 91 of ExpressRegistry)

      await expect(
        destinationChainSwapExpressRegistry
          .connect(ownerWallet)
          .registerExpressCallWithToken(
            expressService.address,
            sourceChain,
            sourceChainSwapCaller.address.toString(),
            payloadHash,
            tokenA,
            swapAmount,
          ),
      ).to.be.reverted;
    });
  });

  describe('ExpressProxyDeployer', () => {
    it('should deploy proxy and registry correctly', async () => {
      const salt = formatBytes32String(1);
      const deploySaltBytes = defaultAbiCoder.encode(
        ['address', 'bytes32'],
        [ownerWallet.address, salt],
      );
      const deploySalt = keccak256(deploySaltBytes);

      const setupParams = defaultAbiCoder.encode(
        ['address', 'address', 'bytes', 'address'],
        [
          destinationChainSwapExpress.address,
          ownerWallet.address,
          [],
          destinationChainGateway.address,
        ],
      );

      await expressProxyDeployer
        .connect(ownerWallet)
        .deployExpressProxy(
          deploySalt,
          destinationChainSwapExpress.address,
          ownerWallet.address,
          setupParams,
        );

      const destinationChainSwapExpressProxyAddress = await expressProxyDeployer
        .connect(ownerWallet)
        .deployedProxyAddress(
          salt,
          ownerWallet.address,
          expressProxyDeployer.address,
        );

      const sampleProxy = await expressProxyFactory.attach(
        destinationChainSwapExpressProxyAddress,
      );

      // Should return true if address is correct and proxy & registry are deployed correctly
      expect(await expressProxyDeployer.isExpressProxy(sampleProxy.address)).to
        .be.true;
    });

    it('should revert on proxy or registry bytecode mismatch', async () => {
      const expressProxyDeployer2 = await expressProxyDeployerFactory
        .deploy(destinationChainGateway.address)
        .then((d) => d.deployed());

      const destinationChainSwapExpress2 = await deployCreate3Upgradable(
        create3Deployer.address,
        ownerWallet,
        DestinationChainSwapExpress,
        ExpressProxy,
        [destinationChainGateway.address, destinationChainTokenSwapper.address],
        [destinationChainGateway.address],
      );

      const destinationChainSwapExpressProxy2 =
        await expressProxyFactory.attach(destinationChainSwapExpress2.address);

      const invalidExpressProxyFactory = await ethers.getContractFactory(
        'InvalidExpressProxy',
        ownerWallet,
      );

      const invalidExpressProxy = await invalidExpressProxyFactory
        .deploy()
        .then((d) => d.deployed());

      // should fail first condition (line 31 of ExpressProxyDeployer)
      expect(
        await expressProxyDeployer2
          .connect(ownerWallet)
          .isExpressProxy(invalidExpressProxy.address),
      ).to.be.false;

      // should fail second condition (line 31 of ExpressProxyDeployer)
      expect(
        await expressProxyDeployer2
          .connect(ownerWallet)
          .isExpressProxy(destinationChainSwapExpressProxy2.address),
      ).to.be.false;

      // add case for wrong registry bytecode, should fail second condition
      await destinationChainSwapExpressProxy2.deployRegistry(
        InvalidExpressRegistry.bytecode,
      );
      expect(
        await expressProxyDeployer2
          .connect(ownerWallet)
          .isExpressProxy(destinationChainSwapExpressProxy2.address),
      ).to.be.false;

      // should pass second condition once correct proxy & corresponding registry are deployed
      const destinationChainSwapExpress3 = await deployCreate3Upgradable(
        create3Deployer.address,
        ownerWallet,
        DestinationChainSwapExpress,
        ExpressProxy,
        [destinationChainGateway.address, destinationChainTokenSwapper.address],
        [destinationChainGateway.address],
      );

      const destinationChainSwapExpressProxy3 =
        await expressProxyFactory.attach(destinationChainSwapExpress3.address);
      await destinationChainSwapExpressProxy3.deployRegistry(
        ExpressRegistry.bytecode,
      );
      expect(
        await expressProxyDeployer2
          .connect(ownerWallet)
          .isExpressProxy(destinationChainSwapExpressProxy3.address),
      ).to.be.true;
    });
  });
});
