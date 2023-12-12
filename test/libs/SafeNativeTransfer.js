'use strict';

const chai = require('chai');
const { ethers } = require('hardhat');
const { expect } = chai;

describe('TestSafeNativeTransfer', function () {
  let contract;
  let signer, recipient;

  before(async function () {
    [signer, recipient] = await ethers.getSigners();

    const TestSafeNativeTransferFactory = await ethers.getContractFactory(
      'TestSafeNativeTransfer',
      signer,
    );
    contract = await TestSafeNativeTransferFactory.deploy();
    await contract.deployed();
  });

  it('should forward native tokens to the recipient', async function () {
    const amount = 123;

    const recipientBalanceBefore = await ethers.provider.getBalance(
      recipient.address,
    );

    await contract.forward(recipient.address, { value: amount });

    const recipientBalanceAfter = await ethers.provider.getBalance(
      recipient.address,
    );

    expect(recipientBalanceAfter.sub(recipientBalanceBefore)).to.equal(amount);
  });
});
