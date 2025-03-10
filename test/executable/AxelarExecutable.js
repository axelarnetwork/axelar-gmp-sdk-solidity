'use strict';

const chai = require('chai');
const {
    utils: { defaultAbiCoder, keccak256, id },
} = require('ethers');
const { expect } = chai;
const { ethers } = require('hardhat');
const {
    constants: { AddressZero },
} = ethers;
const getRandomID = () => id(Math.floor(Math.random() * 1e10).toString());

describe('AxelarExecutable', () => {
    let gatewayFactory;
    let destinationChainGateway;
    let executableFactory;
    let executable;
    let ownerWallet;
    let userWallet;

    const sourceChain = 'chainA';
    const num = 10;

    before(async () => {
        [ownerWallet, userWallet] = await ethers.getSigners();

        gatewayFactory = await ethers.getContractFactory('MockGateway', ownerWallet);
        executableFactory = await ethers.getContractFactory('AxelarExecutableTest', ownerWallet);
    });

    describe('AxelarAxelarExecutable', () => {
        describe('Call Contract', () => {
            beforeEach(async () => {
                destinationChainGateway = await gatewayFactory.deploy().then((d) => d.deployed());

                executable = await executableFactory.deploy(destinationChainGateway.address).then((d) => d.deployed());
            });

            it('should revert when deployed with empty gateway', async () => {
                try {
                    await executableFactory.deploy(AddressZero);
                } catch (e) {
                    expect(e.message).to.contain('InvalidAddress');
                }
            });

            it('should revert without gateway approval', async () => {
                const payload = defaultAbiCoder.encode(['uint256'], [num]);

                const approveCommandId = getRandomID();

                const receive = executable.execute(
                    approveCommandId,
                    sourceChain,
                    userWallet.address.toString(),
                    payload,
                );

                await expect(receive).to.be.revertedWithCustomError(executable, 'NotApprovedByGateway');
            });

            it('should call contract on another chain', async () => {
                const payload = defaultAbiCoder.encode(['uint256'], [num]);
                const payloadHash = keccak256(payload);

                const approveCommandId = getRandomID();
                const sourceTxHash = keccak256('0x123abc123abc');
                const sourceEventIndex = 17;

                const approveData = defaultAbiCoder.encode(
                    ['string', 'string', 'address', 'bytes32', 'bytes32', 'uint256'],
                    [sourceChain, userWallet.address, executable.address, payloadHash, sourceTxHash, sourceEventIndex],
                );

                const approveExecute = await destinationChainGateway.approveContractCall(approveData, approveCommandId);

                await expect(approveExecute)
                    .to.emit(destinationChainGateway, 'ContractCallApproved')
                    .withArgs(
                        approveCommandId,
                        sourceChain,
                        userWallet.address.toString(),
                        executable.address,
                        payloadHash,
                        sourceTxHash,
                        sourceEventIndex,
                    );

                const receive = await executable.execute(
                    approveCommandId,
                    sourceChain,
                    userWallet.address.toString(),
                    payload,
                );

                await expect(receive).to.emit(executable, 'Received').withArgs(num);
            });
        });
    });
});
