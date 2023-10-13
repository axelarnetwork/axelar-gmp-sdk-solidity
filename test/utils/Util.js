'use strict';

const chai = require('chai');
const { expect } = chai;
const { ethers } = require('hardhat');

describe('LibsTest', () => {
  let libsTestFactory;
  let libsTest;

  let noFallBackFactory;
  let noFallBack;

  let ownerWallet;

  before(async () => {
    [ownerWallet] = await ethers.getSigners();

    libsTestFactory = await ethers.getContractFactory('LibsTest', ownerWallet);

    noFallBackFactory = await ethers.getContractFactory(
      'NoFallback',
      ownerWallet,
    );
  });

  beforeEach(async () => {
    libsTest = await libsTestFactory.deploy().then((d) => d.deployed());

    noFallBack = await noFallBackFactory.deploy().then((d) => d.deployed());
  });

  it('should convert address to lowercase string', async () => {
    const address = ownerWallet.address;
    expect(await libsTest.addressToString(address)).to.equal(
      address.toLowerCase(),
    );
  });

  it('should convert string of any format to address', async () => {
    const address = ownerWallet.address;
    expect(await libsTest.stringToAddress(address)).to.equal(address);
    expect(await libsTest.stringToAddress(address.toString())).to.equal(
      address,
    );
    expect(
      await libsTest.stringToAddress(address.toString().toLowerCase()),
    ).to.equal(address);
  });

  it('should revert on invalid string to address conversion', async () => {
    let invalidAddressString = '0x123';
    await expect(
      libsTest.stringToAddress(invalidAddressString),
    ).to.be.revertedWithCustomError(libsTest, 'InvalidAddressString');

    invalidAddressString = '1x1234567890123456789012345678901234567890';
    await expect(
      libsTest.stringToAddress(invalidAddressString),
    ).to.be.revertedWithCustomError(libsTest, 'InvalidAddressString');

    invalidAddressString = '001234567890123456789012345678901234567890';
    await expect(
      libsTest.stringToAddress(invalidAddressString),
    ).to.be.revertedWithCustomError(libsTest, 'InvalidAddressString');

    invalidAddressString = '0x12345678901234567890123456789012345678g9';
    await expect(
      libsTest.stringToAddress(invalidAddressString),
    ).to.be.revertedWithCustomError(libsTest, 'InvalidAddressString');
  });

  it('should convert string to bytes and back', async () => {
    const string = 'big test string';
    const bytes = await libsTest.stringToBytes32(string);
    expect(bytes).to.equal(
      '0x626967207465737420737472696e67000000000000000000000000000000000f',
    );
    expect(await libsTest.bytes32ToString(bytes)).to.equal(string);
  });

  it('should revert on invalid string to bytes conversion', async () => {
    let invalidString = '';
    await expect(
      libsTest.stringToBytes32(invalidString),
    ).to.be.revertedWithCustomError(libsTest, 'InvalidStringLength');

    invalidString = 'This is a string that is too long to convert to bytes32';
    await expect(
      libsTest.stringToBytes32(invalidString),
    ).to.be.revertedWithCustomError(libsTest, 'InvalidStringLength');
  });

  it('should revert if safe native transfer fails', async () => {
    const value = 10;

    await ownerWallet
      .sendTransaction({
        to: libsTest.address,
        value,
      })
      .then((tx) => tx.wait());

    await expect(
      libsTest.nativeTransfer(noFallBack.address, value),
    ).to.be.revertedWithCustomError(libsTest, 'NativeTransferFailed');
  });
});
