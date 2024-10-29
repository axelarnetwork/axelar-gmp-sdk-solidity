// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import { AxelarValuedExpressExecutableWithToken } from '../../express/AxelarValuedExpressExecutableWithToken.sol';

contract TestAxelarValuedExpressExecutable is AxelarValuedExpressExecutableWithToken {
    constructor(address gateway_) AxelarValuedExpressExecutableWithToken(gateway_) {}

    function contractCallValue(
        string calldata, /* sourceChain */
        string calldata, /* sourceAddress */
        bytes calldata /* payload */
    ) public pure override returns (address tokenAddress, uint256 value) {
        return (address(0), 0);
    }

    function contractCallWithTokenValue(
        string calldata, /* sourceChain */
        string calldata, /* sourceAddress */
        bytes calldata, /* payload */
        string calldata, /* symbol */
        uint256 /* amount */
    ) public pure override returns (address tokenAddress, uint256 value) {
        return (address(0), 0);
    }

    function _execute(
        bytes32 commandId,
        string calldata sourceChain,
        string calldata sourceAddress,
        bytes calldata payload
    ) internal virtual override {}

    function _executeWithToken(
        bytes32 commandId,
        string calldata sourceChain,
        string calldata sourceAddress,
        bytes calldata payload,
        string calldata tokenSymbol,
        uint256 amount
    ) internal virtual override {}
}
