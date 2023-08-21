// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import { AxelarExpressExecutable } from '../../express/AxelarExpressExecutable.sol';

contract TestAxelarExpressExecutable is AxelarExpressExecutable {
    constructor(address gateway_) AxelarExpressExecutable(gateway_) {}
}
