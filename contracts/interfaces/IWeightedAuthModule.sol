// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import { IBaseWeightedMultisig } from './IBaseWeightedMultisig.sol';

interface IWeightedAuthModule is IBaseWeightedMultisig {
    function transferOperatorship(bytes calldata params) external;
}
