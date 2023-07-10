# Axelar GMP SDK Solidity
###### General Message Passing Development Kit

This repository contains all the necessary ingredients for successful cross-chain development 
utilizing the Axelar General Message Passing protocol.  

## Installation
```shell
$ npm install @axelar-network/axelar-gmp-sdk-solidity
```

## Documentation
 * [Introduction](https://docs.axelar.dev/dev/intro)
 * [General Message Passing](https://docs.axelar.dev/dev/gmp-overview)
 * [Build](https://docs.axelar.dev/dev/build/getting-started)
 * [Video](https://docs.axelar.dev/dev/guides/video-guides)

## Available contracts

### AxelarExecutable
Base interface for validating and executing GMP contract calls.

### AxelarExpressExecutable
Interface that allows expediting GMP calls by lending assets and performing execution 
before it fully propagates through the Axelar network.

### Create3Deployer and ConstAddressDeployer
These contracts are used to deploy your Executable to have the same address on different EVM chains.
This simplifies message validation from peer Executables. You can learn more in the
[documentation](https://docs.axelar.dev/dev/build/solidity-utilities).

### Proxy and Upgradable
Base implementation of upgradable contracts designed to be deployed with `Create3Deployer`
and to have the same Proxy address on different EVM chains.

### TokenLinker and NTFLinker
Allows developers to create their own cross-chain gateways for
ERC20 and ERC721 tokens utilizing the GMP protocol.
Also it's a great example how to use AxelarExecutable with Upgradable.

### StringAddressUtils
Allows conversion between `string` and `address` data types

### StringBytesUtil
Allows conversion between `string` and `bytes32` data types 
for storing strings under 31 bytes into a single storage slot
