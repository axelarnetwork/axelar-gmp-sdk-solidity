'use strict';

const chai = require('chai');
const { ethers } = require('hardhat');
const { defaultAbiCoder } = ethers.utils;
const { expect } = chai;
const { deployContract } = require('../utils.js');

let ownerWallet;
before(async () => {
    const wallets = await ethers.getSigners();
    ownerWallet = wallets[0];
});

describe('Mutlicall', () => {
    let test;
    let function1Data;
    let function2Data;

    before(async () => {
        test = await deployContract(ownerWallet, 'MulticallTest');
        function1Data = (await test.populateTransaction.function1()).data;
        function2Data = (await test.populateTransaction.function2()).data;
    });

    it('Shoult test the multicall', async () => {
        const nonce = Number(await test.nonce());
        await expect(test.multicall([function1Data, function2Data, function2Data, function1Data]))
            .to.emit(test, 'Function1Called')
            .withArgs(nonce)
            .and.to.emit(test, 'Function2Called')
            .withArgs(nonce + 1)
            .and.to.emit(test, 'Function2Called')
            .withArgs(nonce + 2)
            .and.to.emit(test, 'Function1Called')
            .withArgs(nonce + 3);
    });

    it('Shoult test the multicall returns', async () => {
        const nonce = Number(await test.nonce());
        await expect(test.multicallTest([function2Data, function1Data, function2Data, function2Data]))
            .to.emit(test, 'Function2Called')
            .withArgs(nonce)
            .and.to.emit(test, 'Function1Called')
            .withArgs(nonce + 1)
            .and.to.emit(test, 'Function2Called')
            .withArgs(nonce + 2)
            .and.to.emit(test, 'Function2Called')
            .withArgs(nonce + 3);
        const lastReturns = await test.getLastMulticallReturns();

        for (let i = 0; i < lastReturns.length; i++) {
            const val = Number(defaultAbiCoder.decode(['uint256'], lastReturns[i]));
            expect(val).to.equal(nonce + i);
        }
    });
});

