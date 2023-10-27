// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import { InterchainRouterProxy } from '../../utils/InterchainRouterProxy.sol';

contract TestInterchainRouterProxy is InterchainRouterProxy {
    constructor(
        address implementationAddress,
        address owner,
        bytes memory params
    ) InterchainRouterProxy(implementationAddress, owner, params) {
        contractId();
    }
}