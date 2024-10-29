// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import { IAxelarExpressExecutable } from './IAxelarExpressExecutable.sol';

/**
 * @title IAxelarValuedExpressExecutable
 * @dev Interface for the Axelar Valued Express Executable contract.
 */
interface IAxelarValuedExpressExecutable is IAxelarExpressExecutable {
    /**
     * @dev Returns the value (token address and amount) associated with a contract call
     * @param sourceChain The source chain.
     * @param sourceAddress The source address.
     * @param payload The payload data.
     * @return tokenAddress The address of the token used.
     * @return value The value associated with the contract call.
     */
    function contractCallValue(
        string calldata sourceChain,
        string calldata sourceAddress,
        bytes calldata payload
    ) external view returns (address tokenAddress, uint256 value);
}
