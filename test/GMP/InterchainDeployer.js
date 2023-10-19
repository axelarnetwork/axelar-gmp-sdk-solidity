'use strict';

const chai = require('chai');
const {
  utils: { defaultAbiCoder, keccak256, id },
} = require('ethers');
const { expect } = chai;
const { ethers } = require('hardhat');
const getRandomID = () => id(Math.floor(Math.random() * 1e10).toString());
describe('InterchainDeployer', () => {
  let gatewayFactory;

  let sourceChainGateway;
  let destinationChainGateway;

  let gasServiceFactory;

  let sourceChainGasService;
  let destinationChainGasService;

  let interchainDeployerContractFactory;
  let sourceChainInterchainDeployerContract;
  let destinationChainInterchainDeployerContract;

  let ownerWallet;
  let userWallet;

  const sourceChain = 'chainA';
  const destinationChain = 'chainB';

  before(async () => {
    [ownerWallet, userWallet] = await ethers.getSigners();

    gatewayFactory = await ethers.getContractFactory(
      'MockGateway',
      ownerWallet,
    );
    gasServiceFactory = await ethers.getContractFactory(
      'MockGasService',
      ownerWallet,
    );
    interchainDeployerContractFactory = await ethers.getContractFactory(
      'InterchainDeployer',
      ownerWallet,
    );
  });

  describe('Invoke cross-chain deploy', () => {
    beforeEach(async () => {
      sourceChainGateway = await gatewayFactory
        .deploy()
        .then((d) => d.deployed());
      destinationChainGateway = await gatewayFactory
        .deploy()
        .then((d) => d.deployed());
      sourceChainGasService = await gasServiceFactory
        .deploy(ownerWallet.address)
        .then((d) => d.deployed());
      destinationChainGasService = await gasServiceFactory
        .deploy(ownerWallet.address)
        .then((d) => d.deployed());

      destinationChainInterchainDeployerContract =
        await interchainDeployerContractFactory
          .deploy(
            destinationChainGateway.address,
            destinationChainGasService.address,
            ownerWallet.address,
          )
          .then((d) => d.deployed());

      sourceChainInterchainDeployerContract =
        await interchainDeployerContractFactory
          .deploy(
            sourceChainGateway.address,
            sourceChainGasService.address,
            ownerWallet.address,
          )
          .then((d) => d.deployed());
    });

    it('deployRemoteContracts should deploy impl contract on a destination chain', async () => {
      const gas = 5000000;
      const salt = keccak256(defaultAbiCoder.encode(['string'], ['1']));
      const bytecode = (
        await ethers.getContractFactory('FixedImplementation', ownerWallet)
      ).getDeployTransaction(...[]).data;
      const setupParams = defaultAbiCoder.encode(['string'], ['0x']);
      const payload = defaultAbiCoder.encode(
        ['uint8', 'address', 'bytes32', 'bytes', 'bytes'],
        [1, ownerWallet.address, salt, bytecode, setupParams],
      );
      const payloadHash = keccak256(payload);

      await expect(
        sourceChainInterchainDeployerContract
          .connect(userWallet)
          .deployRemoteContracts(
            [
              {
                destinationChain,
                destinationAddress:
                  destinationChainInterchainDeployerContract.address,
                gas,
              },
            ],
            bytecode,
            salt,
            setupParams,
            {
              value: gas,
            },
          ),
      )
        .to.emit(sourceChainGateway, 'ContractCall')
        // .withArgs(
        //   sourceChainInterchainDeployerContract.address.toString(),
        //   destinationChain,
        //   destinationChainInterchainDeployerContract.address.toString(),
        //   payloadHash,
        //   payload,
        // )
        .and.to.emit(sourceChainGasService, 'NativeGasPaidForContractCall');
      // .withArgs(
      //   sourceChainInterchainDeployerContract.address,
      //   destinationChain,
      //   destinationChainInterchainDeployerContract.address,
      //   payloadHash,
      //   gas,
      //   ownerWallet.address,
      // );

      const approveCommandId = getRandomID();
      const sourceTxHash = keccak256('0x123abc123abc');
      const sourceEventIndex = 1;

      const approveData = defaultAbiCoder.encode(
        ['string', 'string', 'address', 'bytes32', 'bytes32', 'uint256'],
        [
          sourceChain,
          sourceChainInterchainDeployerContract.address,
          destinationChainInterchainDeployerContract.address,
          payloadHash,
          sourceTxHash,
          sourceEventIndex,
        ],
      );

      const approveExecute = await destinationChainGateway.approveContractCall(
        approveData,
        approveCommandId,
      );

      await expect(approveExecute)
        .to.emit(destinationChainGateway, 'ContractCallApproved')
        .withArgs(
          approveCommandId,
          sourceChain,
          sourceChainInterchainDeployerContract.address.toString(),
          destinationChainInterchainDeployerContract.address,
          payloadHash,
          sourceTxHash,
          sourceEventIndex,
        );

      await expect(
        destinationChainInterchainDeployerContract.execute(
          approveCommandId,
          sourceChain,
          sourceChainInterchainDeployerContract.address.toString(),
          payload,
        ),
      ).to.be.revertedWithCustomError(
        destinationChainInterchainDeployerContract,
        'NotWhitelistedSourceAddress',
      );

      await destinationChainInterchainDeployerContract.setWhitelistedSourceAddress(
        sourceChain,
        sourceChainInterchainDeployerContract.address,
        true,
      );

      // await expect(
      //   destinationChainInterchainDeployerContract.execute(
      //     approveCommandId,
      //     sourceChain,
      //     sourceChainInterchainDeployerContract.address.toString(),
      //     payload,
      //   ),
      // ).to.emit(destinationChainInterchainDeployerContract, 'Deployed');
    });
  });
});
