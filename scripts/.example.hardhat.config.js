// Example hardhat config to import custom networks
require('@nomicfoundation/hardhat-toolbox');

const fs = require('fs');
const env = process.env.ENV || 'testnet';
const { importNetworks } = require('@axelar-network/axelar-gmp-sdk-solidity');
const chains = require(`@axelar-network/axelar-cgp-solidity/info/${env}.json`);
const keys = fs.existsSync('keys.json') ? require('keys.json') : {}; // Load keys if they exist
const { networks, etherscan } = importNetworks(chains, keys);

module.exports = {
  solidity: {
    version: '0.8.9',
    settings: {},
  },
  defaultNetwork: 'hardhat',
  networks: networks,
  etherscan: etherscan,
  mocha: {
    timeout: 1000000, // Keep a higher timeout since tests on live networks can take much longer
  },
  gasReporter: {
    enabled: process.env.REPORT_GAS ? true : false,
  },
};
