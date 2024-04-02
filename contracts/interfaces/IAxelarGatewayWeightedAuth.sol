// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import { IBaseWeightedMultisig } from './IBaseWeightedMultisig.sol';

interface IAxelarGatewayWeightedAuth is IBaseWeightedMultisig {
    function rotateSigners(bytes calldata params) external;
}
