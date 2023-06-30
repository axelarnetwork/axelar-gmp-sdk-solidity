// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import { IOwnable2Step } from '../interfaces/IOwnable2Step.sol';
import { IOwnable } from '../interfaces/IOwnable.sol';
import { Ownable } from './Ownable.sol';

abstract contract Ownable2Step is Ownable, IOwnable2Step {
    // keccak256('ownership-transfer')
    bytes32 internal constant _OWNERSHIP_TRANSFER_SLOT =
        0x9855384122b55936fbfb8ca5120e63c6537a1ac40caf6ae33502b3c5da8c87d1;

    function pendingOwner() public view returns (address owner_) {
        assembly {
            owner_ := sload(_OWNERSHIP_TRANSFER_SLOT)
        }
    }

    function transferOwnership(address newOwner) external virtual override(Ownable, IOwnable) onlyOwner {
        emit OwnershipTransferStarted(newOwner);

        assembly {
            sstore(_OWNERSHIP_TRANSFER_SLOT, newOwner)
        }
    }

    function acceptOwnership() external virtual {
        address newOwner = pendingOwner();
        if (newOwner != msg.sender) revert InvalidOwner();

        emit OwnershipTransferred(newOwner);

        assembly {
            sstore(_OWNERSHIP_TRANSFER_SLOT, 0)
            sstore(_OWNER_SLOT, newOwner)
        }
    }
}
