// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import { Implementation } from '../../upgradable/Implementation.sol';

contract TestImplementation is Implementation {
    uint256 public val;

    function setup(bytes calldata params) external override onlyProxy {
        val = abi.decode(params, (uint256));
    }

    function contractId() external pure override returns (bytes32) {
        return keccak256('TestImplementation');
    }
}
