// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import { IUpgradable } from '../interfaces/IUpgradable.sol';
import { Ownable } from '../utils/Ownable.sol';

abstract contract Upgradable is Ownable, IUpgradable {
    // bytes32(uint256(keccak256('eip1967.proxy.implementation')) - 1)
    bytes32 internal constant _IMPLEMENTATION_SLOT = 0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc;

    modifier onlyProxy() {
        // Prevent setup from being called on the implementation
        if (implementation() == address(0)) revert NotProxy();

        _;
    }

    function implementation() public view returns (address implementation_) {
        // solhint-disable-next-line no-inline-assembly
        assembly {
            implementation_ := sload(_IMPLEMENTATION_SLOT)
        }
    }

    function upgrade(
        address newImplementation,
        bytes32 newImplementationCodeHash,
        bytes calldata params
    ) external override onlyOwner {
        if (IUpgradable(newImplementation).contractId() != IUpgradable(this).contractId())
            revert InvalidImplementation();
        if (newImplementationCodeHash != newImplementation.codehash) revert InvalidCodeHash();

        if (params.length > 0) {
            // solhint-disable-next-line avoid-low-level-calls
            (bool success, ) = newImplementation.delegatecall(abi.encodeWithSelector(this.setup.selector, params));

            if (!success) revert SetupFailed();
        }

        emit Upgraded(newImplementation);
        // solhint-disable-next-line no-inline-assembly
        assembly {
            sstore(_IMPLEMENTATION_SLOT, newImplementation)
        }
    }

    function setup(bytes calldata data) external override onlyProxy {
        _setup(data);
    }

    // solhint-disable-next-line no-empty-blocks
    function _setup(bytes calldata data) internal virtual {}
}
