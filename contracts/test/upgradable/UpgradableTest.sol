// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import { Upgradable } from '../../upgradable/Upgradable.sol';

contract UpgradableTest is Upgradable {
    constructor() Upgradable() {
        if (_IMPLEMENTATION_SLOT != bytes32(uint256(keccak256('eip1967.proxy.implementation')) - 1)) {
            revert('invalid implementation slot');
        }
    }

    function contractId() external pure override returns (bytes32) {
        return keccak256('test');
    }
}
