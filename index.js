'use strict';

const {
  estimateGasForDeploy,
  estimateGasForDeployAndInit,
  deployContractConstant,
  deployAndInitContractConstant,
  predictContractConstant,
} = require('./scripts/constAddressDeployer');
const {
  deployUpgradable,
  upgradeUpgradable,
} = require('./scripts/upgradable');

module.exports = {
    estimateGasForDeploy,
    estimateGasForDeployAndInit,
    deployContractConstant,
    deployAndInitContractConstant,
    predictContractConstant,
    deployUpgradable,
    upgradeUpgradable,
}