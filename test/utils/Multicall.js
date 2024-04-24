'use strict';

const chai = require('chai');
const { ethers } = require('hardhat');
const { defaultAbiCoder } = ethers.utils;
const { expect } = chai;
const { deployContract } = require('../utils.js');

describe('Mutlicall', () => {
    let test;
    let function1Data;
    let function2Data;
    let function3Data;
    let function4Data;
    let ownerWallet;

    before(async () => {
        const wallets = await ethers.getSigners();
        ownerWallet = wallets[0];

        test = await deployContract(ownerWallet, 'TestMulticall');
        function1Data = (await test.populateTransaction.function1()).data;
        function2Data = (await test.populateTransaction.function2()).data;
        function3Data = (await test.populateTransaction.function3()).data;
        function4Data = (await test.populateTransaction.function4()).data;
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

    it('Shoult revert if any of the calls fail', async () => {
        await expect(test.multicall([function1Data, function2Data, function3Data, function1Data])).to.be.revertedWith(
            'function3 failed',
        );
    });

    it('Shoult revert with error if a call fails without revert data', async () => {
        await expect(test.multicall([function1Data, function4Data])).to.be.revertedWithCustomError(
            test,
            'MulticallFailed',
        );
    });
});
