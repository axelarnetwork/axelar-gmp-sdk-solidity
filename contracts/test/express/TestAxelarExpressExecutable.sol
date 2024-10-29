// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import { AxelarExpressExecutableWithToken } from '../../express/AxelarExpressExecutableWithToken.sol';

contract TestAxelarExpressExecutable is AxelarExpressExecutableWithToken {
    constructor(address gateway_) AxelarExpressExecutableWithToken(gateway_) {
        if (
            PREFIX_EXPRESS_EXECUTE != keccak256('express-execute') ||
            PREFIX_EXPRESS_EXECUTE_WITH_TOKEN != keccak256('express-execute-with-token')
        ) revert('invalid express execute prefix');
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
