require('@nomicfoundation/hardhat-toolbox');
require('solidity-coverage');

const env = process.env.ENV || 'testnet';
const {
  importNetworks,
  readJSON,
} = require('@axelar-network/axelar-contract-deployments/evm/utils');
const chains = require(`@axelar-network/axelar-contract-deployments/info/${env}.json`);
const keys = readJSON(`${__dirname}/keys.json`);
const { networks, etherscan } = importNetworks(chains, keys);

/**
 * @type import('hardhat/config').HardhatUserConfig
 */
module.exports = {
  solidity: {
    version: '0.8.9',
    settings: {
      evmVersion: process.env.EVM_VERSION || 'london',
      optimizer: {
        enabled: true,
        runs: 1000,
        details: {
          peephole: process.env.COVERAGE === undefined,
          inliner: process.env.COVERAGE === undefined,
          jumpdestRemover: true,
          orderLiterals: true,
          deduplicate: true,
          cse: process.env.COVERAGE === undefined,
          constantOptimizer: true,
          yul: true,
          yulDetails: {
            stackAllocation: true,
          },
        },
      },
    },
  },
  defaultNetwork: 'hardhat',
  networks,
  etherscan,
  paths: {
    sources: './contracts',
  },
  mocha: {
    timeout: 100000,
  },
  gasReporter: {
    enabled: process.env.REPORT_GAS ? true : false,
  },
};
