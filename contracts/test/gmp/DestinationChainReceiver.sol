// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import { AxelarExecutable } from '../../executable/AxelarExecutable.sol';

contract DestinationChainReceiver is AxelarExecutable {
    event Received(uint256 num);

    constructor(address gatewayAddress) AxelarExecutable(gatewayAddress) {}

    function _execute(
        bytes32, /*commandId*/
        string calldata, /*sourceChain*/
        string calldata, /*sourceAddress*/
        bytes calldata payload
    ) internal override {
        uint256 num = abi.decode(payload, (uint256));
        emit Received(num);
    }
}
