// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import { IAxelarAmplifierGateway } from '../interfaces/IAxelarAmplifierGateway.sol';
import { IAxelarAmplifierGatewayAuth } from '../interfaces/IAxelarAmplifierGatewayAuth.sol';

contract AxelarAmplifierGateway is IAxelarAmplifierGateway {
    // keccak256('AxelarAmplifierGateway.Slot') - 1;
    bytes32 internal constant AXELAR_AMPLIFIER_GATEWAY_SLOT =
        0xca458dc12368669a3b8c292bc21c1b887ab1aa386fa3fcc1ed972afd74a330ca;

    struct AxelarAmplifierGatewayStorage {
        mapping(bytes32 => bool) commands;
        mapping(bytes32 => bool) approvals;
    }

    bytes32 internal constant SELECTOR_APPROVE_CONTRACT_CALL = keccak256('approveContractCall');
    bytes32 internal constant SELECTOR_TRANSFER_OPERATORSHIP = keccak256('transferOperatorship');

    IAxelarAmplifierGatewayAuth public immutable authModule;

    constructor(address authModule_) {
        if (authModule_.code.length == 0) revert InvalidAuthModule();

        authModule = IAxelarAmplifierGatewayAuth(authModule_);
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
        bytes32 key = _getIsContractCallApprovedKey(
            commandId,
            sourceChain,
            sourceAddress,
            contractAddress,
            payloadHash
        );
        return _axelarAmplifierGatewayStorage().approvals[key];
    }

    function validateContractCall(
        bytes32 commandId,
        string calldata sourceChain,
        string calldata sourceAddress,
        bytes32 payloadHash
    ) external override returns (bool valid) {
        bytes32 key = _getIsContractCallApprovedKey(commandId, sourceChain, sourceAddress, msg.sender, payloadHash);
        valid = _axelarAmplifierGatewayStorage().approvals[key];

        if (valid) {
            delete _axelarAmplifierGatewayStorage().approvals[key];

            emit ContractCallExecuted(commandId);
        }
    }

    /***********\
    |* Getters *|
    \***********/

    function isCommandExecuted(bytes32 commandId) public view override returns (bool) {
        return _axelarAmplifierGatewayStorage().commands[commandId];
    }

    /**********************\
    |* External Functions *|
    \**********************/

    function execute(bytes calldata batch) external {
        (bytes memory data, bytes memory proof) = abi.decode(batch, (bytes, bytes));

        bytes32 messageHash = keccak256(data);

        // returns true for current operators
        bool allowOperatorshipTransfer = authModule.validateProof(messageHash, proof);

        uint256 chainId;
        bytes32[] memory commandIds;
        string[] memory commands;
        bytes[] memory params;

        (chainId, commandIds, commands, params) = abi.decode(data, (uint256, bytes32[], string[], bytes[]));

        if (chainId != block.chainid) revert InvalidChainId();

        uint256 commandsLength = commandIds.length;

        if (commandsLength != commands.length || commandsLength != params.length) revert InvalidCommands();

        for (uint256 i; i < commandsLength; ++i) {
            bytes32 commandId = commandIds[i];

            // Ignore if commandId is already executed
            if (isCommandExecuted(commandId)) {
                continue;
            }

            bytes32 commandHash = keccak256(abi.encodePacked(commands[i]));

            if (commandHash == SELECTOR_APPROVE_CONTRACT_CALL) {
                _approveContractCall(params[i], commandId);
            } else if (commandHash == SELECTOR_TRANSFER_OPERATORSHIP) {
                if (!allowOperatorshipTransfer) {
                    continue;
                }

                allowOperatorshipTransfer = false;

                _transferOperatorship(params[i]);
            } else {
                revert InvalidCommand(commandHash);
            }

            _axelarAmplifierGatewayStorage().commands[commandId] = true;

            // slither-disable-next-line reentrancy-events
            emit Executed(commandId);
        }
    }

    /**********************\
    |* Internal Functions *|
    \**********************/

    function _approveContractCall(bytes memory params, bytes32 commandId) internal {
        (
            string memory sourceChain,
            string memory sourceAddress,
            address contractAddress,
            bytes32 payloadHash,
            bytes32 sourceTxHash,
            uint256 sourceEventIndex
        ) = abi.decode(params, (string, string, address, bytes32, bytes32, uint256));

        bytes32 key = _getIsContractCallApprovedKey(
            commandId,
            sourceChain,
            sourceAddress,
            contractAddress,
            payloadHash
        );
        _axelarAmplifierGatewayStorage().approvals[key] = true;

        emit ContractCallApproved(
            commandId,
            sourceChain,
            sourceAddress,
            contractAddress,
            payloadHash,
            sourceTxHash,
            sourceEventIndex
        );
    }

    function _transferOperatorship(bytes memory newOperatorsData) internal {
        authModule.rotateSigners(newOperatorsData);

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
     * @return slot containing the WeightedMultisigStorage struct
     */
    function _axelarAmplifierGatewayStorage() private pure returns (AxelarAmplifierGatewayStorage storage slot) {
        assembly {
            slot.slot := AXELAR_AMPLIFIER_GATEWAY_SLOT
        }
    }
}
