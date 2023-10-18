// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

interface IInterchainDeployer {
    event Deployed(
        address indexed _owner,
        address indexed _deployedImplementationAddress,
        address indexed _deployedProxyAddress
    );
    event Upgraded(address indexed _deployedImplementationAddress);
    event WhitelistedSourceAddressSet(string indexed sourceChain, string sourceSender, bool whitelisted);
    error NotWhitelistedSourceAddress();
}
