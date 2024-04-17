// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import { BaseAmplifierGateway } from '../../gateway/BaseAmplifierGateway.sol';

contract TestBaseAmplifierGateway is BaseAmplifierGateway {
    constructor() BaseAmplifierGateway() {
        if (BASE_AMPLIFIER_GATEWAY_SLOT != bytes32(uint256(keccak256('BaseAmplifierGateway.Slot')) - 1)) {
            revert('BaseAmplifierGateway.Slot');
        }
    }
}
