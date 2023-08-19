'use strict';

const chai = require('chai');
const { expect } = chai;
const { ethers } = require('hardhat');

describe('LibsTest', () => {
  let libsTestFactory;
  let libsTest;

  let ownerWallet;

  before(async () => {
    [ownerWallet] = await ethers.getSigners();

    libsTestFactory = await ethers.getContractFactory('LibsTest', ownerWallet);
  });

  beforeEach(async () => {
    libsTest = await libsTestFactory.deploy().then((d) => d.deployed());
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

  it('should convert string to bytes and back', async () => {
    const string = 'big test string';
    const bytes = await libsTest.stringToBytes32(string);
    expect(bytes).to.equal(
      '0x626967207465737420737472696e67000000000000000000000000000000000f',
    );
    expect(await libsTest.bytes32ToString(bytes)).to.equal(string);
  });
});
