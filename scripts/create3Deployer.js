'use strict';

const { Contract, ContractFactory } = require('ethers');
const { getSaltFromKey, IDeployer } = require('./utils');

const estimateGasForCreate3Deploy = async (deployer, contractJson, args = []) => {
    const salt = getSaltFromKey('');
    const factory = new ContractFactory(contractJson.abi, contractJson.bytecode);
    const bytecode = factory.getDeployTransaction(...args).data;
    return await deployer.estimateGas.deploy(bytecode, salt);
};

const estimateGasForCreate3DeployAndInit = async (deployer, wallet, contractJson, args = [], initArgs = []) => {
    const salt = getSaltFromKey('');
    const factory = new ContractFactory(contractJson.abi, contractJson.bytecode);
    const bytecode = factory.getDeployTransaction(...args).data;

    const address = await deployer.deployedAddress('0x', wallet.address, salt);
    const contract = new Contract(address, contractJson.abi, wallet);
    const initData = (await contract.populateTransaction.init(...initArgs)).data;
    return await deployer.estimateGas.deployAndInit(bytecode, salt, initData);
};

const create3DeployContract = async (
    deployerAddress,
    wallet,
    contractJson,
    key,
    args = [],
    txOptions = null,
    confirmations = null,
) => {
    if (txOptions && !Number.isNaN(Number(txOptions))) {
        txOptions = {
            gasLimit: txOptions,
        };
    }

    const deployer = new Contract(deployerAddress, IDeployer, wallet);
    const salt = getSaltFromKey(key);
    const factory = new ContractFactory(contractJson.abi, contractJson.bytecode);
    const bytecode = factory.getDeployTransaction(...args).data;

    const tx = await deployer.deploy(bytecode, salt, txOptions);
    await tx.wait(confirmations);

    const address = await deployer.deployedAddress('0x', wallet.address, salt);

    return new Contract(address, contractJson.abi, wallet);
};

const create3DeployAndInitContract = async (
    deployerAddress,
    wallet,
    contractJson,
    key,
    args = [],
    initArgs = [],
    txOptions = null,
    confirmations = null,
) => {
    if (txOptions && !Number.isNaN(Number(txOptions))) {
        txOptions = {
            gasLimit: txOptions,
        };
    }

    const deployer = new Contract(deployerAddress, IDeployer, wallet);
    const salt = getSaltFromKey(key);
    const factory = new ContractFactory(contractJson.abi, contractJson.bytecode);
    const bytecode = factory.getDeployTransaction(...args).data;
    const address = await deployer.deployedAddress('0x', wallet.address, salt);
    const contract = new Contract(address, contractJson.abi, wallet);
    const initData = (await contract.populateTransaction.init(...initArgs)).data;

    const tx = await deployer.deployAndInit(bytecode, salt, initData, txOptions);
    await tx.wait(confirmations);

    return contract;
};

const getCreate3Address = async (deployerAddress, wallet, key) => {
    const deployer = new Contract(deployerAddress, IDeployer, wallet);
    const salt = getSaltFromKey(key);

    return await deployer.deployedAddress('0x', wallet.address, salt);
};

module.exports = {
    estimateGasForCreate3Deploy,
    estimateGasForCreate3DeployAndInit,
    create3DeployContract,
    create3DeployAndInitContract,
    getCreate3Address,
};
