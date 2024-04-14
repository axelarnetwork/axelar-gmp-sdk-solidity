// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import { IBaseWeightedMultisig } from '../interfaces/IBaseWeightedMultisig.sol';
import { ECDSA } from '../libs/ECDSA.sol';
import { WeightedSigner, WeightedSigners, Proof } from '../types/WeightedMultisigTypes.sol';

/**
    @title BaseWeightedMultisig Contract
    @notice Base contract to build a weighted multisig verification
*/
abstract contract BaseWeightedMultisig is IBaseWeightedMultisig {
    // keccak256('BaseWeightedMultisig.Slot') - 1;
    bytes32 internal constant BASE_WEIGHTED_MULTISIG_SLOT =
        0x457f3fc26bf430b020fe76358b1bfaba57e1657ace718da6437cda9934eabfe8;

    struct BaseWeightedMultisigStorage {
        uint256 epoch;
        mapping(uint256 => bytes32) signerHashByEpoch;
        mapping(bytes32 => uint256) epochBySignerHash;
    }

    /// @dev Previous signers retention. 0 means only the current signers are valid
    /// @return The number of epochs to keep the signers valid for signature verification
    uint256 public immutable previousSignersRetention;

    /// @dev The domain separator for the signer proof
    /// @return The domain separator for the signer proof
    bytes32 public immutable domainSeparator;

    /// @param previousSignersRetentionEpochs The number of epochs to keep previous signers valid for signature verification
    constructor(uint256 previousSignersRetentionEpochs, bytes32 domainSeparator_) {
        previousSignersRetention = previousSignersRetentionEpochs;
        domainSeparator = domainSeparator_;
    }

    /**********************\
    |* External Functions *|
    \**********************/

    /**
     * @notice This function returns the current signers epoch
     * @return uint256 The current signers epoch
     */
    function epoch() external view returns (uint256) {
        return _baseWeightedMultisigStorage().epoch;
    }

    /**
     * @notice This function returns the signers hash for a given epoch
     * @param signerEpoch The given epoch
     * @return bytes32 The signers hash for the given epoch
     */
    function signerHashByEpoch(uint256 signerEpoch) external view returns (bytes32) {
        return _baseWeightedMultisigStorage().signerHashByEpoch[signerEpoch];
    }

    /**
     * @notice This function returns the epoch for a given signers hash
     * @param signerHash The signers hash
     * @return uint256 The epoch for the given signers hash
     */
    function epochBySignerHash(bytes32 signerHash) external view returns (uint256) {
        return _baseWeightedMultisigStorage().epochBySignerHash[signerHash];
    }

    /*************************\
    |* Integration Functions *|
    \*************************/

    /**
     * @notice This function takes dataHash and proof data and reverts if proof is invalid
     * @param dataHash The hash of the message that was signed
     * @param proof The multisig proof data
     * @return isLatestSigners True if the proof is from the latest signer set
     * @dev The proof data should have signers, weights, threshold and signatures encoded
     *      The signers and signatures should be sorted by signer address in ascending order
     *      Example: abi.encode([0x11..., 0x22..., 0x33...], [1, 1, 1], 2, [signature1, signature3])
     */
    function _validateProof(bytes32 dataHash, Proof calldata proof) internal view returns (bool isLatestSigners) {
        BaseWeightedMultisigStorage storage slot = _baseWeightedMultisigStorage();

        WeightedSigners calldata signers = proof.signers;

        bytes32 signersHash = keccak256(abi.encode(signers));
        uint256 signerEpoch = slot.epochBySignerHash[signersHash];
        uint256 currentEpoch = slot.epoch;

        isLatestSigners = signerEpoch == currentEpoch;

        if (signerEpoch == 0 || currentEpoch - signerEpoch > previousSignersRetention) revert InvalidSigners();

        bytes32 messageHash = messageHashToSign(signersHash, dataHash);

        _validateSignatures(messageHash, signers, proof.signatures);
    }

    /**
     * @notice This function rotates the current signers with a new set of signers
     * @param newSigners The new weighted signers data
     * @dev The signers should be sorted by signer address in ascending order
     */
    function _rotateSigners(WeightedSigners memory newSigners) internal {
        BaseWeightedMultisigStorage storage slot = _baseWeightedMultisigStorage();

        _validateSigners(newSigners);

        bytes memory newSignersData = abi.encode(newSigners);
        bytes32 newSignersHash = keccak256(newSignersData);

        uint256 newEpoch = slot.epoch + 1;
        slot.epoch = newEpoch;
        slot.signerHashByEpoch[newEpoch] = newSignersHash;
        // if signer set is the same, old epoch will be overwritten
        slot.epochBySignerHash[newSignersHash] = newEpoch;

        emit SignersRotated(newEpoch, newSignersHash, newSignersData);
    }

    /**********************\
    |* Internal Functions *|
    \**********************/

    /**
     * @notice This function takes messageHash and proof data and reverts if proof is invalid
     * @param messageHash The hash of the message that was signed
     * @param weightedSigners The weighted signers data
     * @param signatures The sorted signatures data
     * @dev The signers and signatures should be sorted by signer address in ascending order
     */
    function _validateSignatures(
        bytes32 messageHash,
        WeightedSigners calldata weightedSigners,
        bytes[] calldata signatures
    ) internal pure {
        WeightedSigner[] calldata signers = weightedSigners.signers;
        uint256 signersLength = signers.length;
        uint256 signaturesLength = signatures.length;
        uint256 signerIndex;
        uint256 totalWeight;

        if (signaturesLength == 0) revert LowSignaturesWeight();

        // looking for signers within signers
        // this requires both signers and signatures to be sorted
        // having it sorted allows us to avoid the full inner loop to find a match
        for (uint256 i; i < signaturesLength; ++i) {
            address recoveredSigner = ECDSA.recover(messageHash, signatures[i]);

            // looping through remaining signers to find a match
            for (; signerIndex < signersLength && recoveredSigner != signers[signerIndex].signer; ++signerIndex) {}

            // checking if we are out of signers
            if (signerIndex == signersLength) revert MalformedSignatures();

            // accumulating signatures weight
            totalWeight = totalWeight + signers[signerIndex].weight;

            // weight needs to reach or surpass threshold
            if (totalWeight >= weightedSigners.threshold) return;

            // increasing signers index if match was found
            ++signerIndex;
        }

        // if weight sum below threshold
        revert LowSignaturesWeight();
    }

    /**
     * @notice Compute the message hash that is signed by the weighted signers
     * @dev Returns an Ethereum Signed Message, created from `domainSeparator`, `signersHash`, and `dataHash`.
     * This replicates the behavior of the
     * https://github.com/ethereum/wiki/wiki/JSON-RPC#eth_sign[`eth_sign`]
     * JSON-RPC method.
     *
     * See {recover}.
     *
     * @param signersHash The hash of the weighted signers that sign off on the data
     * @param dataHash The hash of the data
     * @return The message hash to be signed
     */
    function messageHashToSign(bytes32 signersHash, bytes32 dataHash) public view returns (bytes32) {
        // 96 is the length of the trailing bytes
        return keccak256(abi.encodePacked('\x19Ethereum Signed Message:\n96', domainSeparator, signersHash, dataHash));
    }

    /**
     * @notice This function checks if the provided signers are valid, i.e sorted and contain no duplicates, with valid weights and threshold
     * @dev If signers are invalid, the method will revert
     * @param weightedSigners The weighted signers
     */
    function _validateSigners(WeightedSigners memory weightedSigners) internal pure {
        WeightedSigner[] memory signers = weightedSigners.signers;
        uint256 length = signers.length;
        uint256 totalWeight;

        if (length == 0) revert InvalidSigners();

        // since signers need to be in strictly increasing order,
        // this prevents address(0) from being a valid signer
        address prevSigner = address(0);

        for (uint256 i = 0; i < length; ++i) {
            WeightedSigner memory weightedSigner = signers[i];
            address currSigner = weightedSigner.signer;

            if (prevSigner >= currSigner) {
                revert InvalidSigners();
            }

            prevSigner = currSigner;

            uint256 weight = weightedSigner.weight;

            if (weight == 0) revert InvalidWeights();

            totalWeight = totalWeight + weight;
        }

        uint128 threshold = weightedSigners.threshold;
        if (threshold == 0 || totalWeight < threshold) revert InvalidThreshold();
    }

    /**
     * @notice Gets the specific storage location for preventing upgrade collisions
     * @return slot containing the BaseWeightedMultisigStorage struct
     */
    function _baseWeightedMultisigStorage() private pure returns (BaseWeightedMultisigStorage storage slot) {
        assembly {
            slot.slot := BASE_WEIGHTED_MULTISIG_SLOT
        }
    }
}
