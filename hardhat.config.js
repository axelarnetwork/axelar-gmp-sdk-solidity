require('@nomicfoundation/hardhat-toolbox');
require('solidity-coverage');

if (process.env.STORAGE_LAYOUT) {
    require('hardhat-storage-layout');
}

if (process.env.CHECK_CONTRACT_SIZE) {
    require('hardhat-contract-sizer');
}

const { importNetworks, readJSON } = require('@axelar-network/axelar-chains-config');

const env = process.env.ENV || 'testnet';
const chains = require(`@axelar-network/axelar-chains-config/info/${env}.json`);
const keys = readJSON(`${__dirname}/keys.json`);
const { networks, etherscan } = importNetworks(chains, keys);
networks.hardhat.hardfork = process.env.EVM_VERSION || 'london';

const optimizerSettings = {
    enabled: true,
    runs: 1000000,
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
};

// Need to manually specify outputSelection settings for the hardhat-storage-layout plugin since we're using customized compiler settings.
// https://www.npmjs.com/package/hardhat-storage-layout?activeTab=code
const outputSelectionSettings = process.env.STORAGE_LAYOUT
    ? {
          '*': {
              '*': ['storageLayout'],
          },
      }
    : {};

const defaultSettings = {
    version: '0.8.23',
    settings: {
        evmVersion: process.env.EVM_VERSION || 'london',
        optimizer: optimizerSettings,
        outputSelection: outputSelectionSettings,
    },
};

// Some contracts use fixed compiler settings to ensure deterministic bytecodes across versions
const compilerSettings = {
    version: '0.8.19',
    settings: {
        evmVersion: process.env.EVM_VERSION || 'london',
        optimizer: optimizerSettings,
        outputSelection: outputSelectionSettings,
    },
};

/**
 * @type import('hardhat/config').HardhatUserConfig
 */
module.exports = {
    solidity: {
        compilers: [defaultSettings],
        // Fix compiler settings for contracts that aren't being changed
        // Allow skipping overrides for Slither to work correctly
        overrides: process.env.NO_OVERRIDES
            ? {}
            : {
                  'contracts/deploy/ConstAddressDeployer.sol': compilerSettings,
                  'contracts/deploy/Create2Deployer.sol': compilerSettings,
                  'contracts/deploy/Create3Deployer.sol': compilerSettings,
                  'contracts/upgradable/Proxy.sol': compilerSettings,
                  'contracts/upgradable/InitProxy.sol': compilerSettings,
                  'contracts/upgradable/FinalProxy.sol': compilerSettings,
                  'contracts/upgradable/FixedProxy.sol': compilerSettings,
                  'contracts/governance/InterchainGovernance.sol': compilerSettings,
                  'contracts/governance/Multisig.sol': compilerSettings,
                  'contracts/utils/Operators.sol': compilerSettings,
              },
    },
    defaultNetwork: 'hardhat',
    networks,
    etherscan,
    mocha: {
        timeout: 4 * 60 * 60 * 1000, // 4 hrs
    },
    gasReporter: {
        enabled: process.env.REPORT_GAS !== undefined,
        excludeContracts: ['contracts/test'],
    },
    contractSizer: {
        runOnCompile: process.env.CHECK_CONTRACT_SIZE,
        strict: process.env.CHECK_CONTRACT_SIZE,
        except: ['contracts/test'],
    },
};
