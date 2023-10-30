// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import { Proxy } from '../upgradable/Proxy.sol';

/**
 * @title InterchainAddressTrackerProxy
 * @dev Proxy contract for the InterchainAddressTracker contract. Inherits from the Proxy contract.
 */
contract InterchainAddressTrackerProxy is Proxy {
    bytes32 private constant CONTRACT_ID = keccak256('interchain-router');

    /**
     * @dev Constructs the InterchainAddressTrackerProxy contract.
     * @param implementationAddress Address of the InterchainAddressTracker implementation
     * @param owner Address of the owner of the proxy
     * @param params The params to be passed to the _setup function of the implementation.
     */
    constructor(
        address implementationAddress,
        address owner,
        bytes memory params
    ) Proxy(implementationAddress, owner, params) {}

    /**
     * @dev Override for the `contractId` function in Proxy. Returns a unique identifier for this contract.
     * @return bytes32 Identifier for this contract.
     */
    function contractId() internal pure override returns (bytes32) {
        return CONTRACT_ID;
    }
}
