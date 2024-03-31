const { sortBy } = require('lodash');
const chai = require('chai');
const { ethers } = require('hardhat');
const {
    utils: { id, arrayify, keccak256, defaultAbiCoder, toUtf8Bytes },
} = ethers;
const { expect } = chai;

const { getAddresses, getChainId, getRandomID, getWeightedSignersSet, getWeightedSignersProof } = require('../utils');

const APPROVE_CONTRACT_CALL = 0;
const TRANSFER_OPERATORSHIP = 1;

describe('AxelarAmplifierGateway', () => {
    const threshold = 3;
    const messageId = process.env.REPORT_GAS ? '4' : `${getRandomID()}`; // use fixed command id for deterministic gas computation
    const commandId = keccak256(ethers.utils.toUtf8Bytes(messageId));
    const chainName = 'chain';
    const chainNameHash = keccak256(toUtf8Bytes(chainName));
    const router = 'router';
    const routerHash = keccak256(toUtf8Bytes(router));
    const domainSeparator = keccak256(toUtf8Bytes(chainName + router + 'axelar-1'));

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

    const getApproveContractCall = (sourceChain, source, destination, payloadHash) => {
        return defaultAbiCoder.encode(
            ['tuple(string,string,address,bytes32)'],
            [[sourceChain, source, destination, payloadHash]],
        );
    };

    const getTransferWeightedOperatorshipCommand = (nonce, newOperators, newWeights, threshold) => {
        return defaultAbiCoder.encode(
            ['tuple(uint256,bytes)'],
            [[nonce, defaultAbiCoder.encode(
            ['address[]', 'uint256[]', 'uint256'],
            [sortBy(newOperators, (address) => address.toLowerCase()), newWeights, threshold],
        )]]);
    }

    const getSignedBatch = async (batch, operators, weights, threshold, signers) => {
        const encodedBatch = arrayify(
            defaultAbiCoder.encode(['tuple(bytes32,tuple(uint8,string,bytes)[])'], [batch]),
        );

        return [batch, await getWeightedSignersProof(encodedBatch, operators, weights, threshold, signers)];
    };

    const deployGateway = async () => {
        // setup auth contract with a genesis operator set
        auth = await authFactory
            .deploy(user.address, [getWeightedSignersSet(getAddresses(operators), weights, threshold)])
            .then((d) => d.deployed());

        gateway = await gatewayFactory.deploy(auth.address, domainSeparator).then((d) => d.deployed());

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
    });

    describe('validate contract call', async () => {
        beforeEach(async () => {
            await deployGateway();
        });

        it('should approve and validate contract call', async () => {
            const payload = defaultAbiCoder.encode(['address'], [user.address]);
            const payloadHash = keccak256(payload);
            const sourceChain = 'Source';
            const sourceAddress = 'address0x123';

            const batch = [
                domainSeparator,
                [
                    [
                        APPROVE_CONTRACT_CALL,
                        messageId,
                        getApproveContractCall(sourceChain, sourceAddress, user.address, payloadHash),
                    ],
                ],
            ];

            const signedBatch = await getSignedBatch(
                batch,
                operators,
                weights,
                threshold,
                operators.slice(0, threshold),
            );

            await expect(gateway.execute(signedBatch))
                .to.emit(gateway, 'ContractCallApproved')
                .withArgs(commandId, sourceChain, sourceAddress, user.address, payloadHash, messageId);

            const isApprovedBefore = await gateway.isMessageApproved(
                messageId,
                sourceChain,
                sourceAddress,
                user.address,
                payloadHash,
            );

            expect(isApprovedBefore).to.be.true;

            expect(
                await gateway.isContractCallApproved(commandId, sourceChain, sourceAddress, user.address, payloadHash),
            ).to.be.true;

            await gateway
                .connect(user)
                .validateMessage(messageId, sourceChain, sourceAddress, payloadHash)
                .then((tx) => tx.wait());

            const isApprovedAfter = await gateway.isMessageApproved(
                messageId,
                sourceChain,
                sourceAddress,
                user.address,
                payloadHash,
            );

            expect(isApprovedAfter).to.be.false;

            expect(
                await gateway.isContractCallApproved(commandId, sourceChain, sourceAddress, user.address, payloadHash),
            ).to.be.false;
        });

        it('should approve and validate multiple contract calls', async () => {
            const commands = [];
            const numCommands = 10;
            const payload = defaultAbiCoder.encode(['address'], [user.address]);
            const payloadHash = keccak256(payload);
            const sourceChain = 'Source';
            const sourceAddress = 'address0x123';

            for (let i = 0; i < numCommands; i++) {
                const messageId = `${i}`;

                commands.push([
                    APPROVE_CONTRACT_CALL,
                    messageId,
                    getApproveContractCall(sourceChain, sourceAddress, user.address, payloadHash),
                ]);
            }

            const batch = [domainSeparator, commands];

            const signedBatch = await getSignedBatch(
                batch,
                operators,
                weights,
                threshold,
                operators.slice(0, threshold),
            );

            const tx = await gateway.execute(signedBatch);
            await tx.wait();

            for (let i = 0; i < numCommands; i++) {
                const messageId = `${i}`;
                const commandId = keccak256(ethers.utils.toUtf8Bytes(messageId));

                await expect(tx)
                    .to.emit(gateway, 'ContractCallApproved')
                    .withArgs(commandId, sourceChain, sourceAddress, user.address, payloadHash, messageId);

                const isApprovedBefore = await gateway.isMessageApproved(
                    messageId,
                    sourceChain,
                    sourceAddress,
                    user.address,
                    payloadHash,
                );

                expect(isApprovedBefore).to.be.true;

                expect(
                    await gateway.isContractCallApproved(
                        commandId,
                        sourceChain,
                        sourceAddress,
                        user.address,
                        payloadHash,
                    ),
                ).to.be.true;

                await gateway
                    .connect(user)
                    .validateMessage(messageId, sourceChain, sourceAddress, payloadHash)
                    .then((tx) => tx.wait());

                const isApprovedAfter = await gateway.isMessageApproved(
                    messageId,
                    sourceChain,
                    sourceAddress,
                    user.address,
                    payloadHash,
                );

                expect(isApprovedAfter).to.be.false;

                expect(
                    await gateway.isContractCallApproved(
                        commandId,
                        sourceChain,
                        sourceAddress,
                        user.address,
                        payloadHash,
                    ),
                ).to.be.false;
            }
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
            const nonce = 1;

            const batch = [
                domainSeparator,
                [
                    [
                        TRANSFER_OPERATORSHIP,
                        messageId,
                        getTransferWeightedOperatorshipCommand(
                            nonce,
                            newOperators,
                            getWeights(newOperators),
                            newOperators.length,
                        ),
                    ],
                ],
            ];

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
                    getTransferWeightedOperatorshipCommand(nonce, newOperators, getWeights(newOperators), newOperators.length),
                );
        });
    });
});
