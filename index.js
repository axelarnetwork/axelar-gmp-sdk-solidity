'use strict';

const {
  Contract,
  ContractFactory,
  utils: { keccak256, defaultAbiCoder },
  providers: {Web3Provider},
  Wallet,
} = require('ethers');
const ganache = require('ganache');

const ConstAddressDeployer = require('./build/ConstAddressDeployer.json');

const { it } = require('mocha');

const getSaltFromKey = (key) => {
  return keccak256(defaultAbiCoder.encode(['string'], [key]));
};

const estimateGasForDeploy = async (contractJson, args = []) => {
    const key = keccak256(0);
    const ganacheProvider = ganache.provider({
        wallet: { accounts: [{balance:1e18, secretKey: key}] },
        logging: { quiet: true },
    });
    const provider = new Web3Provider(ganacheProvider);
    const wallet = new Wallet(key, provider);
    //console.log(await provider.getBalance(wallet.address));

    const deployer = await deployContract(wallet, ConstAddressDeployer);
    const salt = getSaltFromKey('');
    const factory = new ContractFactory(contractJson.abi, contractJson.bytecode);
    const bytecode = factory.getDeployTransaction(...args).data;
    return await deployer.estimateGas.deploy(bytecode, salt);
}
const estimateGasForDeployAndInit = async (contractJson, args = [], initArgs = []) => {
    const key = keccak256(0);
    const ganacheProvider = ganache.provider({
        wallet: { accounts: [{balance:1e18, secretKey: key}] },
        logging: { quiet: true },
    });
    const provider = new Web3Provider(ganacheProvider);
    const wallet = new Wallet(key, provider);
    //console.log(await provider.getBalance(wallet.address));

    const deployer = await deployContract(wallet, ConstAddressDeployer);
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
}

const deployContractConstant = async (
  deployer,
  wallet,
  contractJson,
  key,
  args = [],
) => {
  const salt = getSaltFromKey(key);
  const factory = new ContractFactory(contract.abi, contractJson.bytecode);
  const bytecode = factory.getDeployTransaction(...args).data;
  const tx = await deployer.connect(wallet).deploy(bytecode, salt);
  await tx.wait();
  const address = await deployer.deployedAddress(
    bytecode,
    wallet.address,
    salt,
  );
  return new Contract(address, contractJson.abi, wallet);
};

const deployAndInitContractConstant = async (
  deployer,
  wallet,
  contractJson,
  key,
  args = [],
  initArgs = [],
) => {
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
    .deployAndInit(bytecode, salt, initData);
  await tx.wait();
  return contract;
};

const predictContractConstant = async (
  deployer,
  wallet,
  contractJson,
  key,
  args = [],
) => {
  const salt = getSaltFromKey(key);

  const factory = new ContractFactory(contractJson.abi, contractJson.bytecode);
  const bytecode = factory.getDeployTransaction(...args).data;
  return await deployer.deployedAddress(bytecode, wallet.address, salt);
};

module.exports = {
    estimateGasForDeploy,
    estimateGasForDeployAndInit,
    deployContractConstant,
    deployAndInitContractConstant,
    predictContractConstant,
}