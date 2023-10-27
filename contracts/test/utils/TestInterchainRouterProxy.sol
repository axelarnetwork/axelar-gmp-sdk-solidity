// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import { InterchainRouterProxy } from '../../utils/InterchainRouterProxy.sol';

contract TestInterchainRouterProxy is InterchainRouterProxy {
    function test() external {
        bytes32 temp = contractId();
    }
}