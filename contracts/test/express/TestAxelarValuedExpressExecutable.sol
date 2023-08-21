// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import { AxelarValuedExpressExecutable } from '../../express/AxelarValuedExpressExecutable.sol';

contract TestAxelarValuedExpressExecutable is AxelarValuedExpressExecutable {
    constructor(address gateway_) AxelarValuedExpressExecutable(gateway_) {}
}
