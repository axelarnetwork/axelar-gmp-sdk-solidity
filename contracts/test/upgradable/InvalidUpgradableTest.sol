// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import { Upgradable } from '../../upgradable/Upgradable.sol';

contract InvalidUpgradableTest is Upgradable {
    function contractId() external pure override returns (bytes32) {
        return keccak256('invalid');
    }

    function _setup(bytes calldata data) internal override {}
}
