// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import { Proxy } from '../upgradable/Proxy.sol';

contract AxelarAmplifierGatewayProxy is Proxy {
    bytes32 public constant CONTRACT_ID = keccak256('axelar-amplifier-gateway');

    constructor(
        address implementationAddress,
        address owner,
        bytes memory setupParams
    ) Proxy(implementationAddress, owner, setupParams) {}

    function contractId() internal pure override returns (bytes32) {
        return CONTRACT_ID;
    }
}
