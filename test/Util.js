'use strict';

const chai = require('chai');
const { deployContract, MockProvider, solidity } = require('ethereum-waffle');
chai.use(solidity);
const { expect } = chai;

const UtilTest = require('../artifacts/contracts/test/UtilTest.sol/UtilTest.json');

describe('UtilTest', () => {
  const [ownerWallet] = new MockProvider().getWallets();
  let utilTest;

  beforeEach(async () => {
    utilTest = await deployContract(ownerWallet, UtilTest);
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
