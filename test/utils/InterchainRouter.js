'use strict';

const chai = require('chai');
const { ethers } = require('hardhat');
const {
  utils: { defaultAbiCoder },
} = ethers;
const { expect } = chai;
const { deployContract } = require('../utils.js');

describe('InterchainRouter', () => {
  let ownerWallet, otherWallet, interchainRouter, interchainRouterFactory;

  const otherRemoteAddress = 'any string as an address';
  const otherChain = 'Other Name';
  const chainName = 'Chain Name';

  const defaultChains = ['Chain1', 'Chain2'];
  const defaultAddresses = [];

  before(async () => {
    const wallets = await ethers.getSigners();
    ownerWallet = wallets[0];
    otherWallet = wallets[1];
    defaultAddresses.push(wallets[2].address);
    defaultAddresses.push('another address format');
    const implementation = await deployContract(
      ownerWallet,
      'InterchainRouter',
      [chainName],
    );
    const params = defaultAbiCoder.encode(
      ['string[]', 'string[]'],
      [defaultChains, defaultAddresses],
    );
    interchainRouter = await deployContract(
      ownerWallet,
      'InterchainRouterProxy',
      [implementation.address, ownerWallet.address, params],
    );

    interchainRouterFactory = await ethers.getContractFactory(
      'InterchainRouter',
    );
    interchainRouter = interchainRouterFactory
      .attach(interchainRouter.address)
      .connect(ownerWallet);
  });

  it('Should revert on interchainRouter deployment with invalid chain name', async () => {
    await expect(
      interchainRouterFactory.deploy(''),
    ).to.be.revertedWithCustomError(interchainRouter, 'ZeroStringLength');
  });

  it('Should revert on interchainRouter deployment with length mismatch between chains and trusted addresses arrays', async () => {
    const interchainRouterImpl = await deployContract(
      ownerWallet,
      'InterchainRouter',
      [chainName],
    );
    const interchainRouterProxyFactory = await ethers.getContractFactory(
      'InterchainRouterProxy',
    );
    const params = defaultAbiCoder.encode(
      ['string[]', 'string[]'],
      [['Chain A'], []],
    );
    await expect(
      interchainRouterProxyFactory.deploy(
        interchainRouterImpl.address,
        ownerWallet.address,
        params,
      ),
    ).to.be.revertedWithCustomError(interchainRouter, 'SetupFailed');
  });

  it('Should get empty strings for the remote address for unregistered chains', async () => {
    expect(await interchainRouter.getTrustedAddress(otherChain)).to.equal('');
  });

  it('Should be able to validate remote addresses properly', async () => {
    expect(
      await interchainRouter.validateSender(otherChain, otherRemoteAddress),
    ).to.equal(false);
  });

  it('Should not be able to add a custom remote address as not the owner', async () => {
    await expect(
      interchainRouter
        .connect(otherWallet)
        .addTrustedAddress(otherChain, otherRemoteAddress),
    ).to.be.revertedWithCustomError(interchainRouter, 'NotOwner');
  });

  it('Should be able to add a custom remote address as the owner', async () => {
    await expect(
      interchainRouter.addTrustedAddress(otherChain, otherRemoteAddress),
    )
      .to.emit(interchainRouter, 'TrustedAddressAdded')
      .withArgs(otherChain, otherRemoteAddress);
    expect(await interchainRouter.getTrustedAddress(otherChain)).to.equal(
      otherRemoteAddress,
    );
  });

  it('Should revert on adding a custom remote address with an empty chain name', async () => {
    await expect(
      interchainRouter.addTrustedAddress('', otherRemoteAddress),
    ).to.be.revertedWithCustomError(interchainRouter, 'ZeroStringLength');
  });

  it('Should revert on adding a custom remote address with an invalid remote address', async () => {
    await expect(
      interchainRouter.addTrustedAddress(otherChain, ''),
    ).to.be.revertedWithCustomError(interchainRouter, 'ZeroStringLength');
  });

  it('Should be able to validate remote addresses properly.', async () => {
    expect(
      await interchainRouter.validateSender(otherChain, otherRemoteAddress),
    ).to.equal(true);
  });

  it('Should not be able to remove a custom remote address as not the owner', async () => {
    await expect(
      interchainRouter.connect(otherWallet).removeTrustedAddress(otherChain),
    ).to.be.revertedWithCustomError(interchainRouter, 'NotOwner');
  });

  it('Should be able to remove a custom remote address as the owner', async () => {
    await expect(interchainRouter.removeTrustedAddress(otherChain))
      .to.emit(interchainRouter, 'TrustedAddressRemoved')
      .withArgs(otherChain);
    expect(await interchainRouter.getTrustedAddress(otherChain)).to.equal('');
  });

  it('Should revert on removing a custom remote address with an empty chain name', async () => {
    await expect(
      interchainRouter.removeTrustedAddress(''),
    ).to.be.revertedWithCustomError(interchainRouter, 'ZeroStringLength');
  });

  it('Should be able to validate remote addresses properly.', async () => {
    expect(
      await interchainRouter.validateSender(otherChain, otherRemoteAddress),
    ).to.equal(false);
  });
});
