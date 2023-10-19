'use strict';

const { config, ethers, network } = require('hardhat');
const {
  utils: { defaultAbiCoder, id, arrayify, keccak256 },
} = ethers;
const { sortBy } = require('lodash');

const getRandomInt = (max) => {
  return Math.floor(Math.random() * max);
};

const getEVMVersion = () => {
  return config.solidity.compilers[0].settings.evmVersion;
};

const getGasOptions = () => {
  return network.config.blockGasLimit
    ? { gasLimit: network.config.blockGasLimit.toString() }
    : { gasLimit: 5e6 }; // defaults to 5M gas for revert tests to work correctly
};

const isHardhat = network.name === 'hardhat';

const getPayloadAndProposalHash = async (
  commandID,
  target,
  nativeValue,
  calldata,
  timeDelay,
) => {
  let eta;

  if (timeDelay) {
    const block = await ethers.provider.getBlock('latest');
    eta = block.timestamp + timeDelay - 12; // 12 second buffer for live network tests
  } else {
    eta = 0;
  }

  const proposalHash = keccak256(
    defaultAbiCoder.encode(
      ['address', 'bytes', 'uint256'],
      [target, calldata, nativeValue],
    ),
  );

  const payload = defaultAbiCoder.encode(
    ['uint256', 'address', 'bytes', 'uint256', 'uint256'],
    [commandID, target, calldata, nativeValue, eta],
  );

  return [payload, proposalHash, eta];
};

const waitFor = async (timeDelay) => {
  if (isHardhat) {
    await network.provider.send('evm_increaseTime', [timeDelay]);
    await network.provider.send('evm_mine');
  } else {
    await new Promise((resolve) => setTimeout(resolve, timeDelay * 1000));
  }
};

async function deployContract(wallet, contractName, args = []) {
  const factory = await ethers.getContractFactory(contractName, wallet);
  const contract = await factory.deploy(...args);
  await contract.deployTransaction.wait(network.config.confirmations);
  return contract;
}

module.exports = {
  bigNumberToNumber: (bigNumber) => bigNumber.toNumber(),

  getEVMVersion,

  getGasOptions,

  getSignedExecuteInput: (data, wallet) =>
    wallet
      .signMessage(arrayify(keccak256(data)))
      .then((signature) =>
        defaultAbiCoder.encode(['bytes', 'bytes'], [data, signature]),
      ),

  getSignedMultisigExecuteInput: (data, wallets) =>
    Promise.all(
      sortBy(wallets, (wallet) => wallet.address.toLowerCase()).map((wallet) =>
        wallet.signMessage(arrayify(keccak256(data))),
      ),
    ).then((signatures) =>
      defaultAbiCoder.encode(['bytes', 'bytes[]'], [data, signatures]),
    ),

  getRandomInt,

  getRandomID: () => id(getRandomInt(1e10).toString()),

  tickBlockTime: (provider, seconds) =>
    provider.send('evm_increaseTime', [seconds]),

  isHardhat,

  getPayloadAndProposalHash,

  waitFor,

  deployContract,
};
