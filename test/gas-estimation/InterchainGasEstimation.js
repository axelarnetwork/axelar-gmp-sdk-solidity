'use strict';

const chai = require('chai');
const { expect } = chai;
const { ethers } = require('hardhat');

const DefaultEstimationType = 0;
const OptimismEcotoneEstimationType = 1;
const OptimismBedrockEstimationType = 2;
const ArbitrumEstimationType = 3;
const ScrollEstimationType = 4;

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
            .updateGasInfo(sourceChain, {
                gasEstimationType: DefaultEstimationType,
                l1FeeScalar: 0,
                axelarBaseFee: 90000000000,
                relativeGasPrice: 50000000000,
                relativeBlobBaseFee: 1,
                expressFee: 190000000000,
            })
            .then((tx) => tx.wait());
    });

    it('shourld get the gas info', async () => {
        const gasInfo = await gasEstimate.getGasInfo(sourceChain);
        expect(gasInfo.gasEstimationType).to.equal(DefaultEstimationType);
        expect(gasInfo.l1FeeScalar).to.equal(0);
        expect(gasInfo.axelarBaseFee).to.equal(90000000000);
        expect(gasInfo.relativeGasPrice).to.equal(50000000000);
        expect(gasInfo.relativeBlobBaseFee).to.equal(1);
        expect(gasInfo.expressFee).to.equal(190000000000);
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

    it('should compute gas estimate for OP Ecotone', async () => {
        await gasEstimate
            .updateGasInfo(destinationChain, {
                gasEstimationType: OptimismEcotoneEstimationType,
                l1FeeScalar: 1500,
                axelarBaseFee: 90000,
                relativeGasPrice: 5000,
                relativeBlobBaseFee: 0,
                expressFee: 190000,
            })
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

    it('should compute gas estimate for OP Bedrock', async () => {
        await gasEstimate
            .updateGasInfo(destinationChain, {
                gasEstimationType: OptimismBedrockEstimationType,
                l1FeeScalar: 10000,
                axelarBaseFee: 90000,
                relativeGasPrice: 5000,
                relativeBlobBaseFee: 0,
                expressFee: 190000,
            })
            .then((tx) => tx.wait());

        const estimate = await gasEstimate.estimateGasFee(
            destinationChain,
            destinationAddress,
            '0x2534d1533c9ffce84d3174c1f846a4041d07b56d1e7b5cb0000000000007138e06fb42086325',
            120000,
            '0x',
        );

        expect(estimate).to.equal('2464600090000');
    });

    it('should compute gas estimate for Arbitrum', async () => {
        await gasEstimate
            .updateGasInfo(destinationChain, {
                gasEstimationType: ArbitrumEstimationType,
                l1FeeScalar: 0,
                axelarBaseFee: 90000,
                relativeGasPrice: 5000,
                relativeBlobBaseFee: 0,
                expressFee: 190000,
            })
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
            .updateGasInfo(destinationChain, {
                gasEstimationType: ScrollEstimationType,
                l1FeeScalar: 1150000000,
                axelarBaseFee: 90000,
                relativeGasPrice: 5000,
                relativeBlobBaseFee: 0,
                expressFee: 190000,
            })
            .then((tx) => tx.wait());

        const estimate = await gasEstimate.estimateGasFee(
            destinationChain,
            destinationAddress,
            '0x2534d1533c9ffce84d3174c1f846a4041d07b56d1e7b5cb0000000000007138e06fb42086325',
            120000,
            '0x',
        );

        expect(estimate).to.equal('419980600090000');
    });
});
