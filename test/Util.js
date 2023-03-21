'use strict';

const chai = require('chai');
const { expect } = chai;
const { ethers } = require('hardhat');

describe('UtilTest', () => {
  let utilTestFactory;
  let utilTest;

  let wallets;
  let ownerWallet;

  before(async () => {
    wallets = await ethers.getSigners();
    ownerWallet = wallets[0];

    utilTestFactory = await ethers.getContractFactory('UtilTest', ownerWallet);
  });

  beforeEach(async () => {
    utilTest = await utilTestFactory.deploy().then((d) => d.deployed());
  });

  it('should convert address to lowercase string', async () => {
    const address = ownerWallet.address;
    expect(await utilTest.addressToString(address)).to.equal(
      address.toLowerCase(),
    );
  });

  it('should convert string of any format to address', async () => {
    const address = ownerWallet.address;
    expect(await utilTest.stringToAddress(address)).to.equal(address);
    expect(await utilTest.stringToAddress(address.toString())).to.equal(
      address,
    );
    expect(
      await utilTest.stringToAddress(address.toString().toLowerCase()),
    ).to.equal(address);
  });

  it('should convert string to bytes and back', async () => {
    const string = 'big test string';
    const bytes = await utilTest.stringToBytes32(string);
    expect(bytes).to.equal(
      '0x626967207465737420737472696e67000000000000000000000000000000000f',
    );
    expect(await utilTest.bytes32ToString(bytes)).to.equal(string);
  });
});
