// SPDX-License-Identifier: MIT

pragma solidity 0.8.9;

import { Proxy } from '../upgradable/Proxy.sol';

contract ProxyTest is Proxy {
    function contractId() internal pure override returns (bytes32) {
        return keccak256('test');
    }
}
