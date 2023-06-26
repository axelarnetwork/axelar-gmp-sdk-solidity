'use strict';

const chai = require('chai');
const {
  utils: { defaultAbiCoder, keccak256 },
} = require('ethers');
const { expect } = chai;
const { ethers, network } = require('hardhat');
const { HashZero } = ethers.constants;

describe('TimeLock', async () => {
  let owner;

  let timeLockFactory;
  let timeLock;

  before(async () => {
    [owner] = await ethers.getSigners();
  });

  beforeEach(async () => {
    timeLockFactory = await ethers.getContractFactory('TimeLockTest', owner);

    // 12 hour buffer
    const buffer = 12 * 60 * 60;

    timeLock = await timeLockFactory.deploy(buffer).then((d) => d.deployed());
  });

  it('should revert when scheduling a timelock with invalid hash', async () => {
    const eta = 12 * 60 * 60;

    await expect(
      timeLock.scheduleSetNum(HashZero, eta),
    ).to.be.revertedWithCustomError(timeLock, 'InvalidTimeLockHash');
  });

  it('should successfully schedule a timelock', async () => {
    const num = 5;
    const numParam = defaultAbiCoder.encode(['uint256'], [num]);
    const numHash = keccak256(numParam);
    const timeDelay = 13 * 60 * 60;

    const block = await ethers.provider.getBlock('latest');
    const eta = block.timestamp + timeDelay;

    await timeLock.scheduleSetNum(numHash, eta).then((tx) => tx.wait());

    const etaTimeLock = await timeLock.getTimeLock(numHash);
    expect(etaTimeLock).to.equal(eta);
  });

  it('should set the timelock to the minimum time delay if the time delay provided is too low', async () => {
    const num = 5;
    const numParam = defaultAbiCoder.encode(['uint256'], [num]);
    const numHash = keccak256(numParam);
    const minTimeDelay = 12 * 60 * 60;
    const timeDelay = 2 * 60 * 60;

    const block = await ethers.provider.getBlock('latest');
    const eta = block.timestamp + timeDelay;

    await timeLock.scheduleSetNum(numHash, eta).then((tx) => tx.wait());

    const minEta = block.timestamp + minTimeDelay;

    const etaTimeLock = await timeLock.getTimeLock(numHash);

    // allow for small block timestamp disparity
    expect(Math.abs(etaTimeLock - minEta)).to.be.lessThanOrEqual(5);
  });

  it('should revert when scheduling the same timelock twice', async () => {
    const num = 5;
    const numParam = defaultAbiCoder.encode(['uint256'], [num]);
    const numHash = keccak256(numParam);
    const timeDelay = 13 * 60 * 60;

    const block = await ethers.provider.getBlock('latest');
    const eta = block.timestamp + timeDelay;

    await timeLock.scheduleSetNum(numHash, eta).then((tx) => tx.wait());

    await expect(
      timeLock.scheduleSetNum(numHash, eta),
    ).to.be.revertedWithCustomError(timeLock, 'TimeLockAlreadyScheduled');
  });

  it('should revert when cancelling a timelock with invalid hash', async () => {
    await expect(timeLock.cancelSetNum(HashZero)).to.be.revertedWithCustomError(
      timeLock,
      'InvalidTimeLockHash',
    );
  });

  it('should cancel a timelock', async () => {
    const num = 5;
    const numParam = defaultAbiCoder.encode(['uint256'], [num]);
    const numHash = keccak256(numParam);
    const timeDelay = 13 * 60 * 60;

    const block = await ethers.provider.getBlock('latest');
    const eta = block.timestamp + timeDelay;

    await timeLock.scheduleSetNum(numHash, eta).then((tx) => tx.wait());

    const etaTimeLock = await timeLock.getTimeLock(numHash);
    expect(etaTimeLock).to.equal(eta);

    await timeLock.cancelSetNum(numHash).then((tx) => tx.wait());

    const cancelledEta = await timeLock.getTimeLock(numHash);
    expect(cancelledEta).to.equal(0);
  });

  it('should revert on executing a timelock with invalid hash', async () => {
    const num = 5;

    await expect(timeLock.setNum(HashZero, num)).to.be.revertedWithCustomError(
      timeLock,
      'InvalidTimeLockHash',
    );
  });

  it('should revert on executing a timelock that has never been created', async () => {
    const num = 5;
    const numParam = defaultAbiCoder.encode(['uint256'], [num]);
    const numHash = keccak256(numParam);

    await expect(timeLock.setNum(numHash, num)).to.be.revertedWithCustomError(
      timeLock,
      'InvalidTimeLockHash',
    );
  });

  it('should revert on executing a timelock if buffer period has not passed', async () => {
    const num = 5;
    const numParam = defaultAbiCoder.encode(['uint256'], [num]);
    const numHash = keccak256(numParam);
    const timeDelay = 13 * 60 * 60;

    const block = await ethers.provider.getBlock('latest');
    const eta = block.timestamp + timeDelay;

    await timeLock.scheduleSetNum(numHash, eta).then((tx) => tx.wait());

    const etaTimeLock = await timeLock.getTimeLock(numHash);
    expect(etaTimeLock).to.equal(eta);

    await expect(timeLock.setNum(numHash, num)).to.be.revertedWithCustomError(
      timeLock,
      'TimeLockNotReady',
    );
  });

  it('should execute timelock if buffer period has passed', async () => {
    const num = 5;
    const numParam = defaultAbiCoder.encode(['uint256'], [num]);
    const numHash = keccak256(numParam);
    const timeDelay = 13 * 60 * 60;

    const block = await ethers.provider.getBlock('latest');
    const eta = block.timestamp + timeDelay;

    await timeLock.scheduleSetNum(numHash, eta).then((tx) => tx.wait());

    const etaTimeLock = await timeLock.getTimeLock(numHash);
    expect(etaTimeLock).to.equal(eta);

    await network.provider.send('evm_increaseTime', [timeDelay]);
    await network.provider.send('evm_mine');

    await expect(timeLock.setNum(numHash, num))
      .to.emit(timeLock, 'NumUpdated')
      .withArgs(num);

    const newNum = await timeLock.getNum();
    expect(newNum).to.equal(num);
  });
});
