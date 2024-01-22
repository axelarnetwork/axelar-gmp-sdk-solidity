// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import { IBaseWeightedMultisig } from '../interfaces/IBaseWeightedMultisig.sol';
import { ECDSA } from '../libs/ECDSA.sol';

abstract contract BaseWeightedMultisig is IBaseWeightedMultisig {
    // keccak256('WeightedMultisig.Storage');
    bytes32 private constant BASE_WEIGHTED_STORAGE_LOCATION =
        0xa233fbcae4dcfad00091a9d8ff9561f12b3db9ec7227470684b4617d40a38746;

    struct WeightedMultisigStorage {
        uint256 currentSignersEpoch;
        mapping(uint256 => bytes32) hashForSignersEpoch;
        mapping(bytes32 => uint256) signersEpochForHash;
    }

    uint256 internal constant OLD_SIGNERS_RETENTION = 16;

    /**********************\
    |* External Functions *|
    \**********************/

    /*
     * @notice This function returns the current signers epoch
     * @return uint256 The current signers epoch
     */
    function currentSignersEpoch() external view returns (uint256) {
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
    function signersEpochForHash(bytes32 hash) external view returns (uint256) {
        return _baseWeightedStorage().signersEpochForHash[hash];
    }

    /*************************\
    |* Integration Functions *|
    \*************************/
    /*
     * @notice This function takes messageHash and proof data and reverts if proof is invalid
     * @param messageHash The hash of the message that was signed
     * @param weightedSigners The weighted signers data
     * @param signatures The signatures data
     * @return isLatestSigners True if provided signers are the current ones
     */
    function _validateProof(
        bytes32 messageHash,
        bytes calldata weightedSigners,
        bytes[] calldata signatures
    ) internal view returns (bool isLatestSigners) {
        WeightedMultisigStorage storage $ = _baseWeightedStorage();
        bytes32 signersHash = keccak256(weightedSigners);
        uint256 signersEpoch = $.signersEpochForHash[signersHash];
        uint256 currentEpoch = $.currentSignersEpoch;

        isLatestSigners = signersEpoch == currentEpoch;

        if (signatures.length == 0) revert MalformedSignatures();
        if (signersEpoch == 0 || currentEpoch - signersEpoch >= OLD_SIGNERS_RETENTION || weightedSigners.length == 0) revert InvalidSigners();

        WeightedSigners memory signers = abi.decode(weightedSigners, (WeightedSigners));

        _validateSignatures(messageHash, signers, signatures);
    }

    /*
     * @notice This function rotates the current signers with a new set of signers
     * @param newWeightedSigners The new weighted signers data
     */
    function _rotateSigners(bytes memory newWeightedSigners) internal {
        WeightedMultisigStorage storage $ = _baseWeightedStorage();
        WeightedSigners memory newSet = abi.decode(newWeightedSigners, (WeightedSigners));

        // signers must be sorted binary or alphabetically in lower case
        if (newSet.signers.length == 0 || !_isSortedAscAndContainsNoDuplicate(newSet.signers)) revert InvalidSigners();

        uint256 length = newSet.signers.length;
        uint256 totalWeight;
        for (uint256 i; i < length; ++i) {
            uint256 weight = newSet.signers[i].weight;

            if (weight == 0) revert InvalidWeights();

            totalWeight = totalWeight + weight;
        }

        if (newSet.threshold == 0 || totalWeight < newSet.threshold) revert InvalidThreshold();

        bytes32 newSignersHash = keccak256(newWeightedSigners);

        uint256 epoch = $.currentSignersEpoch + 1;
        // slither-disable-next-line costly-loop
        $.currentSignersEpoch = epoch;
        $.hashForSignersEpoch[epoch] = newSignersHash;
        $.signersEpochForHash[newSignersHash] = epoch;

        emit SignersRotated(newSet);
    }

    /**********************\
    |* Internal Functions *|
    \**********************/

    /*
     * @notice This function takes messageHash and proof data and reverts if proof is invalid
     * @param messageHash The hash of the message that was signed
     * @param weighted The weighted signers data
     * @param signatures The signatures data
     */
    function _validateSignatures(
        bytes32 messageHash,
        WeightedSigners memory weighted,
        bytes[] memory signatures
    ) internal pure {
        uint256 signersLength = weighted.signers.length;
        uint256 signaturesLength = signatures.length;
        uint256 signerIndex;
        uint256 totalWeight;
        // looking for signers within signers
        // assuming that both signers and signatures are sorted
        for (uint256 i; i < signaturesLength; ++i) {
            address signer = ECDSA.recover(messageHash, signatures[i]);
            // looping through remaining signers to find a match
            for (; signerIndex < signersLength && signer != weighted.signers[signerIndex].account; ++signerIndex) {}
            // checking if we are out of signers
            if (signerIndex == signersLength) revert MalformedSignatures();
            // accumulating signatures weight
            totalWeight = totalWeight + weighted.signers[signerIndex].weight;
            // weight needs to reach or surpass threshold
            if (totalWeight >= weighted.threshold) return;
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
    function _isSortedAscAndContainsNoDuplicate(WeightedSigner[] memory signers) internal pure returns (bool) {
        uint256 accountsLength = signers.length;
        address prevAccount = signers[0].account;

        if (prevAccount == address(0)) return false;

        for (uint256 i = 1; i < accountsLength; ++i) {
            address currAccount = signers[i].account;

            if (prevAccount >= currAccount) {
                return false;
            }

            prevAccount = currAccount;
        }

        return true;
    }

    /*
     * @notice Gets the storage slot for the WeightedMultisigStorage struct
     * @return the storage slot
     */
    function _baseWeightedStorage() private pure returns (WeightedMultisigStorage storage $) {
        assembly {
            $.slot := BASE_WEIGHTED_STORAGE_LOCATION
        }
    }
}
