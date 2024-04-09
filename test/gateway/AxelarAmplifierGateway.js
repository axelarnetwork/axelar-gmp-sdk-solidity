const { sortBy } = require('lodash');
const chai = require('chai');
const { ethers, network } = require('hardhat');
const {
    utils: { arrayify, id, keccak256, defaultAbiCoder, toUtf8Bytes, solidityKeccak256, solidityPack },
} = ethers;
const { expect } = chai;

const { getRandomID } = require('../utils');
const { encodeWeightedSigners, getWeightedSignersProof } = require('../../scripts/utils');

const APPROVE_MESSAGES = 0;
const ROTATE_SIGNERS = 1;

describe.only('AxelarAmplifierGateway', () => {
    const threshold = 3;
    const chainName = 'chain';
    const router = 'router';
    const domainSeparator = keccak256(toUtf8Bytes(chainName + router + 'axelar-1'));
    const previousSignersRetention = 15;

    let wallets;
    let user;
    let signers;
    let weightedSigners;

    let gatewayFactory;
    let authFactory;

    let auth;
    let gateway;

    before(async () => {
        wallets = await ethers.getSigners();
        user = wallets[0];
        signers = sortBy(wallets.slice(0, threshold), (wallet) => wallet.address.toLowerCase());

        weightedSigners = {
            signers: signers.map((wallet) => ({ signer: wallet.address, weight: 1 })),
            threshold,
            nonce: id('0'),
        };

        gatewayFactory = await ethers.getContractFactory('AxelarAmplifierGateway', user);
        authFactory = await ethers.getContractFactory('AxelarAmplifierAuth', user);
    });

    const getApproveMessageData = (messages) => {
        return defaultAbiCoder.encode(
            ['tuple(string messageId, string sourceChain, string sourceAddress, address contractAddress, bytes32 payloadHash)[] messages'],
            [messages]
        );
    };

    const getRotateSignersData = (newSigners) => encodeWeightedSigners(newSigners);

    const getProof = (commandType, command, weightedSigners, wallets) => {
        const commandData = (commandType === ROTATE_SIGNERS) ? getRotateSignersData(command) : getApproveMessageData(command);

        const data = solidityPack(['uint8', 'bytes'], [commandType, commandData]);

        return getWeightedSignersProof(data, domainSeparator, weightedSigners, wallets);
    }

    const deployGateway = async () => {
        auth = await authFactory
            .deploy(user.address, domainSeparator, previousSignersRetention, [encodeWeightedSigners(weightedSigners)]);
        await auth.deployTransaction.wait(network.config.confirmations);

        gateway = await gatewayFactory.deploy(auth.address);
        await gateway.deployTransaction.wait(network.config.confirmations);

        await auth.transferOwnership(gateway.address).then((tx) => tx.wait(network.config.confirmations));
    };

    describe('queries', () => {
        before(async () => {
            await deployGateway();
        });

        it('should return the auth module', async () => {
            expect(await gateway.authModule()).to.equal(auth.address);
        });

        it('should return the correct command id', async () => {
            const messageId = '1';
            const sourceChain = 'Source';

            const commandId = await gateway.messageToCommandId(sourceChain, messageId);
            const expectedCommandId = solidityKeccak256(
                ['uint8', 'string', 'string', 'string'],
                [APPROVE_MESSAGES, sourceChain, '_', messageId],
            );

            expect(commandId).to.equal(expectedCommandId);
        });
    });

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

        it('should approve and validate message', async () => {
            const messageId = '1';
            const payload = defaultAbiCoder.encode(['address'], [user.address]);
            const payloadHash = keccak256(payload);
            const sourceChain = 'Source';
            const sourceAddress = 'address0x123';
            const commandId = await gateway.messageToCommandId(sourceChain, messageId);

            const messages = [{
                messageId,
                sourceChain,
                sourceAddress,
                contractAddress: user.address,
                payloadHash,
            }];

            const proof = await getProof(
                APPROVE_MESSAGES,
                messages,
                weightedSigners,
                signers.slice(0, threshold),
            );

            await expect(gateway.approveMessages(messages, proof))
                .to.emit(gateway, 'ContractCallApproved')
                .withArgs(commandId, messageId, sourceChain, sourceAddress, user.address, payloadHash);

            const isApprovedBefore = await gateway.isMessageApproved(
                messageId,
                sourceChain,
                sourceAddress,
                user.address,
                payloadHash,
            );
            expect(isApprovedBefore).to.be.true;

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
        });

        it('should approve and validate contract call', async () => {
            const messageId = '1';
            const payload = defaultAbiCoder.encode(['address'], [user.address]);
            const payloadHash = keccak256(payload);
            const sourceChain = 'Source';
            const sourceAddress = 'address0x123';
            const commandId = await gateway.messageToCommandId(sourceChain, messageId);

            const messages = [{
                messageId,
                sourceChain,
                sourceAddress,
                contractAddress: user.address,
                payloadHash,
            }];

            const proof = await getProof(
                APPROVE_MESSAGES,
                messages,
                weightedSigners,
                signers.slice(0, threshold),
            );

            await expect(gateway.approveMessages(messages, proof))
                .to.emit(gateway, 'ContractCallApproved')
                .withArgs(commandId, messageId, sourceChain, sourceAddress, user.address, payloadHash);

            expect(
                await gateway.isContractCallApproved(commandId, sourceChain, sourceAddress, user.address, payloadHash),
            ).to.be.true;

            await gateway
                .connect(user)
                .validateContractCall(commandId, sourceChain, sourceAddress, payloadHash)
                .then((tx) => tx.wait());

            expect(
                await gateway.isContractCallApproved(commandId, sourceChain, sourceAddress, user.address, payloadHash),
            ).to.be.false;
        });

        it('should approve and validate multiple contract calls', async () => {
            const messages = [];
            const numCommands = 10;
            const payload = defaultAbiCoder.encode(['address'], [user.address]);
            const payloadHash = keccak256(payload);
            const sourceChain = 'Source';
            const sourceAddress = 'address0x123';

            for (let i = 0; i < numCommands; i++) {
                const messageId = `${i}`;

                messages.push({
                    messageId,
                    sourceChain,
                    sourceAddress,
                    contractAddress: user.address,
                    payloadHash,
                });
            }

            const proof = await getProof(
                APPROVE_MESSAGES,
                messages,
                weightedSigners,
                signers.slice(0, threshold),
            );

            const tx = await gateway.approveMessages(messages, proof);
            await tx.wait();

            for (let i = 0; i < numCommands; i++) {
                const messageId = `${i}`;
                const commandId = await gateway.messageToCommandId(sourceChain, messageId);

                await expect(tx)
                    .to.emit(gateway, 'ContractCallApproved')
                    .withArgs(commandId, messageId, sourceChain, sourceAddress, user.address, payloadHash);

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

    describe('rotate signers', () => {
        beforeEach(async () => {
            await deployGateway();
        });

        it('should allow operators to transfer operatorship', async () => {
            const newSigners = {
                signers: [
                    { signer: '0x6D4017D4b1DCd36e6EA88b7900e8eC64A1D1315b', weight: 1 },
                    { signer: '0xb7900E8Ec64A1D1315B6D4017d4b1dcd36E6Ea88', weight: 1 },
                ],
                threshold: 2,
                nonce: id('0'),
            };
            const newSignersData = getRotateSignersData(newSigners);

            const proof = await getProof(ROTATE_SIGNERS, newSigners, weightedSigners, signers.slice(0, threshold));

            await expect(gateway.rotateSigners(newSignersData, proof))
                .to.emit(gateway, 'SignersRotated')
                .withArgs(newSignersData);
        });
    });
});
