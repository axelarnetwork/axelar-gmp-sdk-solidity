// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

interface IBaseWeightedMultisig {
    error InvalidSigners();
    error InvalidThreshold();
    error MalformedSignatures();
    error LowSignaturesWeight();
    error InvalidWeights();

    event SignersRotated(address[] signers, uint256[] weights, uint256 threshold);

    /**
     * @notice This struct represents the weighted signers payload
     * @param signers The list of signers
     * @param weights The list of weights
     * @param threshold The threshold for the signers
     */
    struct WeightedSigners {
        address[] signers;
        uint256[] weights;
        uint256 threshold;
    }

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
     * @notice This function takes messageHash and proof data and reverts if proof is invalid
     * @param messageHash The hash of the message that was signed
     * @param proof The data containing signers with signatures
     * @return isLatestSigners True if provided signers are the current ones
     */
    function validateProof(bytes32 messageHash, bytes calldata proof) external view returns (bool isLatestSigners);
}
