'use strict';

const {
  Contract,
  ContractFactory,
  utils: { keccak256, defaultAbiCoder },
  providers: { Web3Provider },
  Wallet,
} = require('ethers');
const ganache = require('ganache');

const Create3Deployer = require('../dist/Create3Deployer.json');

const getSaltFromKey = (key) => {
  return keccak256(defaultAbiCoder.encode(['string'], [key.toString()]));
};

const estimateGasForCreate3Deploy = async (contractJson, args = []) => {
  const key = keccak256(0);
  const ganacheProvider = ganache.provider({
    wallet: { accounts: [{ balance: 1e18, secretKey: key }] },
    logging: { quiet: true },
  });
  const provider = new Web3Provider(ganacheProvider);
  const wallet = new Wallet(key, provider);

  const deployerFactory = new ContractFactory(
    Create3Deployer.abi,
    Create3Deployer.bytecode,
    wallet,
  );

  const deployer = await deployerFactory.deploy();
  await deployer.deployed();

  const salt = getSaltFromKey('');
  const factory = new ContractFactory(contractJson.abi, contractJson.bytecode);
  const bytecode = factory.getDeployTransaction(...args).data;
  return await deployer.estimateGas.deploy(bytecode, salt);
};

const estimateGasForCreate3DeployAndInit = async (
  contractJson,
  args = [],
  initArgs = [],
) => {
  const key = keccak256(0);
  const ganacheProvider = ganache.provider({
    wallet: { accounts: [{ balance: 1e18, secretKey: key }] },
    logging: { quiet: true },
  });
  const provider = new Web3Provider(ganacheProvider);
  const wallet = new Wallet(key, provider);

  const deployerFactory = new ContractFactory(
    Create3Deployer.abi,
    Create3Deployer.bytecode,
    wallet,
  );

  const deployer = await deployerFactory.deploy();
  await deployer.deployed();

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
  gasLimit = null,
) => {
  const deployer = new Contract(deployerAddress, Create3Deployer.abi, wallet);
  const salt = getSaltFromKey(key);
  const factory = new ContractFactory(contractJson.abi, contractJson.bytecode);
  const bytecode = factory.getDeployTransaction(...args).data;
  const tx = await deployer
    .connect(wallet)
    .deploy(bytecode, salt, { gasLimit });
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
  gasLimit = null,
) => {
  const deployer = new Contract(deployerAddress, Create3Deployer.abi, wallet);
  const salt = getSaltFromKey(key);
  const factory = new ContractFactory(contractJson.abi, contractJson.bytecode);
  const bytecode = factory.getDeployTransaction(...args).data;
  const address = await deployer.deployedAddress(wallet.address, salt);
  const contract = new Contract(address, contractJson.abi, wallet);
  const initData = (await contract.populateTransaction.init(...initArgs)).data;
  const tx = await deployer
    .connect(wallet)
    .deployAndInit(bytecode, salt, initData, {
      gasLimit,
    });
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
