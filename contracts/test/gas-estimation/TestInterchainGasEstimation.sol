// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import { GasInfo } from '../../types/GasEstimationTypes.sol';
import { InterchainGasEstimation } from '../../gas-estimation/InterchainGasEstimation.sol';

contract TestInterchainGasEstimation is InterchainGasEstimation {
    constructor() {
        if (GAS_SERVICE_SLOT != bytes32(uint256(keccak256('GasEstimate.Slot')) - 1)) {
            revert('TestGasEstimate: invalid slot');
        }
    }

    function updateGasInfo(string calldata chain, GasInfo calldata info) external {
        _setGasInfo(chain, info);
    }
}
