// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

interface IBaseWeightedMultisig {
    error InvalidSigners();
    error InvalidThreshold();
    error MalformedSignatures();
    error LowSignaturesWeight();
    error InvalidWeights();

    struct WeightedSigner {
        address account;
        uint256 weight;
    }

    struct WeightedSigners {
        WeightedSigner[] signers;
        uint256 threshold;
    }

    event SignersRotated(WeightedSigners signers);

    /**
     * @notice Returns the current signers of the multisig
     * @return The current signers of the multisig
     */
    function currentSignersEpoch() external view returns (uint256);

    /**
     * @notice Returns the hash for a given signers epoch
     * @param epoch The epoch to get the hash for
     * @return The hash for the given epoch
     */
    function hashForSignersEpoch(uint256 epoch) external view returns (bytes32);

    /**
     * @notice Returns the epoch for a given hash
     * @param hash The hash to get the epoch for
     * @return The epoch for the given hash
     */
    function signersEpochForHash(bytes32 hash) external view returns (uint256);
}
