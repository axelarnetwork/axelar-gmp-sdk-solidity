// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

interface IAxelarAmplifierGatewayAuth {
    /**
     * @notice This function takes messageHash and proof data and reverts if proof is invalid
     * @param dataHash The hash of the message that was signed
     * @param proof The data containing signers with signatures
     * @return isLatestSigners True if provided signers are the current ones
     */
    function validateProof(bytes32 dataHash, bytes calldata proof) external view returns (bool isLatestSigners);

    /**
     * @notice This function rotates the current signers with a new set
     * @param newSigners The data containing the new signers and their weights
     * @param applyRotationDelay True if rotation delay should be applied
     */
    function rotateSigners(bytes calldata newSigners, bool applyRotationDelay) external;
}
