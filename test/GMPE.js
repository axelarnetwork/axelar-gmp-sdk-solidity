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

const { deployCreate3Upgradable } = require('../index');

const AxelarGateway = require('../artifacts/contracts/test/MockGateway.sol/MockGateway.json');
const ExpressProxyDeployer = require('../artifacts/contracts/express/ExpressProxyDeployer.sol/ExpressProxyDeployer.json');
const GMPExpressService = require('../artifacts/contracts/test/MockGMPExpressService.sol/MockGMPExpressService.json');
const MintableCappedERC20 = require('../artifacts/contracts/test/ERC20MintableBurnable.sol/ERC20MintableBurnable.json');
const SourceChainSwapCaller = require('../artifacts/contracts/test/gmp/SourceChainSwapCaller.sol/SourceChainSwapCaller.json');
const ExpressProxy = require('../artifacts/contracts/express/ExpressProxy.sol/ExpressProxy.json');
const ExpressRegistry = require('../artifacts/contracts/express/ExpressRegistry.sol/ExpressRegistry.json');
const DestinationChainSwapExpress = require('../artifacts/contracts/test/gmp/DestinationChainSwapExpress.sol/DestinationChainSwapExpress.json');
const DestinationChainSwapExpressDisabled = require('../artifacts/contracts/test/gmp/DestinationChainSwapExpressDisabled.sol/DestinationChainSwapExpressDisabled.json');
const DestinationChainTokenSwapper = require('../artifacts/contracts/test/gmp/DestinationChainTokenSwapper.sol/DestinationChainTokenSwapper.json');
const Create3Deployer = require('../dist/Create3Deployer.json');
const ExecutableSample = require('../artifacts/contracts/test/gmp/ExecutableSample.sol/ExecutableSample.json');

const getRandomID = () => id(Math.floor(Math.random() * 1e10).toString());

describe('GMPE', () => {
  const [ownerWallet, userWallet] = new MockProvider().getWallets();

  let sourceChainGateway;
  let destinationChainGateway;
  let gmpExpressService;
  let sourceChainSwapCaller;
  let destinationChainSwapExpress;
  let destinationChainSwapExpressProxy;
  let destinationChainSwapExpressDisabled;
  let destinationChainTokenSwapper;
  let tokenA;
  let tokenB;
  let create3Deployer;

  const sourceChain = 'chainA';
  const destinationChain = 'chainB';
  const nameA = 'testTokenX';
  const symbolA = 'testTokenX';
  const nameB = 'testTokenY';
  const symbolB = 'testTokenY';
  const decimals = 16;
  const capacity = 0;

  beforeEach(async () => {
    create3Deployer = await deployContract(ownerWallet, Create3Deployer);

    sourceChainGateway = await deployContract(ownerWallet, AxelarGateway);
    destinationChainGateway = await deployContract(ownerWallet, AxelarGateway);
    const expressProxyDeployer = await deployContract(
      ownerWallet,
      ExpressProxyDeployer,
      [destinationChainGateway.address],
    );
    gmpExpressService = await deployContract(ownerWallet, GMPExpressService, [
      destinationChainGateway.address,
      ownerWallet.address,
      expressProxyDeployer.address,
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

    sourceChainSwapCaller = await deployContract(
      ownerWallet,
      SourceChainSwapCaller,
      [
        sourceChainGateway.address,
        destinationChain,
        destinationChainSwapExpress.address.toString(),
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

      sourceChainSwapCaller = await deployContract(
        ownerWallet,
        SourceChainSwapCaller,
        [
          sourceChainGateway.address,
          destinationChain,
          destinationChainSwapExpressDisabled.address.toString(),
        ],
      );

      // Attempt to perform interchain token swap
      const swapAmount = 1e6;
      //const convertedAmount = 2 * swapAmount;
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
      ).to.be.reverted; // With ExpressCallNotEnabled
    });

    it('should revert if registry is deployed twice', async () => {
      await expect(
        destinationChainSwapExpressProxy
          .connect(ownerWallet)
          .deployRegistry(ExpressRegistry.bytecode, { gasLimit: 250000 }),
      ).to.be.reverted; // With AlreadyDeployed
    });

    it('should not execute if not approved by gateway', async () => {
      const value = 'test';
      const payload = defaultAbiCoder.encode(['string'], [value]);
      const payloadHash = keccak256(payload);

      const executableSampleSource = await deployContract(
        ownerWallet,
        ExecutableSample,
        [sourceChainGateway.address],
      );

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
      ).to.be.reverted; // With NotApprovedByGateway
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
      ).to.be.reverted; // With NotApprovedByGateway
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
      ).to.be.reverted; // With NotExpressRegistry
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

    //   it('should fail upgrade if it is the final implementation', async () => {});
  });

  // describe('Registry', () => {
  //   it('should only pay back token amount once', async () => {});
  //   it('should not register concurrent identical express calls', async () => {});
  //   it('should only execute calls from the proxy', async () => {});
  // });

  // describe('ExpressProxyDeployer', () => {
  //   it('should predict the correct address of deployed proxy', async () => {});
  //   it('should deploy proxy and registry correctly', async () => {});
  //   it('should revert on proxy or registry bytecode mismatch', async () => {});
  // });
});
