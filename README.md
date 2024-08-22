# Axelar GMP SDK Solidity

This repository contains all the necessary ingredients for successful cross-chain development
utilizing the Axelar General Message Passing protocol.

## Documentation

* [Introduction](https://docs.axelar.dev/dev/intro)
* [General Message Passing](https://docs.axelar.dev/dev/gmp-overview)
* [Build](https://docs.axelar.dev/dev/build/getting-started)
* [Video](https://docs.axelar.dev/dev/guides/video-guides)

## Build

We recommend using the latest Node.js [LTS version](https://nodejs.org/en/about/releases/).

```bash
npm ci

npm run build

npm run test
```

Pre-compiled bytecodes can be found under [Releases](https://github.com/axelarnetwork/axelar-gmp-sdk-solidity/releases).
Furthermore, pre-compiled bytecodes and ABI are shipped in the [npm package](https://www.npmjs.com/package/@axelar-network/axelar-gmp-sdk-solidity) and can be imported via:

```bash
npm install @axelar-network/axelar-gmp-sdk-solidity
```

```javascript
const IAxelarExecutable = require('@axelar-network/axelar-gmp-sdk-solidity/interfaces/IAxelarExecutable.json');

const Upgradable = require('@axelar-network/axelar-cgp-solidity/artifacts/contracts/upgradable/Upgradable.sol/Upgradable.json');
```

Unit tests can also be run against live networks for integration testing, see [here](https://github.com/axelarnetwork/axelar-cgp-solidity#live-network-testing).

### Development

Check gas usage
```bash
REPORT_GAS=true npm run test
```

Check storage layout of contracts.
```bash
STORAGE_LAYOUT=true npm run check
```

Check contract bytecode size
```bash
CHECK_CONTRACT_SIZE=true npm run build
```

## Available contracts

### AxelarExecutable

Base interface for validating and executing GMP contract calls.

### AxelarExpressExecutable

Interface that allows expediting GMP calls by lending assets and performing execution
before it fully propagates through the Axelar network.

### Create2Deployer and Create3Deployer

These contracts are used to deploy your Executable to have the same address on different EVM chains.
This simplifies message validation from peer Executables. You can learn more in the
[documentation](https://docs.axelar.dev/dev/general-message-passing/solidity-utilities).

### Proxy and Upgradable

Base implementation of upgradable contracts designed to be deployed with `Create3Deployer`
and to have the same Proxy address on different EVM chains.

### AddressString

Allows conversion between `string` and `address` data types

### AddressBytes

Allows conversion between `bytes` and `address` data types

### Bytes32String

Allows conversion between `string` and `bytes32` data types
for storing strings under 31 bytes into a single storage slot
