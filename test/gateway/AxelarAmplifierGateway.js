const { sortBy } = require('lodash');
const chai = require('chai');
const { ethers } = require('hardhat');
const {
    utils: { id, arrayify, keccak256, defaultAbiCoder },
} = ethers;
const { expect } = chai;

const { getChainId, getRandomID } = require('../utils');
const { encodeWeightedSigners, getWeightedSignersProof } = require('../../scripts/utils');

describe('AxelarAmplifierGateway', () => {
    const threshold = 2;
    const domainSeparator = id('chain');
    const commandId = process.env.REPORT_GAS ? id('4') : getRandomID(); // use fixed command id for deterministic gas computation

    let wallets;
    let user;
    let operators;
    let weightedSigners;

    let gatewayFactory;
    let authFactory;

    let auth;
    let gateway;

    before(async () => {
        wallets = await ethers.getSigners();
        user = wallets[0];
        operators = sortBy(wallets.slice(0, threshold), (wallet) => wallet.address.toLowerCase());

        weightedSigners = {
            signers: operators.map((wallet, i) => ({ signer: wallet.address, weight: 1 })),
            threshold,
            nonce: id('0'),
        };

        gatewayFactory = await ethers.getContractFactory('AxelarAmplifierGateway', user);
        authFactory = await ethers.getContractFactory('AxelarGatewayWeightedAuth', user);
    });

    const getApproveContractCall = (sourceChain, source, destination, payloadHash, sourceTxHash, sourceEventIndex) => {
        return defaultAbiCoder.encode(
            ['string', 'string', 'address', 'bytes32', 'bytes32', 'uint256'],
            [sourceChain, source, destination, payloadHash, sourceTxHash, sourceEventIndex],
        );
    };

    const buildCommandBatch = (chainId, commandIDs, commandNames, commands) => {
        return arrayify(
            defaultAbiCoder.encode(
                ['uint256', 'bytes32[]', 'string[]', 'bytes[]'],
                [chainId, commandIDs, commandNames, commands],
            ),
        );
    };

    const getTransferWeightedOperatorshipCommand = (newSigners) => encodeWeightedSigners(newSigners);

    const getSignedWeightedExecuteInput = async (data, weightedSigners, signers) =>
        defaultAbiCoder.encode(
            ['bytes', 'bytes'],
            [data, await getWeightedSignersProof(data, domainSeparator, weightedSigners, signers)],
        );

    const deployGateway = async () => {
        // setup auth contract with a genesis operator set
        auth = await authFactory
            .deploy(user.address, domainSeparator, [encodeWeightedSigners(weightedSigners)])
            .then((d) => d.deployed());

        gateway = await gatewayFactory.deploy(auth.address).then((d) => d.deployed());

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

            const approveData = buildCommandBatch(
                await getChainId(),
                [commandId],
                ['approveContractCall'],
                [
                    getApproveContractCall(
                        sourceChain,
                        sourceAddress,
                        user.address,
                        payloadHash,
                        sourceTxHash,
                        sourceEventIndex,
                    ),
                ],
            );

            const approveInput = await getSignedWeightedExecuteInput(
                approveData,
                weightedSigners,
                operators.slice(0, threshold),
            );

            await expect(gateway.execute(approveInput))
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
            const newSigners = {
                signers: [
                    { signer: '0x6D4017D4b1DCd36e6EA88b7900e8eC64A1D1315b', weight: 1 },
                    { signer: '0xb7900E8Ec64A1D1315B6D4017d4b1dcd36E6Ea88', weight: 1 },
                ],
                threshold: 2,
                nonce: id('0'),
            };

            const data = buildCommandBatch(
                await getChainId(),
                [commandId],
                ['transferOperatorship'],
                [getTransferWeightedOperatorshipCommand(newSigners)],
            );

            const input = await getSignedWeightedExecuteInput(data, weightedSigners, operators.slice(0, threshold));

            const tx = await gateway.execute(input);

            await expect(tx)
                .to.emit(gateway, 'OperatorshipTransferred')
                .withArgs(getTransferWeightedOperatorshipCommand(newSigners));
        });
    });
});
