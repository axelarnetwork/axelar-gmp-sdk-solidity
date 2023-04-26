const { ContractFactory } = require('ethers');
const http = require('http');
const { outputJsonSync } = require('fs-extra');
const { execSync } = require('child_process');
const fs = require('fs');

const deployContract = async (
  wallet,
  contractJson,
  args = [],
  options = {},
) => {
  const factory = new ContractFactory(
    contractJson.abi,
    contractJson.bytecode,
    wallet,
  );

  const contract = await factory.deploy(...args, { ...options });
  await contract.deployed();
  return contract;
};

function printObj(obj) {
  console.log(JSON.stringify(obj, null, 2));
}

const setJSON = (data, name) => {
  outputJsonSync(name, data, {
    spaces: 2,
    EOL: '\n',
  });
};

const httpGet = (url) => {
  return new Promise((resolve, reject) => {
    http.get(url, (res) => {
      const { statusCode } = res;
      const contentType = res.headers['content-type'];
      let error;

      if (statusCode !== 200) {
        error = new Error('Request Failed.\n' + `Status Code: ${statusCode}`);
      } else if (!/^application\/json/.test(contentType)) {
        error = new Error(
          'Invalid content-type.\n' +
          `Expected application/json but received ${contentType}`,
        );
      }

      if (error) {
        res.resume();
        reject(error);
        return;
      }

      res.setEncoding('utf8');
      let rawData = '';
      res.on('data', (chunk) => {
        rawData += chunk;
      });
      res.on('end', () => {
        try {
          const parsedData = JSON.parse(rawData);
          resolve(parsedData);
        } catch (e) {
          reject(e);
        }
      });
    });
  });
};

/**
 * Imports custom networks into hardhat config format.
 * Check out the example hardhat config for usage `.example.hardhat.config.js`.
 *
 * @param {Object[]} chains - Array of chain objects following the format in info/mainnet.json
 * @param {Object} keys - Object containing keys for contract verification and accounts
 * @returns {Object} - Object containing networks and etherscan config
 */
function importNetworks(chains, keys) {
  var networks = {
    hardhat: {
      chainId: 31337, // default hardhat network chain id
    },
  };

  var etherscan = {
    apiKey: {},
    customChains: [],
  };

  // Add custom networks
  for (const chain of chains) {
    const name = chain.name.toLowerCase();
    networks[name] = {
      chainId: chain.chainId,
      id: chain.id,
      url: chain.rpc,
      blockGasLimit: chain.gasOptions?.gasLimit,
      accounts: keys.accounts || keys.chains[name]?.accounts,
    };

    // Add contract verification keys
    if (chain.explorer) {
      etherscan.apiKey[name] = keys.chains[name]?.api;

      etherscan.customChains.push({
        network: name,
        chainId: chain.chainId,
        urls: {
          apiURL: chain.explorer.api,
          browserURL: chain.explorer.url,
        },
      });
    }
  }

  return { networks, etherscan };
}

/**
 * Verifies a contract on etherscan-like explorer of the provided chain using hardhat.
 * This assumes that the chain has been loaded as a custom network in hardhat.
 *
 * @param {string} env
 * @param {string} chain
 * @param {string} contract
 * @param {any[]} args
 * @returns {Promise<void>}
 */
function verifyContract(env, chain, contract, args) {
  const stringArgs = args.map((arg) => JSON.stringify(arg));
  const content = `module.exports = [\n    ${stringArgs.join(',\n    ')}\n];`;
  const file = 'temp-arguments.js';
  const cmd = `ENV=${env} npx hardhat verify --network ${chain.toLowerCase()} --no-compile --constructor-args ${file} ${contract} --show-stack-traces`;
  fs.writeFileSync(file, content, 'utf-8');

  printObj(`Verifying contract ${contract} with args '${stringArgs.join(',')}'`);
  printObj(cmd);
  execSync(cmd, { stdio: 'inherit' });
  printObj('Verified!');
}

module.exports = {
  deployContract,
  setJSON,
  httpGet,
  importNetworks,
  verifyContract,
  printObj,
};
