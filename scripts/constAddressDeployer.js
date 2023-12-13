const {
    estimateGasForCreate2Deploy,
    estimateGasForCreate2DeployAndInit,
    create2DeployContract,
    create2DeployAndInitContract,
    getCreate2Address,
} = require('./create2Deployer');

/**
 * @dev These methods are deprecated and exported for backwards compatibility.
 */
module.exports = {
    estimateGasForDeploy: estimateGasForCreate2Deploy,
    estimateGasForDeployAndInit: estimateGasForCreate2DeployAndInit,
    deployContractConstant: create2DeployContract,
    deployAndInitContractConstant: create2DeployAndInitContract,
    predictContractConstant: getCreate2Address,
};
