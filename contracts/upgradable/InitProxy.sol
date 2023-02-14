// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import { IInitProxy } from '../interfaces/IInitProxy.sol';
import { IUpgradable } from '../interfaces/IUpgradable.sol';
import { BaseProxy } from './BaseProxy.sol';

contract InitProxy is BaseProxy, IInitProxy {
    constructor() {
        // solhint-disable-next-line no-inline-assembly
        assembly {
            sstore(_OWNER_SLOT, caller())
        }
    }

    function init(
        address implementationAddress,
        address newOwner,
        bytes memory params
    ) external {
        address owner;
        // solhint-disable-next-line no-inline-assembly
        assembly {
            owner := sload(_OWNER_SLOT)
        }

        if (msg.sender != owner) revert NotOwner();
        if (implementation() != address(0)) revert AlreadyInitialized();

        bytes32 id = contractId();
        if (id != bytes32(0) && IUpgradable(implementationAddress).contractId() != id) revert InvalidImplementation();

        // solhint-disable-next-line no-inline-assembly
        assembly {
            sstore(_IMPLEMENTATION_SLOT, implementationAddress)
            sstore(_OWNER_SLOT, newOwner)
        }
        if (params.length != 0) {
            // solhint-disable-next-line avoid-low-level-calls
            (bool success, ) = implementationAddress.delegatecall(
                abi.encodeWithSelector(BaseProxy.setup.selector, params)
            );
            if (!success) revert SetupFailed();
        }
    }
}
