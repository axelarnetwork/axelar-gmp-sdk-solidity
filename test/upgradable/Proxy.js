'use strict';

const chai = require('chai');
const {
  utils: { defaultAbiCoder, keccak256 },
  constants: { AddressZero },
} = require('ethers');
const { expect } = chai;
const { ethers } = require('hardhat');
const { getEVMVersion } = require('../utils');

describe('Proxy', async () => {
  let owner, user;

  let proxyImplementationFactory;
  let proxyImplementation;

  let invalidProxyImplementationFactory;
  let invalidProxyImplementation;

  before(async () => {
    [owner, user] = await ethers.getSigners();

    proxyImplementationFactory = await ethers.getContractFactory(
      'ProxyImplementation',
      owner,
    );

    invalidProxyImplementationFactory = await ethers.getContractFactory(
      'InvalidProxyImplementation',
      owner,
    );
  });

  describe('FixedProxy', async () => {
    let fixedProxyFactory;
    let fixedProxyImplementationFactory;

    let fixedProxy;
    let fixedProxyImplementation;

    beforeEach(async () => {
      fixedProxyFactory = await ethers.getContractFactory('FixedProxy', owner);
      fixedProxyImplementationFactory = await ethers.getContractFactory(
        'FixedImplementation',
        owner,
      );
      fixedProxyImplementation = await fixedProxyImplementationFactory
        .deploy()
        .then((d) => d.deployed());

      fixedProxy = await fixedProxyFactory
        .deploy(fixedProxyImplementation.address)
        .then((d) => d.deployed());
    });

    it('should revert with invalid contract id', async () => {
      fixedProxyFactory = await ethers.getContractFactory(
        'TestFixedProxy',
        owner,
      );
      const invalidProxyImplementation = await invalidProxyImplementationFactory
        .deploy()
        .then((d) => d.deployed());

      await expect(
        fixedProxyFactory.deploy(invalidProxyImplementation.address),
      ).to.be.revertedWithCustomError(fixedProxy, 'InvalidImplementation');
    });

    it('call to proxy invokes correct function in implementation', async () => {
      const input = 123;

      const implementationAsProxy = fixedProxyImplementationFactory.attach(
        fixedProxy.address,
      );

      let val = await implementationAsProxy.value();

      expect(val).to.equal(0);

      await implementationAsProxy.set(input);
      val = await implementationAsProxy.value();

      expect(val).to.equal(input);
    });

    it('should preserve the fixed proxy bytecode [ @skip-on-coverage ]', async () => {
      const fixedProxyBytecode = fixedProxyFactory.bytecode;
      const fixedProxyBytecodeHash = keccak256(fixedProxyBytecode);

      const expected = {
        istanbul:
          '0x7f1872745e5f87c15cfb884491d90619949f3c2039952e665efba135f482aa6a',
        berlin:
          '0x6e68b4e648128044f488715574f76c6a08804437591a6bcd4fc9ce4c48b93206',
        london:
          '0xe0fea3cc41b62725f54139764f597f39f4bb23aa16fd0165eaca932ada0c44fc',
      }[getEVMVersion()];

      expect(fixedProxyBytecodeHash).to.be.equal(expected);
    });
  });

  describe('Proxy & BaseProxy', async () => {
    let proxyFactory;
    let invalidSetupProxyImplementationFactory;

    let proxy;
    let invalidSetupProxyImplementation;

    beforeEach(async () => {
      proxyFactory = await ethers.getContractFactory('TestProxy', owner);

      invalidSetupProxyImplementationFactory = await ethers.getContractFactory(
        'InvalidSetupProxyImplementation',
        owner,
      );

      invalidProxyImplementation = await invalidProxyImplementationFactory
        .deploy()
        .then((d) => d.deployed());

      proxyImplementation = await proxyImplementationFactory
        .deploy()
        .then((d) => d.deployed());

      invalidSetupProxyImplementation =
        await invalidSetupProxyImplementationFactory
          .deploy()
          .then((d) => d.deployed());
    });

    // Proxy
    it('reverts on invalid owner', async () => {
      await expect(
        proxyFactory.deploy(
          proxyImplementation.address,
          ethers.constants.AddressZero,
          '0x',
        ),
      ).to.be.revertedWithCustomError(proxyFactory, 'InvalidOwner');
    });

    it('reverts on invalid implementation', async () => {
      const setupParams = '0x';

      await expect(
        proxyFactory.deploy(
          invalidProxyImplementation.address,
          owner.address,
          setupParams,
          { gasLimit: 250000 },
        ),
      ).to.be.revertedWithCustomError(proxyFactory, 'InvalidImplementation');
    });

    it('reverts if setup params are provided but implementation setup fails', async () => {
      const setupParams = defaultAbiCoder.encode(
        ['uint256', 'string'],
        [123, 'test'],
      );

      await expect(
        proxyFactory.deploy(
          invalidSetupProxyImplementation.address,
          owner.address,
          setupParams,
          { gasLimit: 250000 },
        ),
      ).to.be.revertedWithCustomError(proxyFactory, 'SetupFailed');
    });

    // BaseProxy
    it('implementation returns correct address', async () => {
      const setupParams = defaultAbiCoder.encode(
        ['uint256', 'string'],
        [123, 'test'],
      );

      proxy = await proxyFactory
        .deploy(proxyImplementation.address, owner.address, setupParams)
        .then((d) => d.deployed());

      const expectedAddress = await proxy.implementation();

      expect(proxyImplementation.address).to.equal(expectedAddress);
    });

    it('call to proxy invokes correct function in implementation', async () => {
      const setupParams = defaultAbiCoder.encode(
        ['uint256', 'string'],
        [123, 'test'],
      );

      proxy = await proxyFactory
        .deploy(proxyImplementation.address, owner.address, setupParams)
        .then((d) => d.deployed());

      const implementationAsProxy = proxyImplementation.attach(proxy.address);

      const input = 234;
      let val = await implementationAsProxy.value();

      expect(val).to.equal(123);

      await implementationAsProxy.set(input);
      val = await implementationAsProxy.value();

      expect(val).to.equal(input);
    });

    it('should shadow a call to setup on the implementation', async () => {
      let setupParams = defaultAbiCoder.encode(
        ['uint256', 'string'],
        [123, 'test'],
      );

      proxy = await proxyFactory
        .deploy(proxyImplementation.address, owner.address, setupParams)
        .then((d) => d.deployed());

      const implementationAsProxy = proxyImplementation.attach(proxy.address);

      setupParams = defaultAbiCoder.encode(
        ['uint256', 'string'],
        [456, 'test'],
      );

      await proxyImplementation.setup(setupParams);

      const val = await implementationAsProxy.value();

      expect(val).to.eq(123);
    });

    it('should preserve the proxy bytecode [ @skip-on-coverage ]', async () => {
      const proxyFactory = await ethers.getContractFactory('Proxy', owner);
      const proxyBytecode = proxyFactory.bytecode;
      const proxyBytecodeHash = keccak256(proxyBytecode);

      const expected = {
        istanbul:
          '0x9708ed200e1c05090844fc16c500a593be639f493c8949ee2d773aa0fce7d051',
        berlin:
          '0xfc17f3b1332553428d12c6edcb24322e92f5ff4d455c0112845a249c936bf6fc',
        london:
          '0x04e1ba2679e69e7ce1a3934e9aecc4de17c178000c619658abe453ce74854105',
      }[getEVMVersion()];

      expect(proxyBytecodeHash).to.be.equal(expected);
    });
  });

  describe('FinalProxy', async () => {
    let finalProxyFactory;
    let differentProxyImplementationFactory;
    let invalidSetupProxyImplementationFactory;

    let finalProxy;
    let differentProxyImplementation;

    beforeEach(async () => {
      finalProxyFactory = await ethers.getContractFactory('FinalProxy', owner);
      differentProxyImplementationFactory = await ethers.getContractFactory(
        'DifferentProxyImplementation',
        owner,
      );
      invalidSetupProxyImplementationFactory = await ethers.getContractFactory(
        'InvalidSetupProxyImplementation',
        owner,
      );

      proxyImplementation = await proxyImplementationFactory
        .deploy()
        .then((d) => d.deployed());

      invalidProxyImplementation = await invalidProxyImplementationFactory
        .deploy()
        .then((d) => d.deployed());

      differentProxyImplementation = await differentProxyImplementationFactory
        .deploy()
        .then((d) => d.deployed());
    });

    it('check internal constants', async () => {
      const setupParams = '0x';
      const testFinalProxyFactory = await ethers.getContractFactory(
        'TestFinalProxy',
        owner,
      );

      await testFinalProxyFactory
        .deploy(proxyImplementation.address, owner.address, setupParams)
        .then((d) => d.deployed());
    });

    it('returns false initially from isFinal', async () => {
      const setupParams = '0x';

      finalProxy = await finalProxyFactory
        .deploy(proxyImplementation.address, owner.address, setupParams)
        .then((d) => d.deployed());

      const isFinal = await finalProxy.isFinal();

      expect(isFinal).to.be.false;
    });

    it('reverts when finalUpgrade is called by a non-owner', async () => {
      const setupParams = '0x';

      finalProxy = await finalProxyFactory
        .deploy(proxyImplementation.address, owner.address, setupParams)
        .then((d) => d.deployed());

      await expect(
        finalProxy
          .connect(user)
          .finalUpgrade(differentProxyImplementation.address, setupParams),
      ).to.be.revertedWithCustomError(finalProxy, 'NotOwner');
    });

    it('reverts if setup params are provided but implementation setup fails', async () => {
      let setupParams = '0x';

      finalProxy = await finalProxyFactory
        .deploy(proxyImplementation.address, owner.address, setupParams)
        .then((d) => d.deployed());

      setupParams = defaultAbiCoder.encode(
        ['uint256', 'string'],
        [123, 'test'],
      );

      const bytecode =
        await invalidSetupProxyImplementationFactory.getDeployTransaction()
          .data;

      await expect(
        finalProxy.finalUpgrade(bytecode, setupParams),
      ).to.be.revertedWithCustomError(finalProxy, 'SetupFailed');
    });

    it('should revert on final upgrade with invalid contract ID', async () => {
      const setupParams = '0x';
      const testFinalProxyFactory = await ethers.getContractFactory(
        'TestFinalProxy',
        owner,
      );

      const finalProxy = await testFinalProxyFactory
        .deploy(proxyImplementation.address, owner.address, setupParams)
        .then((d) => d.deployed());

      const bytecode =
        await invalidProxyImplementationFactory.getDeployTransaction().data;

      await expect(
        finalProxy.finalUpgrade(bytecode, setupParams),
      ).to.be.revertedWithCustomError(finalProxy, 'InvalidImplementation');
    });

    it('after finalUpgrade, isFinal returns true', async () => {
      const setupParams = '0x';

      finalProxy = await finalProxyFactory
        .deploy(proxyImplementation.address, owner.address, setupParams)
        .then((d) => d.deployed());

      const bytecode =
        await differentProxyImplementationFactory.getDeployTransaction().data;

      await finalProxy.finalUpgrade(bytecode, setupParams);

      const isFinal = await finalProxy.isFinal();

      expect(isFinal).to.be.true;
    });

    it('should perform final upgrade with setup params', async () => {
      let setupParams = '0x';

      finalProxy = await finalProxyFactory
        .deploy(
          differentProxyImplementation.address,
          owner.address,
          setupParams,
        )
        .then((d) => d.deployed());

      const bytecode = await proxyImplementationFactory.getDeployTransaction()
        .data;

      setupParams = defaultAbiCoder.encode(
        ['uint256', 'string'],
        [123, 'test'],
      );

      await finalProxy.finalUpgrade(bytecode, setupParams);

      const isFinal = await finalProxy.isFinal();

      expect(isFinal).to.be.true;
    });

    it('should return the correct implementation address', async () => {
      const setupParams = '0x';

      finalProxy = await finalProxyFactory
        .deploy(proxyImplementation.address, owner.address, setupParams)
        .then((d) => d.deployed());

      let implementationAddress = await finalProxy.implementation();

      expect(implementationAddress).to.eq(proxyImplementation.address);

      const bytecode =
        await differentProxyImplementationFactory.getDeployTransaction().data;

      await finalProxy.finalUpgrade(bytecode, setupParams);

      implementationAddress = await finalProxy.implementation();

      expect(implementationAddress).to.not.eq(AddressZero);
    });

    it('reverts on second call to finalUpgrade', async () => {
      const setupParams = '0x';

      finalProxy = await finalProxyFactory
        .deploy(proxyImplementation.address, owner.address, setupParams)
        .then((d) => d.deployed());

      let bytecode =
        await differentProxyImplementationFactory.getDeployTransaction().data;

      await finalProxy.finalUpgrade(bytecode, setupParams);

      bytecode = await proxyImplementationFactory.getDeployTransaction().data;

      await expect(
        finalProxy.finalUpgrade(bytecode, setupParams),
      ).to.be.revertedWithCustomError(finalProxy, 'AlreadyDeployed');
    });

    it('should preserve the final proxy bytecode [ @skip-on-coverage ]', async () => {
      const finalProxyBytecode = finalProxyFactory.bytecode;
      const finalProxyBytecodeHash = keccak256(finalProxyBytecode);

      const expected = {
        istanbul:
          '0x5783daa6a87868e3688dbf756c2b22435972a8861bd9b1ce845e7b3743e6e91d',
        berlin:
          '0x897a0eb5e643779a9dc956301807206603ea3363c082c3f5a0c6830f2569a206',
        london:
          '0x07ae950d9aa7a5cafa356c43b79cca5a74d598cbcfe757532073b377f59c8960',
      }[getEVMVersion()];

      expect(finalProxyBytecodeHash).to.be.equal(expected);
    });
  });

  describe('InitProxy', async () => {
    let initProxyFactory;
    let initProxy;

    beforeEach(async () => {
      initProxyFactory = await ethers.getContractFactory('InitProxy', owner);

      initProxy = await initProxyFactory.deploy().then((d) => d.deployed());

      proxyImplementation = await proxyImplementationFactory
        .deploy()
        .then((d) => d.deployed());
    });

    it('should revert if non-owner calls init', async () => {
      await expect(
        initProxy
          .connect(user)
          .init(proxyImplementation.address, owner.address, '0x'),
      ).to.be.revertedWithCustomError(initProxy, 'NotOwner');
    });

    it('should initialize init proxy with the implementation', async () => {
      await initProxy
        .init(proxyImplementation.address, owner.address, '0x')
        .then((tx) => tx.wait());

      const expectedAddress = await initProxy.implementation();

      expect(proxyImplementation.address).to.equal(expectedAddress);
    });

    it('should revert if proxy has already been initialized', async () => {
      await initProxy
        .init(proxyImplementation.address, owner.address, '0x')
        .then((tx) => tx.wait());

      await expect(
        initProxy.init(proxyImplementation.address, owner.address, '0x'),
      ).to.be.revertedWithCustomError(initProxy, 'AlreadyInitialized');
    });

    it('should revert if call to setup on the implementation fails', async () => {
      const initVal = 123;

      const setupParams = defaultAbiCoder.encode(['uint256'], [initVal]);

      await expect(
        initProxy.init(proxyImplementation.address, owner.address, setupParams),
      ).to.be.revertedWithCustomError(initProxy, 'SetupFailed');
    });

    it('should revert with invalid contract ID', async () => {
      initProxyFactory = await ethers.getContractFactory(
        'TestInitProxy',
        owner,
      );

      initProxy = await initProxyFactory.deploy().then((d) => d.deployed());

      const invalidProxyImplementation = await invalidProxyImplementationFactory
        .deploy()
        .then((d) => d.deployed());

      const setupParams = '0x';

      await expect(
        initProxy.init(
          invalidProxyImplementation.address,
          owner.address,
          setupParams,
        ),
      ).to.be.revertedWithCustomError(initProxy, 'InvalidImplementation');
    });

    it('should initialize init proxy with setup params', async () => {
      const initVal = 123;
      const initName = 'test';

      const setupParams = defaultAbiCoder.encode(
        ['uint256', 'string'],
        [initVal, initName],
      );

      // if init does not revert, setup was successful
      await initProxy
        .init(proxyImplementation.address, owner.address, setupParams)
        .then((tx) => tx.wait());
    });

    it('should preserve the init proxy bytecode [ @skip-on-coverage ]', async () => {
      const initProxyBytecode = initProxyFactory.bytecode;
      const initProxyBytecodeHash = keccak256(initProxyBytecode);

      const expected = {
        istanbul:
          '0x75dc062062acecd55d475213b60dfd69753017317a5ce14078758d1ccb32f17f',
        berlin:
          '0x8d4322fbdf6c1488dabe92d991e3e74f3b1666184b22110e1f1f924bc1db2e8b',
        london:
          '0x107eefebd032510da85d8de3712d95bab49956c66f9bd79a280bb736e6cfd054',
      }[getEVMVersion()];

      expect(initProxyBytecodeHash).to.be.equal(expected);
    });
  });
});
