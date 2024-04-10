// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import { IBaseWeightedMultisig } from './IBaseWeightedMultisig.sol';
import { IAxelarAmplifierGatewayAuth } from './IAxelarAmplifierGatewayAuth.sol';

/**
 * @title IAxelarAmplifierAuth Interface
 * @notice This interface defines the functions that the Axelar Amplifier Auth contract supports
 */
interface IAxelarAmplifierAuth is IBaseWeightedMultisig, IAxelarAmplifierGatewayAuth {

}
