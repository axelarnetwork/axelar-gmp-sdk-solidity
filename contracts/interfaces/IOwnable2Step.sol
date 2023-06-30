// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import { IOwnable } from './IOwnable.sol';

// General interface for upgradable contracts
interface IOwnable2Step is IOwnable {
    error InvalidOwner();

    event OwnershipTransferStarted(address indexed newOwner);

    // Get pending ownership transfer
    function pendingOwner() external view returns (address);

    function acceptOwnership() external;
}
