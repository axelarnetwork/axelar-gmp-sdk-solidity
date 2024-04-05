// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import { IBaseWeightedMultisig } from './IBaseWeightedMultisig.sol';

interface IAxelarGatewayWeightedAuth is IBaseWeightedMultisig {
    /**
     * @notice This function rotates the current signers with a new set
     * @param newSigners The data containing the new signers and their weights
     */
    function rotateSigners(bytes calldata newSigners) external;
}
