const { sortBy } = require('lodash');
const chai = require('chai');
const { ethers } = require('hardhat');
const {
    utils: { id, arrayify, keccak256, defaultAbiCoder },
} = ethers;
const { expect } = chai;

const { getAddresses, getChainId, getRandomID, getWeightedSignersSet, getWeightedSignersProof } = require('../utils');

const APPROVE_CONTRACT_CALL = 0;
const TRANSFER_OPERATORSHIP = 1;

describe('AxelarAmplifierGateway', () => {
    const threshold = 20;
    const commandId = process.env.REPORT_GAS ? id('4') : getRandomID(); // use fixed command id for deterministic gas computation

    let wallets;
    let user;
    let operators;
    let weights;

    let gatewayFactory;
    let authFactory;

    let auth;
    let gateway;

    before(async () => {
        wallets = await ethers.getSigners();
        user = wallets[0];
        operators = sortBy(wallets.slice(0, threshold), (wallet) => wallet.address.toLowerCase());
        weights = Array(operators.length).fill(1);

        gatewayFactory = await ethers.getContractFactory('AxelarAmplifierGateway', user);
        authFactory = await ethers.getContractFactory('AxelarGatewayWeightedAuth', user);
    });

    const getWeights = ({ length }, weight = 1) => Array(length).fill(weight);

    const getApproveContractCall = (sourceChain, source, destination, payloadHash, sourceTxHash, sourceEventIndex) => {
        return defaultAbiCoder.encode(
            ['string', 'string', 'address', 'bytes32', 'bytes32', 'uint256'],
            [sourceChain, source, destination, payloadHash, sourceTxHash, sourceEventIndex],
        );
    };

    const getTransferWeightedOperatorshipCommand = (newOperators, newWeights, threshold) =>
        defaultAbiCoder.encode(
            ['address[]', 'uint256[]', 'uint256'],
            [sortBy(newOperators, (address) => address.toLowerCase()), newWeights, threshold],
        );

    const getSignedBatch = async (batch, operators, weights, threshold, signers) => {
        const encodedBatch = arrayify(
                defaultAbiCoder.encode(
                    ['tuple(string,tuple(bytes32,uint8,bytes)[])'],
                    [batch],
                ),
            );

        return [batch, await getWeightedSignersProof(encodedBatch, operators, weights, threshold, signers)];
    }

    const deployGateway = async () => {
        // setup auth contract with a genesis operator set
        auth = await authFactory
            .deploy(user.address, [getWeightedSignersSet(getAddresses(operators), weights, threshold)])
            .then((d) => d.deployed());

        gateway = await gatewayFactory.deploy("chain", auth.address).then((d) => d.deployed());

        await auth.transferOwnership(gateway.address).then((tx) => tx.wait());
    };

    describe('call contract', () => {
        beforeEach(async () => {
            await deployGateway();
        });

        it('should emit contract call event', async () => {
            const destinationChain = 'Destination';
            const destinationAddress = '0x123abc';
            const payload = defaultAbiCoder.encode(['address'], [user.address]);

            const tx = await gateway.connect(user).callContract(destinationChain, destinationAddress, payload);

            expect(tx)
                .to.emit(gateway, 'ContractCall')
                .withArgs(user.address, destinationChain, destinationAddress, keccak256(payload), payload);
        });

        it('should approve and validate contract call', async () => {
            const payload = defaultAbiCoder.encode(['address'], [user.address]);
            const payloadHash = keccak256(payload);
            const sourceChain = 'Source';
            const sourceAddress = 'address0x123';
            const sourceTxHash = keccak256('0x123abc123abc');
            const sourceEventIndex = 17;

            const batch = ["chain", [[
                commandId,
                APPROVE_CONTRACT_CALL,
                getApproveContractCall(
                    sourceChain,
                    sourceAddress,
                    user.address,
                    payloadHash,
                    sourceTxHash,
                    sourceEventIndex,
                ),
            ]]];

            const signedBatch = await getSignedBatch(
                batch,
                operators,
                weights,
                threshold,
                operators.slice(0, threshold),
            );

            await expect(gateway.execute(signedBatch))
                .to.emit(gateway, 'ContractCallApproved')
                .withArgs(
                    commandId,
                    sourceChain,
                    sourceAddress,
                    user.address,
                    payloadHash,
                    sourceTxHash,
                    sourceEventIndex,
                );

            const isApprovedBefore = await gateway.isContractCallApproved(
                commandId,
                sourceChain,
                sourceAddress,
                user.address,
                payloadHash,
            );

            expect(isApprovedBefore).to.be.true;

            await gateway
                .connect(user)
                .validateContractCall(commandId, sourceChain, sourceAddress, payloadHash)
                .then((tx) => tx.wait());

            const isApprovedAfter = await gateway.isContractCallApproved(
                commandId,
                sourceChain,
                sourceAddress,
                user.address,
                payloadHash,
            );

            expect(isApprovedAfter).to.be.false;
        });
    });

    describe('transfer operatorship', () => {
        beforeEach(async () => {
            await deployGateway();
        });

        it('should allow operators to transfer operatorship', async () => {
            const newOperators = [
                '0xb7900E8Ec64A1D1315B6D4017d4b1dcd36E6Ea88',
                '0x6D4017D4b1DCd36e6EA88b7900e8eC64A1D1315b',
            ];

            const batch = ["chain", [[
                commandId,
                TRANSFER_OPERATORSHIP,
                getTransferWeightedOperatorshipCommand(newOperators, getWeights(newOperators), newOperators.length)
            ]]];

            const signedBatch = await getSignedBatch(
                batch,
                operators,
                weights,
                threshold,
                operators.slice(0, threshold),
            );

            const tx = await gateway.execute(signedBatch);

            await expect(tx)
                .to.emit(gateway, 'OperatorshipTransferred')
                .withArgs(
                    getTransferWeightedOperatorshipCommand(newOperators, getWeights(newOperators), newOperators.length),
                );
        });
    });
});
