// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

interface IBaseWeightedMultisig {
    error InvalidSigners();
    error InvalidThreshold();
    error MalformedSignatures();
    error LowSignaturesWeight();
    error InvalidWeights();

    struct WeightedSigners {
        address[] accounts;
        uint256[] weights;
        uint256 threshold;
    }

    event SignersRotated(WeightedSigners signers);

    /**
     * @dev This function returns the old signers retention period
     * @return uint256 The old signers retention period
     */
    function OLD_SIGNERS_RETENTION() external view returns (uint256);

    /*
     * @dev This function returns the current signers epoch
     * @return uint256 The current signers epoch
     */
    function signersEpoch() external view returns (uint256);

    /**
     * @dev Returns the hash for a given signers epoch
     * @param epoch The epoch to get the hash for
     * @return The hash for the given epoch
     */
    function hashForSignersEpoch(uint256 epoch) external view returns (bytes32);

    /**
     * @dev Returns the epoch for a given hash
     * @param hash The hash to get the epoch for
     * @return The epoch for the given hash
     */
    function signersEpochForHash(bytes32 hash) external view returns (uint256);

    /*
     * @notice This function takes messageHash and proof data and reverts if proof is invalid
     * @param messageHash The hash of the message that was signed
     * @param weightedSigners The weighted signers data
     * @param signatures The signatures data
     * @return isLatestSigners True if provided signers are the current ones
     */
    function validateProof(bytes32 messageHash, bytes calldata proof) external view returns (bool isLatestSigners);
}
