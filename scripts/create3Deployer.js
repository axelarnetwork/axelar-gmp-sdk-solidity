'use strict';

const {
  Contract,
  ContractFactory,
  utils: { keccak256, defaultAbiCoder },
} = require('ethers');

const Create3Deployer = require('../dist/Create3Deployer.json');

const getSaltFromKey = (key) => {
  return keccak256(defaultAbiCoder.encode(['string'], [key.toString()]));
};

const estimateGasForCreate3Deploy = async (
  deployer,
  contractJson,
  args = [],
) => {
  const salt = getSaltFromKey('');
  const factory = new ContractFactory(contractJson.abi, contractJson.bytecode);
  const bytecode = factory.getDeployTransaction(...args).data;
  return await deployer.estimateGas.deploy(bytecode, salt);
};

const estimateGasForCreate3DeployAndInit = async (
  deployer,
  wallet,
  contractJson,
  args = [],
  initArgs = [],
) => {
  const salt = getSaltFromKey('');
  const factory = new ContractFactory(contractJson.abi, contractJson.bytecode);
  const bytecode = factory.getDeployTransaction(...args).data;

  const address = await deployer.deployedAddress(
    bytecode,
    wallet.address,
    salt,
  );
  const contract = new Contract(address, contractJson.abi, wallet);
  const initData = (await contract.populateTransaction.init(...initArgs)).data;
  return await deployer.estimateGas.deployAndInit(bytecode, salt, initData);
};

const deployCreate3Contract = async (
  deployerAddress,
  wallet,
  contractJson,
  key,
  args = [],
  txOptions = null,
) => {
  if (txOptions && !Number.isNaN(Number(txOptions))) {
    txOptions = {
      gasLimit: txOptions,
    };
  }

  const deployer = new Contract(deployerAddress, Create3Deployer.abi, wallet);
  const salt = getSaltFromKey(key);
  const factory = new ContractFactory(contractJson.abi, contractJson.bytecode);
  const bytecode = factory.getDeployTransaction(...args).data;
  const tx = await deployer.connect(wallet).deploy(bytecode, salt, txOptions);
  await tx.wait();
  const address = await deployer.deployedAddress(wallet.address, salt);
  return new Contract(address, contractJson.abi, wallet);
};

const deployCreate3AndInitContract = async (
  deployerAddress,
  wallet,
  contractJson,
  key,
  args = [],
  initArgs = [],
  txOptions = null,
) => {
  if (txOptions && !Number.isNaN(Number(txOptions))) {
    txOptions = {
      gasLimit: txOptions,
    };
  }

  const deployer = new Contract(deployerAddress, Create3Deployer.abi, wallet);
  const salt = getSaltFromKey(key);
  const factory = new ContractFactory(contractJson.abi, contractJson.bytecode);
  const bytecode = factory.getDeployTransaction(...args).data;
  const address = await deployer.deployedAddress(wallet.address, salt);
  const contract = new Contract(address, contractJson.abi, wallet);
  const initData = (await contract.populateTransaction.init(...initArgs)).data;
  const tx = await deployer
    .connect(wallet)
    .deployAndInit(bytecode, salt, initData, txOptions);
  await tx.wait();
  return contract;
};

const getCreate3Address = async (deployerAddress, wallet, key) => {
  const deployer = new Contract(deployerAddress, Create3Deployer.abi, wallet);
  const salt = getSaltFromKey(key);

  return await deployer.deployedAddress(wallet.address, salt);
};

module.exports = {
  estimateGasForCreate3Deploy,
  estimateGasForCreate3DeployAndInit,
  deployCreate3Contract,
  deployCreate3AndInitContract,
  getCreate3Address,
};
