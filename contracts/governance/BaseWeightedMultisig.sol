// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import { IBaseWeightedMultisig } from '../interfaces/IBaseWeightedMultisig.sol';
import { ECDSA } from '../libs/ECDSA.sol';

abstract contract BaseWeightedMultisig is IBaseWeightedMultisig {
    // keccak256('WeightedMultisig.Storage');
    bytes32 private constant BASE_WEIGHTED_STORAGE_LOCATION =
        0xa233fbcae4dcfad00091a9d8ff9561f12b3db9ec7227470684b4617d40a38746;

    struct WeightedMultisigStorage {
        uint256 epoch;
        mapping(uint256 => bytes32) signerHashByEpoch;
        mapping(bytes32 => uint256) epochBySignerHash;
    }

    uint256 public immutable OLD_SIGNERS_RETENTION;

    constructor(uint256 oldSignersRetention) {
        OLD_SIGNERS_RETENTION = oldSignersRetention;
    }

    /**********************\
    |* External Functions *|
    \**********************/

    /*
     * @notice This function returns the current signers epoch
     * @return uint256 The current signers epoch
     */
    function epoch() external view returns (uint256) {
        return _baseWeightedStorage().currentSignersEpoch;
    }

    /*
     * @notice This function returns the signers hash for a given epoch
     * @param epoch The given epoch
     * @return bytes32 The signers hash for the given epoch
     */
    function hashForSignersEpoch(uint256 epoch) external view returns (bytes32) {
        return _baseWeightedStorage().hashForSignersEpoch[epoch];
    }

    /*
     * @notice This function returns the epoch for a given signers hash
     * @param hash The signers hash
     * @return uint256 The epoch for the given signers hash
     */
    function epochBySignerHash(bytes32 signerHash) external view returns (uint256) {
        return _baseWeightedStorage().signersEpochForHash[signerHash];
    }

    /*
     * @notice This function takes messageHash and proof data and reverts if proof is invalid
     * @param messageHash The hash of the message that was signed
     * @param weightedSigners The weighted signers data
     * @param signatures The signatures data
     * @return isLatestSigners True if provided signers are the current ones
     */
    function validateProof(bytes32 messageHash, bytes calldata proof) public view returns (bool isLatestSigners) {
        WeightedMultisigStorage storage slot = _baseWeightedStorage();

        if (proof.length < 32) revert InvalidSigners();

        WeightedSigners memory signers;
        bytes[] memory signatures;

        (signers.accounts, signers.weights, signers.threshold, signatures) = abi.decode(
            proof,
            (address[], uint256[], uint256, bytes[])
        );

        bytes32 signersHash = keccak256(abi.encode(signers.accounts, signers.weights, signers.threshold));
        uint256 epoch = slot.signersEpochForHash[signersHash];
        uint256 currentEpoch = slot.currentSignersEpoch;

        isLatestSigners = epoch == currentEpoch;

        if (signatures.length == 0) revert MalformedSignatures();
        if (epoch == 0 || currentEpoch - epoch > OLD_SIGNERS_RETENTION) revert InvalidSigners();

        _validateSignatures(messageHash, signers, signatures);
    }

    /*************************\
    |* Integration Functions *|
    \*************************/

    /*
     * @notice This function rotates the current signers with a new set of signers
     * @param newWeightedSigners The new weighted signers data
     */
    function _rotateSigners(WeightedSigners memory newSigners) internal {
        WeightedMultisigStorage storage slot = _baseWeightedStorage();

        uint256 length = newSigners.accounts.length;
        uint256 totalWeight;

        // signers must be sorted binary or alphabetically in lower case
        if (length == 0 || !_isSortedAscAndContainsNoDuplicate(newSigners.accounts))
            revert InvalidSigners();

        if (newSigners.weights.length != length) revert InvalidWeights();

        for (uint256 i; i < length; ++i) {
            uint256 weight = newSigners.weights[i];

            if (weight == 0) revert InvalidWeights();

            totalWeight = totalWeight + weight;
        }

        if (newSigners.threshold == 0 || totalWeight < newSigners.threshold) revert InvalidThreshold();

        bytes32 newSignersHash = keccak256(abi.encode(newSigners.accounts, newSigners.weights, newSigners.threshold));

        uint256 epoch = slot.currentSignersEpoch + 1;
        // slither-disable-next-line costly-loop
        slot.currentSignersEpoch = epoch;
        slot.hashForSignersEpoch[epoch] = newSignersHash;
        slot.signersEpochForHash[newSignersHash] = epoch;

        emit SignersRotated(newSigners);
    }

    /**********************\
    |* Internal Functions *|
    \**********************/

    /*
     * @notice This function takes messageHash and proof data and reverts if proof is invalid
     * @param messageHash The hash of the message that was signed
     * @param weighted The weighted signers data
     * @param signatures The sorted signatures data
     */
    function _validateSignatures(
        bytes32 messageHash,
        WeightedSigners memory weightedSigners,
        bytes[] memory signatures
    ) internal pure {
        uint256 signersLength = weightedSigners.accounts.length;
        uint256 signaturesLength = signatures.length;
        uint256 signerIndex;
        uint256 totalWeight;

        // looking for signers within signers
        // this requires both signers and signatures to be sorted
        // having it sorted allows us to avoid the full inner loop to find a match
        for (uint256 i; i < signaturesLength; ++i) {
            address signer = ECDSA.recover(messageHash, signatures[i]);

            // looping through remaining signers to find a match
            for (; signerIndex < signersLength && signer != weightedSigners.accounts[signerIndex]; ++signerIndex) {}

            // checking if we are out of signers
            if (signerIndex == signersLength) revert MalformedSignatures();

            // accumulating signatures weight
            totalWeight = totalWeight + weightedSigners.weights[signerIndex];

            // weight needs to reach or surpass threshold
            if (totalWeight >= weightedSigners.threshold) return;

            // increasing signers index if match was found
            ++signerIndex;
        }
        // if weight sum below threshold
        revert LowSignaturesWeight();
    }

    /*
     * @notice This function checks if the provided signers are sorted and contain no duplicates
     * @param signers The signers to check
     * @return True if the signers are sorted and contain no duplicates
     */
    function _isSortedAscAndContainsNoDuplicate(address[] memory signers) internal pure returns (bool) {
        uint256 signersLength = signers.length;
        address prevSigner = signers[0];

        if (prevSigner == address(0)) return false;

        for (uint256 i = 1; i < signersLength; ++i) {
            address currSigner = signers[i];

            if (prevSigner >= currSigner) {
                return false;
            }

            prevSigner = currSigner;
        }

        return true;
    }

    /*
     * @notice Gets the storage slot for the WeightedMultisigStorage struct
     * @return the storage slot
     */
    function _baseWeightedStorage() private pure returns (WeightedMultisigStorage storage slot) {
        assembly {
            slot.slot := BASE_WEIGHTED_STORAGE_LOCATION
        }
    }
}
