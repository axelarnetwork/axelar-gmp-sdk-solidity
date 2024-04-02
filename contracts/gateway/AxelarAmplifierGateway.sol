// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import { IAxelarAmplifierGateway } from '../interfaces/IAxelarAmplifierGateway.sol';
import { IAxelarGatewayWeightedAuth } from '../interfaces/IAxelarGatewayWeightedAuth.sol';

import { ECDSA } from '../libs/ECDSA.sol';

contract AxelarAmplifierGateway is IAxelarAmplifierGateway {
    /// @dev This slot contains all the storage for this contract in an upgrade-compatible manner
    // keccak256('AxelarAmplifierGateway.Slot') - 1;
    bytes32 internal constant AXELAR_AMPLIFIER_GATEWAY_SLOT =
        0xca458dc12368669a3b8c292bc21c1b887ab1aa386fa3fcc1ed972afd74a330ca;

    struct AxelarAmplifierGatewayStorage {
        mapping(bytes32 => bool) commands;
        mapping(bytes32 => bool) approvals;
    }

    IAxelarGatewayWeightedAuth public immutable authModule;
    bytes32 public immutable domainSeparator;

    constructor(address authModule_, bytes32 domainSeparator_) {
        if (authModule_.code.length == 0) revert InvalidAuthModule();

        authModule = IAxelarGatewayWeightedAuth(authModule_);
        domainSeparator = domainSeparator_;
    }

    /******************\
    |* Public Methods *|
    \******************/

    function callContract(
        string calldata destinationChain,
        string calldata destinationContractAddress,
        bytes calldata payload
    ) external {
        emit ContractCall(msg.sender, destinationChain, destinationContractAddress, keccak256(payload), payload);
    }

    function isContractCallApproved(
        bytes32 commandId,
        string calldata sourceChain,
        string calldata sourceAddress,
        address contractAddress,
        bytes32 payloadHash
    ) external view override returns (bool) {
        return _isContractCallApproved(commandId, sourceChain, sourceAddress, contractAddress, payloadHash);
    }

    function isMessageApproved(
        string calldata messageId,
        string calldata sourceChain,
        string calldata sourceAddress,
        address contractAddress,
        bytes32 payloadHash
    ) external view override returns (bool) {
        bytes32 commandId = keccak256(bytes(messageId));
        return _isContractCallApproved(commandId, sourceChain, sourceAddress, contractAddress, payloadHash);
    }

    function validateContractCall(
        bytes32 commandId,
        string calldata sourceChain,
        string calldata sourceAddress,
        bytes32 payloadHash
    ) external override returns (bool valid) {
        valid = _validateContractCall(commandId, sourceChain, sourceAddress, payloadHash);
    }

    function validateMessage(
        string calldata messageId,
        string calldata sourceChain,
        string calldata sourceAddress,
        bytes32 payloadHash
    ) external override returns (bool valid) {
        bytes32 commandId = keccak256(bytes(messageId));
        valid = _validateContractCall(commandId, sourceChain, sourceAddress, payloadHash);
    }

    function isCommandExecuted(bytes32 commandId) public view override returns (bool) {
        return _storage().commands[commandId];
    }

    /**********************\
    |* External Functions *|
    \**********************/

    function verifyMessages(SignedMessageBatch calldata signedBatch) public {
        bytes memory data = abi.encode(signedBatch.messages);

        _validate(CommandType.VerifyMessages, data, signedBatch.proof);

        Message[] calldata messages = signedBatch.messages;

        for (uint256 i; i < messages.length; ++i) {
            Message calldata message = messages[i];
            bytes32 commandId = keccak256(bytes(message.messageId));

            // Ignore if commandId is already executed
            if (isCommandExecuted(commandId)) {
                continue;
            }

            _approveMessage(commandId, message);

            _storage().commands[commandId] = true;

            // slither-disable-next-line reentrancy-events
            emit Executed(commandId);
        }
    }

    function rotateSigners(SignedRotation calldata signedRotation) public {
        bytes memory data = abi.encode(signedRotation.rotation);
        // TODO: prefix with CommandType for domain separation
        bytes32 commandId = keccak256(data);

        if (isCommandExecuted(commandId)) {
            revert CommandAlreadyExecuted(commandId);
        }

        bool isLatestSigners = _validate(CommandType.RotateSigners, data, signedRotation.proof);
        if (!isLatestSigners) {
            revert NotLatestSigners();
        }

        authModule.rotateSigners(signedRotation.rotation.newSigners);

        emit OperatorshipTransferred(data);
    }

    /**********************\
    |* Internal Functions *|
    \**********************/

    function _validate(CommandType commandType, bytes memory data, Proof calldata proof) internal view returns (bool) {
        if (domainSeparator != proof.domainSeparator) revert InvalidDomainSeparator();

        // TODO: use SignData struct
        data = abi.encode(commandType, proof.domainSeparator, proof.signerCommitment, data);
        bytes32 dataHash = ECDSA.toEthSignedMessageHash(keccak256(data));

        // TODO: check proof.signerCommitment
        return authModule.validateProof(dataHash, proof.proof);
    }

    function _isContractCallApproved(
        bytes32 commandId,
        string calldata sourceChain,
        string calldata sourceAddress,
        address contractAddress,
        bytes32 payloadHash
    ) internal view returns (bool) {
        bytes32 key = _getIsContractCallApprovedKey(
            commandId,
            sourceChain,
            sourceAddress,
            contractAddress,
            payloadHash
        );
        return _storage().approvals[key];
    }

    function _validateContractCall(
        bytes32 commandId,
        string calldata sourceChain,
        string calldata sourceAddress,
        bytes32 payloadHash
    ) internal returns (bool valid) {
        bytes32 key = _getIsContractCallApprovedKey(commandId, sourceChain, sourceAddress, msg.sender, payloadHash);
        valid = _storage().approvals[key];

        if (valid) {
            delete _storage().approvals[key];

            emit ContractCallExecuted(commandId);
        }
    }

    function _approveMessage(bytes32 commandId, Message calldata message) internal {
        bytes32 key = _getIsContractCallApprovedKey(
            commandId,
            message.sourceChain,
            message.sourceAddress,
            message.contractAddress,
            message.payloadHash
        );
        _storage().approvals[key] = true;

        emit ContractCallApproved(
            commandId,
            message.sourceChain,
            message.sourceAddress,
            message.contractAddress,
            message.payloadHash,
            message.messageId
        );
    }

    /********************\
    |* Pure Key Getters *|
    \********************/

    function _getIsContractCallApprovedKey(
        bytes32 commandId,
        string memory sourceChain,
        string memory sourceAddress,
        address contractAddress,
        bytes32 payloadHash
    ) internal pure returns (bytes32) {
        return keccak256(abi.encode(commandId, sourceChain, sourceAddress, contractAddress, payloadHash));
    }

    /**
     * @notice Gets the specific storage location for preventing upgrade collisions
     * @return slot containing the AxelarAmplifierGatewayStorage struct
     */
    function _storage() private pure returns (AxelarAmplifierGatewayStorage storage slot) {
        assembly {
            slot.slot := AXELAR_AMPLIFIER_GATEWAY_SLOT
        }
    }
}
