'use strict';

const {
    Contract,
    ContractFactory,
    utils: { keccak256 },
} = require('ethers');
const { create2DeployAndInitContract } = require('./create2Deployer');
const { create3DeployContract, create3DeployAndInitContract } = require('./create3Deployer');
const { verifyContract } = require('./utils');

const IUpgradable = require('../interfaces/IUpgradable.json');

// for deploying upgradable contracts with InitProxy via CREATE2 method
async function deployCreate2InitUpgradable(
    create2DeployerAddress,
    wallet,
    implementationJson,
    proxyJson,
    implementationConstructorArgs = [],
    proxyConstructorArgs = [],
    setupParams = '0x',
    key = Date.now(),
    gasLimit = null,
    env = 'testnet',
    chain = 'ethereum',
    shouldVerifyContract = false,
) {
    const implementationFactory = new ContractFactory(implementationJson.abi, implementationJson.bytecode, wallet);

    const implementation = await implementationFactory.deploy(...implementationConstructorArgs);
    await implementation.deployed();

    const proxy = await create2DeployAndInitContract(
        create2DeployerAddress,
        wallet,
        proxyJson,
        key,
        proxyConstructorArgs,
        [implementation.address, wallet.address, setupParams],
        gasLimit,
    );

    if (shouldVerifyContract) {
        await verifyContract(env, chain, implementation.address, implementationConstructorArgs);
        await verifyContract(env, chain, proxy.address, proxyConstructorArgs);
    }

    return new Contract(proxy.address, implementationJson.abi, wallet);
}

// for deploying upgradable contracts with Proxy via CREATE3 method
async function deployCreate3Upgradable(
    create3DeployerAddress,
    wallet,
    implementationJson,
    proxyJson,
    implementationConstructorArgs = [],
    additionalProxyConstructorArgs = [],
    setupParams = '0x',
    key = Date.now().toString(),
    gasLimit = null,
    env = 'testnet',
    chain = 'ethereum',
    shouldVerifyContract = false,
) {
    const implementationFactory = new ContractFactory(implementationJson.abi, implementationJson.bytecode, wallet);

    const implementation = await implementationFactory.deploy(...implementationConstructorArgs);
    await implementation.deployed();

    const proxy = await create3DeployContract(
        create3DeployerAddress,
        wallet,
        proxyJson,
        key,
        [implementation.address, wallet.address, setupParams, ...additionalProxyConstructorArgs],
        gasLimit,
    );

    if (shouldVerifyContract) {
        await verifyContract(env, chain, implementation.address, implementationConstructorArgs);
        await verifyContract(env, chain, proxy.address, [
            implementation.address,
            wallet.address,
            setupParams,
            ...additionalProxyConstructorArgs,
        ]);
    }

    return new Contract(proxy.address, implementationJson.abi, wallet);
}

// for deploying upgradable contracts with InitProxy via CREATE3 method
async function deployCreate3InitUpgradable(
    create3DeployerAddress,
    wallet,
    implementationJson,
    proxyJson,
    implementationConstructorArgs = [],
    proxyConstructorArgs = [],
    setupParams = '0x',
    key = Date.now(),
    gasLimit = null,
    env = 'testnet',
    chain = 'ethereum',
    shouldVerifyContract = false,
) {
    const implementationFactory = new ContractFactory(implementationJson.abi, implementationJson.bytecode, wallet);

    const implementation = await implementationFactory.deploy(...implementationConstructorArgs);
    await implementation.deployed();

    const proxy = await create3DeployAndInitContract(
        create3DeployerAddress,
        wallet,
        proxyJson,
        key,
        proxyConstructorArgs,
        [implementation.address, wallet.address, setupParams],
        gasLimit,
    );

    if (shouldVerifyContract) {
        await verifyContract(env, chain, implementation.address, implementationConstructorArgs);
        await verifyContract(env, chain, proxy.address, proxyConstructorArgs);
    }

    return new Contract(proxy.address, implementationJson.abi, wallet);
}

async function upgradeUpgradable(
    proxyAddress,
    wallet,
    contractJson,
    implementationConstructorArgs = [],
    setupParams = '0x',
    env = 'testnet',
    chain = 'ethereum',
    shouldVerifyContract = false,
) {
    const proxy = new Contract(proxyAddress, IUpgradable.abi, wallet);

    const implementationFactory = new ContractFactory(contractJson.abi, contractJson.bytecode, wallet);

    const implementation = await implementationFactory.deploy(...implementationConstructorArgs);
    await implementation.deployed();

    const implementationCode = await wallet.provider.getCode(implementation.address);
    const implementationCodeHash = keccak256(implementationCode);

    const tx = await proxy.upgrade(implementation.address, implementationCodeHash, setupParams);
    await tx.wait();

    if (shouldVerifyContract) {
        await verifyContract(env, chain, implementation.address, implementationConstructorArgs);
    }

    return tx;
}

module.exports = {
    deployUpgradable: deployCreate2InitUpgradable, // deprecated alias
    deployCreate2InitUpgradable,
    deployCreate3Upgradable,
    deployCreate3InitUpgradable,
    upgradeUpgradable,
};
