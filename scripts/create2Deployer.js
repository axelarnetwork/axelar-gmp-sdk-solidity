'use strict';

const { Contract, ContractFactory } = require('ethers');
const { getSaltFromKey } = require('./utils');

const Create2Deployer = require('../artifacts/contracts/interfaces/ICreate2Deployer.sol/ICreate2Deployer.json');

const estimateGasForCreate2Deploy = async (
  deployer,
  contractJson,
  args = [],
) => {
  const salt = getSaltFromKey('');
  const factory = new ContractFactory(contractJson.abi, contractJson.bytecode);
  const bytecode = factory.getDeployTransaction(...args).data;
  return await deployer.estimateGas.deploy(bytecode, salt);
};

const estimateGasForCreate2DeployAndInit = async (
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

const create2DeployContract = async (
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

  const deployer = new Contract(deployerAddress, Create2Deployer.abi, wallet);
  const salt = getSaltFromKey(key);
  const factory = new ContractFactory(contractJson.abi, contractJson.bytecode);
  const bytecode = factory.getDeployTransaction(...args).data;
  const tx = await deployer.connect(wallet).deploy(bytecode, salt, txOptions);
  await tx.wait();
  const address = await deployer.deployedAddress(
    bytecode,
    wallet.address,
    salt,
  );
  return new Contract(address, contractJson.abi, wallet);
};

const create2DeployAndInitContract = async (
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

  const deployer = new Contract(deployerAddress, Create2Deployer.abi, wallet);
  const salt = getSaltFromKey(key);
  const factory = new ContractFactory(contractJson.abi, contractJson.bytecode);
  const bytecode = factory.getDeployTransaction(...args).data;
  const address = await deployer.deployedAddress(
    bytecode,
    wallet.address,
    salt,
  );
  const contract = new Contract(address, contractJson.abi, wallet);
  const initData = (await contract.populateTransaction.init(...initArgs)).data;
  const tx = await deployer
    .connect(wallet)
    .deployAndInit(bytecode, salt, initData, txOptions);
  await tx.wait();
  return contract;
};

const getCreate2Address = async (
  deployerAddress,
  wallet,
  contractJson,
  key,
  args = [],
) => {
  const deployer = new Contract(deployerAddress, Create2Deployer.abi, wallet);
  const salt = getSaltFromKey(key);

  const factory = new ContractFactory(contractJson.abi, contractJson.bytecode);
  const bytecode = factory.getDeployTransaction(...args).data;
  return await deployer.deployedAddress(bytecode, wallet.address, salt);
};

module.exports = {
  estimateGasForCreate2Deploy,
  estimateGasForCreate2DeployAndInit,
  create2DeployContract,
  create2DeployAndInitContract,
  getCreate2Address,
};
