const {
    ContractFactory,
    utils: { keccak256, defaultAbiCoder, arrayify, recoverAddress },
} = require('ethers');
const http = require('http');
const { outputJsonSync } = require('fs-extra');
const { sortBy } = require('lodash');

const deployContract = async (wallet, contractJson, args = [], options = {}) => {
    const factory = new ContractFactory(contractJson.abi, contractJson.bytecode, wallet);

    const contract = await factory.deploy(...args, { ...options });
    await contract.deployed();
    return contract;
};

const getSaltFromKey = (key) => {
    return keccak256(defaultAbiCoder.encode(['string'], [key.toString()]));
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
                error = new Error('Invalid content-type.\n' + `Expected application/json but received ${contentType}`);
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

const getAddresses = (wallets) => wallets.map(({ address }) => address);

const getWeightedSignersSet = (accounts, weights, signerThresholds) =>
    defaultAbiCoder.encode(['address[]', 'uint256[]', 'uint256'], [accounts, weights, signerThresholds]);

const getWeightedSignersProof = async (data, accounts, weights, threshold, signers) => {
    const hash = arrayify(keccak256(data));
    const signatures = await Promise.all(
        sortBy(signers, (wallet) => wallet.address.toLowerCase()).map((wallet) => wallet.signMessage(hash)),
    );
    const addresses = sortBy(getAddresses(accounts), (address) => address.toLowerCase());

    return defaultAbiCoder.encode(
        ['address[]', 'uint256[]', 'uint256', 'bytes[]'],
        [addresses, weights, threshold, signatures],
    );
};

const sortWeightedSignaturesProof = async (data, signerAddresses, weights, threshold, signatures) => {
    const hash = arrayify(keccak256(data));
    signatures = sortBy(signatures, (signature) => recoverAddress(hash, signature).toLowerCase());
    signerAddresses = sortBy(signerAddresses, (address) => address.toLowerCase());

    return defaultAbiCoder.encode(
        ['address[]', 'uint256[]', 'uint256', 'bytes[]'],
        [signerAddresses, weights, threshold, signatures],
    );
};

const encodeInterchainCallsBatch = (batchId, calls) =>
    defaultAbiCoder.encode(['uint256', 'tuple(string, address, address, bytes, uint256)[]'], [batchId, calls]);

module.exports = {
    getSaltFromKey,
    deployContract,
    setJSON,
    httpGet,
    printObj,
    getAddresses,
    getWeightedSignersSet,
    getWeightedSignersProof,
    sortWeightedSignaturesProof,
    encodeInterchainCallsBatch,
};
