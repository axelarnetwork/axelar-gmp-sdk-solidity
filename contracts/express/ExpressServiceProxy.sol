// SPDX-License-Identifier: MIT

pragma solidity ^0.8.9;

import { FinalProxy } from '../upgradable/FinalProxy.sol';

contract ExpressServiceProxy is FinalProxy {
    constructor(
        address implementationAddress,
        address owner,
        bytes memory setupParams
    ) FinalProxy(implementationAddress, owner, setupParams) {}

    function contractId() internal pure override returns (bytes32) {
        return keccak256('axelar-gmp-express-service');
    }
}
