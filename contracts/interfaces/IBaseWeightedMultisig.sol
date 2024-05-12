// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

interface IBaseWeightedMultisig {
    error InvalidSigners();
    error InvalidThreshold();
    error MalformedSignatures();
    error LowSignaturesWeight();
    error InvalidWeights();
    error DuplicateSigners(bytes32 signersHash);
    error InsufficientRotationDelay(uint256 minimumRotationDelay, uint256 lastRotationTimestamp, uint256 timeElapsed);

    event SignersRotated(uint256 indexed epoch, bytes32 indexed signersHash, bytes signers);

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
     * @notice This function returns the timestamp for the last signer rotation
     * @return uint256 The last rotation timestamp
     */
    function lastRotationTimestamp() external view returns (uint256);

    /**
     * @notice This function returns the time elapsed (in secs) since the last rotation
     * @return uint256 The time since the last rotation
     */
    function timeSinceRotation() external view returns (uint256);

    /**
     * @notice Compute the message hash that is signed by the weighted signers
     * @param signersHash The hash of the weighted signers that sign off on the data
     * @param dataHash The hash of the data
     * @return The message hash to be signed
     */
    function messageHashToSign(bytes32 signersHash, bytes32 dataHash) external view returns (bytes32);
}
