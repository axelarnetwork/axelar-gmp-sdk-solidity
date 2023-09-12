// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import { FixedProxy } from '../../upgradable/FixedProxy.sol';

contract TestFixedProxy is FixedProxy {
    constructor(address implementationAddress) FixedProxy(implementationAddress) {}

    function contractId() internal pure override returns (bytes32) {
        return keccak256('proxy-implementation');
    }
}
