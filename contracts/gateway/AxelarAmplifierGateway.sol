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

    /***********\
    |* Getters *|
    \***********/

    function isCommandExecuted(bytes32 commandId) public view override returns (bool) {
        return _storage().commands[commandId];
    }

    /**********************\
    |* External Functions *|
    \**********************/

    function execute(SignedCommandBatch calldata signedBatch) external {
        CommandBatch calldata batch = signedBatch.batch;
        bytes memory data = abi.encode(batch);

        // This is the EVM convention for signing non-tx data to domain separate from regular EVM txs.
        // This should be customized per chain.
        bytes32 batchHash = ECDSA.toEthSignedMessageHash(keccak256(data));

        // returns true for current operators
        bool allowOperatorshipTransfer = authModule.validateProof(batchHash, signedBatch.proof);

        if (domainSeparator != signedBatch.batch.domainSeparator) revert InvalidDomainSeparator();

        Command[] calldata commands = batch.commands;

        for (uint256 i; i < commands.length; ++i) {
            Command calldata command = commands[i];
            bytes32 commandId = keccak256(bytes(command.messageId));

            // Ignore if commandId is already executed
            if (isCommandExecuted(commandId)) {
                continue;
            }

            if (command.commandType == CommandType.ApproveContractCall) {
                _approveContractCall(commandId, command);
            } else if (command.commandType == CommandType.TransferOperatorship) {
                if (!allowOperatorshipTransfer) {
                    continue;
                }

                allowOperatorshipTransfer = false;

                _transferOperatorship(command.params);
            } else {
                revert InvalidCommand();
            }

            _storage().commands[commandId] = true;

            // slither-disable-next-line reentrancy-events
            emit Executed(commandId, command.messageId);
        }
    }

    /**********************\
    |* Internal Functions *|
    \**********************/

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

    function _approveContractCall(bytes32 commandId, Command calldata command) internal {
        ContractCallApprovalParams memory params = abi.decode(command.params, (ContractCallApprovalParams));

        bytes32 key = _getIsContractCallApprovedKey(
            commandId,
            params.sourceChain,
            params.sourceAddress,
            params.contractAddress,
            params.payloadHash
        );
        _storage().approvals[key] = true;

        emit ContractCallApproved(
            commandId,
            params.sourceChain,
            params.sourceAddress,
            params.contractAddress,
            params.payloadHash,
            command.messageId
        );
    }

    function _transferOperatorship(bytes calldata newOperatorsData) internal {
        TransferOperatorshipParams memory params = abi.decode(newOperatorsData, (TransferOperatorshipParams));

        authModule.transferOperatorship(params.newOperators);

        // slither-disable-next-line reentrancy-events
        emit OperatorshipTransferred(newOperatorsData);
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
