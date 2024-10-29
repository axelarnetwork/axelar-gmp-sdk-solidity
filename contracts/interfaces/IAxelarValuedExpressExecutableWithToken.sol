// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import { IAxelarExpressExecutableWithToken } from './IAxelarExpressExecutableWithToken.sol';
import { IAxelarValuedExpressExecutable } from './IAxelarValuedExpressExecutable.sol';

/**
 * @title IAxelarValuedExpressExecutableWithToken
 * @dev Interface for the Axelar Valued Express Executable With Token contract.
 */
interface IAxelarValuedExpressExecutableWithToken is IAxelarExpressExecutableWithToken, IAxelarValuedExpressExecutable {
    /**
     * @dev Returns the value (token address and amount) associated with a contract call with token.
     * @param sourceChain The source chain.
     * @param sourceAddress The source address.
     * @param payload The payload data.
     * @param symbol The token symbol.
     * @param amount The amount of tokens.
     * @return tokenAddress The address of the token used.
     * @return value The value associated with the contract call.
     */
    function contractCallWithTokenValue(
        string calldata sourceChain,
        string calldata sourceAddress,
        bytes calldata payload,
        string calldata symbol,
        uint256 amount
    ) external view returns (address tokenAddress, uint256 value);
}
