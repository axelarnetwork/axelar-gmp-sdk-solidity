// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import { AxelarGMPExecutable } from '../../executable/AxelarGMPExecutable.sol';

contract TestAxelarGMPExecutable is AxelarGMPExecutable {
    constructor(address gateway_) AxelarGMPExecutable(gateway_) {}

    function _execute(
        bytes32, /*commandId*/
        string calldata, /*sourceChain*/
        string calldata, /*sourceAddress*/
        bytes calldata /*payload*/
    ) internal override {}
}
