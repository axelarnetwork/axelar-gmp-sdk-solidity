const {
    ContractFactory,
    utils: { keccak256, defaultAbiCoder, arrayify, id, hashMessage },
    BigNumber,
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

const encodeWeightedSigners = (weightedSigners) => {
    return defaultAbiCoder.encode(
        ['tuple(tuple(address signer,uint128 weight)[] signers,uint128 threshold,bytes32 nonce) signers'],
        [weightedSigners],
    );
};

const encodeWeightedSignersMessage = (data, domainSeparator, weightedSignerHash) => {
    return arrayify(domainSeparator + weightedSignerHash.slice(2) + keccak256(arrayify(data)).slice(2));
};

const encodeMessageHash = (data, domainSeparator, weightedSignerHash) => {
    return hashMessage(encodeWeightedSignersMessage(data, domainSeparator, weightedSignerHash));
};

const getWeightedSignersProof = async (data, domainSeparator, weightedSigners, wallets) => {
    const weightedSignerHash = keccak256(encodeWeightedSigners(weightedSigners));
    const message = encodeWeightedSignersMessage(data, domainSeparator, weightedSignerHash);

    const signatures = await Promise.all(wallets.map((wallet) => wallet.signMessage(message)));

    return defaultAbiCoder.encode(
        [
            'tuple(tuple(tuple(address signer,uint128 weight)[] signers,uint128 threshold,bytes32 nonce) signers,bytes[] signatures)',
        ],
        [{ signers: weightedSigners, signatures }],
    );
};

const encodeInterchainCallsBatch = (batchId, calls) =>
    defaultAbiCoder.encode(['bytes32', 'tuple(string, address, address, bytes, uint256)[]'], [batchId, calls]);

/**
 * Convert object to solidity tuple type
 * @param {*} obj
 * @returns {Array}
 */
const solidityObjectToTuple = (obj) => {
    if (typeof obj === 'object') {
        return Object.entries(obj).map(([key, value]) => solidityObjectToTuple(value));
    }

    return obj;
};

module.exports = {
    getSaltFromKey,
    deployContract,
    setJSON,
    httpGet,
    printObj,
    getAddresses,
    getWeightedSignersSet,
    getWeightedSignersProof,
    encodeInterchainCallsBatch,
    encodeWeightedSigners,
    encodeMessageHash,
    solidityObjectToTuple,
};
