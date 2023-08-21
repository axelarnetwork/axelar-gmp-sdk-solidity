// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import { AxelarExecutable } from '../../executable/AxelarExecutable.sol';

contract TestAxelarExecutable is AxelarExecutable {
    constructor(address gateway_) AxelarExecutable(gateway_) {}
}
