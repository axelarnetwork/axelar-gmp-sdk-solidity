// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import { IImplementation } from '../interfaces/IImplementation.sol';

/**
 * @title Implementation
 * @notice This contract serves as a base for other contracts and enforces a proxy-first access restriction.
 * @dev Derived contracts must implement the setup function.
 */
abstract contract Implementation is IImplementation {
    address private immutable implementationAddress;

    /**
     * @dev Contract constructor that sets the implementation address to the address of this contract.
     */
    constructor() {
        implementationAddress = address(this);
    }

    /**
     * @dev Modifier to require the caller to be the proxy contract.
     * Reverts if the caller is the current contract (i.e., the implementation contract itself).
     */
    modifier onlyProxy() {
        if (implementationAddress == address(this)) revert NotProxy();
        _;
    }

    /**
     * @notice Initializes contract parameters.
     * This function is intended to be overridden by derived contracts.
     * The overriding function must have the onlyProxy modifier.
     * @param params The parameters to be used for initialization
     */
    function setup(bytes calldata params) external virtual;
}
