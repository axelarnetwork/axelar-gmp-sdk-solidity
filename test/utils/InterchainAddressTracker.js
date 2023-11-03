'use strict';

const chai = require('chai');
const { ethers } = require('hardhat');
const { expect } = chai;
const { deployContract } = require('../utils.js');

describe('InterchainAddressTracker', () => {
  let ownerWallet,
    otherWallet,
    interchainAddressTracker,
    interchainAddressTrackerFactory;

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
    interchainAddressTracker = await deployContract(
      ownerWallet,
      'TestInterchainAddressTracker',
      [chainName, defaultChains, defaultAddresses],
    );

    interchainAddressTrackerFactory = await ethers.getContractFactory(
      'InterchainAddressTracker',
    );
  });

  it('check internal constants', async () => {
    const interchainAddressTracker = await deployContract(
      ownerWallet,
      'TestInterchainAddressTracker',
      [chainName, [], []],
    );

    expect(await interchainAddressTracker.chainName()).to.equal(chainName);
  });

  it('Should get empty strings for the trusted address for unregistered chains', async () => {
    expect(await interchainAddressTracker.trustedAddress(otherChain)).to.equal(
      '',
    );
  });

  it('Should be able to check trusted addresses properly', async () => {
    expect(
      await interchainAddressTracker.isTrustedAddress(
        otherChain,
        otherRemoteAddress,
      ),
    ).to.equal(false);
  });

  it('Should not be able to add a trusted address as not the owner', async () => {
    await expect(
      interchainAddressTracker
        .connect(otherWallet)
        .setTrustedAddress(otherChain, otherRemoteAddress),
    ).to.be.revertedWithCustomError(interchainAddressTracker, 'NotOwner');
  });

  it('Should be able to add a trusted address as the owner', async () => {
    await expect(
      interchainAddressTracker.setTrustedAddress(
        otherChain,
        otherRemoteAddress,
      ),
    )
      .to.emit(interchainAddressTracker, 'TrustedAddressSet')
      .withArgs(otherChain, otherRemoteAddress);
    expect(await interchainAddressTracker.trustedAddress(otherChain)).to.equal(
      otherRemoteAddress,
    );
  });

  it('Should revert on setting a trusted address with an empty chain name', async () => {
    await expect(
      interchainAddressTracker.setTrustedAddress('', otherRemoteAddress),
    ).to.be.revertedWithCustomError(
      interchainAddressTracker,
      'ZeroStringLength',
    );
  });

  it('Should revert on setting a trusted address with an invalid remote address', async () => {
    await expect(
      interchainAddressTracker.setTrustedAddress(otherChain, ''),
    ).to.be.revertedWithCustomError(
      interchainAddressTracker,
      'ZeroStringLength',
    );
  });

  it('Should be able to check trusted addresses properly.', async () => {
    expect(
      await interchainAddressTracker.isTrustedAddress(
        otherChain,
        otherRemoteAddress,
      ),
    ).to.equal(true);
  });

  it('Should not be able to remove a trusted address as not the owner', async () => {
    await expect(
      interchainAddressTracker
        .connect(otherWallet)
        .removeTrustedAddress(otherChain),
    ).to.be.revertedWithCustomError(interchainAddressTracker, 'NotOwner');
  });

  it('Should be able to remove a trusted address as the owner', async () => {
    await expect(interchainAddressTracker.removeTrustedAddress(otherChain))
      .to.emit(interchainAddressTracker, 'TrustedAddressRemoved')
      .withArgs(otherChain);
    expect(await interchainAddressTracker.trustedAddress(otherChain)).to.equal(
      '',
    );
  });

  it('Should revert on removing a custom remote address with an empty chain name', async () => {
    await expect(
      interchainAddressTracker.removeTrustedAddress(''),
    ).to.be.revertedWithCustomError(
      interchainAddressTracker,
      'ZeroStringLength',
    );
  });
});
