const { sortBy } = require('lodash');
const chai = require('chai');
const { ethers, network } = require('hardhat');
const {
    utils: { id, keccak256, defaultAbiCoder, toUtf8Bytes, solidityKeccak256 },
    constants: { AddressZero },
} = ethers;
const { expect } = chai;

const { encodeWeightedSigners, getWeightedSignersProof, WEIGHTED_SIGNERS_TYPE } = require('../../scripts/utils');
const { expectRevert, waitFor, getGasOptions, getPayloadAndProposalHash, isHardhat } = require('../utils');

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

    it('_pauseBypassSender() default returns address(0): no caller can bypass pause', async () => {
        const testBaseGatewayFactory = await ethers.getContractFactory('TestBaseAmplifierGateway', owner);
        const testBaseGateway = await testBaseGatewayFactory.deploy();
        await testBaseGateway.deployTransaction.wait(network.config.confirmations);

        await testBaseGateway.pause().then((tx) => tx.wait());

        // With the default address(0) bypass, even the deployer is blocked
        await expectRevert(
            (gasOptions) =>
                testBaseGateway.connect(owner).validateContractCall(id('x'), 'src', 'addr', id('payload'), gasOptions),
            testBaseGateway,
            'Pause',
        );
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

        it('should allow transferring operatorship to the zero address', async () => {
            await expect(gateway.connect(owner).transferOperatorship(AddressZero))
                .to.emit(gateway, 'OperatorshipTransferred')
                .withArgs(AddressZero);

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

    describe('pause', () => {
        const sourceChain = 'Source';
        const sourceAddress = 'src';
        const payload = defaultAbiCoder.encode(['uint256'], [42]);
        const payloadHash = keccak256(payload);

        let executable; // plain executable, never the owner

        const approveMessage = async (contractAddress, messageId) => {
            const messages = [{ sourceChain, messageId, sourceAddress, contractAddress, payloadHash }];
            const proof = await getProof(APPROVE_MESSAGES, messages, weightedSigners, signers.slice(0, threshold));
            await gateway.approveMessages(messages, proof).then((tx) => tx.wait());
        };

        beforeEach(async () => {
            await deployGateway();
            const executableFactory = await ethers.getContractFactory('AxelarExecutableTest', owner);
            executable = await executableFactory.deploy(gateway.address);
            await executable.deployTransaction.wait(network.config.confirmations);
        });

        it('paused() is false on a fresh deploy', async () => {
            expect(await gateway.paused()).to.be.false;
        });

        it('operator can pause and unpause; non-privileged callers cannot', async () => {
            await expect(gateway.connect(operator).setPauseStatus(true))
                .to.emit(gateway, 'Paused')
                .withArgs(operator.address);
            expect(await gateway.paused()).to.be.true;

            await expectRevert(
                (gasOptions) => gateway.connect(user).setPauseStatus(false, gasOptions),
                gateway,
                'InvalidSender',
                [user.address],
            );

            await expect(gateway.connect(operator).setPauseStatus(false))
                .to.emit(gateway, 'Unpaused')
                .withArgs(operator.address);
            expect(await gateway.paused()).to.be.false;
        });

        it('callContract is blocked while paused', async () => {
            await gateway
                .connect(operator)
                .setPauseStatus(true)
                .then((tx) => tx.wait());

            await expectRevert(
                (gasOptions) => gateway.connect(user).callContract('Destination', '0xabc', payload, gasOptions),
                gateway,
                'Pause',
            );
        });

        it('approveMessages is never gated by pause', async () => {
            await gateway
                .connect(operator)
                .setPauseStatus(true)
                .then((tx) => tx.wait());

            const messageId = 'approved-while-paused';
            const messages = [
                { sourceChain, messageId, sourceAddress, contractAddress: executable.address, payloadHash },
            ];
            const proof = await getProof(APPROVE_MESSAGES, messages, weightedSigners, signers.slice(0, threshold));
            const commandId = await gateway.messageToCommandId(sourceChain, messageId);

            await expect(gateway.approveMessages(messages, proof))
                .to.emit(gateway, 'MessageApproved')
                .withArgs(commandId, sourceChain, messageId, sourceAddress, executable.address, payloadHash);

            expect(
                await gateway.isMessageApproved(sourceChain, messageId, sourceAddress, executable.address, payloadHash),
            ).to.be.true;
        });

        it('rotateSigners is never gated by pause', async () => {
            await gateway
                .connect(operator)
                .setPauseStatus(true)
                .then((tx) => tx.wait());

            const newSigners = {
                signers: signers.map((wallet) => ({ signer: wallet.address, weight: 1 })),
                threshold,
                nonce: id('rotation-while-paused'),
            };
            const newSignersData = encodeWeightedSigners(newSigners);
            const proof = await getProof(ROTATE_SIGNERS, newSigners, weightedSigners, signers.slice(0, threshold));
            const epoch = (await gateway.epoch()).toNumber() + 1;

            await expect(gateway.rotateSigners(newSigners, proof))
                .to.emit(gateway, 'SignersRotated')
                .withArgs(epoch, keccak256(newSignersData), newSignersData);
        });

        it('owner bypasses validateMessage while paused', async () => {
            const messageId = 'owner-vm';
            await approveMessage(owner.address, messageId);
            const commandId = await gateway.messageToCommandId(sourceChain, messageId);

            await gateway
                .connect(operator)
                .setPauseStatus(true)
                .then((tx) => tx.wait());

            // msg.sender == owner() — bypass passes; non-owner is blocked
            await expectRevert(
                (gasOptions) =>
                    gateway
                        .connect(user)
                        .validateMessage(sourceChain, messageId, sourceAddress, payloadHash, gasOptions),
                gateway,
                'Pause',
            );
            await expect(gateway.connect(owner).validateMessage(sourceChain, messageId, sourceAddress, payloadHash))
                .to.emit(gateway, 'MessageExecuted')
                .withArgs(commandId);
        });

        it('pause survives ownership and operatorship transfers; roles are revoked from old holders and granted to new ones', async () => {
            await gateway
                .connect(operator)
                .setPauseStatus(true)
                .then((tx) => tx.wait());

            // Transfer both roles to `user` while paused
            await expect(gateway.connect(owner).transferOwnership(user.address))
                .to.emit(gateway, 'OwnershipTransferred')
                .withArgs(user.address);
            await expect(gateway.connect(user).transferOperatorship(user.address))
                .to.emit(gateway, 'OperatorshipTransferred')
                .withArgs(user.address);

            expect(await gateway.paused()).to.be.true;

            // Old holders can no longer act
            await expectRevert(
                (gasOptions) => gateway.connect(owner).setPauseStatus(false, gasOptions),
                gateway,
                'InvalidSender',
                [owner.address],
            );
            await expectRevert(
                (gasOptions) => gateway.connect(operator).setPauseStatus(false, gasOptions),
                gateway,
                'InvalidSender',
                [operator.address],
            );

            // New holder can unpause
            await expect(gateway.connect(user).setPauseStatus(false))
                .to.emit(gateway, 'Unpaused')
                .withArgs(user.address);
            expect(await gateway.paused()).to.be.false;
        });

        it('pause survives an implementation upgrade', async () => {
            await gateway
                .connect(operator)
                .setPauseStatus(true)
                .then((tx) => tx.wait());

            const newImplementation = await gatewayFactory.deploy(
                previousSignersRetention,
                domainSeparator,
                minimumRotationDelay,
            );
            await newImplementation.deployTransaction.wait(network.config.confirmations);
            const newImplementationCodehash = keccak256(await ethers.provider.getCode(newImplementation.address));

            await expect(gateway.connect(owner).upgrade(newImplementation.address, newImplementationCodehash, '0x'))
                .to.emit(gateway, 'Upgraded')
                .withArgs(newImplementation.address);

            expect(await gateway.paused()).to.be.true;
            expect(await gateway.implementation()).to.equal(newImplementation.address);
        });

        describe('with a contract owner', () => {
            let ownerExecutable;

            beforeEach(async () => {
                const executableFactory = await ethers.getContractFactory('AxelarExecutableTest', owner);
                ownerExecutable = await executableFactory.deploy(gateway.address);
                await ownerExecutable.deployTransaction.wait(network.config.confirmations);
                await gateway
                    .connect(owner)
                    .transferOwnership(ownerExecutable.address)
                    .then((tx) => tx.wait());
            });

            it('a non-owner executable cannot consume an approved message while paused', async () => {
                const messageId = 'plain-1';
                await approveMessage(executable.address, messageId);
                const commandId = await gateway.messageToCommandId(sourceChain, messageId);

                await gateway
                    .connect(operator)
                    .setPauseStatus(true)
                    .then((tx) => tx.wait());

                // Approval is still on-chain — the brake sits on consumption, not approval.
                expect(
                    await gateway.isMessageApproved(
                        sourceChain,
                        messageId,
                        sourceAddress,
                        executable.address,
                        payloadHash,
                    ),
                ).to.be.true;

                // The executable's execute() calls validateContractCall internally; msg.sender at the
                // gateway is the executable, which is not the owner, so the modifier reverts with Pause.
                await expectRevert(
                    (gasOptions) => executable.execute(commandId, sourceChain, sourceAddress, payload, gasOptions),
                    gateway,
                    'Pause',
                );

                // Once unpaused, the same call succeeds — proving the approval was untouched.
                await gateway
                    .connect(operator)
                    .setPauseStatus(false)
                    .then((tx) => tx.wait());

                await expect(executable.execute(commandId, sourceChain, sourceAddress, payload))
                    .to.emit(gateway, 'MessageExecuted')
                    .withArgs(commandId);
            });

            it('the owner contract can still consume messages while paused', async () => {
                const messageId = 'gov-1';
                await approveMessage(ownerExecutable.address, messageId);
                const commandId = await gateway.messageToCommandId(sourceChain, messageId);

                await gateway
                    .connect(operator)
                    .setPauseStatus(true)
                    .then((tx) => tx.wait());

                // msg.sender at the gateway is ownerExecutable == owner(), so the bypass passes.
                await expect(ownerExecutable.execute(commandId, sourceChain, sourceAddress, payload))
                    .to.emit(gateway, 'MessageExecuted')
                    .withArgs(commandId);
            });
        });

        // End-to-end with the real InterchainGovernance contract. Mirrors production:
        //   1. Cosmos x/gov proposal on Axelar -> AxelarnetGateway.callContract -> dest gateway
        //   2. relayer calls gateway.approveMessages with a verifier proof
        //   3. relayer calls InterchainGovernance.execute -> IG calls gateway.validateContractCall
        //   4. IG schedules the proposal in its timelock
        //   5. after eta, anyone calls IG.executeProposal -> the inner call (here: gateway.setPauseStatus)
        describe('via real InterchainGovernance', () => {
            const governanceChain = 'Axelarnet';
            const governanceAddress = 'axelar10d07y265gmmuvt4z0w9aw880jnsr700j7v9daj';
            const minimumTimeDelay = isHardhat ? 12 * 60 * 60 : 15;
            const proposalTimeDelay = isHardhat ? 13 * 60 * 60 : 25;

            let interchainGovernance;

            beforeEach(async () => {
                const igFactory = await ethers.getContractFactory('InterchainGovernance', owner);
                interchainGovernance = await igFactory.deploy(
                    gateway.address,
                    governanceChain,
                    governanceAddress,
                    minimumTimeDelay,
                );
                await interchainGovernance.deployTransaction.wait(network.config.confirmations);
                await gateway
                    .connect(owner)
                    .transferOwnership(interchainGovernance.address)
                    .then((tx) => tx.wait());
            });

            // Helper: deliver a `ScheduleTimeLockProposal` GMP message to IG, simulating the
            // approve + execute step of the cross-chain governance pipeline.
            // Returns { proposalHash, eta } so callers can make IG state assertions.
            const submitProposalThroughGmp = async (target, callData, messageId, nativeValue = 0) => {
                const [proposalPayload, proposalHash, eta] = await getPayloadAndProposalHash(
                    0, // ScheduleTimeLockProposal
                    target,
                    nativeValue,
                    callData,
                    proposalTimeDelay,
                );
                const messages = [
                    {
                        sourceChain: governanceChain,
                        messageId,
                        sourceAddress: governanceAddress,
                        contractAddress: interchainGovernance.address,
                        payloadHash: keccak256(proposalPayload),
                    },
                ];
                const proof = await getProof(APPROVE_MESSAGES, messages, weightedSigners, signers.slice(0, threshold));

                // (2) approve — always allowed, even while paused
                await gateway.approveMessages(messages, proof).then((tx) => tx.wait());

                // (3) execute through IG: msg.sender at the gateway is IG == owner, so the bypass on
                // validateContractCall passes even when the gateway is paused. (4) IG schedules.
                const commandId = await gateway.messageToCommandId(governanceChain, messageId);
                await expect(
                    interchainGovernance.execute(commandId, governanceChain, governanceAddress, proposalPayload),
                )
                    .to.emit(interchainGovernance, 'ProposalScheduled')
                    .withArgs(proposalHash, target, callData, nativeValue, eta);

                // Gateway marks the GMP message as executed (consumed by IG)
                expect(await gateway.isMessageExecuted(governanceChain, messageId)).to.be.true;

                // IG records the ETA — proposal is locked until the timelock elapses
                const storedEta = await interchainGovernance.getProposalEta(target, callData, nativeValue);
                expect(storedEta).to.be.gte(eta);

                // Attempting to execute before the timelock elapses must revert
                await expectRevert(
                    (gasOptions) => interchainGovernance.executeProposal(target, callData, nativeValue, gasOptions),
                    interchainGovernance,
                    'TimeLockNotReady',
                );

                return { proposalHash, eta };
            };

            it('can pause and unpause through the governance pipeline end-to-end', async () => {
                // --- (1)-(4) schedule pause via GMP, then (5) execute after the timelock elapses ---
                const pauseCalldata = gateway.interface.encodeFunctionData('setPauseStatus', [true]);
                await submitProposalThroughGmp(gateway.address, pauseCalldata, 'pause-schedule');

                // Proposal is scheduled but the timelock hasn't elapsed — gateway still live
                expect(await gateway.paused()).to.be.false;

                await waitFor(proposalTimeDelay);
                await expect(interchainGovernance.executeProposal(gateway.address, pauseCalldata, 0))
                    .to.emit(gateway, 'Paused')
                    .withArgs(interchainGovernance.address);
                expect(await gateway.paused()).to.be.true;

                // --- while paused, a plain executable cannot consume even a freshly-approved message ---
                const messageId = 'probe';
                await approveMessage(executable.address, messageId);
                const commandId = await gateway.messageToCommandId(sourceChain, messageId);
                await expectRevert(
                    (gasOptions) => executable.execute(commandId, sourceChain, sourceAddress, payload, gasOptions),
                    gateway,
                    'Pause',
                );

                // --- schedule unpause via GMP. This is the load-bearing step: schedule requires
                // IG to call validateContractCall on the gateway while paused, and the owner-bypass
                // is what makes it succeed.
                const unpauseCalldata = gateway.interface.encodeFunctionData('setPauseStatus', [false]);
                await submitProposalThroughGmp(gateway.address, unpauseCalldata, 'unpause-schedule');

                // Proposal scheduled but timelock not elapsed — gateway still paused
                expect(await gateway.paused()).to.be.true;

                await waitFor(proposalTimeDelay);
                await expect(interchainGovernance.executeProposal(gateway.address, unpauseCalldata, 0))
                    .to.emit(gateway, 'Unpaused')
                    .withArgs(interchainGovernance.address);
                expect(await gateway.paused()).to.be.false;

                // --- the previously-approved probe message becomes consumable again ---
                await expect(executable.execute(commandId, sourceChain, sourceAddress, payload))
                    .to.emit(gateway, 'MessageExecuted')
                    .withArgs(commandId);
            });
        });
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
