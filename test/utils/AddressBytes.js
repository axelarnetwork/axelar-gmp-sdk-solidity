'use strict';

const { ethers } = require('hardhat');
const chai = require('chai');
const { deployContract } = require('../utils');
const { defaultAbiCoder, arrayify, toUtf8Bytes, hexlify } = ethers.utils;
const { expect } = chai;

describe('AddressBytes', () => {
    let addressBytes;
    let ownerWallet;

    before(async () => {
        const wallets = await ethers.getSigners();
        ownerWallet = wallets[0];

        addressBytes = await deployContract(ownerWallet, 'TestAddressBytes');
    });

    it('Should convert bytes address to address', async () => {
        const bytesAddress = arrayify(ownerWallet.address);
        const convertedAddress = await addressBytes.toAddress(bytesAddress);
        expect(convertedAddress).to.eq(ownerWallet.address);
    });

    it('Should revert on invalid bytes length', async () => {
        const bytesAddress = defaultAbiCoder.encode(['bytes'], [toUtf8Bytes(ownerWallet.address)]);
        await expect(addressBytes.toAddress(bytesAddress)).to.be.revertedWithCustomError(
            addressBytes,
            'InvalidBytesLength',
        );
    });

    it('Should convert address to bytes address', async () => {
        const convertedAddress = await addressBytes.toBytes(ownerWallet.address);
        expect(convertedAddress).to.eq(hexlify(ownerWallet.address));
    });
});
