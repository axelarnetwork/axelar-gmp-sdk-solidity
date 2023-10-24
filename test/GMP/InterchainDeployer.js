'use strict';

const chai = require('chai');
const {
  utils: { defaultAbiCoder, keccak256, id },
} = require('ethers');
const { expect } = chai;
const { ethers } = require('hardhat');

const getRandomID = () => id(Math.floor(Math.random() * 1e10).toString());

describe('InterchainDeployer', () => {
  let gatewayFactory, srcGateway, destGateway;
  let gasSvcFactory, srcGasSvc, destGasSvc;
  let IDFactory, srcID, destID;

  let owner, user;

  let fixedImplBytecode, impl1Bytecode, impl2Bytecode;

  let destProxyAddr, destProxyContract, srcProxyAddr, srcProxyContract;

  let remoteChains;

  const salt = keccak256(defaultAbiCoder.encode(['string'], ['1']));
  const setupParams = defaultAbiCoder.encode(['string'], ['0x']);
  const sourceChain = 'chainA';
  const destinationChain = 'chainB';
  const gas = 5000000;
  const sampleAbi = [
    'function implementation() external view returns (address)',
    'function getDummyMessage() external pure returns (string memory)',
  ];

  before(async () => {
    [owner, user] = await ethers.getSigners();

    gatewayFactory = await ethers.getContractFactory('MockGateway', owner);
    gasSvcFactory = await ethers.getContractFactory('MockGasService', owner);
    IDFactory = await ethers.getContractFactory('InterchainDeployer', owner);

    srcGateway = await gatewayFactory.deploy().then((d) => d.deployed());
    destGateway = await gatewayFactory.deploy().then((d) => d.deployed());
    srcGasSvc = await gasSvcFactory
      .deploy(owner.address)
      .then((d) => d.deployed());
    destGasSvc = await gasSvcFactory
      .deploy(owner.address)
      .then((d) => d.deployed());
    destID = await IDFactory.deploy(
      destGateway.address,
      destGasSvc.address,
      owner.address,
    ).then((d) => d.deployed());
    srcID = await IDFactory.deploy(
      srcGateway.address,
      srcGasSvc.address,
      owner.address,
    ).then((d) => d.deployed());

    impl1Bytecode = (
      await ethers.getContractFactory('UpgradableTest', owner)
    ).getDeployTransaction().data;

    destProxyAddr = await destID.connect(user).getProxyAddress(salt);
    destProxyContract = new ethers.Contract(destProxyAddr, sampleAbi, user);
    srcProxyAddr = await srcID.connect(user).getProxyAddress(salt);
    srcProxyContract = new ethers.Contract(srcProxyAddr, sampleAbi, user);
  });

  describe('Invoke single-chain deployment of arbitrary contracts, it:', () => {
    it('should be able to deploy a simple contract', async () => {
      const fixedImpl = (
        await ethers.getContractFactory('FixedImplementation', owner)
      ).getDeployTransaction().data;

      await expect(
        srcID.connect(user).deployStaticContract(salt, fixedImpl),
      ).to.emit(srcID, 'DeployedStaticContract');
    });

    it('should be able to deploy an upgradeable contract', async () => {
      const impl1 = (
        await ethers.getContractFactory('UpgradableTest', owner)
      ).getDeployTransaction().data;

      await expect(
        srcID.connect(user).deployUpgradeableContract(salt, impl1, setupParams),
      ).to.emit(srcID, 'DeployedUpgradeableContract');

      expect(await srcProxyContract.getDummyMessage()).to.equal(
        'Hello from UpgradableTest',
      );
    });

    it('should be able to upgrade an upgradeable contract', async () => {
      const impl2 = (
        await ethers.getContractFactory('UpgradableTest2', owner)
      ).getDeployTransaction().data;

      await expect(
        srcID
          .connect(user)
          .upgradeUpgradeableContract(salt, impl2, setupParams),
      ).to.emit(srcID, 'UpgradedContract');

      expect(await srcProxyContract.getDummyMessage()).to.equal(
        'Hello from UpgradableTest2',
      );
    });
  });

  describe('Invoke cross-chain deployment of arbitrary contracts, it:', () => {
    it('should revert if caller from the src chain is not whitelisted', async () => {
      const payload = defaultAbiCoder.encode(
        ['uint8', 'address', 'bytes32', 'bytes', 'bytes'],
        [1, user.address, salt, impl1Bytecode, setupParams],
      );
      const payloadHash = keccak256(payload);

      const approveCommandId = getRandomID();
      const sourceTxHash = keccak256('0x123abc123abc');
      const sourceEventIndex = 1;

      const approveData = defaultAbiCoder.encode(
        ['string', 'string', 'address', 'bytes32', 'bytes32', 'uint256'],
        [
          sourceChain,
          srcID.address,
          destID.address,
          payloadHash,
          sourceTxHash,
          sourceEventIndex,
        ],
      );

      await expect(
        await destGateway.approveContractCall(approveData, approveCommandId),
      )
        .to.emit(destGateway, 'ContractCallApproved')
        .withArgs(
          approveCommandId,
          sourceChain,
          srcID.address.toString(),
          destID.address,
          payloadHash,
          sourceTxHash,
          sourceEventIndex,
        );

      await expect(
        destID.execute(
          approveCommandId,
          sourceChain,
          srcID.address.toString(),
          payload,
        ),
      ).to.be.revertedWithCustomError(destID, 'NotWhitelistedSourceAddress');
    });

    it('should be able to deploy a new fixed impl contract on the destination chain', async () => {
      fixedImplBytecode = (
        await ethers.getContractFactory('FixedImplementation', owner)
      ).getDeployTransaction().data;
      const payload = defaultAbiCoder.encode(
        ['uint8', 'address', 'bytes32', 'bytes', 'bytes'],
        [0, user.address, salt, fixedImplBytecode, setupParams],
      );
      const payloadHash = keccak256(payload);
      const remoteChains = [
        {
          destinationChain,
          destinationAddress: destID.address,
          gas,
          implBytecode: fixedImplBytecode,
          implSetupParams: setupParams,
        },
      ];

      await expect(
        srcID.connect(user).deployRemoteStaticContracts(remoteChains, salt, {
          value: gas,
        }),
      )
        .to.emit(srcGateway, 'ContractCall')
        .withArgs(
          srcID.address.toString(),
          destinationChain,
          destID.address.toString(),
          payloadHash,
          payload,
        )
        .and.to.emit(srcGasSvc, 'NativeGasPaidForContractCall')
        .withArgs(
          srcID.address,
          destinationChain,
          destID.address,
          payloadHash,
          gas,
          user.address,
        );

      const approveCommandId = getRandomID();
      const sourceTxHash = keccak256('0x123abc123abc');
      const sourceEventIndex = 1;

      const approveData = defaultAbiCoder.encode(
        ['string', 'string', 'address', 'bytes32', 'bytes32', 'uint256'],
        [
          sourceChain,
          srcID.address,
          destID.address,
          payloadHash,
          sourceTxHash,
          sourceEventIndex,
        ],
      );

      await expect(
        await destGateway.approveContractCall(approveData, approveCommandId),
      )
        .to.emit(destGateway, 'ContractCallApproved')
        .withArgs(
          approveCommandId,
          sourceChain,
          srcID.address.toString(),
          destID.address,
          payloadHash,
          sourceTxHash,
          sourceEventIndex,
        );

      await destID.setWhitelistedSourceAddress(
        sourceChain,
        srcID.address,
        true,
      );

      await expect(
        destID.execute(
          approveCommandId,
          sourceChain,
          srcID.address.toString(),
          payload,
        ),
      ).to.emit(destID, 'DeployedStaticContract');
    });

    it('should be able to deploy an upgradeable contract on a destination chain', async () => {
      const payload = defaultAbiCoder.encode(
        ['uint8', 'address', 'bytes32', 'bytes', 'bytes'],
        [1, user.address, salt, impl1Bytecode, setupParams],
      );
      const payloadHash = keccak256(payload);
      remoteChains = [
        {
          destinationChain,
          destinationAddress: destID.address,
          gas,
          implBytecode: impl1Bytecode,
          implSetupParams: setupParams,
        },
      ];

      await expect(
        srcID
          .connect(user)
          .deployRemoteUpgradeableContracts(remoteChains, salt, {
            value: gas,
          }),
      )
        .to.emit(srcGateway, 'ContractCall')
        .withArgs(
          srcID.address.toString(),
          destinationChain,
          destID.address.toString(),
          payloadHash,
          payload,
        )
        .and.to.emit(srcGasSvc, 'NativeGasPaidForContractCall')
        .withArgs(
          srcID.address,
          destinationChain,
          destID.address,
          payloadHash,
          gas,
          user.address,
        );

      const approveCommandId = getRandomID();
      const sourceTxHash = keccak256('0x123abc123abc');
      const sourceEventIndex = 1;

      const approveData = defaultAbiCoder.encode(
        ['string', 'string', 'address', 'bytes32', 'bytes32', 'uint256'],
        [
          sourceChain,
          srcID.address,
          destID.address,
          payloadHash,
          sourceTxHash,
          sourceEventIndex,
        ],
      );

      await expect(
        await destGateway.approveContractCall(approveData, approveCommandId),
      )
        .to.emit(destGateway, 'ContractCallApproved')
        .withArgs(
          approveCommandId,
          sourceChain,
          srcID.address.toString(),
          destID.address,
          payloadHash,
          sourceTxHash,
          sourceEventIndex,
        );

      await destID.setWhitelistedSourceAddress(
        sourceChain,
        srcID.address,
        true,
      );

      await expect(
        destID.execute(
          approveCommandId,
          sourceChain,
          srcID.address.toString(),
          payload,
        ),
      )
        .to.emit(destID, 'DeployedUpgradeableContract')
        .withArgs(
          user.address,
          salt,
          destProxyAddr,
          await destProxyContract.implementation(),
          sourceChain,
        );
    });

    it('should be able to upgrade an upgradeable contract on a destination chain', async () => {
      const impl1Address = await destProxyContract.implementation();
      expect(await destProxyContract.getDummyMessage()).to.equal(
        'Hello from UpgradableTest',
      );

      impl2Bytecode = (
        await ethers.getContractFactory('UpgradableTest2', owner)
      ).getDeployTransaction().data;
      const upgradePayload = defaultAbiCoder.encode(
        ['uint8', 'address', 'bytes32', 'bytes', 'bytes'],
        [2, user.address, salt, impl2Bytecode, setupParams],
      );
      const upgradePayloadHash = keccak256(upgradePayload);
      remoteChains = [
        {
          destinationChain,
          destinationAddress: destID.address,
          gas,
          implBytecode: impl2Bytecode,
          implSetupParams: setupParams,
        },
      ];

      await expect(
        srcID.connect(user).upgradeRemoteContracts(remoteChains, salt, {
          value: gas,
        }),
      )
        .to.emit(srcGateway, 'ContractCall')
        .withArgs(
          srcID.address.toString(),
          destinationChain,
          destID.address.toString(),
          upgradePayloadHash,
          upgradePayload,
        )
        .and.to.emit(srcGasSvc, 'NativeGasPaidForContractCall')
        .withArgs(
          srcID.address,
          destinationChain,
          destID.address,
          upgradePayloadHash,
          gas,
          user.address,
        );

      const upgradeApproveCommandId = getRandomID();
      const upgradeSourceTxHash = keccak256('0x345def345def');
      const upgradeSourceEventIndex = 1;

      const upgradeAapproveData = defaultAbiCoder.encode(
        ['string', 'string', 'address', 'bytes32', 'bytes32', 'uint256'],
        [
          sourceChain,
          srcID.address,
          destID.address,
          upgradePayloadHash,
          upgradeSourceTxHash,
          upgradeSourceEventIndex,
        ],
      );

      await expect(
        await destGateway.approveContractCall(
          upgradeAapproveData,
          upgradeApproveCommandId,
        ),
      )
        .to.emit(destGateway, 'ContractCallApproved')
        .withArgs(
          upgradeApproveCommandId,
          sourceChain,
          srcID.address.toString(),
          destID.address,
          upgradePayloadHash,
          upgradeSourceTxHash,
          upgradeSourceEventIndex,
        );

      await expect(
        destID.execute(
          upgradeApproveCommandId,
          sourceChain,
          srcID.address.toString(),
          upgradePayload,
        ),
      )
        .to.emit(destID, 'UpgradedContract')
        .withArgs(
          user.address,
          salt,
          destProxyAddr,
          await destProxyContract.implementation(),
          sourceChain,
        );

      expect(impl1Address).not.to.equal(
        await destProxyContract.implementation(),
      );
      expect(await destProxyContract.getDummyMessage()).to.equal(
        'Hello from UpgradableTest2',
      );
    });
  });
});
