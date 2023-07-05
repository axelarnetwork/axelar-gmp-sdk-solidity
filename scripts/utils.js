const { ContractFactory } = require('ethers');
const http = require('http');
const { outputJsonSync } = require('fs-extra');

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

const printObj = (obj) => {
  console.log(JSON.stringify(obj, null, 2));
};

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

module.exports = {
  deployContract,
  setJSON,
  httpGet,
  printObj,
};
