'use strict';

const chai = require('chai');
const { expect } = chai;
const { ethers } = require('hardhat');

const DefaultEstimationType = 0;
const OptimismEcotoneEstimationType = 1;
const ArbitrumEstimationType = 2;
const ScrollEstimationType = 3;
const MantleEstimationType = 4;

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

        await gasEstimate
            .updateGasInfo(sourceChain, [DefaultEstimationType, 90000000000, 190000000000, 50000000000, 1])
            .then((tx) => tx.wait());
    });

    it('shourld get the gas info', async () => {
        const gasInfo = await gasEstimate.getGasInfo(sourceChain);
        expect(gasInfo[0]).to.equal(DefaultEstimationType);
        expect(gasInfo[1]).to.equal(90000000000);
        expect(gasInfo[2]).to.equal(190000000000);
        expect(gasInfo[3]).to.equal(50000000000);
        expect(gasInfo[4]).to.equal(1);
    });

    it('should compute gas estimate for L1', async () => {
        const estimate = await gasEstimate.estimateGasFee(
            sourceChain,
            destinationAddress,
            '0x2534d1533c9ffce84d3174c1f846a4041d07b56d1e7b5cb0000000000007138e06fb42086325',
            120000,
            '0x',
        );

        expect(estimate).to.equal(6000090000000000);
    });

    it('should compute gas estimate for OP chains', async () => {
        await gasEstimate
            .updateGasInfo(destinationChain, [OptimismEcotoneEstimationType, 90000, 190000, 5000, 0])
            .then((tx) => tx.wait());
        const estimate = await gasEstimate.estimateGasFee(
            destinationChain,
            destinationAddress,
            '0x2534d1533c9ffce84d3174c1f846a4041d07b56d1e7b5cb0000000000007138e06fb42086325',
            120000,
            '0x',
        );

        expect(estimate).to.equal(356100090266);
    });

    it('should compute gas estimate for Arbitrum', async () => {
        await gasEstimate
            .updateGasInfo(destinationChain, [ArbitrumEstimationType, 90000, 190000, 5000, 0])
            .then((tx) => tx.wait());

        const estimate = await gasEstimate.estimateGasFee(
            destinationChain,
            destinationAddress,
            '0x2534d1533c9ffce84d3174c1f846a4041d07b56d1e7b5cb0000000000007138e06fb42086325',
            120000,
            '0x',
        );

        expect(estimate).to.equal(212504600090000);
    });

    it('should compute gas estimate for Scroll', async () => {
        await gasEstimate
            .updateGasInfo(destinationChain, [ScrollEstimationType, 90000, 190000, 5000, 0])
            .then((tx) => tx.wait());

        const estimate = await gasEstimate.estimateGasFee(
            destinationChain,
            destinationAddress,
            '0x2534d1533c9ffce84d3174c1f846a4041d07b56d1e7b5cb0000000000007138e06fb42086325',
            120000,
            '0x',
        );

        expect(estimate).to.equal('6552710823071820600090000');
    });

    it('should compute gas estimate for Mantle', async () => {
        await gasEstimate
            .updateGasInfo(destinationChain, [MantleEstimationType, 90000, 190000, 5000, 0])
            .then((tx) => tx.wait());

        const estimate = await gasEstimate.estimateGasFee(
            destinationChain,
            destinationAddress,
            '0x2534d1533c9ffce84d3174c1f846a4041d07b56d1e7b5cb0000000000007138e06fb42086325',
            120000,
            '0x',
        );

        expect(estimate).to.equal('37435595925728600090000');
    });
});
