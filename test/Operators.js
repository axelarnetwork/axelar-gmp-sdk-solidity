'use strict';

const chai = require('chai');
const { ethers } = require('hardhat');
const { getGasOptions } = require('./utils');
const { expect } = chai;

describe('Operators', () => {
  let ownerWallet;
  let userWallet;
  let operatorWallet;

  let operatorsFactory;
  let operators;

  let testFactory;
  let test;

  before(async () => {
    [ownerWallet, userWallet, operatorWallet] = await ethers.getSigners();

    operatorsFactory = await ethers.getContractFactory(
      'Operators',
      ownerWallet,
    );
    testFactory = await ethers.getContractFactory('TestOperators', ownerWallet);
  });

  beforeEach(async () => {
    operators = await operatorsFactory.deploy().then((d) => d.deployed());
    test = await testFactory.deploy().then((d) => d.deployed());
  });

  describe('owner actions', () => {
    it('should set deployer address as owner', async () => {
      expect(await operators.connect(ownerWallet).owner()).to.equal(
        ownerWallet.address,
      );
    });

    it('should return false from isOperator for non operator address', async () => {
      expect(
        await operators.connect(ownerWallet).isOperator(operatorWallet.address),
      ).to.be.false;
    });

    it('should revert if non owner adds operator', async () => {
      await expect(
        operators
          .connect(userWallet)
          .addOperator(operatorWallet.address, getGasOptions()),
      ).to.be.revertedWithCustomError(operators, 'NotOwner');
    });

    it('should add an operator', async () => {
      await expect(
        operators
          .connect(ownerWallet)
          .addOperator(operatorWallet.address, getGasOptions()),
      )
        .to.emit(operators, 'OperatorAdded')
        .withArgs(operatorWallet.address);
    });

    it('should return true from isOperator for operator address', async () => {
      await operators
        .connect(ownerWallet)
        .addOperator(operatorWallet.address, getGasOptions());
      expect(
        await operators.connect(ownerWallet).isOperator(operatorWallet.address),
      ).to.be.true;
    });

    it('should revert when adding invalid operator address', async () => {
      await expect(
        operators
          .connect(ownerWallet)
          .addOperator(ethers.constants.AddressZero, getGasOptions()),
      ).to.be.revertedWithCustomError(operators, 'InvalidOperator');
    });

    it('should not add same operator twice', async () => {
      await operators
        .connect(ownerWallet)
        .addOperator(operatorWallet.address, getGasOptions());

      await expect(
        operators
          .connect(ownerWallet)
          .addOperator(operatorWallet.address, getGasOptions()),
      ).to.be.revertedWithCustomError(operators, 'OperatorAlreadyAdded');
    });

    it('should revert if non owner removes operator', async () => {
      await expect(
        operators
          .connect(userWallet)
          .removeOperator(operatorWallet.address, getGasOptions()),
      ).to.be.revertedWithCustomError(operators, 'NotOwner');
    });

    it('should remove operator', async () => {
      console.log(JSON.stringify(getGasOptions()));
      await operators
        .connect(ownerWallet)
        .addOperator(operatorWallet.address, getGasOptions());

      await expect(
        operators
          .connect(ownerWallet)
          .removeOperator(operatorWallet.address, getGasOptions()),
      )
        .to.emit(operators, 'OperatorRemoved')
        .withArgs(operatorWallet.address);
    });

    it('should revert on remove operator with invalid address', async () => {
      await expect(
        operators
          .connect(ownerWallet)
          .removeOperator(ethers.constants.AddressZero, getGasOptions()),
      ).to.be.revertedWithCustomError(operators, 'InvalidOperator');
    });

    it('should revert when trying to remove non operator address', async () => {
      await operators
        .connect(ownerWallet)
        .addOperator(operatorWallet.address, getGasOptions());

      await expect(
        operators
          .connect(ownerWallet)
          .removeOperator(userWallet.address, getGasOptions()),
      ).to.be.revertedWithCustomError(operators, 'NotAnOperator');
    });

    it('should receive ether', async () => {
      const sendValue = 100;

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
    it('should revert when non operator calls execute', async () => {
      await operators.connect(ownerWallet).addOperator(operatorWallet.address);

      const target = test.address;
      const nativeValue = 0;
      const num = 10;

      const iface = new ethers.utils.Interface([
        'function setNum(uint256 _num) external returns (bool)',
      ]);

      const callData = iface.encodeFunctionData('setNum', [num]);

      await expect(
        operators
          .connect(ownerWallet)
          .execute(target, callData, nativeValue, getGasOptions()),
      ).to.be.revertedWithCustomError(operators, 'NotOperator');
    });

    it('should revert when execute fails', async () => {
      await operators.connect(ownerWallet).addOperator(operatorWallet.address);

      const target = test.address;
      const nativeValue = 0;
      const num = 10;

      // create typo in function name so execution fails
      const iface = new ethers.utils.Interface([
        'function set(uint256 _num) external returns (bool)',
      ]);

      const callData = iface.encodeFunctionData('set', [num]);

      await expect(
        operators
          .connect(operatorWallet)
          .execute(target, callData, nativeValue, getGasOptions()),
      ).to.be.revertedWithCustomError(operators, 'ExecutionFailed');
    });

    it('should execute and return correct data', async () => {
      await operators.connect(ownerWallet).addOperator(operatorWallet.address);

      const target = test.address;
      const nativeValue = 0;
      const num = 10;

      const iface = new ethers.utils.Interface([
        'function setNum(uint256 _num) external returns (bool)',
      ]);

      const callData = iface.encodeFunctionData('setNum', [num]);

      await expect(
        operators
          .connect(operatorWallet)
          .execute(target, callData, nativeValue, getGasOptions()),
      )
        .to.emit(test, 'NumAdded')
        .withArgs(num);
    });

    it('should execute with native value', async () => {
      await operators.connect(ownerWallet).addOperator(operatorWallet.address);

      const target = test.address;
      const nativeValue = 1000;
      const num = 10;

      const iface = new ethers.utils.Interface([
        'function setNum(uint256 _num) external returns (bool)',
      ]);

      const callData = iface.encodeFunctionData('setNum', [num]);
      const gasOptions = getGasOptions();

      await expect(
        operators
          .connect(operatorWallet)
          .execute(target, callData, nativeValue, {
            value: nativeValue,
            ...gasOptions,
          }),
      )
        .to.emit(test, 'NumAdded')
        .withArgs(num);

      const targetBalance = await ethers.provider.getBalance(target);

      expect(targetBalance).to.equal(nativeValue);
    });

    it('should execute with msg.value if nativeValue is zero', async () => {
      await operators.connect(ownerWallet).addOperator(operatorWallet.address);

      const target = test.address;
      const nativeValue = 0;
      const num = 10;

      const iface = new ethers.utils.Interface([
        'function setNum(uint256 _num) external returns (bool)',
      ]);

      const callData = iface.encodeFunctionData('setNum', [num]);
      const gasOptions = getGasOptions();

      await expect(
        operators
          .connect(operatorWallet)
          .execute(target, callData, nativeValue, {
            value: 1000,
            ...gasOptions,
          }),
      )
        .to.emit(test, 'NumAdded')
        .withArgs(num);

      const targetBalance = await ethers.provider.getBalance(target);

      expect(targetBalance).to.equal(1000);
    });
  });
});
