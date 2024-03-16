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

    before(async () => {
        [ownerWallet] = await ethers.getSigners();

        gasEstimateFactory = await ethers.getContractFactory('TestInterchainGasEstimation', ownerWallet);
        gasEstimate = await gasEstimateFactory.deploy().then((d) => d.deployed());

        await gasEstimate.updateGasInfo(sourceChain, [0, 0, 50000000000, 1]);
        await gasEstimate.updateGasInfo(destinationChain, [1, 0, 5000, 0]);
    });

    it('should compute gas estimate correctly', async () => {
        const estimate = await gasEstimate.estimateGasFee(
            destinationChain,
            destinationChain,
            '0x2534d1533c9ffce84d3174c1f846a4041d07b56d1e7b5cb7138e06fb42086325',
            0,
        );

        expect(estimate).to.equal(352800000264);
    });
});
