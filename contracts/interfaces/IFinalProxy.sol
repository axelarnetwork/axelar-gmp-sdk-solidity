// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import { IProxy } from './IProxy.sol';

// General interface for upgradable contracts
interface IFinalProxy is IProxy {
    error NotOwner();

    function finalUpgrade(bytes memory bytecode, bytes calldata setupParams) external returns (address);
}
