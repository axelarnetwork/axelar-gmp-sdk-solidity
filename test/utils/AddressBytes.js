'use strict';

const { ethers } = require('hardhat');
const chai = require('chai');
const { defaultAbiCoder, arrayify, toUtf8Bytes, hexlify } = ethers.utils;
const { expect } = chai;

let ownerWallet;
before(async () => {
  const wallets = await ethers.getSigners();
  ownerWallet = wallets[0];
});

describe('AddressBytes', () => {
  let addressBytes;

  before(async () => {
    const factory = await ethers.getContractFactory(
      'TestAddressBytes',
      ownerWallet,
    );
    addressBytes = await factory.deploy().then((d) => d.deployed());
  });

  it('Should convert bytes address to address', async () => {
    const bytesAddress = arrayify(ownerWallet.address);
    const convertedAddress = await addressBytes.toAddress(bytesAddress);
    expect(convertedAddress).to.eq(ownerWallet.address);
  });

  it('Should revert on invalid bytes length', async () => {
    const bytesAddress = defaultAbiCoder.encode(
      ['bytes'],
      [toUtf8Bytes(ownerWallet.address)],
    );
    await expect(
      addressBytes.toAddress(bytesAddress),
    ).to.be.revertedWithCustomError(addressBytes, 'InvalidBytesLength');
  });

  it('Should convert address to bytes address', async () => {
    const convertedAddress = await addressBytes.toBytes(ownerWallet.address);
    expect(convertedAddress).to.eq(hexlify(ownerWallet.address));
  });
});
