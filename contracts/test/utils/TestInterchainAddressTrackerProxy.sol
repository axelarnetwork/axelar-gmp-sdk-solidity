// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import { InterchainAddressTrackerProxy } from '../../utils/InterchainAddressTrackerProxy.sol';

contract TestInterchainAddressTrackerProxy is InterchainAddressTrackerProxy {
    constructor(
        address implementationAddress,
        address owner,
        bytes memory params
    ) InterchainAddressTrackerProxy(implementationAddress, owner, params) {
        contractId();
    }
}
