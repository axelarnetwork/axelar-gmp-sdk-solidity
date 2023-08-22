'use strict';

const chai = require('chai');
const {
  utils: { defaultAbiCoder, keccak256 },
} = require('ethers');
const { expect } = chai;
const { ethers } = require('hardhat');
const { getEVMVersion } = require('../utils');

describe('Proxy', async () => {
  let owner, user;

  before(async () => {
    [owner, user] = await ethers.getSigners();
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
    let proxyImplementationFactory;
    let invalidProxyImplementationFactory;
    let invalidSetupProxyImplementationFactory;

    let proxy;
    let proxyImplementation;
    let invalidProxyImplementation;
    let invalidSetupProxyImplementation;

    beforeEach(async () => {
      proxyFactory = await ethers.getContractFactory('TestProxy', owner);
      proxyImplementationFactory = await ethers.getContractFactory(
        'ProxyImplementation',
        owner,
      );
      invalidProxyImplementationFactory = await ethers.getContractFactory(
        'InvalidProxyImplementation',
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

    it('should preserve the proxy bytecode [ @skip-on-coverage ]', async () => {
      const proxyBytecode = proxyFactory.bytecode;
      const proxyBytecodeHash = keccak256(proxyBytecode);

      const expected = {
        istanbul:
          '0xb63923c8818b3f1a2576521660ddbe5ad6df0bcea6fb36106f1392cd1dd0f64a',
        berlin:
          '0x3ba099df39cbcb664016963fbb30ff28e70329c527d6bb810e4739b6bf76eeb7',
        london:
          '0x9a930016584906252718ae8da0587240c1c46164395fef703f976ba4122080bd',
      }[getEVMVersion()];

      expect(proxyBytecodeHash).to.be.equal(expected);
    });
  });

  describe('FinalProxy', async () => {
    let finalProxyFactory;
    let proxyImplementationFactory;
    let differentProxyImplementationFactory;
    let invalidSetupProxyImplementationFactory;

    let finalProxy;
    let proxyImplementation;
    let differentProxyImplementation;

    beforeEach(async () => {
      finalProxyFactory = await ethers.getContractFactory(
        'TestFinalProxy',
        owner,
      );
      proxyImplementationFactory = await ethers.getContractFactory(
        'ProxyImplementation',
        owner,
      );
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
      differentProxyImplementation = await differentProxyImplementationFactory
        .deploy()
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
          '0xa380508f0834d5a0c7a632fc3fb7170234f1f1b5966ec89b2ef624c432202c1d',
        berlin:
          '0xe74cc8d86dc3900151dcedfa44d8e6803fa5e04a1ba7089b8e2f63a1e400df83',
        london:
          '0x99a18a9ea3cf78066969e3a22ffcd784378001d64422efb5050decafe5dcfeec',
      }[getEVMVersion()];

      expect(finalProxyBytecodeHash).to.be.equal(expected);
    });
  });
});
