// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import { IBaseWeightedMultisig } from './IBaseWeightedMultisig.sol';
import { IAxelarAmplifierGatewayAuth } from './IAxelarAmplifierGatewayAuth.sol';

interface IAxelarAmplifierAuth is IBaseWeightedMultisig, IAxelarAmplifierGatewayAuth {}
