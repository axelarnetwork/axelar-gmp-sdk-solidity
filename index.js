'use strict';
const {
  estimateGasForCreate3Deploy,
  estimateGasForCreate3DeployAndInit,
  deployCreate3Contract,
  deployCreate3AndInitContract,
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
  deployCreate3Upgradable,
  upgradeUpgradable,
} = require('./scripts/upgradable');
const { printObj } = require('./scripts/utils');

module.exports = {
  estimateGasForDeploy,
  estimateGasForDeployAndInit,
  deployContractConstant,
  deployAndInitContractConstant,
  predictContractConstant,
  estimateGasForCreate3Deploy,
  estimateGasForCreate3DeployAndInit,
  deployCreate3Contract,
  deployCreate3AndInitContract,
  getCreate3Address,
  deployUpgradable,
  deployCreate3Upgradable,
  upgradeUpgradable,
  printObj,
};
