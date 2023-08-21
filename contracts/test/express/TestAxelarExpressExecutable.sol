// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import { AxelarExpressExecutable } from '../../express/AxelarExpressExecutable.sol';

contract TestAxelarExpressExecutable is AxelarExpressExecutable {
    constructor(address gateway_) AxelarExpressExecutable(gateway_) {
        if (
            PREFIX_EXPRESS_EXECUTE != keccak256('express-execute') ||
            PREFIX_EXPRESS_EXECUTE_WITH_TOKEN != keccak256('express-execute-with-token')
        ) revert('invalid express execute prefix');
    }
}
