// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import { AxelarAmplifierGateway } from '../../gateway/AxelarAmplifierGateway.sol';

contract TestAxelarAmplifierGateway is AxelarAmplifierGateway {
    constructor(
        uint256 previousSignersRetention_,
        bytes32 domainSeparator_,
        uint256 minimumRotationDelay_
    ) AxelarAmplifierGateway(previousSignersRetention_, domainSeparator_, minimumRotationDelay_) {
        if (AXELAR_AMPLIFIER_GATEWAY_SLOT != bytes32(uint256(keccak256('AxelarAmplifierGateway.Slot')) - 1)) {
            revert('AxelarAmplifierGateway.Slot');
        }
    }
}
