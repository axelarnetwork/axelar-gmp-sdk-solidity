// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import '../interfaces/IUpgradable.sol';

abstract contract Upgradable is IUpgradable {
    // bytes32(uint256(keccak256('eip1967.proxy.implementation')) - 1)
    bytes32 internal constant _IMPLEMENTATION_SLOT = 0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc;
    // keccak256('owner')
    bytes32 internal constant _OWNER_SLOT = 0x02016836a56b71f0d02689e69e326f4f4c1b9057164ef592671cf0d37c8040c0;
    // keccak256('ownership-transfer')
    bytes32 internal constant _OWNERSHIP_TRANSFER_SLOT = 0x9855384122b55936fbfb8ca5120e63c6537a1ac40caf6ae33502b3c5da8c87d1;

    modifier onlyOwner() {
        if (owner() != msg.sender) revert NotOwner();
        _;
    }

    function owner() public view returns (address owner_) {
        // solhint-disable-next-line no-inline-assembly
        assembly {
            owner_ := sload(_OWNER_SLOT)
        }
    }

    function pendingOwner() public view returns (address owner_) {
        // solhint-disable-next-line no-inline-assembly
        assembly {
            owner_ := sload(_OWNERSHIP_TRANSFER_SLOT)
        }
    }

    function transferOwnership(address newOwner) external virtual onlyOwner {
        emit OwnershipTransferStarted(newOwner);
        // solhint-disable-next-line no-inline-assembly
        assembly {
            sstore(_OWNERSHIP_TRANSFER_SLOT, newOwner)
        }
    }

    function acceptOwnership() external virtual onlyOwner {
        address newOwner = pendingOwner();
        if (newOwner != msg.sender) revert InvalidOwner();

        emit OwnershipTransferred(newOwner);
        // solhint-disable-next-line no-inline-assembly
        assembly {
            sstore(_OWNERSHIP_TRANSFER_SLOT, 0)
            sstore(_OWNER_SLOT, newOwner)
        }
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

    function setup(bytes calldata data) external override {
        // Prevent setup from being called on the implementation
        if (implementation() == address(0)) revert NotProxy();

        _setup(data);
    }

    // solhint-disable-next-line no-empty-blocks
    function _setup(bytes calldata data) internal virtual {}
}
