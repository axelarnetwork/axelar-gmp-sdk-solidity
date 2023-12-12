'use strict';
const {
    estimateGasForCreate2Deploy,
    estimateGasForCreate2DeployAndInit,
    create2DeployContract,
    create2DeployAndInitContract,
    getCreate2Address,
} = require('./scripts/create2Deployer');
const {
    estimateGasForCreate3Deploy,
    estimateGasForCreate3DeployAndInit,
    create3DeployContract,
    create3DeployAndInitContract,
    getCreate3Address,
} = require('./scripts/create3Deployer');
const {
    estimateGasForDeploy,
    estimateGasForDeployAndInit,
    deployContractConstant,
    deployAndInitContractConstant,
    predictContractConstant,
} = require('./scripts/constAddressDeployer');
const {
    deployUpgradable,
    deployCreate2InitUpgradable,
    deployCreate3Upgradable,
    deployCreate3InitUpgradable,
    upgradeUpgradable,
} = require('./scripts/upgradable');
const { printObj } = require('./scripts/utils');

module.exports = {
    estimateGasForDeploy,
    estimateGasForDeployAndInit,
    deployContractConstant,
    deployAndInitContractConstant,
    predictContractConstant,

    estimateGasForCreate2Deploy,
    estimateGasForCreate2DeployAndInit,
    create2DeployContract,
    create2DeployAndInitContract,
    getCreate2Address,

    estimateGasForCreate3Deploy,
    estimateGasForCreate3DeployAndInit,
    create3DeployContract,
    create3DeployAndInitContract,
    getCreate3Address,

    deployUpgradable,
    deployCreate2InitUpgradable,
    deployCreate3Upgradable,
    deployCreate3InitUpgradable,
    upgradeUpgradable,
    printObj,
};
