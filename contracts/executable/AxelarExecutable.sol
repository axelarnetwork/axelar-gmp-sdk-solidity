// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import { AxelarGmpWithTokenExecutable } from './AxelarGmpWithTokenExecutable.sol';

contract AxelarExecutable is AxelarGmpWithTokenExecutable {
    constructor(address gateway_) AxelarGmpWithTokenExecutable(gateway_) {}
}
