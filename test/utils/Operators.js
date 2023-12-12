'use strict';

const chai = require('chai');
const { ethers } = require('hardhat');
const { expect } = chai;
const { create2DeployContract } = require('../../scripts/create2Deployer');
const Operators = require('../../artifacts/contracts/utils/Operators.sol/Operators.json');

describe('Operators', () => {
    let ownerWallet;
    let operatorWallet;

    let operatorsFactory;
    let operators;

    let testFactory;

    let deployerFactory;
    let deployer;

    before(async () => {
        [ownerWallet, operatorWallet] = await ethers.getSigners();

        operatorsFactory = await ethers.getContractFactory('Operators', ownerWallet);

        testFactory = await ethers.getContractFactory('TestOperators', ownerWallet);

        deployerFactory = await ethers.getContractFactory('Create2Deployer', ownerWallet);

        deployer = (await deployerFactory.deploy().then((d) => d.deployed())).address;
    });

    describe('owner actions', () => {
        beforeEach(async () => {
            operators = await operatorsFactory.deploy(ownerWallet.address).then((d) => d.deployed());
        });

        it('should set owner to correct address', async () => {
            expect(await operators.owner()).to.equal(ownerWallet.address);
        });

        it('should revert if non owner adds or removes an operator', async () => {
            expect(await operators.isOperator(operatorWallet.address)).to.be.false;

            await expect(
                operators.connect(operatorWallet).addOperator(operatorWallet.address),
            ).to.be.revertedWithCustomError(operators, 'NotOwner');

            await expect(
                operators.connect(operatorWallet).removeOperator(operatorWallet.address),
            ).to.be.revertedWithCustomError(operators, 'NotOwner');
        });

        it('should be able to add and remove an operator', async () => {
            await expect(operators.connect(ownerWallet).addOperator(operatorWallet.address))
                .to.emit(operators, 'OperatorAdded')
                .withArgs(operatorWallet.address);

            expect(await operators.connect(ownerWallet).isOperator(operatorWallet.address)).to.be.true;

            await expect(operators.connect(ownerWallet).removeOperator(operatorWallet.address))
                .to.emit(operators, 'OperatorRemoved')
                .withArgs(operatorWallet.address);
        });

        it('should revert when adding or removing invalid operator address', async () => {
            await expect(
                operators.connect(ownerWallet).addOperator(ethers.constants.AddressZero),
            ).to.be.revertedWithCustomError(operators, 'InvalidOperator');

            await expect(
                operators.connect(ownerWallet).removeOperator(ethers.constants.AddressZero),
            ).to.be.revertedWithCustomError(operators, 'InvalidOperator');
        });

        it('should not add same operator twice', async () => {
            await operators
                .connect(ownerWallet)
                .addOperator(operatorWallet.address)
                .then((tx) => tx.wait());

            await expect(
                operators.connect(ownerWallet).addOperator(operatorWallet.address),
            ).to.be.revertedWithCustomError(operators, 'OperatorAlreadyAdded');
        });

        it('should revert when trying to remove non operator address', async () => {
            await expect(
                operators.connect(ownerWallet).removeOperator(operatorWallet.address),
            ).to.be.revertedWithCustomError(operators, 'NotAnOperator');
        });

        it('should be able to transfer owner', async () => {
            await expect(operators.connect(ownerWallet).transferOwnership(operatorWallet.address))
                .to.emit(operators, 'OwnershipTransferred')
                .withArgs(operatorWallet.address);
        });

        it('should receive ether', async () => {
            const sendValue = 10;

            const initBalance = await ethers.provider.getBalance(operators.address);
            expect(initBalance).to.equal(0);

            await ownerWallet
                .sendTransaction({
                    to: operators.address,
                    value: sendValue,
                })
                .then((tx) => tx.wait());

            const finalBalance = await ethers.provider.getBalance(operators.address);
            expect(finalBalance).to.equal(sendValue);
        });
    });

    describe('operator actions', () => {
        let test;
        let testI;
        let target;
        let callData;
        let num;

        beforeEach(async () => {
            operators = await operatorsFactory.deploy(ownerWallet.address).then((d) => d.deployed());
            test = await testFactory.deploy().then((d) => d.deployed());
            testI = new ethers.utils.Interface(test.interface.fragments);

            await operators
                .connect(ownerWallet)
                .addOperator(operatorWallet.address)
                .then((tx) => tx.wait());

            target = test.address;
            num = 10;
            callData = testI.encodeFunctionData('setNum', [num]);
        });

        it('should revert when non operator calls execute', async () => {
            const nativeValue = 0;

            await expect(
                operators.connect(ownerWallet).executeContract(target, callData, nativeValue),
            ).to.be.revertedWithCustomError(operators, 'NotOperator');
        });

        it('should revert when execute fails', async () => {
            const nativeValue = 0;

            // create typo in function name so execution fails
            const iface = new ethers.utils.Interface(['function set(uint256 num) external returns (bool)']);

            const invalidCallData = iface.encodeFunctionData('set', [num]);

            await expect(
                operators.connect(operatorWallet).executeContract(target, invalidCallData, nativeValue),
            ).to.be.revertedWithCustomError(operators, 'ExecutionFailed');
        });

        it('should execute and return correct data', async () => {
            const nativeValue = 0;

            await expect(operators.connect(operatorWallet).executeContract(target, callData, nativeValue))
                .to.emit(test, 'NumAdded')
                .withArgs(num);
        });

        it('should execute with native value', async () => {
            const nativeValue = 10;

            await expect(
                operators.connect(operatorWallet).executeContract(target, callData, nativeValue, {
                    value: nativeValue,
                }),
            )
                .to.emit(test, 'NumAdded')
                .withArgs(num);

            const targetBalance = await ethers.provider.getBalance(target);

            expect(targetBalance).to.equal(nativeValue);
        });

        it('should execute with msg.value if nativeValue is zero', async () => {
            const nativeValue = 0;
            const msgValue = 10;

            await expect(
                operators.connect(operatorWallet).executeContract(target, callData, nativeValue, {
                    value: msgValue,
                }),
            )
                .to.emit(test, 'NumAdded')
                .withArgs(num);

            const targetBalance = await ethers.provider.getBalance(target);

            expect(targetBalance).to.equal(msgValue);
        });
    });

    describe('custom deployer', () => {
        before(async () => {
            const key = 'Operators';

            operators = await create2DeployContract(deployer, ownerWallet, Operators, key, [ownerWallet.address]);
        });

        it('should set owner to correct address', async () => {
            expect(await operators.owner()).to.equal(ownerWallet.address);
        });

        it('should be able to add an operator', async () => {
            await expect(operators.connect(ownerWallet).addOperator(operatorWallet.address))
                .to.emit(operators, 'OperatorAdded')
                .withArgs(operatorWallet.address);

            expect(await operators.connect(ownerWallet).isOperator(operatorWallet.address)).to.be.true;
        });

        it('should be able to transfer owner', async () => {
            await expect(operators.connect(ownerWallet).transferOwnership(operatorWallet.address))
                .to.emit(operators, 'OwnershipTransferred')
                .withArgs(operatorWallet.address);
        });
    });
});
