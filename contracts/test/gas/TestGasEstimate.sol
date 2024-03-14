// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import { GasEstimate } from '../../gas/GasEstimate.sol';

contract TestGasEstimate is GasEstimate {
    function updateGasInfo(string calldata chain, GasInfo calldata info) external {
        _setGasInfo(chain, info);
    }
}
