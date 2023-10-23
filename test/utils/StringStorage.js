'use strict';

const { ethers } = require('hardhat');
const chai = require('chai');
const { deployContract } = require('../utils');
const { expect } = chai;

describe.only('StringUtils', () => {
  let stringStorage;
  let ownerWallet;
  const slot1 = 123, slot2 = 456;
  const string1 = 'abc', string2 = 'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.'

  before(async () => {
    const wallets = await ethers.getSigners();
    ownerWallet = wallets[0];

    stringStorage = await deployContract(ownerWallet, 'StringStorageTest');
  });

  it('Should return an empty string for an unassigned slot', async () => {
    expect(await stringStorage.getString(slot1)).to.equal('');
  });

  it('Should be able to store and delete a short string', async () => {
    await (await stringStorage.storeString(slot1, string1)).wait();

    expect(await stringStorage.getString(slot1)).to.equal(string1);

    await (await stringStorage.deleteString(slot1)).wait();

    expect(await stringStorage.getString(slot1)).to.equal('');
  });


  it('Should be able to store and delete a long string', async () => {
    await (await stringStorage.storeString(slot2, string2)).wait();

    expect(await stringStorage.getString(slot2)).to.equal(string2);

    await (await stringStorage.deleteString(slot2)).wait();

    expect(await stringStorage.getString(slot2)).to.equal('');
  });

  it('Should be able to store the edge cases properly as well', async() => {
    const substr1 = string2.slice(0, 31);
    const substr2 = string2.slice(0, 32);
    
    await (await stringStorage.storeString(slot1, substr1)).wait();
    await (await stringStorage.storeString(slot2, substr2)).wait();

    expect(await stringStorage.getString(slot1)).to.equal(substr1);
    expect(await stringStorage.getString(slot2)).to.equal(substr2);

    await (await stringStorage.deleteString(slot1)).wait();
    await (await stringStorage.deleteString(slot2)).wait();

    expect(await stringStorage.getString(slot1)).to.equal('');
    expect(await stringStorage.getString(slot2)).to.equal('');

    
  });

});
