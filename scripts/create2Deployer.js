'use strict';

const { Contract, ContractFactory } = require('ethers');
const { getSaltFromKey, IDeployer } = require('./utils');

const estimateGasForCreate2Deploy = async (deployer, contractJson, args = []) => {
    const salt = getSaltFromKey('');
    const factory = new ContractFactory(contractJson.abi, contractJson.bytecode);
    const bytecode = factory.getDeployTransaction(...args).data;
    return await deployer.estimateGas.deploy(bytecode, salt);
};

const estimateGasForCreate2DeployAndInit = async (deployer, wallet, contractJson, args = [], initArgs = []) => {
    const salt = getSaltFromKey('');
    const factory = new ContractFactory(contractJson.abi, contractJson.bytecode);
    const bytecode = factory.getDeployTransaction(...args).data;

    const address = await deployer.deployedAddress(bytecode, wallet.address, salt);
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

    const address = await deployer.deployedAddress(bytecode, wallet.address, salt);
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
    const address = await deployer.deployedAddress(bytecode, wallet.address, salt);
    const contract = new Contract(address, contractJson.abi, wallet);
    const initData = (await contract.populateTransaction.init(...initArgs)).data;

    const tx = await deployer.deployAndInit(bytecode, salt, initData, txOptions);
    await tx.wait(confirmations);

    return contract;
};

const getCreate2Address = async (deployerAddress, wallet, contractJson, key, args = []) => {
    const deployer = new Contract(deployerAddress, IDeployer, wallet);
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
