const {
    ContractFactory,
    utils: { keccak256, defaultAbiCoder, arrayify, hashMessage, recoverAddress },
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

const getWeightedSignersSet = (signerAddresses, weights, threshold) => {
    const signersWithWeights = signerAddresses.map((address, i) => ({ address, weight: weights[i] }));
    const sortedSignersWithWeights = sortBy(signersWithWeights, (signer) => signer.address.toLowerCase());
    const sortedAddresses = sortedSignersWithWeights.map(({ address }) => address);
    const sortedWeights = sortedSignersWithWeights.map(({ weight }) => weight);

    return defaultAbiCoder.encode(['address[]', 'uint256[]', 'uint256'], [sortedAddresses, sortedWeights, threshold]);
};

const getWeightedSignersProof = async (data, accounts, weights, threshold, signers) => {
    const signersWithWeights = getAddresses(accounts).map((address, i) => ({ address, weight: weights[i] }));
    const sortedSignersWithWeights = sortBy(signersWithWeights, (signer) => signer.address.toLowerCase());
    const sortedAddresses = sortedSignersWithWeights.map(({ address }) => address);
    const sortedWeights = sortedSignersWithWeights.map(({ weight }) => weight);

    const hash = arrayify(keccak256(data));
    const signatures = await Promise.all(
        sortBy(signers, (wallet) => wallet.address.toLowerCase()).map((wallet) => wallet.signMessage(hash)),
    );

    return defaultAbiCoder.encode(
        ['address[]', 'uint256[]', 'uint256', 'bytes[]'],
        [sortedAddresses, sortedWeights, threshold, signatures],
    );
};

const sortWeightedSignaturesProof = async (data, signerAddresses, weights, threshold, signatures) => {
    const signersWithWeights = signerAddresses.map((address, i) => ({ address, weight: weights[i] }));
    const sortedSignersWithWeights = sortBy(signersWithWeights, (signer) => signer.address.toLowerCase());
    const sortedAddresses = sortedSignersWithWeights.map(({ address }) => address);
    const sortedWeights = sortedSignersWithWeights.map(({ weight }) => weight);

    const hash = arrayify(hashMessage(arrayify(keccak256(data))));
    signatures = sortBy(signatures, (signature) => recoverAddress(hash, signature).toLowerCase());

    return defaultAbiCoder.encode(
        ['address[]', 'uint256[]', 'uint256', 'bytes[]'],
        [sortedAddresses, sortedWeights, threshold, signatures],
    );
};

const encodeInterchainCallsBatch = (batchId, calls) =>
    defaultAbiCoder.encode(['bytes32', 'tuple(string, address, address, bytes, uint256)[]'], [batchId, calls]);

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
