# Axelar GMP SDK
###### General Message Passing Development Kit

This repository contains all the necessary ingredients for successful cross-chain development 
utilizing the Axelar General Message Passing protocol.  

### AxelarExecutable
Base interface for validating and executing GMP contract calls.

### AxelarForecallable
Interface that allows to expedite GMP calls by lending assets and performing execution 
before it fully propagates through the Axelar network.

### ConstAddressDeployer
This contract is used to deploy your Executable to have the same address on different EVM chains.
This simplifies message validation from peer Executables. You can learn more in the
[documentation](https://docs.axelar.dev/dev/build/solidity-utilities).

### Proxy and Upgradable
Base implementation of upgradable contracts designed to be deployed with `ConstAddressDeployer`
and to have the same Proxy address on different EVM chains.

### TokenLiner and NTFLinker
Allows developers to create their own cross-chain gateways for
ERC20 and ERC721 tokens utilizing the GMP protocol.
Also it's a great example how to use AxelarExecutable with Upgradable.

### StringAddressUtils
Allows conversion between `string` and `address` data types

### StringBytesUtil
Allows conversion between `string` and `bytes32` data types 
for storing strings under 31 bytes into a single storage slot
