'use strict';

const chai = require('chai');
const { expect } = chai;
const { ethers } = require('hardhat');

describe('InterchainGasEstimation', () => {
    let gasEstimateFactory;
    let gasEstimate;

    let ownerWallet;

    const sourceChain = 'ethereum';
    const destinationChain = 'optimism';
    const destinationAddress = '0x6D4017D4b1DCd36e6EA88b7900e8eC64A1D1315b';

    before(async () => {
        [ownerWallet] = await ethers.getSigners();

        gasEstimateFactory = await ethers.getContractFactory('TestInterchainGasEstimation', ownerWallet);
        gasEstimate = await gasEstimateFactory.deploy().then((d) => d.deployed());
    });

    it('should compute gas estimate correctly', async () => {
        await gasEstimate
            .updateGasInfo(sourceChain, [0, 90000000000, 190000000000, 50000000000, 1])
            .then((tx) => tx.wait());
        await gasEstimate.updateGasInfo(destinationChain, [1, 90000, 190000, 5000, 0]).then((tx) => tx.wait());
        let estimate = await gasEstimate.estimateGasFee(
            destinationChain,
            destinationAddress,
            '0x2534d1533c9ffce84d3174c1f846a4041d07b56d1e7b5cb7138e06fb42086325',
            120000,
            '0x',
        );

        expect(estimate).to.equal(353400090264);

        await gasEstimate.updateGasInfo(destinationChain, [2, 90000, 190000, 5000, 0]).then((tx) => tx.wait());
        estimate = await gasEstimate.estimateGasFee(
            destinationChain,
            destinationAddress,
            '0x2534d1533c9ffce84d3174c1f846a4041d07b56d1e7b5cb7138e06fb42086325',
            120000,
            '0x',
        );

        expect(estimate).to.equal(170488600090000);
    });
});
