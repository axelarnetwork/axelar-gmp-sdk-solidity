'use strict';

const chai = require('chai');
const {
  utils: { defaultAbiCoder },
} = require('ethers');
const { expect } = chai;
const { ethers } = require('hardhat');

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
      finalProxyFactory = await ethers.getContractFactory('FinalProxy', owner);
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
      ).to.be.revertedWithCustomError(finalProxy, 'Create3AlreadyDeployed');
    });
  });
});
