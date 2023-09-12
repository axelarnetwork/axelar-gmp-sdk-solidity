// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import { InitProxy } from '../../upgradable/InitProxy.sol';

contract TestInitProxy is InitProxy {
    function contractId() internal pure override returns (bytes32) {
        return keccak256('proxy-implementation');
    }
}
