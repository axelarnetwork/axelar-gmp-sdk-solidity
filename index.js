'use strict';

const {
  estimateGasForDeploy,
  deployContractConstant,
  predictContractConstant,
} = require('./scripts/deploy');
const { deployUpgradable, upgradeUpgradable } = require('./scripts/upgradable');

module.exports = {
  estimateGasForDeploy,
  deployContractConstant,
  predictContractConstant,
  deployUpgradable,
  upgradeUpgradable,
};
