'use strict';

const chai = require('chai');
const { ethers } = require('hardhat');
const {
  utils: { defaultAbiCoder },
} = ethers;
const { expect } = chai;
const { deployContract } = require('../utils.js');

describe('InterchainAddressTracker', () => {
  let ownerWallet, otherWallet, interchainAddressTracker, interchainAddressTrackerFactory;

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
      'InterchainAddressTracker',
      [chainName],
    );
    const params = defaultAbiCoder.encode(
      ['string[]', 'string[]'],
      [defaultChains, defaultAddresses],
    );
    interchainAddressTracker = await deployContract(
      ownerWallet,
      'InterchainAddressTrackerProxy',
      [implementation.address, ownerWallet.address, params],
    );

    interchainAddressTrackerFactory = await ethers.getContractFactory(
      'InterchainAddressTracker',
    );
    interchainAddressTracker = interchainAddressTrackerFactory
      .attach(interchainAddressTracker.address)
      .connect(ownerWallet);
  });

  it('Should revert on interchainAddressTracker deployment with invalid chain name', async () => {
    await expect(
      interchainAddressTrackerFactory.deploy(''),
    ).to.be.revertedWithCustomError(interchainAddressTracker, 'ZeroStringLength');
  });

  it('Should revert on interchainAddressTracker deployment with length mismatch between chains and trusted addresses arrays', async () => {
    const interchainAddressTrackerImpl = await deployContract(
      ownerWallet,
      'InterchainAddressTracker',
      [chainName],
    );
    const interchainAddressTrackerProxyFactory = await ethers.getContractFactory(
      'InterchainAddressTrackerProxy',
    );
    const params = defaultAbiCoder.encode(
      ['string[]', 'string[]'],
      [['Chain A'], []],
    );
    await expect(
      interchainAddressTrackerProxyFactory.deploy(
        interchainAddressTrackerImpl.address,
        ownerWallet.address,
        params,
      ),
    ).to.be.revertedWithCustomError(interchainAddressTracker, 'SetupFailed');
  });

  it('Should get empty strings for the remote address for unregistered chains', async () => {
    expect(await interchainAddressTracker.getTrustedAddress(otherChain)).to.equal('');
  });

  it('Should be able to validate remote addresses properly', async () => {
    expect(
      await interchainAddressTracker.validateSender(otherChain, otherRemoteAddress),
    ).to.equal(false);
  });

  it('Should not be able to add a custom remote address as not the owner', async () => {
    await expect(
      interchainAddressTracker
        .connect(otherWallet)
        .addTrustedAddress(otherChain, otherRemoteAddress),
    ).to.be.revertedWithCustomError(interchainAddressTracker, 'NotOwner');
  });

  it('Should be able to add a custom remote address as the owner', async () => {
    await expect(
      interchainAddressTracker.addTrustedAddress(otherChain, otherRemoteAddress),
    )
      .to.emit(interchainAddressTracker, 'TrustedAddressAdded')
      .withArgs(otherChain, otherRemoteAddress);
    expect(await interchainAddressTracker.getTrustedAddress(otherChain)).to.equal(
      otherRemoteAddress,
    );
  });

  it('Should revert on adding a custom remote address with an empty chain name', async () => {
    await expect(
      interchainAddressTracker.addTrustedAddress('', otherRemoteAddress),
    ).to.be.revertedWithCustomError(interchainAddressTracker, 'ZeroStringLength');
  });

  it('Should revert on adding a custom remote address with an invalid remote address', async () => {
    await expect(
      interchainAddressTracker.addTrustedAddress(otherChain, ''),
    ).to.be.revertedWithCustomError(interchainAddressTracker, 'ZeroStringLength');
  });

  it('Should be able to validate remote addresses properly.', async () => {
    expect(
      await interchainAddressTracker.validateSender(otherChain, otherRemoteAddress),
    ).to.equal(true);
  });

  it('Should not be able to remove a custom remote address as not the owner', async () => {
    await expect(
      interchainAddressTracker.connect(otherWallet).removeTrustedAddress(otherChain),
    ).to.be.revertedWithCustomError(interchainAddressTracker, 'NotOwner');
  });

  it('Should be able to remove a custom remote address as the owner', async () => {
    await expect(interchainAddressTracker.removeTrustedAddress(otherChain))
      .to.emit(interchainAddressTracker, 'TrustedAddressRemoved')
      .withArgs(otherChain);
    expect(await interchainAddressTracker.getTrustedAddress(otherChain)).to.equal('');
  });

  it('Should revert on removing a custom remote address with an empty chain name', async () => {
    await expect(
      interchainAddressTracker.removeTrustedAddress(''),
    ).to.be.revertedWithCustomError(interchainAddressTracker, 'ZeroStringLength');
  });

  it('Should be able to validate remote addresses properly.', async () => {
    expect(
      await interchainAddressTracker.validateSender(otherChain, otherRemoteAddress),
    ).to.equal(false);
  });
});
