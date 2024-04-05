// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import { WeightedSigners } from '../types/WeightedSigners.sol';

interface IBaseWeightedMultisig {
    error InvalidSigners();
    error InvalidThreshold();
    error MalformedSignatures();
    error LowSignaturesWeight();
    error InvalidWeights();

    event SignersRotated(uint256 indexed epoch, bytes32 indexed signersHash, WeightedSigners signers);

    /**
     * @dev This function returns the old signers retention period
     * @return uint256 The old signers retention period
     */
    function previousSignersRetention() external view returns (uint256);

    /**
     * @dev This function returns the current signers epoch
     * @return uint256 The current signers epoch
     */
    function epoch() external view returns (uint256);

    /**
     * @dev Returns the hash for a given signers epoch
     * @param signerEpoch The epoch to get the hash for
     * @return The hash for the given epoch
     */
    function signerHashByEpoch(uint256 signerEpoch) external view returns (bytes32);

    /**
     * @dev Returns the epoch for a given hash
     * @param signerHash The hash to get the epoch for
     * @return The epoch for the given hash
     */
    function epochBySignerHash(bytes32 signerHash) external view returns (uint256);

    /**
     * @dev This function is used to hash the data with auth related data to compute the message hash that will be signed
     * @param signersHash The hash of the weighted signers that sign off on the data
     * @param dataHash The hash of the data
     * @return The message hash to be signed
     */
    function hashMessage(bytes32 signersHash, bytes32 dataHash) external view returns (bytes32);

    /**
     * @notice This function takes messageHash and proof data and reverts if proof is invalid
     * @param messageHash The hash of the message that was signed
     * @param proof The data containing signers with signatures
     * @return isLatestSigners True if provided signers are the current ones
     */
    function validateProof(bytes32 messageHash, bytes calldata proof) external view returns (bool isLatestSigners);
}
