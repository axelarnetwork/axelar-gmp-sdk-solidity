'use strict';

const chai = require('chai');
const {
    utils: { defaultAbiCoder, keccak256, id },
    constants: { AddressZero },
} = require('ethers');
const { expect } = chai;
const { ethers } = require('hardhat');

const DestinationChainSwapExpress = require('../../artifacts/contracts/test/gmp/DestinationChainSwapExpress.sol/DestinationChainSwapExpress.json');
const { deployContract } = require('../../scripts/utils');
const { getGasOptions } = require('../utils');

const getRandomID = () => id(Math.floor(Math.random() * 1e10).toString());

describe('GMPE', async () => {
    let gatewayFactory;
    let sourceChainSwapCallerFactory;
    let destinationChainTokenSwapperFactory;
    let expressExecutableTestFactory;
    let valuedAxelarExpressExecutableTestFactory;
    let tokenFactory;

    let sourceChainGateway;
    let sourceChainSwapCaller;
    let destinationChainGateway;
    let destinationChainSwapExpress;
    let tokenA;
    let tokenB;
    let destinationChainTokenSwapper;
    let expressExecutableTest;
    let valuedAxelarExpressExecutableTest;

    let ownerWallet;
    let userWallet;

    const sourceChain = 'chainA';
    const destinationChain = 'chainB';
    const nameA = 'testTokenX';
    const symbolA = 'testTokenX';
    const nameB = 'testTokenY';
    const symbolB = 'testTokenY';
    const decimals = 16;
    const capacity = 0;

    before(async () => {
        [ownerWallet, userWallet] = await ethers.getSigners();

        gatewayFactory = await ethers.getContractFactory('MockGateway', ownerWallet);
        sourceChainSwapCallerFactory = await ethers.getContractFactory('SourceChainSwapCaller', ownerWallet);
        destinationChainTokenSwapperFactory = await ethers.getContractFactory(
            'DestinationChainTokenSwapper',
            ownerWallet,
        );
        tokenFactory = await ethers.getContractFactory('ERC20MintableBurnable', ownerWallet);
        expressExecutableTestFactory = await ethers.getContractFactory('AxelarExpressExecutableTest', ownerWallet);
        valuedAxelarExpressExecutableTestFactory = await ethers.getContractFactory(
            'AxelarValuedExpressExecutableTest',
            ownerWallet,
        );

        tokenA = await tokenFactory.deploy(nameA, symbolA, decimals).then((d) => d.deployed());

        tokenB = await tokenFactory.deploy(nameB, symbolB, decimals).then((d) => d.deployed());

        await tokenA.mint(ownerWallet.address, 1e9).then((t) => t.wait());
        await tokenB.mint(ownerWallet.address, 1e9).then((t) => t.wait());
        await tokenA.mint(userWallet.address, 1e9).then((t) => t.wait());

        destinationChainTokenSwapper = await destinationChainTokenSwapperFactory
            .deploy(tokenA.address.toString(), tokenB.address.toString())
            .then((d) => d.deployed());

        sourceChainGateway = await gatewayFactory.deploy().then((d) => d.deployed());

        destinationChainGateway = await gatewayFactory.deploy().then((d) => d.deployed());

        await sourceChainGateway
            .deployToken(
                defaultAbiCoder.encode(
                    ['string', 'string', 'uint8', 'uint256', ' address', 'uint256'],
                    [nameA, symbolA, decimals, capacity, ethers.constants.AddressZero, 0],
                ),
                keccak256('0x'),
            )
            .then((t) => t.wait());
        await sourceChainGateway
            .deployToken(
                defaultAbiCoder.encode(
                    ['string', 'string', 'uint8', 'uint256', ' address', 'uint256'],
                    [nameB, symbolB, decimals, capacity, ethers.constants.AddressZero, 0],
                ),
                keccak256('0x'),
            )
            .then((t) => t.wait());

        await sourceChainGateway
            .mintToken(
                defaultAbiCoder.encode(
                    ['string', 'address', 'uint256'],
                    [symbolA, userWallet.address, 1e9],
                    keccak256('0x'),
                ),
                keccak256('0x'),
            )
            .then((t) => t.wait());

        await destinationChainGateway
            .deployToken(
                defaultAbiCoder.encode(
                    ['string', 'string', 'uint8', 'uint256', ' address', 'uint256'],
                    [nameA, symbolA, decimals, capacity, tokenA.address, 0],
                ),
                keccak256('0x'),
            )
            .then((t) => t.wait());
        await destinationChainGateway
            .deployToken(
                defaultAbiCoder.encode(
                    ['string', 'string', 'uint8', 'uint256', ' address', 'uint256'],
                    [nameB, symbolB, decimals, capacity, tokenB.address, 0],
                ),
                keccak256('0x'),
            )
            .then((t) => t.wait());

        await tokenA.mint(destinationChainGateway.address, 1e9).then((t) => t.wait());
        await tokenB.mint(destinationChainTokenSwapper.address, 1e9).then((t) => t.wait());

        destinationChainSwapExpress = await deployContract(ownerWallet, DestinationChainSwapExpress, [
            destinationChainGateway.address,
            destinationChainTokenSwapper.address,
        ]);

        expressExecutableTest = await expressExecutableTestFactory
            .deploy(destinationChainGateway.address)
            .then((d) => d.deployed());

        valuedAxelarExpressExecutableTest = await valuedAxelarExpressExecutableTestFactory
            .deploy(destinationChainGateway.address)
            .then((d) => d.deployed());

        sourceChainSwapCaller = await sourceChainSwapCallerFactory
            .deploy(sourceChainGateway.address, destinationChain, destinationChainSwapExpress.address)
            .then((d) => d.deployed());
    });

    describe('AxelarExpressExecutable', () => {
        it('should revert on deployment with invalid gateway address', async () => {
            await expect(expressExecutableTestFactory.deploy(AddressZero)).to.be.revertedWithCustomError(
                expressExecutableTest,
                'InvalidAddress',
            );
        });

        it('should expressExecuteWithToken a swap on remote chain', async () => {
            const swapAmount = 1e3;
            const convertedAmount = 2 * swapAmount;
            const payload = defaultAbiCoder.encode(['string', 'string'], [symbolB, userWallet.address.toString()]);
            const payloadHash = keccak256(payload);
            const sourceChainTokenA = tokenFactory
                .connect(userWallet)
                .attach(await sourceChainGateway.tokenAddresses(symbolA));
            await sourceChainTokenA.approve(sourceChainSwapCaller.address, swapAmount);
            await expect(
                sourceChainSwapCaller
                    .connect(userWallet)
                    .swapToken(symbolA, symbolB, swapAmount, userWallet.address.toString()),
            )
                .to.emit(sourceChainGateway, 'ContractCallWithToken')
                .withArgs(
                    sourceChainSwapCaller.address.toString(),
                    destinationChain,
                    destinationChainSwapExpress.address.toString(),
                    payloadHash,
                    payload,
                    symbolA,
                    swapAmount,
                );
            await tokenA.connect(userWallet).approve(destinationChainSwapExpress.address, swapAmount);
            const approveCommandId = getRandomID();
            await expect(
                destinationChainSwapExpress
                    .connect(userWallet)
                    .expressExecuteWithToken(
                        approveCommandId,
                        sourceChain,
                        sourceChainSwapCaller.address,
                        payload,
                        symbolA,
                        swapAmount,
                        getGasOptions(),
                    ),
            )
                .to.emit(tokenA, 'Transfer')
                .withArgs(userWallet.address, destinationChainSwapExpress.address, swapAmount)
                .and.to.emit(tokenA, 'Transfer')
                .withArgs(destinationChainSwapExpress.address, destinationChainTokenSwapper.address, swapAmount)
                .and.to.emit(tokenB, 'Transfer')
                .withArgs(destinationChainTokenSwapper.address, destinationChainSwapExpress.address, convertedAmount)
                .and.to.emit(tokenB, 'Transfer')
                .withArgs(destinationChainSwapExpress.address, destinationChainGateway.address, convertedAmount)
                .and.to.emit(destinationChainGateway, 'TokenSent')
                .withArgs(
                    destinationChainSwapExpress.address,
                    sourceChain,
                    userWallet.address.toString(),
                    symbolB,
                    convertedAmount,
                );
            const sourceTxHash = keccak256('0x123abc123abc');
            const sourceEventIndex = 17;
            const approveWithMintData = defaultAbiCoder.encode(
                ['string', 'string', 'address', 'bytes32', 'string', 'uint256', 'bytes32', 'uint256'],
                [
                    sourceChain,
                    sourceChainSwapCaller.address.toString(),
                    destinationChainSwapExpress.address,
                    payloadHash,
                    symbolA,
                    swapAmount,
                    sourceTxHash,
                    sourceEventIndex,
                ],
            );
            const approveExecute = await destinationChainGateway.approveContractCallWithMint(
                approveWithMintData,
                approveCommandId,
            );
            await expect(approveExecute)
                .to.emit(destinationChainGateway, 'ContractCallApprovedWithMint')
                .withArgs(
                    approveCommandId,
                    sourceChain,
                    sourceChainSwapCaller.address.toString(),
                    destinationChainSwapExpress.address,
                    payloadHash,
                    symbolA,
                    swapAmount,
                    sourceTxHash,
                    sourceEventIndex,
                );
            const execute = await destinationChainSwapExpress.executeWithToken(
                approveCommandId,
                sourceChain,
                sourceChainSwapCaller.address.toString(),
                payload,
                symbolA,
                swapAmount,
            );
            await expect(execute)
                .to.emit(tokenA, 'Transfer')
                .withArgs(destinationChainGateway.address, destinationChainSwapExpress.address, swapAmount)
                .and.to.emit(tokenA, 'Transfer')
                .withArgs(destinationChainSwapExpress.address, userWallet.address, swapAmount);
        });
    });

    describe('AxelarExpressExecutableTest Execute', () => {
        let commandId;
        let contract;
        const sourceTxHash = keccak256('0x123abc123abc');
        const sourceEventIndex = 17;
        const payload = '0x1234';
        const payloadHash = keccak256(payload);
        const sourceAddress = '0x5678';

        async function approve() {
            const approveWithMintData = defaultAbiCoder.encode(
                ['string', 'string', 'address', 'bytes32', 'bytes32', 'uint256'],
                [sourceChain, sourceAddress, contract.address, payloadHash, sourceTxHash, sourceEventIndex],
            );
            const approveExecute = destinationChainGateway.approveContractCall(approveWithMintData, commandId);
            await expect(approveExecute)
                .to.emit(destinationChainGateway, 'ContractCallApproved')
                .withArgs(
                    commandId,
                    sourceChain,
                    sourceAddress,
                    contract.address,
                    payloadHash,
                    sourceTxHash,
                    sourceEventIndex,
                );
        }

        async function expressSuccess() {
            let expressTx = contract.expressExecute(commandId, sourceChain, sourceAddress, payload);
            await expect(expressTx)
                .to.emit(contract, 'ExpressExecuted')
                .withArgs(commandId, sourceChain, sourceAddress, payloadHash, ownerWallet.address)
                .and.to.emit(contract, 'Executed')
                .withArgs(sourceChain, sourceAddress, payload);

            expressTx = contract.expressExecute(commandId, sourceChain, sourceAddress, payload);
            await expect(expressTx).to.be.revertedWithCustomError(contract, 'ExpressExecutorAlreadySet');
        }

        async function executionFailure() {
            const executeTx = contract.execute(commandId, sourceChain, sourceAddress, payload);
            await expect(executeTx).to.be.revertedWithCustomError(contract, 'NotApprovedByGateway');
        }

        async function expressFailure() {
            const expressTx = contract.expressExecute(commandId, sourceChain, sourceAddress, payload);
            await expect(expressTx).to.be.revertedWithCustomError(contract, 'AlreadyExecuted');
        }

        async function execution() {
            const executeTx = contract.execute(commandId, sourceChain, sourceAddress, payload);
            await expect(executeTx).to.emit(contract, 'Executed').withArgs(sourceChain, sourceAddress, payload);
        }

        async function expressFullfill() {
            const executeTx = contract.execute(commandId, sourceChain, sourceAddress, payload);
            await expect(executeTx)
                .to.emit(contract, 'ExpressExecutionFulfilled')
                .withArgs(commandId, sourceChain, sourceAddress, payloadHash, ownerWallet.address)
                .and.to.not.emit(contract, 'Executed');
        }

        before(() => {
            contract = expressExecutableTest;
        });

        beforeEach(async () => {
            commandId = getRandomID();
        });

        it('Should Execute without express', async () => {
            await approve();
            await execution();
        });

        it('Should not Execute without gateway approval', async () => {
            await executionFailure();
        });

        it('Should Execute with express before approval', async () => {
            await expressSuccess();
            await approve();
            await expressFullfill();
        });

        it('Should not Execute with express after approval', async () => {
            await approve();
            await expressFailure();
            await execution();
        });

        it('Should not Execute with express after execution', async () => {
            await approve();
            await execution();
            await expressFailure();
        });
    });

    describe('AxelarExpressExecutableTest Execute With Token', () => {
        let commandId;
        let contract;
        const sourceTxHash = keccak256('0x123abc123abc');
        const sourceEventIndex = 17;
        const payload = '0x1234';
        const payloadHash = keccak256(payload);
        const sourceAddress = '0x5678';
        const tokenSymbol = symbolA;
        const amount = 1234;

        async function approve() {
            const approveWithMintData = defaultAbiCoder.encode(
                ['string', 'string', 'address', 'bytes32', 'string', 'uint256', 'bytes32', 'uint256'],
                [
                    sourceChain,
                    sourceAddress,
                    contract.address,
                    payloadHash,
                    tokenSymbol,
                    amount,
                    sourceTxHash,
                    sourceEventIndex,
                ],
            );
            const approveExecute = destinationChainGateway.approveContractCallWithMint(approveWithMintData, commandId);
            await expect(approveExecute)
                .to.emit(destinationChainGateway, 'ContractCallApprovedWithMint')
                .withArgs(
                    commandId,
                    sourceChain,
                    sourceAddress,
                    contract.address,
                    payloadHash,
                    tokenSymbol,
                    amount,
                    sourceTxHash,
                    sourceEventIndex,
                );
        }

        async function expressNotPayed() {
            const expressTx = contract.expressExecuteWithToken(
                commandId,
                sourceChain,
                sourceAddress,
                payload,
                tokenSymbol,
                amount,
            );
            await expect(expressTx).to.be.revertedWithCustomError(contract, 'TokenTransferFailed');
        }

        async function expressSuccess() {
            await (await tokenA.connect(ownerWallet).approve(contract.address, amount)).wait();
            let expressTx = contract.expressExecuteWithToken(
                commandId,
                sourceChain,
                sourceAddress,
                payload,
                tokenSymbol,
                amount,
            );
            await expect(expressTx)
                .to.emit(tokenA, 'Transfer')
                .withArgs(ownerWallet.address, contract.address, amount)
                .and.to.emit(contract, 'ExpressExecutedWithToken')
                .withArgs(commandId, sourceChain, sourceAddress, payloadHash, tokenSymbol, amount, ownerWallet.address)
                .and.to.emit(contract, 'ExecutedWithToken')
                .withArgs(sourceChain, sourceAddress, payload, tokenSymbol, amount);

            await (await tokenA.connect(ownerWallet).approve(contract.address, amount)).wait();

            expressTx = contract.expressExecuteWithToken(
                commandId,
                sourceChain,
                sourceAddress,
                payload,
                tokenSymbol,
                amount,
            );
            await expect(expressTx).to.be.revertedWithCustomError(contract, 'ExpressExecutorAlreadySet');

            await (await tokenA.connect(ownerWallet).approve(contract.address, 0)).wait();
        }

        async function expressFailure() {
            const expressTx = contract.expressExecuteWithToken(
                commandId,
                sourceChain,
                sourceAddress,
                payload,
                tokenSymbol,
                amount,
            );
            await expect(expressTx).to.be.revertedWithCustomError(contract, 'AlreadyExecuted');
        }

        async function execution() {
            const executeTx = contract.executeWithToken(
                commandId,
                sourceChain,
                sourceAddress,
                payload,
                tokenSymbol,
                amount,
            );
            await expect(executeTx)
                .to.emit(tokenA, 'Transfer')
                .withArgs(destinationChainGateway.address, contract.address, amount)
                .and.to.emit(contract, 'ExecutedWithToken')
                .withArgs(sourceChain, sourceAddress, payload, tokenSymbol, amount);
        }

        async function executionFailed() {
            const executeTx = contract.executeWithToken(
                commandId,
                sourceChain,
                sourceAddress,
                payload,
                tokenSymbol,
                amount,
            );
            await expect(executeTx).to.be.revertedWithCustomError(contract, 'NotApprovedByGateway');
        }

        async function expressFullfill() {
            const executeTx = contract.executeWithToken(
                commandId,
                sourceChain,
                sourceAddress,
                payload,
                tokenSymbol,
                amount,
            );
            await expect(executeTx)
                .to.emit(tokenA, 'Transfer')
                .withArgs(contract.address, ownerWallet.address, amount)
                .and.to.emit(contract, 'ExpressExecutionWithTokenFulfilled')
                .withArgs(commandId, sourceChain, sourceAddress, payloadHash, tokenSymbol, amount, ownerWallet.address)
                .and.to.not.emit(contract, 'ExecutedWithToken');
        }

        before(() => {
            contract = expressExecutableTest;
        });

        beforeEach(async () => {
            commandId = getRandomID();
        });

        it('Should Execute without express', async () => {
            await approve();
            await execution();
        });

        it('Should not Execute without gateway approval', async () => {
            await executionFailed();
        });

        it('Should Execute with express before approval', async () => {
            await expressSuccess();
            await approve();
            await expressFullfill();
        });

        it('Should not Execute with express before approval without proper payment', async () => {
            await expressNotPayed();
        });

        it('Should not Execute with express after approval', async () => {
            await approve();
            await expressFailure();
            await execution();
        });

        it('Should not Execute with express after execution', async () => {
            await approve();
            await execution();
            await expressFailure();
        });
    });

    describe('AxelarValuedExpressExecutableTest Execute (native token)', () => {
        let commandId;
        let contract;
        const sourceTxHash = keccak256('0x123abc123abc');
        const sourceEventIndex = 17;
        const payload = '0x1234';
        const payloadHash = keccak256(payload);
        const sourceAddress = '0x5678';
        const value = 12;

        async function approve() {
            const approveWithMintData = defaultAbiCoder.encode(
                ['string', 'string', 'address', 'bytes32', 'bytes32', 'uint256'],
                [sourceChain, sourceAddress, contract.address, payloadHash, sourceTxHash, sourceEventIndex],
            );
            const approveExecute = destinationChainGateway.approveContractCall(approveWithMintData, commandId);
            await expect(approveExecute)
                .to.emit(destinationChainGateway, 'ContractCallApproved')
                .withArgs(
                    commandId,
                    sourceChain,
                    sourceAddress,
                    contract.address,
                    payloadHash,
                    sourceTxHash,
                    sourceEventIndex,
                );
        }

        async function expressNotPayed() {
            const expressTx = contract.expressExecute(commandId, sourceChain, sourceAddress, payload);
            await expect(expressTx).to.be.revertedWithCustomError(contract, 'InsufficientValue');
        }

        async function expressSuccess() {
            let expressTx = contract.expressExecute(commandId, sourceChain, sourceAddress, payload, { value });
            await expect(expressTx)
                .to.emit(contract, 'ExpressExecuted')
                .withArgs(commandId, sourceChain, sourceAddress, payloadHash, ownerWallet.address)
                .and.to.emit(contract, 'Executed')
                .withArgs(sourceChain, sourceAddress, payload);

            expressTx = contract.expressExecute(commandId, sourceChain, sourceAddress, payload, { value });
            await expect(expressTx).to.be.revertedWithCustomError(contract, 'ExpressExecutorAlreadySet');
        }

        async function expressFailure() {
            const expressTx = contract.expressExecute(commandId, sourceChain, sourceAddress, payload);
            await expect(expressTx).to.be.revertedWithCustomError(contract, 'AlreadyExecuted');
        }

        async function execution() {
            const executeTx = contract.execute(commandId, sourceChain, sourceAddress, payload);
            await expect(executeTx).to.emit(contract, 'Executed').withArgs(sourceChain, sourceAddress, payload);
        }

        async function executionFailure() {
            const executeTx = contract.execute(commandId, sourceChain, sourceAddress, payload);
            await expect(executeTx).to.be.revertedWithCustomError(contract, 'NotApprovedByGateway');
        }

        async function expressFullfill() {
            const balance = BigInt(await ownerWallet.provider.getBalance(ownerWallet.address));
            const executeTx = contract.connect(userWallet).execute(commandId, sourceChain, sourceAddress, payload);
            await expect(executeTx)
                .to.emit(contract, 'ExpressExecutionFulfilled')
                .withArgs(commandId, sourceChain, sourceAddress, payloadHash, ownerWallet.address)
                .and.to.not.emit(contract, 'Executed');
            const newBalance = BigInt(await ownerWallet.provider.getBalance(ownerWallet.address));
            expect(newBalance - balance).to.equal(value);
        }

        before(async () => {
            contract = valuedAxelarExpressExecutableTest;
            await valuedAxelarExpressExecutableTest.setCallValue(value).then((tx) => tx.wait());
            await valuedAxelarExpressExecutableTest.setExpressToken(AddressZero).then((tx) => tx.wait());
        });

        beforeEach(async () => {
            commandId = getRandomID();
        });

        it('should revert on deployment with invalid gateway address', async () => {
            await expect(valuedAxelarExpressExecutableTestFactory.deploy(AddressZero)).to.be.revertedWithCustomError(
                valuedAxelarExpressExecutableTest,
                'InvalidAddress',
            );
        });

        it('Should Execute without express', async () => {
            await approve();
            await execution();
        });

        it('Should not Execute without gateway approval', async () => {
            await executionFailure();
        });

        it('Should Execute with express before approval', async () => {
            await expressSuccess();
            await approve();
            await expressFullfill();
        });

        it('Should return the correct express executor slot', async () => {
            await expressSuccess();

            const slotPrefix = '0x2a41fec9a0df4e0996b975f71622c7164b0f652ea69d9dbcd6b24e81b20ab5e5';

            const predictedSlot = keccak256(
                defaultAbiCoder.encode(
                    ['bytes32', 'bytes32', 'string', 'string', 'bytes32'],
                    [slotPrefix, commandId, sourceChain, sourceAddress, payloadHash],
                ),
            );

            const valueAtSlot = await ethers.provider.getStorageAt(contract.address, predictedSlot);

            const predictedExecutorAddress = '0x' + valueAtSlot.slice(-40);

            const executorAddress = await contract.getExpressExecutor(
                commandId,
                sourceChain,
                sourceAddress,
                payloadHash,
            );

            expect(predictedExecutorAddress.toLowerCase()).to.eq(executorAddress.toLowerCase());

            await approve();
            await expressFullfill();

            const fullfilledExecutorAddress = await contract.getExpressExecutor(
                commandId,
                sourceChain,
                sourceAddress,
                payloadHash,
            );

            expect(fullfilledExecutorAddress).to.eq(AddressZero);
        });

        it('Should not Execute with express before approval without proper payment', async () => {
            await expressNotPayed();
        });

        it('Should not Execute with express after approval', async () => {
            await approve();
            await expressFailure();
            await execution();
        });

        it('Should not Execute with express after execution', async () => {
            await approve();
            await execution();
            await expressFailure();
        });
    });

    describe('AxelarValuedExpressExecutableTest Execute (ERC20)', () => {
        let commandId;
        let contract;
        const sourceTxHash = keccak256('0x123abc123abc');
        const sourceEventIndex = 17;
        const payload = '0x1234';
        const payloadHash = keccak256(payload);
        const sourceAddress = '0x5678';
        const value = 5678;

        async function approve() {
            const approveWithMintData = defaultAbiCoder.encode(
                ['string', 'string', 'address', 'bytes32', 'bytes32', 'uint256'],
                [sourceChain, sourceAddress, contract.address, payloadHash, sourceTxHash, sourceEventIndex],
            );
            const approveExecute = destinationChainGateway.approveContractCall(approveWithMintData, commandId);
            await expect(approveExecute)
                .to.emit(destinationChainGateway, 'ContractCallApproved')
                .withArgs(
                    commandId,
                    sourceChain,
                    sourceAddress,
                    contract.address,
                    payloadHash,
                    sourceTxHash,
                    sourceEventIndex,
                );
        }

        async function expressNotPayed() {
            const expressTx = contract.expressExecute(commandId, sourceChain, sourceAddress, payload);
            await expect(expressTx).to.be.revertedWithCustomError(contract, 'TokenTransferFailed');
        }

        async function expressSuccess() {
            await (await tokenB.approve(contract.address, value)).wait();
            let expressTx = contract.expressExecute(commandId, sourceChain, sourceAddress, payload);
            await expect(expressTx)
                .to.emit(tokenB, 'Transfer')
                .withArgs(ownerWallet.address, contract.address, value)
                .and.to.emit(contract, 'ExpressExecuted')
                .withArgs(commandId, sourceChain, sourceAddress, payloadHash, ownerWallet.address)
                .and.to.emit(contract, 'Executed')
                .withArgs(sourceChain, sourceAddress, payload);

            await (await tokenB.approve(contract.address, value)).wait();

            expressTx = contract.expressExecute(commandId, sourceChain, sourceAddress, payload);

            await expect(expressTx).to.be.revertedWithCustomError(contract, 'ExpressExecutorAlreadySet');

            await (await tokenB.approve(contract.address, 0)).wait();
        }

        async function expressFailure() {
            const expressTx = contract.expressExecute(commandId, sourceChain, sourceAddress, payload);
            await expect(expressTx).to.be.revertedWithCustomError(contract, 'AlreadyExecuted');
        }

        async function execution() {
            const executeTx = contract.execute(commandId, sourceChain, sourceAddress, payload);
            await expect(executeTx).to.emit(contract, 'Executed').withArgs(sourceChain, sourceAddress, payload);
        }

        async function expressFullfill() {
            const executeTx = contract.connect(userWallet).execute(commandId, sourceChain, sourceAddress, payload);
            await expect(executeTx)
                .to.emit(tokenB, 'Transfer')
                .withArgs(contract.address, ownerWallet.address, value)
                .and.to.emit(contract, 'ExpressExecutionFulfilled')
                .withArgs(commandId, sourceChain, sourceAddress, payloadHash, ownerWallet.address)
                .and.to.not.emit(contract, 'Executed');
        }

        before(async () => {
            contract = valuedAxelarExpressExecutableTest;
            await valuedAxelarExpressExecutableTest.setCallValue(value);
            await valuedAxelarExpressExecutableTest.setExpressToken(tokenB.address);
        });

        beforeEach(async () => {
            commandId = getRandomID();
        });

        it('Should Execute without express', async () => {
            await approve();
            await execution();
        });

        it('Should Execute with express before approval', async () => {
            await expressSuccess();
            await approve();
            await expressFullfill();
        });

        it('Should Execute with express before approval with zero token value', async () => {
            await expressSuccess(0);
            await approve();
            await expressFullfill(0);
        });

        it('Should not Execute with express before approval without proper payment', async () => {
            await expressNotPayed();
        });

        it('Should not Execute with express after approval', async () => {
            await approve();
            await expressFailure();
            await execution();
        });

        it('Should not Execute with express after execution', async () => {
            await approve();
            await execution();
            await expressFailure();
        });
    });

    describe('AxelarValuedExpressExecutableTest Execute With Token (native token)', () => {
        let commandId;
        let contract;
        const sourceTxHash = keccak256('0x123abc123abc');
        const sourceEventIndex = 17;
        const payload = '0x1234';
        const payloadHash = keccak256(payload);
        const sourceAddress = '0x5678';
        const tokenSymbol = symbolA;
        const amount = 1234;
        const value = 5678;

        async function approve() {
            const approveWithMintData = defaultAbiCoder.encode(
                ['string', 'string', 'address', 'bytes32', 'string', 'uint256', 'bytes32', 'uint256'],
                [
                    sourceChain,
                    sourceAddress,
                    contract.address,
                    payloadHash,
                    tokenSymbol,
                    amount,
                    sourceTxHash,
                    sourceEventIndex,
                ],
            );
            const approveExecute = destinationChainGateway.approveContractCallWithMint(approveWithMintData, commandId);
            await expect(approveExecute)
                .to.emit(destinationChainGateway, 'ContractCallApprovedWithMint')
                .withArgs(
                    commandId,
                    sourceChain,
                    sourceAddress,
                    contract.address,
                    payloadHash,
                    tokenSymbol,
                    amount,
                    sourceTxHash,
                    sourceEventIndex,
                );
        }

        async function expressSuccess() {
            await (await tokenA.connect(ownerWallet).approve(contract.address, amount)).wait();
            let expressTx = contract.expressExecuteWithToken(
                commandId,
                sourceChain,
                sourceAddress,
                payload,
                tokenSymbol,
                amount,
                {
                    value,
                },
            );
            await expect(expressTx)
                .to.emit(tokenA, 'Transfer')
                .withArgs(ownerWallet.address, contract.address, amount)
                .and.to.emit(contract, 'ExpressExecutedWithToken')
                .withArgs(commandId, sourceChain, sourceAddress, payloadHash, tokenSymbol, amount, ownerWallet.address)
                .and.to.emit(contract, 'ExecutedWithToken')
                .withArgs(sourceChain, sourceAddress, payload, tokenSymbol, amount);

            await (await tokenA.connect(ownerWallet).approve(contract.address, amount)).wait();

            expressTx = contract.expressExecuteWithToken(
                commandId,
                sourceChain,
                sourceAddress,
                payload,
                tokenSymbol,
                amount,
                { value },
            );
            await expect(expressTx).to.be.revertedWithCustomError(contract, 'ExpressExecutorAlreadySet');

            await (await tokenA.connect(ownerWallet).approve(contract.address, 0)).wait();
        }

        async function expressNotPayed() {
            await (await tokenA.approve(contract.address, amount)).wait();
            const expressTx = contract.expressExecuteWithToken(
                commandId,
                sourceChain,
                sourceAddress,
                payload,
                tokenSymbol,
                amount,
            );
            await expect(expressTx).to.be.revertedWithCustomError(contract, 'InsufficientValue');
            await (await tokenA.approve(contract.address, 0)).wait();
        }

        async function expressFailure() {
            const expressTx = contract.expressExecuteWithToken(
                commandId,
                sourceChain,
                sourceAddress,
                payload,
                tokenSymbol,
                amount,
            );
            await expect(expressTx).to.be.revertedWithCustomError(contract, 'AlreadyExecuted');
        }

        async function execution() {
            const executeTx = contract.executeWithToken(
                commandId,
                sourceChain,
                sourceAddress,
                payload,
                tokenSymbol,
                amount,
            );
            await expect(executeTx)
                .to.emit(tokenA, 'Transfer')
                .withArgs(destinationChainGateway.address, contract.address, amount)
                .and.to.emit(contract, 'ExecutedWithToken')
                .withArgs(sourceChain, sourceAddress, payload, tokenSymbol, amount);
        }

        async function expressFullfill() {
            const balance = BigInt(await ownerWallet.provider.getBalance(ownerWallet.address));
            const executeTx = contract
                .connect(userWallet)
                .executeWithToken(commandId, sourceChain, sourceAddress, payload, tokenSymbol, amount);
            await expect(executeTx)
                .to.emit(tokenA, 'Transfer')
                .withArgs(contract.address, ownerWallet.address, amount)
                .and.to.emit(contract, 'ExpressExecutionWithTokenFulfilled')
                .withArgs(commandId, sourceChain, sourceAddress, payloadHash, tokenSymbol, amount, ownerWallet.address)
                .and.to.not.emit(contract, 'ExecutedWithToken');
            const newBalance = BigInt(await ownerWallet.provider.getBalance(ownerWallet.address));
            expect(newBalance - balance).to.equal(value);
        }

        before(async () => {
            contract = valuedAxelarExpressExecutableTest;
            await valuedAxelarExpressExecutableTest.setCallValue(value);
            await valuedAxelarExpressExecutableTest.setExpressToken(AddressZero);
        });

        beforeEach(async () => {
            commandId = getRandomID();
        });

        it('Should Execute without express', async () => {
            await approve();
            await execution();
        });

        it('Should Execute with express before approval', async () => {
            await expressSuccess();
            await approve();
            await expressFullfill();
        });

        it('Should return the correct express executor with token slot', async () => {
            await expressSuccess();

            const slotPrefix = '0xebf4535caee8019297b7be3ed867db0d00b69fedcdda98c5e2c41ea6e41a98d5';

            const predictedSlot = keccak256(
                defaultAbiCoder.encode(
                    ['bytes32', 'bytes32', 'string', 'string', 'bytes32', 'string', 'uint256'],
                    [slotPrefix, commandId, sourceChain, sourceAddress, payloadHash, tokenSymbol, amount],
                ),
            );

            const valueAtSlot = await ethers.provider.getStorageAt(contract.address, predictedSlot);

            const predictedExecutorAddress = '0x' + valueAtSlot.slice(-40);

            const executorAddress = await contract.getExpressExecutorWithToken(
                commandId,
                sourceChain,
                sourceAddress,
                payloadHash,
                tokenSymbol,
                amount,
            );

            expect(predictedExecutorAddress.toLowerCase()).to.eq(executorAddress.toLowerCase());

            await approve();
            await expressFullfill();

            const fullfilledExecutorAddress = await contract.getExpressExecutorWithToken(
                commandId,
                sourceChain,
                sourceAddress,
                payloadHash,
                tokenSymbol,
                amount,
            );

            expect(fullfilledExecutorAddress).to.eq(AddressZero);
        });

        it('Should not Execute with express before approval without proper payment', async () => {
            await expressNotPayed();
        });

        it('Should not Execute with express after approval', async () => {
            await approve();
            await expressFailure();
            await execution();
        });

        it('Should not Execute with express after execution', async () => {
            await approve();
            await execution();
            await expressFailure();
        });
    });

    describe('AxelarValuedExpressExecutableTest Execute With Token (different ERC20)', () => {
        let commandId;
        let contract;
        const sourceTxHash = keccak256('0x123abc123abc');
        const sourceEventIndex = 17;
        const payload = '0x1234';
        const payloadHash = keccak256(payload);
        const sourceAddress = '0x5678';
        const tokenSymbol = symbolA;
        const amount = 1234;
        const value = 5678;

        async function approve() {
            const approveWithMintData = defaultAbiCoder.encode(
                ['string', 'string', 'address', 'bytes32', 'string', 'uint256', 'bytes32', 'uint256'],
                [
                    sourceChain,
                    sourceAddress,
                    contract.address,
                    payloadHash,
                    tokenSymbol,
                    amount,
                    sourceTxHash,
                    sourceEventIndex,
                ],
            );
            const approveExecute = destinationChainGateway.approveContractCallWithMint(approveWithMintData, commandId);
            await expect(approveExecute)
                .to.emit(destinationChainGateway, 'ContractCallApprovedWithMint')
                .withArgs(
                    commandId,
                    sourceChain,
                    sourceAddress,
                    contract.address,
                    payloadHash,
                    tokenSymbol,
                    amount,
                    sourceTxHash,
                    sourceEventIndex,
                );
        }

        async function expressSuccess() {
            await (await tokenA.connect(ownerWallet).approve(contract.address, amount)).wait();
            await (await tokenB.connect(ownerWallet).approve(contract.address, value)).wait();
            let expressTx = contract.expressExecuteWithToken(
                commandId,
                sourceChain,
                sourceAddress,
                payload,
                tokenSymbol,
                amount,
            );
            await expect(expressTx)
                .to.emit(tokenA, 'Transfer')
                .withArgs(ownerWallet.address, contract.address, amount)
                .and.to.emit(tokenB, 'Transfer')
                .withArgs(ownerWallet.address, contract.address, value)
                .and.to.emit(contract, 'ExpressExecutedWithToken')
                .withArgs(commandId, sourceChain, sourceAddress, payloadHash, tokenSymbol, amount, ownerWallet.address)
                .and.to.emit(contract, 'ExecutedWithToken')
                .withArgs(sourceChain, sourceAddress, payload, tokenSymbol, amount);

            await (await tokenA.connect(ownerWallet).approve(contract.address, amount)).wait();
            await (await tokenB.connect(ownerWallet).approve(contract.address, value)).wait();

            expressTx = contract.expressExecuteWithToken(
                commandId,
                sourceChain,
                sourceAddress,
                payload,
                tokenSymbol,
                amount,
            );
            await expect(expressTx).to.be.revertedWithCustomError(contract, 'ExpressExecutorAlreadySet');

            await (await tokenA.connect(ownerWallet).approve(contract.address, 0)).wait();
            await (await tokenB.connect(ownerWallet).approve(contract.address, 0)).wait();
        }

        async function expressNotPayed() {
            await (await tokenA.approve(contract.address, amount)).wait();
            const expressTx = contract.expressExecuteWithToken(
                commandId,
                sourceChain,
                sourceAddress,
                payload,
                tokenSymbol,
                amount,
            );
            await expect(expressTx).to.be.revertedWithCustomError(contract, 'TokenTransferFailed');
            await (await tokenA.approve(contract.address, 0)).wait();
        }

        async function expressFailure() {
            const expressTx = contract.expressExecuteWithToken(
                commandId,
                sourceChain,
                sourceAddress,
                payload,
                tokenSymbol,
                amount,
            );
            await expect(expressTx).to.be.revertedWithCustomError(contract, 'AlreadyExecuted');
        }

        async function execution() {
            const executeTx = contract.executeWithToken(
                commandId,
                sourceChain,
                sourceAddress,
                payload,
                tokenSymbol,
                amount,
            );
            await expect(executeTx)
                .to.emit(tokenA, 'Transfer')
                .withArgs(destinationChainGateway.address, contract.address, amount)
                .and.to.emit(contract, 'ExecutedWithToken')
                .withArgs(sourceChain, sourceAddress, payload, tokenSymbol, amount);
        }

        async function executionFailure() {
            const executeTx = contract.executeWithToken(
                commandId,
                sourceChain,
                sourceAddress,
                payload,
                tokenSymbol,
                amount,
            );
            await expect(executeTx).to.be.revertedWithCustomError(contract, 'NotApprovedByGateway');
        }

        async function expressFullfill() {
            const executeTx = contract
                .connect(userWallet)
                .executeWithToken(commandId, sourceChain, sourceAddress, payload, tokenSymbol, amount);
            await expect(executeTx)
                .to.emit(tokenA, 'Transfer')
                .withArgs(contract.address, ownerWallet.address, amount)
                .and.to.emit(tokenB, 'Transfer')
                .withArgs(contract.address, ownerWallet.address, value)
                .and.to.emit(contract, 'ExpressExecutionWithTokenFulfilled')
                .withArgs(commandId, sourceChain, sourceAddress, payloadHash, tokenSymbol, amount, ownerWallet.address)
                .and.to.not.emit(contract, 'ExecutedWithToken');
        }

        before(async () => {
            contract = valuedAxelarExpressExecutableTest;
            await valuedAxelarExpressExecutableTest.setCallValue(value);
            await valuedAxelarExpressExecutableTest.setExpressToken(tokenB.address);
        });

        beforeEach(async () => {
            commandId = getRandomID();
        });

        it('Should Execute without express', async () => {
            await approve();
            await execution();
        });

        it('Should not Execute without gateway approval', async () => {
            await executionFailure();
        });

        it('Should Execute with express before approval', async () => {
            await expressSuccess();
            await approve();
            await expressFullfill();
        });

        it('Should not Execute with express before approval without proper payment', async () => {
            await expressNotPayed();
        });

        it('Should not Execute with express after approval', async () => {
            await approve();
            await expressFailure();
            await execution();
        });

        it('Should not Execute with express after execution', async () => {
            await approve();
            await execution();
            await expressFailure();
        });
    });

    describe('AxelarValuedExpressExecutableTest Execute With Token (different ERC20)', () => {
        let commandId;
        let contract;
        const sourceTxHash = keccak256('0x123abc123abc');
        const sourceEventIndex = 17;
        const payload = '0x1234';
        const payloadHash = keccak256(payload);
        const sourceAddress = '0x5678';
        const tokenSymbol = symbolA;
        const amount = 1234;
        const value = 5678;

        async function approve() {
            const approveWithMintData = defaultAbiCoder.encode(
                ['string', 'string', 'address', 'bytes32', 'string', 'uint256', 'bytes32', 'uint256'],
                [
                    sourceChain,
                    sourceAddress,
                    contract.address,
                    payloadHash,
                    tokenSymbol,
                    amount,
                    sourceTxHash,
                    sourceEventIndex,
                ],
            );
            const approveExecute = destinationChainGateway.approveContractCallWithMint(approveWithMintData, commandId);
            await expect(approveExecute)
                .to.emit(destinationChainGateway, 'ContractCallApprovedWithMint')
                .withArgs(
                    commandId,
                    sourceChain,
                    sourceAddress,
                    contract.address,
                    payloadHash,
                    tokenSymbol,
                    amount,
                    sourceTxHash,
                    sourceEventIndex,
                );
        }

        async function expressSuccess() {
            await (await tokenA.connect(ownerWallet).approve(contract.address, amount + value)).wait();
            let expressTx = contract.expressExecuteWithToken(
                commandId,
                sourceChain,
                sourceAddress,
                payload,
                tokenSymbol,
                amount,
            );
            await expect(expressTx)
                .to.emit(tokenA, 'Transfer')
                .withArgs(ownerWallet.address, contract.address, amount)
                .to.emit(tokenA, 'Transfer')
                .withArgs(ownerWallet.address, contract.address, value)
                .and.to.emit(contract, 'ExpressExecutedWithToken')
                .withArgs(commandId, sourceChain, sourceAddress, payloadHash, tokenSymbol, amount, ownerWallet.address)
                .and.to.emit(contract, 'ExecutedWithToken')
                .withArgs(sourceChain, sourceAddress, payload, tokenSymbol, amount);

            await (await tokenA.connect(ownerWallet).approve(contract.address, amount + value)).wait();

            expressTx = contract.expressExecuteWithToken(
                commandId,
                sourceChain,
                sourceAddress,
                payload,
                tokenSymbol,
                amount,
            );
            await expect(expressTx).to.be.revertedWithCustomError(contract, 'ExpressExecutorAlreadySet');
            await (await tokenA.connect(ownerWallet).approve(contract.address, 0)).wait();
        }

        async function expressNotPayed() {
            await (await tokenA.approve(contract.address, amount)).wait();
            const expressTx = contract.expressExecuteWithToken(
                commandId,
                sourceChain,
                sourceAddress,
                payload,
                tokenSymbol,
                amount,
            );
            await expect(expressTx).to.be.revertedWithCustomError(contract, 'TokenTransferFailed');
            await (await tokenA.approve(contract.address, 0)).wait();
        }

        async function expressFailure() {
            const expressTx = contract.expressExecuteWithToken(
                commandId,
                sourceChain,
                sourceAddress,
                payload,
                tokenSymbol,
                amount,
            );
            await expect(expressTx).to.be.revertedWithCustomError(contract, 'AlreadyExecuted');
        }

        async function execution() {
            const executeTx = contract.executeWithToken(
                commandId,
                sourceChain,
                sourceAddress,
                payload,
                tokenSymbol,
                amount,
            );
            await expect(executeTx)
                .to.emit(tokenA, 'Transfer')
                .withArgs(destinationChainGateway.address, contract.address, amount)
                .and.to.emit(contract, 'ExecutedWithToken')
                .withArgs(sourceChain, sourceAddress, payload, tokenSymbol, amount);
        }

        async function expressFullfill() {
            const executeTx = contract
                .connect(userWallet)
                .executeWithToken(commandId, sourceChain, sourceAddress, payload, tokenSymbol, amount);
            await expect(executeTx)
                .to.emit(tokenA, 'Transfer')
                .withArgs(contract.address, ownerWallet.address, amount)
                .to.emit(tokenA, 'Transfer')
                .withArgs(contract.address, ownerWallet.address, value)
                .and.to.emit(contract, 'ExpressExecutionWithTokenFulfilled')
                .withArgs(commandId, sourceChain, sourceAddress, payloadHash, tokenSymbol, amount, ownerWallet.address)
                .and.to.not.emit(contract, 'ExecutedWithToken');
        }

        before(async () => {
            contract = valuedAxelarExpressExecutableTest;
            await valuedAxelarExpressExecutableTest.setCallValue(value);
            await valuedAxelarExpressExecutableTest.setExpressToken(tokenA.address);
        });

        beforeEach(async () => {
            commandId = getRandomID();
        });

        it('Should Execute without express', async () => {
            await approve();
            await execution();
        });

        it('Should Execute with express before approval', async () => {
            await expressSuccess();
            await approve();
            await expressFullfill();
        });

        it('Should not Execute with express before approval without proper payment', async () => {
            await expressNotPayed();
        });

        it('Should not Execute with express after approval', async () => {
            await approve();
            await expressFailure();
            await execution();
        });

        it('Should not Execute with express after execution', async () => {
            await approve();
            await execution();
            await expressFailure();
        });
    });
});
