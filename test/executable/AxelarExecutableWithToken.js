'use strict';

const chai = require('chai');
const {
    utils: { defaultAbiCoder, toUtf8Bytes, keccak256, id },
} = require('ethers');
const { expect } = chai;
const { ethers } = require('hardhat');
const getRandomID = () => id(Math.floor(Math.random() * 1e10).toString());

describe('AxelarExecutableWithToken', () => {
    let gatewayFactory;
    let tokenFactory;

    let destinationChainGateway;
    let tokenA;

    let AxelarExecutableWithTokenFactory;
    let AxelarExecutableWithToken;

    let ownerWallet;
    let userWallet;

    const sourceChain = 'chainA';
    const nameA = 'testTokenX';
    const symbolA = 'testTokenX';
    const decimals = 16;
    const capacity = 0;
    const num = 10;

    before(async () => {
        [ownerWallet, userWallet] = await ethers.getSigners();
        gatewayFactory = await ethers.getContractFactory('MockGateway', ownerWallet);
        tokenFactory = await ethers.getContractFactory('ERC20MintableBurnable', ownerWallet);
        AxelarExecutableWithTokenFactory = await ethers.getContractFactory(
            'AxelarExecutableWithTokenTest',
            ownerWallet,
        );
    });

    describe('AxelarAxelarExecutableWithToken', () => {
        describe('Call Contract with Token', () => {
            beforeEach(async () => {
                destinationChainGateway = await gatewayFactory.deploy().then((d) => d.deployed());

                tokenA = await tokenFactory.deploy(nameA, symbolA, decimals).then((d) => d.deployed());

                await destinationChainGateway
                    .deployToken(
                        defaultAbiCoder.encode(
                            ['string', 'string', 'uint8', 'uint256', ' address', 'uint256'],
                            [nameA, symbolA, decimals, capacity, tokenA.address, 0],
                        ),
                        keccak256('0x'),
                    )
                    .then((t) => t.wait());

                AxelarExecutableWithToken = await AxelarExecutableWithTokenFactory.deploy(
                    destinationChainGateway.address,
                ).then((d) => d.deployed());

                await tokenA.mint(destinationChainGateway.address, 1e9).then((t) => t.wait());
                await tokenA.mint(userWallet.address, 1e9).then((t) => t.wait());
            });

            it('should revert without gateway approval', async () => {
                const swapAmount = 1e6;
                const payload = defaultAbiCoder.encode(['uint256'], [num]);

                const approveCommandId = getRandomID();

                const execute = AxelarExecutableWithToken.executeWithToken(
                    approveCommandId,
                    sourceChain,
                    userWallet.address.toString(),
                    payload,
                    symbolA,
                    swapAmount,
                );
                await expect(execute).to.be.revertedWithCustomError(AxelarExecutableWithToken, 'NotApprovedByGateway');
            });

            it('should execute with token on remote chain', async () => {
                const swapAmount = 1e6;
                const payload = defaultAbiCoder.encode(['uint256'], [num]);
                const payloadHash = keccak256(payload);

                const approveCommandId = getRandomID();
                const sourceTxHash = keccak256('0x123abc123abc');
                const sourceEventIndex = 17;
                const userWalletAddress = userWallet.address.toString();

                const approveWithMintData = defaultAbiCoder.encode(
                    ['string', 'string', 'address', 'bytes32', 'string', 'uint256', 'bytes32', 'uint256'],
                    [
                        sourceChain,
                        userWallet.address,
                        AxelarExecutableWithToken.address,
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
                        userWalletAddress,
                        AxelarExecutableWithToken.address,
                        payloadHash,
                        symbolA,
                        swapAmount,
                        sourceTxHash,
                        sourceEventIndex,
                    );

                const execute = await AxelarExecutableWithToken.executeWithToken(
                    approveCommandId,
                    sourceChain,
                    userWalletAddress,
                    payload,
                    symbolA,
                    swapAmount,
                );

                await expect(execute)
                    .to.emit(AxelarExecutableWithToken, 'InterchainTransferReceived')
                    .withArgs(
                        sourceChain,
                        userWalletAddress,
                        toUtf8Bytes(userWalletAddress),
                        AxelarExecutableWithToken.address,
                        await destinationChainGateway.tokenAddresses(symbolA),
                        swapAmount,
                    );
            });
        });

        describe('Call Contract', () => {
            beforeEach(async () => {
                destinationChainGateway = await gatewayFactory.deploy().then((d) => d.deployed());

                AxelarExecutableWithToken = await AxelarExecutableWithTokenFactory.deploy(
                    destinationChainGateway.address,
                ).then((d) => d.deployed());
            });

            it('should revert without gateway approval', async () => {
                const payload = defaultAbiCoder.encode(['uint256'], [num]);

                const approveCommandId = getRandomID();

                const receive = AxelarExecutableWithToken.execute(
                    approveCommandId,
                    sourceChain,
                    userWallet.address.toString(),
                    payload,
                );

                await expect(receive).to.be.revertedWithCustomError(AxelarExecutableWithToken, 'NotApprovedByGateway');
            });

            it('should call contract on another chain', async () => {
                const payload = defaultAbiCoder.encode(['uint256'], [num]);
                const payloadHash = keccak256(payload);

                const approveCommandId = getRandomID();
                const sourceTxHash = keccak256('0x123abc123abc');
                const sourceEventIndex = 17;

                const approveData = defaultAbiCoder.encode(
                    ['string', 'string', 'address', 'bytes32', 'bytes32', 'uint256'],
                    [
                        sourceChain,
                        userWallet.address,
                        AxelarExecutableWithToken.address,
                        payloadHash,
                        sourceTxHash,
                        sourceEventIndex,
                    ],
                );

                const approveExecute = await destinationChainGateway.approveContractCall(approveData, approveCommandId);

                await expect(approveExecute)
                    .to.emit(destinationChainGateway, 'ContractCallApproved')
                    .withArgs(
                        approveCommandId,
                        sourceChain,
                        userWallet.address.toString(),
                        AxelarExecutableWithToken.address,
                        payloadHash,
                        sourceTxHash,
                        sourceEventIndex,
                    );

                const receive = await AxelarExecutableWithToken.execute(
                    approveCommandId,
                    sourceChain,
                    userWallet.address.toString(),
                    payload,
                );

                await expect(receive).to.emit(AxelarExecutableWithToken, 'Received').withArgs(num);
            });
        });
    });
});
