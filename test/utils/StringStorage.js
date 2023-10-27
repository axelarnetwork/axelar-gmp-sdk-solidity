'use strict';

const { ethers } = require('hardhat');
const chai = require('chai');
const { deployContract } = require('../utils');
const { keccak256 } = ethers.utils;
const { expect } = chai;

describe('StringStorage', () => {
  let stringStorage;
  let ownerWallet;

  before(async () => {
    const wallets = await ethers.getSigners();
    ownerWallet = wallets[0];

    stringStorage = await deployContract(ownerWallet, 'TestStringStorage');
  });

  it('Should store, load and delete a short string properly', async () => {
    const str = 'hello';
    const slot = keccak256('0x1234');

    await await stringStorage.store(slot, str);

    expect(await stringStorage.load(slot)).to.equal(str);

    await await stringStorage.del(slot);

    expect(await stringStorage.load(slot)).to.equal('');
  });

  it('Should store, load and delete a long string properly', async () => {
    const str = keccak256('0x1234') + keccak256('0x5678');
    const slot = keccak256('0x1234');

    await await stringStorage.store(slot, str);

    expect(await stringStorage.load(slot)).to.equal(str);

    await await stringStorage.del(slot);

    expect(await stringStorage.load(slot)).to.equal('');
  });
});
