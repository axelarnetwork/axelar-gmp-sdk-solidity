const { sortBy } = require('lodash');
const chai = require('chai');
const { ethers, network } = require('hardhat');
const {
    utils: { id, keccak256, defaultAbiCoder, toUtf8Bytes, solidityKeccak256 },
    constants: { AddressZero },
} = ethers;
const { expect } = chai;

const { encodeWeightedSigners, getWeightedSignersProof, WEIGHTED_SIGNERS_TYPE } = require('../../scripts/utils');
const { expectRevert, waitFor, getGasOptions } = require('../utils');

const APPROVE_MESSAGES = 0;
const ROTATE_SIGNERS = 1;

describe('AxelarAmplifierGateway', () => {
    const numSigners = 5;
    const threshold = 3;
    const chainName = 'chain';
    const router = 'router';
    const domainSeparator = keccak256(toUtf8Bytes(chainName + router + 'axelar-1'));
    const minimumRotationDelay = 0;
    const previousSignersRetention = 15;

    let owner;
    let operator;
    let user;
    let signers;
    let weightedSigners;

    let gatewayFactory;
    let gatewayProxyFactory;
    let gateway;
    let implementation;

    before(async () => {
        const wallets = await ethers.getSigners();
        owner = wallets[0];
        operator = wallets[1];
        user = wallets[2];

        signers = sortBy(
            Array.from({ length: numSigners }, (_, i) => wallets[i]),
            (wallet) => wallet.address.toLowerCase(),
        );

        weightedSigners = {
            signers: signers.map((wallet) => ({ signer: wallet.address, weight: 1 })),
            threshold,
            nonce: id('0'),
        };

        gatewayFactory = await ethers.getContractFactory('AxelarAmplifierGateway', owner);
        gatewayProxyFactory = await ethers.getContractFactory('AxelarAmplifierGatewayProxy', owner);
    });

    const getApproveMessageData = (messages) => {
        return defaultAbiCoder.encode(
            [
                'uint8',
                'tuple(string sourceChain, string messageId, string sourceAddress, address contractAddress, bytes32 payloadHash)[] messages',
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

    const deployGateway = async (minimumRotationDelay = 0) => {
        const signers = defaultAbiCoder.encode(
            ['address', `${WEIGHTED_SIGNERS_TYPE}[]`],
            [operator.address, [weightedSigners]],
        );

        implementation = await gatewayFactory.deploy(previousSignersRetention, domainSeparator, minimumRotationDelay);
        await implementation.deployTransaction.wait(network.config.confirmations);

        const proxy = await gatewayProxyFactory.deploy(implementation.address, owner.address, signers, getGasOptions());
        await proxy.deployTransaction.wait(network.config.confirmations);

        gateway = gatewayFactory.attach(proxy.address);
    };

    describe('queries', () => {
        before(async () => {
            await deployGateway();
        });

        it('should return the correct command id', async () => {
            const messageId = '1';
            const sourceChain = 'Source';

            const commandId = await gateway.messageToCommandId(sourceChain, messageId);
            const expectedCommandId = solidityKeccak256(['string', 'string', 'string'], [sourceChain, '_', messageId]);

            expect(commandId).to.equal(expectedCommandId);
        });

        it('should return the correct implementation address', async () => {
            const gatewayImplementation = await gateway.implementation();
            expect(gatewayImplementation).to.equal(implementation.address);
        });

        it('should return the correct contract id', async () => {
            const contractId = await gateway.contractId();
            expect(contractId).to.equal(id('axelar-amplifier-gateway'));
        });

        it('should return the correct operator', async () => {
            expect(await gateway.operator()).to.equal(operator.address);
        });
    });

    it('should validate storage constants', async () => {
        const testBaseGatewayFactory = await ethers.getContractFactory('TestBaseAmplifierGateway', owner);
        const testBaseGateway = await testBaseGatewayFactory.deploy();
        await testBaseGateway.deployTransaction.wait(network.config.confirmations);

        const testAxelarGatewayFactory = await ethers.getContractFactory('TestAxelarAmplifierGateway', owner);
        const testAxelarGateway = await testAxelarGatewayFactory.deploy(0, id('1'), 0);
        await testAxelarGateway.deployTransaction.wait(network.config.confirmations);
    });

    describe('call contract', () => {
        beforeEach(async () => {
            await deployGateway();
        });

        it('should emit contract call event', async () => {
            const destinationChain = 'Destination';
            const destinationAddress = '0x123abc';
            const payload = defaultAbiCoder.encode(['address'], [owner.address]);

            const tx = await gateway.connect(owner).callContract(destinationChain, destinationAddress, payload);

            expect(tx)
                .to.emit(gateway, 'ContractCall')
                .withArgs(owner.address, destinationChain, destinationAddress, keccak256(payload), payload);
        });
    });

    describe('roles', () => {
        before(async () => {
            await deployGateway();
        });

        it('should allow transferring ownership', async () => {
            const tx = await gateway.connect(owner).transferOwnership(user.address);
            await tx.wait();

            await expect(tx).to.emit(gateway, 'OwnershipTransferred').withArgs(user.address);

            expect(await gateway.owner()).to.equal(user.address);

            // test transferring it again
            await expect(gateway.connect(user).transferOwnership(owner.address))
                .to.emit(gateway, 'OwnershipTransferred')
                .withArgs(owner.address);

            expect(await gateway.owner()).to.equal(owner.address);
        });

        it('should allow transferring operatorship', async () => {
            await expect(gateway.connect(operator).transferOperatorship(user.address))
                .to.emit(gateway, 'OperatorshipTransferred')
                .withArgs(user.address);

            expect(await gateway.operator()).to.equal(user.address);

            // test transferring it again
            await expect(gateway.connect(user).transferOperatorship(operator.address))
                .to.emit(gateway, 'OperatorshipTransferred')
                .withArgs(operator.address);

            expect(await gateway.operator()).to.equal(operator.address);
        });

        it('should allow owner to transfer operatorship', async () => {
            await expect(gateway.connect(owner).transferOperatorship(user.address))
                .to.emit(gateway, 'OperatorshipTransferred')
                .withArgs(user.address);

            expect(await gateway.operator()).to.equal(user.address);

            // test transferring it again
            await expect(gateway.connect(owner).transferOperatorship(operator.address))
                .to.emit(gateway, 'OperatorshipTransferred')
                .withArgs(operator.address);

            expect(await gateway.operator()).to.equal(operator.address);
        });

        it('should allow deploying gateway with address 0 as the operator', async () => {
            const signers = defaultAbiCoder.encode(
                ['address', `${WEIGHTED_SIGNERS_TYPE}[]`],
                [AddressZero, [weightedSigners]],
            );

            implementation = await gatewayFactory.deploy(
                previousSignersRetention,
                domainSeparator,
                minimumRotationDelay,
            );
            await implementation.deployTransaction.wait(network.config.confirmations);

            const proxy = await gatewayProxyFactory.deploy(
                implementation.address,
                owner.address,
                signers,
                getGasOptions(),
            );
            await proxy.deployTransaction.wait(network.config.confirmations);

            gateway = gatewayFactory.attach(proxy.address);

            expect(await gateway.operator()).to.equal(AddressZero);
        });

        it('reject transferring ownership by non-owner', async () => {
            await expectRevert(
                (gasOptions) => gateway.connect(operator).transferOwnership(operator.address, gasOptions),
                gateway,
                'NotOwner',
            );
        });

        it('reject transferring operatorship by non-operator', async () => {
            await expectRevert(
                (gasOptions) => gateway.connect(user).transferOperatorship(user.address, gasOptions),
                gateway,
                'InvalidSender',
                [user.address],
            );
        });

        it('reject transferring operatorship to the zero address', async () => {
            await expectRevert(
                (gasOptions) => gateway.connect(operator).transferOperatorship(AddressZero, gasOptions),
                gateway,
                'InvalidOperator',
            );
        });
    });

    describe('validate message', async () => {
        beforeEach(async () => {
            await deployGateway();
        });

        it('should approve and validate message', async () => {
            const messageId = '1';
            const payload = defaultAbiCoder.encode(['address'], [owner.address]);
            const payloadHash = keccak256(payload);
            const sourceChain = 'Source';
            const sourceAddress = 'address0x123';
            const commandId = await gateway.messageToCommandId(sourceChain, messageId);

            const messages = [
                {
                    sourceChain,
                    messageId,
                    sourceAddress,
                    contractAddress: owner.address,
                    payloadHash,
                },
            ];

            const proof = await getProof(APPROVE_MESSAGES, messages, weightedSigners, signers.slice(0, threshold));

            expect(await gateway.validateProof(keccak256(getApproveMessageData(messages)), proof)).to.be.true;

            await expect(gateway.approveMessages(messages, proof))
                .to.emit(gateway, 'MessageApproved')
                .withArgs(commandId, sourceChain, messageId, sourceAddress, owner.address, payloadHash);

            const isApprovedBefore = await gateway.isMessageApproved(
                sourceChain,
                messageId,
                sourceAddress,
                owner.address,
                payloadHash,
            );
            expect(isApprovedBefore).to.be.true;

            await gateway
                .connect(owner)
                .validateMessage(sourceChain, messageId, sourceAddress, payloadHash)
                .then((tx) => tx.wait());

            const isApprovedAfter = await gateway.isMessageApproved(
                sourceChain,
                messageId,
                sourceAddress,
                owner.address,
                payloadHash,
            );
            expect(isApprovedAfter).to.be.false;
        });

        it('should approve and validate contract call', async () => {
            const messageId = '1';
            const payload = defaultAbiCoder.encode(['address'], [owner.address]);
            const payloadHash = keccak256(payload);
            const sourceChain = 'Source';
            const sourceAddress = 'address0x123';
            const commandId = await gateway.messageToCommandId(sourceChain, messageId);

            const messages = [
                {
                    sourceChain,
                    messageId,
                    sourceAddress,
                    contractAddress: owner.address,
                    payloadHash,
                },
            ];

            const proof = await getProof(APPROVE_MESSAGES, messages, weightedSigners, signers.slice(0, threshold));

            await expect(gateway.approveMessages(messages, proof))
                .to.emit(gateway, 'MessageApproved')
                .withArgs(commandId, sourceChain, messageId, sourceAddress, owner.address, payloadHash);

            expect(
                await gateway.isContractCallApproved(commandId, sourceChain, sourceAddress, owner.address, payloadHash),
            ).to.be.true;

            await expect(
                gateway.connect(owner).validateContractCall(commandId, sourceChain, sourceAddress, payloadHash),
            )
                .to.emit(gateway, 'MessageExecuted')
                .withArgs(commandId);

            expect(
                await gateway.isContractCallApproved(commandId, sourceChain, sourceAddress, owner.address, payloadHash),
            ).to.be.false;

            // already executed
            await expect(
                gateway.connect(owner).validateContractCall(commandId, sourceChain, sourceAddress, payloadHash),
            ).to.not.emit(gateway, 'MessageExecuted');

            expect(await gateway.isCommandExecuted(commandId)).to.be.true;
        });

        it('should approve and validate multiple contract calls', async () => {
            const messages = [];
            const numCommands = 10;
            const payload = defaultAbiCoder.encode(['address'], [owner.address]);
            const payloadHash = keccak256(payload);
            const sourceChain = 'Source';
            const sourceAddress = 'address0x123';

            for (let i = 0; i < numCommands; i++) {
                const messageId = `${i}`;

                messages.push({
                    sourceChain,
                    messageId,
                    sourceAddress,
                    contractAddress: owner.address,
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
                    .to.emit(gateway, 'MessageApproved')
                    .withArgs(commandId, sourceChain, messageId, sourceAddress, owner.address, payloadHash);

                const isApprovedBefore = await gateway.isMessageApproved(
                    sourceChain,
                    messageId,
                    sourceAddress,
                    owner.address,
                    payloadHash,
                );

                expect(isApprovedBefore).to.be.true;

                expect(
                    await gateway.isContractCallApproved(
                        commandId,
                        sourceChain,
                        sourceAddress,
                        owner.address,
                        payloadHash,
                    ),
                ).to.be.true;

                await gateway
                    .connect(owner)
                    .validateMessage(sourceChain, messageId, sourceAddress, payloadHash)
                    .then((tx) => tx.wait());

                const isApprovedAfter = await gateway.isMessageApproved(
                    sourceChain,
                    messageId,
                    sourceAddress,
                    owner.address,
                    payloadHash,
                );

                expect(isApprovedAfter).to.be.false;

                expect(
                    await gateway.isContractCallApproved(
                        commandId,
                        sourceChain,
                        sourceAddress,
                        owner.address,
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
            expect(await gateway.isContractCallApproved(id('1'), 'Chain', 'address', owner.address, id('data'))).to.be
                .false;

            await expect(gateway.validateContractCall(id('1'), 'Chain', 'address', id('data'))).to.not.emit(
                gateway,
                'MessageExecuted',
            );
        });

        it('reject invalid message approval', async () => {
            expect(await gateway.isMessageApproved('Chain', '1', 'address', owner.address, id('data'))).to.be.false;

            await expect(gateway.validateMessage('Chain', '1', 'address', id('data'))).to.not.emit(
                gateway,
                'MessageExecuted',
            );
        });

        it('reject re-approving a message', async () => {
            const messageId = '1';
            const payload = defaultAbiCoder.encode(['address'], [owner.address]);
            const payloadHash = keccak256(payload);
            const sourceChain = 'Source';
            const sourceAddress = 'address0x123';
            const commandId = await gateway.messageToCommandId(sourceChain, messageId);

            const messages = [
                {
                    sourceChain,
                    messageId,
                    sourceAddress,
                    contractAddress: owner.address,
                    payloadHash,
                },
            ];

            const proof = await getProof(APPROVE_MESSAGES, messages, weightedSigners, signers.slice(0, threshold));

            await expect(gateway.approveMessages(messages, proof))
                .to.emit(gateway, 'MessageApproved')
                .withArgs(commandId, sourceChain, messageId, sourceAddress, owner.address, payloadHash);

            expect(await gateway.isMessageApproved(sourceChain, messageId, sourceAddress, owner.address, payloadHash))
                .to.be.true;
            expect(await gateway.isMessageExecuted(sourceChain, messageId)).to.be.false;
            expect(await gateway.isCommandExecuted(commandId)).to.be.true;

            // re-approval should be a no-op
            await expect(gateway.approveMessages(messages, proof)).to.not.emit(gateway, 'MessageApproved');

            expect(await gateway.isMessageApproved(sourceChain, messageId, sourceAddress, owner.address, payloadHash))
                .to.be.true;
            expect(await gateway.isMessageExecuted(sourceChain, messageId)).to.be.false;
            expect(await gateway.isCommandExecuted(commandId)).to.be.true;

            // execute message
            await gateway
                .connect(owner)
                .validateMessage(sourceChain, messageId, sourceAddress, payloadHash)
                .then((tx) => tx.wait());

            expect(await gateway.isMessageApproved(sourceChain, messageId, sourceAddress, owner.address, payloadHash))
                .to.be.false;
            expect(await gateway.isMessageExecuted(sourceChain, messageId)).to.be.true;
            expect(await gateway.isCommandExecuted(commandId)).to.be.true;

            // re-approving same message after execution should be a no-op as well
            await expect(gateway.approveMessages(messages, proof)).to.not.emit(gateway, 'MessageApproved');

            expect(await gateway.isMessageApproved(sourceChain, messageId, sourceAddress, owner.address, payloadHash))
                .to.be.false;
            expect(await gateway.isMessageExecuted(sourceChain, messageId)).to.be.true;
            expect(await gateway.isCommandExecuted(commandId)).to.be.true;
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

            contractAddress = owner.address;
            payload = defaultAbiCoder.encode(['address'], [owner.address]);
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

            await expect(gateway.rotateSigners(newSigners, proof))
                .to.emit(gateway, 'SignersRotated')
                .withArgs(epoch, keccak256(newSignersData), newSignersData);

            // validate message with the new signer set
            const messageId = '1';
            const commandId = await gateway.messageToCommandId(sourceChain, messageId);

            const messages = [
                {
                    sourceChain,
                    messageId,
                    sourceAddress,
                    contractAddress,
                    payloadHash,
                },
            ];

            proof = await getProof(APPROVE_MESSAGES, messages, newSigners, wallets.slice(0, newThreshold));

            expect(await gateway.validateProof(keccak256(getApproveMessageData(messages)), proof)).to.be.true;

            await expect(gateway.approveMessages(messages, proof))
                .to.emit(gateway, 'MessageApproved')
                .withArgs(commandId, sourceChain, messageId, sourceAddress, owner.address, payloadHash);
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
                    .withArgs(i + 1, keccak256(encodedSigners), encodedSigners);

                currentSigners = newSigners;

                const timeDelay = 5;
                await waitFor(timeDelay);
            }

            for (let i = 1; i <= previousSignersRetention; i++) {
                const ithSigners = {
                    ...weightedSigners,
                    nonce: id(`${i}`),
                };
                const messages = [
                    {
                        sourceChain,
                        messageId: `${i}`,
                        sourceAddress,
                        contractAddress,
                        payloadHash,
                    },
                ];
                const commandId = await gateway.messageToCommandId(sourceChain, `${i}`);
                const proof = await getProof(APPROVE_MESSAGES, messages, ithSigners, signers.slice(0, threshold));

                await expect(gateway.approveMessages(messages, proof))
                    .to.emit(gateway, 'MessageApproved')
                    .withArgs(commandId, sourceChain, `${i}`, sourceAddress, owner.address, payloadHash);
            }

            // reject proof from outdated signer set
            const messages = [
                {
                    sourceChain,
                    messageId: '0',
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

        it('should allow rotating signers from an old signer set from gateway operator', async () => {
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

            await expect(gateway.connect(operator).rotateSigners(newSigners2, proof))
                .to.emit(gateway, 'SignersRotated')
                .withArgs(3, keccak256(encodeWeightedSigners(newSigners2)), encodeWeightedSigners(newSigners2));
        });

        it('reject rotating to the same signers', async () => {
            const newSigners = {
                signers: signers.map((wallet) => ({ signer: wallet.address, weight: 1 })),
                threshold: threshold - 1,
                nonce: id('1'),
            };

            const newSignersData = encodeWeightedSigners(newSigners);
            let proof = await getProof(ROTATE_SIGNERS, newSigners, weightedSigners, signers.slice(0, threshold));

            await expect(gateway.rotateSigners(newSigners, proof))
                .to.emit(gateway, 'SignersRotated')
                .withArgs(2, keccak256(newSignersData), newSignersData);

            proof = await getProof(ROTATE_SIGNERS, newSigners, newSigners, signers.slice(0, threshold - 1));
            await expectRevert(
                (gasOptions) => gateway.rotateSigners(newSigners, proof, gasOptions),
                gateway,
                'DuplicateSigners',
                keccak256(newSignersData),
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

    it('should allow rotating signers after the delay', async () => {
        const minimumRotationDelay = 60; // seconds

        await deployGateway(minimumRotationDelay);

        const newSigners = {
            ...weightedSigners,
            nonce: id('1'),
        };
        const proof = await getProof(ROTATE_SIGNERS, newSigners, weightedSigners, signers.slice(0, threshold));

        // reject rotation before the delay
        await expectRevert(
            (gasOptions) => gateway.rotateSigners(newSigners, proof, gasOptions),
            gateway,
            'InsufficientRotationDelay',
        );

        await waitFor(minimumRotationDelay);

        // rotate signers after the delay
        const epoch = (await gateway.epoch()).toNumber();
        await expect(gateway.rotateSigners(newSigners, proof))
            .to.emit(gateway, 'SignersRotated')
            .withArgs(epoch + 1, keccak256(encodeWeightedSigners(newSigners)), encodeWeightedSigners(newSigners));
    });

    describe('upgradability', () => {
        beforeEach(async () => {
            await deployGateway();
        });

        it('should allow upgrading the implementation', async () => {
            const newImplementation = await gatewayFactory.deploy(
                previousSignersRetention,
                domainSeparator,
                minimumRotationDelay,
            );
            await newImplementation.deployTransaction.wait(network.config.confirmations);

            const newImplementationCodehash = keccak256(await ethers.provider.getCode(newImplementation.address));

            await expect(gateway.upgrade(newImplementation.address, newImplementationCodehash, '0x'))
                .to.emit(gateway, 'Upgraded')
                .withArgs(newImplementation.address);
        });

        it('should allow upgrading the implementation with setup params', async () => {
            const newImplementation = await gatewayFactory.deploy(
                previousSignersRetention,
                domainSeparator,
                minimumRotationDelay,
            );
            await newImplementation.deployTransaction.wait(network.config.confirmations);

            const newImplementationCodehash = keccak256(await ethers.provider.getCode(newImplementation.address));

            const newSigners = {
                signers: signers.map((wallet) => ({ signer: wallet.address, weight: 2 })),
                threshold: threshold * 2,
                nonce: id('1'),
            };
            const newSigners2 = {
                ...newSigners,
                nonce: id('2'),
            };

            const setupParams = defaultAbiCoder.encode(
                ['address', `${WEIGHTED_SIGNERS_TYPE}[]`],
                [operator.address, [newSigners, newSigners2]],
            );

            await expect(gateway.upgrade(newImplementation.address, newImplementationCodehash, setupParams))
                .to.emit(gateway, 'Upgraded')
                .withArgs(newImplementation.address)
                .to.emit(gateway, 'OperatorshipTransferred')
                .withArgs(operator.address)
                .to.emit(gateway, 'SignersRotated')
                .withArgs(2, keccak256(encodeWeightedSigners(newSigners)), encodeWeightedSigners(newSigners))
                .to.emit(gateway, 'SignersRotated')
                .withArgs(3, keccak256(encodeWeightedSigners(newSigners2)), encodeWeightedSigners(newSigners2));
        });

        it('should allow upgrading the implementation with setup params without operator', async () => {
            const newImplementation = await gatewayFactory.deploy(
                previousSignersRetention,
                domainSeparator,
                minimumRotationDelay,
            );
            await newImplementation.deployTransaction.wait(network.config.confirmations);

            const newImplementationCodehash = keccak256(await ethers.provider.getCode(newImplementation.address));

            const newSigners = {
                signers: signers.map((wallet) => ({ signer: wallet.address, weight: 2 })),
                threshold: threshold * 2,
                nonce: id('1'),
            };

            const setupParams = defaultAbiCoder.encode(
                ['address', `${WEIGHTED_SIGNERS_TYPE}[]`],
                [AddressZero, [newSigners]],
            );

            await expect(gateway.upgrade(newImplementation.address, newImplementationCodehash, setupParams))
                .to.emit(gateway, 'Upgraded')
                .withArgs(newImplementation.address)
                .to.emit(gateway, 'SignersRotated')
                .withArgs(2, keccak256(encodeWeightedSigners(newSigners)), encodeWeightedSigners(newSigners))
                .to.not.emit(gateway, 'OperatorshipTransferred');
        });

        it('should allow upgrading the implementation with setup params without rotations', async () => {
            const newImplementation = await gatewayFactory.deploy(
                previousSignersRetention,
                domainSeparator,
                minimumRotationDelay,
            );
            await newImplementation.deployTransaction.wait(network.config.confirmations);

            const newImplementationCodehash = keccak256(await ethers.provider.getCode(newImplementation.address));

            const setupParams = defaultAbiCoder.encode(
                ['address', `${WEIGHTED_SIGNERS_TYPE}[]`],
                [operator.address, []],
            );

            await expect(gateway.upgrade(newImplementation.address, newImplementationCodehash, setupParams))
                .to.emit(gateway, 'Upgraded')
                .withArgs(newImplementation.address)
                .to.emit(gateway, 'OperatorshipTransferred')
                .withArgs(operator.address);
        });

        it('reject upgrading with invalid setup params', async () => {
            const newImplementation = await gatewayFactory.deploy(
                previousSignersRetention,
                domainSeparator,
                minimumRotationDelay,
            );
            await newImplementation.deployTransaction.wait(network.config.confirmations);

            const newImplementationCodehash = keccak256(await ethers.provider.getCode(newImplementation.address));
            const setupParams = '0xff';

            await expectRevert(
                (gasOptions) =>
                    gateway.upgrade(newImplementation.address, newImplementationCodehash, setupParams, gasOptions),
                gateway,
                'SetupFailed',
            );
        });

        it('reject upgrading to invalid implementation', async () => {
            await expectRevert(
                (gasOptions) => gateway.upgrade(implementation.address, ethers.constants.HashZero, '0x', gasOptions),
                gateway,
                'InvalidCodeHash',
            );
        });
    });
});
