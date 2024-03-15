// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import { GasEstimate } from '../../gas/GasEstimate.sol';

contract TestGasEstimate is GasEstimate {
    constructor() {
        if (GAS_SERVICE_SLOT != bytes32(uint256(keccak256("GasEstimate.Slot")) - 1)) {
            revert("TestGasEstimate: invalid slot");
        }
    }

    function updateGasInfo(string calldata chain, GasInfo calldata info) external {
        _setGasInfo(chain, info);
    }
}
