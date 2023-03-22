// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import { IAxelarExecutable } from './IAxelarExecutable.sol';

interface IExpressExecutable is IAxelarExecutable {
    function acceptExpressCallWithToken(
        address caller, /*caller*/
        string calldata sourceChain, /*sourceChain*/
        string calldata sourceAddress, /*sourceAddress*/
        bytes32 payloadHash, /*payloadHash*/
        string calldata tokenSymbol, /*tokenSymbol*/
        uint256 /*amount*/
    ) external returns (bool);
}
