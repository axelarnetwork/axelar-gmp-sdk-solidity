require('@nomicfoundation/hardhat-toolbox');
require('solidity-coverage');

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
