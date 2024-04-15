const { sortBy } = require('lodash');
const chai = require('chai');
const { ethers, network } = require('hardhat');
const {
    utils: { id, keccak256, defaultAbiCoder, toUtf8Bytes, solidityKeccak256 },
} = ethers;
const { expect } = chai;

const { encodeWeightedSigners, getWeightedSignersProof } = require('../../scripts/utils');
const { expectRevert } = require('../utils');

const APPROVE_MESSAGES = 0;
const ROTATE_SIGNERS = 1;

describe('AxelarAmplifierGateway', () => {
    const numSigners = 5;
    const threshold = 3;
    const chainName = 'chain';
    const router = 'router';
    const domainSeparator = keccak256(toUtf8Bytes(chainName + router + 'axelar-1'));
    const previousSignersRetention = 15;

    let user;
    let signers;
    let weightedSigners;

    let gatewayFactory;
    let gateway;

    before(async () => {
        const wallets = await ethers.getSigners();
        user = wallets[0];

        signers = sortBy(
            Array.from({ length: numSigners }, (_, i) => wallets[i]),
            (wallet) => wallet.address.toLowerCase(),
        );

        weightedSigners = {
            signers: signers.map((wallet) => ({ signer: wallet.address, weight: 1 })),
            threshold,
            nonce: id('0'),
        };

        gatewayFactory = await ethers.getContractFactory('AxelarAmplifierGateway', user);
    });

    const getApproveMessageData = (messages) => {
        return defaultAbiCoder.encode(
            [
                'uint8',
                'tuple(string messageId, string sourceChain, string sourceAddress, address contractAddress, bytes32 payloadHash)[] messages',
            ],
            [APPROVE_MESSAGES, messages],
        );
    };

    const getRotateSignersData = (signers) => {
        return defaultAbiCoder.encode(
            ['uint8', 'tuple(tuple(address signer,uint128 weight)[] signers,uint128 threshold,bytes32 nonce)'],
            [ROTATE_SIGNERS, signers],
        );
    };

    const getProof = (commandType, command, weightedSigners, wallets) => {
        let data;

        switch (commandType) {
            case APPROVE_MESSAGES:
                data = getApproveMessageData(command);
                break;
            case ROTATE_SIGNERS:
                data = getRotateSignersData(command);
                break;
            default:
                throw new Error(`Invalid command type: ${commandType}`);
        }

        return getWeightedSignersProof(data, domainSeparator, weightedSigners, wallets);
    };

    const deployGateway = async () => {
        gateway = await gatewayFactory.deploy(previousSignersRetention, domainSeparator, weightedSigners);
        await gateway.deployTransaction.wait(network.config.confirmations);
    };

    describe('queries', () => {
        before(async () => {
            await deployGateway();
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

    describe('negative tests', () => {});

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

            const messages = [
                {
                    messageId,
                    sourceChain,
                    sourceAddress,
                    contractAddress: user.address,
                    payloadHash,
                },
            ];

            const proof = await getProof(APPROVE_MESSAGES, messages, weightedSigners, signers.slice(0, threshold));

            expect(await gateway.validateProof(keccak256(getApproveMessageData(messages)), proof)).to.be.true;

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

            const messages = [
                {
                    messageId,
                    sourceChain,
                    sourceAddress,
                    contractAddress: user.address,
                    payloadHash,
                },
            ];

            const proof = await getProof(APPROVE_MESSAGES, messages, weightedSigners, signers.slice(0, threshold));

            await expect(gateway.approveMessages(messages, proof))
                .to.emit(gateway, 'ContractCallApproved')
                .withArgs(commandId, messageId, sourceChain, sourceAddress, user.address, payloadHash);

            expect(
                await gateway.isContractCallApproved(commandId, sourceChain, sourceAddress, user.address, payloadHash),
            ).to.be.true;

            await expect(gateway.connect(user).validateContractCall(commandId, sourceChain, sourceAddress, payloadHash))
                .to.emit(gateway, 'ContractCallExecuted')
                .withArgs(commandId);

            expect(
                await gateway.isContractCallApproved(commandId, sourceChain, sourceAddress, user.address, payloadHash),
            ).to.be.false;

            // already executed
            await expect(
                gateway.connect(user).validateContractCall(commandId, sourceChain, sourceAddress, payloadHash),
            ).to.not.emit(gateway, 'ContractCallExecuted');
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

            const proof = await getProof(APPROVE_MESSAGES, messages, weightedSigners, signers.slice(0, threshold));

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

        it('reject empty messages', async () => {
            await expectRevert(
                async (gasOptions) => {
                    const proof = await getProof(APPROVE_MESSAGES, [], weightedSigners, signers.slice(0, threshold));

                    return gateway.approveMessages([], proof, gasOptions);
                },
                gateway,
                'InvalidMessages',
            );
        });

        it('reject invalid contract call approval', async () => {
            expect(await gateway.isContractCallApproved(id('1'), 'Chain', 'address', user.address, id('data'))).to.be.false;

            await expect(gateway.validateContractCall(id('1'), 'Chain', 'address', id('data')))
                .to.not.emit(gateway, 'ContractCallExecuted');
        });

        it('reject invalid message approval', async () => {
            expect(await gateway.isMessageApproved('1', 'Chain', 'address', user.address, id('data'))).to.be.false;

            await expect(gateway.validateMessage('1', 'Chain', 'address', id('data')))
                .to.not.emit(gateway, 'ContractCallExecuted');
        });

        it('reject re-approving a message', async () => {
            const messageId = '1';
            const payload = defaultAbiCoder.encode(['address'], [user.address]);
            const payloadHash = keccak256(payload);
            const sourceChain = 'Source';
            const sourceAddress = 'address0x123';
            const commandId = await gateway.messageToCommandId(sourceChain, messageId);

            const messages = [
                {
                    messageId,
                    sourceChain,
                    sourceAddress,
                    contractAddress: user.address,
                    payloadHash,
                },
            ];

            const proof = await getProof(APPROVE_MESSAGES, messages, weightedSigners, signers.slice(0, threshold));

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

            expect(await gateway.isCommandExecuted(commandId)).to.be.true;

            // try re-approving the same message
            await expect(gateway.approveMessages(messages, proof)).to.not.emit(gateway, 'ContractCallApproved');

            expect(await gateway.isMessageApproved(messageId, sourceChain, sourceAddress, user.address, payloadHash)).to
                .be.false;
        });
    });

    describe('rotate signers', () => {
        const sourceChain = 'Source';
        const sourceAddress = 'address0x123';
        let contractAddress;
        let payload;
        let payloadHash;

        beforeEach(async () => {
            await deployGateway();

            contractAddress = user.address;
            payload = defaultAbiCoder.encode(['address'], [user.address]);
            payloadHash = keccak256(payload);
        });

        it('should allow rotating signers', async () => {
            const newSignersCount = 75;
            const newThreshold = 35;
            const wallets = sortBy(
                Array.from({ length: newSignersCount }, (_, i) => ethers.Wallet.createRandom()),
                (wallet) => wallet.address.toLowerCase(),
            );

            const newSigners = {
                signers: wallets.map((wallet) => ({ signer: wallet.address, weight: 1 })),
                threshold: newThreshold,
                nonce: id('1'),
            };
            const newSignersData = encodeWeightedSigners(newSigners);

            let proof = await getProof(ROTATE_SIGNERS, newSigners, weightedSigners, signers.slice(0, threshold));
            const epoch = (await gateway.epoch()).toNumber() + 1;

            expect(await gateway.validateProof(keccak256(getRotateSignersData(newSigners)), proof)).to.be.true;

            const rotationCommandId = solidityKeccak256(
                ['uint8', 'bytes'],
                [ROTATE_SIGNERS, newSignersData],
            );

            await expect(gateway.rotateSigners(newSigners, proof))
                .to.emit(gateway, 'SignersRotated')
                .withArgs(epoch, keccak256(newSignersData), newSignersData)
                .to.emit(gateway, 'Executed')
                .withArgs(rotationCommandId);

            expect(await gateway.isCommandExecuted(rotationCommandId)).to.be.true;

            // validate message with the new signer set
            const messageId = '1';
            const commandId = await gateway.messageToCommandId(sourceChain, messageId);

            const messages = [
                {
                    messageId,
                    sourceChain,
                    sourceAddress,
                    contractAddress,
                    payloadHash,
                },
            ];

            proof = await getProof(APPROVE_MESSAGES, messages, newSigners, wallets.slice(0, newThreshold));

            expect(await gateway.validateProof(keccak256(getApproveMessageData(messages)), proof)).to.be.true;

            await expect(gateway.approveMessages(messages, proof))
                .to.emit(gateway, 'ContractCallApproved')
                .withArgs(commandId, messageId, sourceChain, sourceAddress, user.address, payloadHash);
        });

        it('should allow multiple rotations crossing the retention period', async () => {
            let currentSigners = weightedSigners;

            for (let i = 1; i <= previousSignersRetention + 1; i++) {
                const newSigners = {
                    ...weightedSigners,
                    nonce: id(`${i}`),
                };
                const encodedSigners = encodeWeightedSigners(newSigners);
                const proof = await getProof(ROTATE_SIGNERS, newSigners, currentSigners, signers.slice(0, threshold));

                await expect(gateway.rotateSigners(newSigners, proof))
                    .to.emit(gateway, 'SignersRotated')
                    .withArgs(i+1, keccak256(encodedSigners), encodedSigners);

                currentSigners = newSigners;
            }

            for (let i = 1; i <= previousSignersRetention; i++) {
                const ithSigners = {
                    ...weightedSigners,
                    nonce: id(`${i}`),
                };
                const messages = [
                    {
                        messageId: `${i}`,
                        sourceChain,
                        sourceAddress,
                        contractAddress,
                        payloadHash,
                    },
                ];
                const commandId = await gateway.messageToCommandId(sourceChain, `${i}`);
                const proof = await getProof(APPROVE_MESSAGES, messages, ithSigners, signers.slice(0, threshold));

                await expect(gateway.approveMessages(messages, proof))
                    .to.emit(gateway, 'ContractCallApproved')
                    .withArgs(commandId, `${i}`, sourceChain, sourceAddress, user.address, payloadHash);
            }

            // reject proof from outdated signer set
            const messages = [
                {
                    messageId: '0',
                    sourceChain,
                    sourceAddress,
                    contractAddress,
                    payloadHash,
                },
            ];
            const proof = await getProof(APPROVE_MESSAGES, messages, weightedSigners, signers.slice(0, threshold));
            await expectRevert(
                (gasOptions) => gateway.approveMessages(messages, proof, gasOptions),
                gateway,
                'InvalidSigners',
            );
        });

        it('reject rotating to the same signers', async () => {
            const newSigners = {
                signers: signers.map((wallet) => ({ signer: wallet.address, weight: 1 })),
                threshold: threshold - 1,
                nonce: id('1'),
            };

            const newSignersData = encodeWeightedSigners(newSigners);
            const commandId = solidityKeccak256(['uint8', 'bytes'], [ROTATE_SIGNERS, newSignersData]);
            let proof = await getProof(ROTATE_SIGNERS, newSigners, weightedSigners, signers.slice(0, threshold));

            await expect(gateway.rotateSigners(newSigners, proof))
                .to.emit(gateway, 'Executed')
                .withArgs(commandId)
                .to.emit(gateway, 'SignersRotated')
                .withArgs(2, keccak256(newSignersData), newSignersData);

            proof = await getProof(ROTATE_SIGNERS, newSigners, newSigners, signers.slice(0, threshold - 1));
            await expectRevert(
                (gasOptions) => gateway.rotateSigners(newSigners, proof, gasOptions),
                gateway,
                'CommandAlreadyExecuted',
                commandId,
            );
        });

        it('reject rotating signers from an old signer set', async () => {
            const newSigners = {
                signers: signers.map((wallet) => ({ signer: wallet.address, weight: 1 })),
                threshold,
                nonce: id('1'),
            };

            let proof = await getProof(ROTATE_SIGNERS, newSigners, weightedSigners, signers.slice(0, threshold));

            await gateway.rotateSigners(newSigners, proof).then((tx) => tx.wait());

            // sign off from an older signer set
            const newSigners2 = {
                signers: signers.map((wallet) => ({ signer: wallet.address, weight: 1 })),
                threshold,
                nonce: id('2'),
            };
            proof = await getProof(ROTATE_SIGNERS, newSigners2, weightedSigners, signers.slice(0, threshold));

            await expectRevert(
                (gasOptions) => gateway.rotateSigners(newSigners2, proof, gasOptions),
                gateway,
                'NotLatestSigners',
            );
        });
    });
});
