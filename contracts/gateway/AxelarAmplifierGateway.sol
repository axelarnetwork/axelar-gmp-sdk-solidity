// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import { IAxelarAmplifierGateway } from '../interfaces/IAxelarAmplifierGateway.sol';
import { IAxelarGatewayWeightedAuth } from '../interfaces/IAxelarGatewayWeightedAuth.sol';

import { ECDSA } from '../libs/ECDSA.sol';
import { Ownable } from '../utils/Ownable.sol';

contract AxelarAmplifierGateway is Ownable, IAxelarAmplifierGateway {
    // keccak256('AxelarAmplifierGateway.Slot') - 1;
    bytes32 internal constant AXELAR_AMPLIFIER_GATEWAY_SLOT =
        0xca458dc12368669a3b8c292bc21c1b887ab1aa386fa3fcc1ed972afd74a330ca;

    struct AxelarAmplifierGatewayStorage {
        mapping(bytes32 => bool) commands;
        mapping(bytes32 => bool) approvals;
    }

    /**********\
    |* Errors *|
    \**********/

    error InvalidAuthModule();
    error NotSelf();
    error InvalidChainId();
    error InvalidCommands();

    bytes32 internal constant SELECTOR_APPROVE_CONTRACT_CALL = keccak256('approveContractCall');
    bytes32 internal constant SELECTOR_TRANSFER_OPERATORSHIP = keccak256('transferOperatorship');

    IAxelarGatewayWeightedAuth public immutable authModule;

    constructor(address authModule_) Ownable(msg.sender) {
        if (authModule_.code.length == 0) revert InvalidAuthModule();

        authModule = IAxelarGatewayWeightedAuth(authModule_);
    }

    modifier onlySelf() {
        if (msg.sender != address(this)) revert NotSelf();

        _;
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
        AxelarAmplifierGatewayStorage storage slot = _axelarAmplifierGatewayStorage();
        valid = slot.approvals[key];

        if (valid) {
            delete slot.approvals[key];

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

        bytes32 messageHash = ECDSA.toEthSignedMessageHash(keccak256(data));

        // returns true for current operators
        bool allowOperatorshipTransfer = authModule.validateProof(messageHash, proof);

        AxelarAmplifierGatewayStorage storage slot = _axelarAmplifierGatewayStorage();

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

            if (isCommandExecuted(commandId)) continue; /* Ignore if duplicate commandId received */

            bytes4 commandSelector;
            bytes32 commandHash = keccak256(abi.encodePacked(commands[i]));

            if (commandHash == SELECTOR_APPROVE_CONTRACT_CALL) {
                commandSelector = AxelarAmplifierGateway.approveContractCall.selector;
            } else if (commandHash == SELECTOR_TRANSFER_OPERATORSHIP) {
                if (!allowOperatorshipTransfer) continue;

                allowOperatorshipTransfer = false;
                commandSelector = AxelarAmplifierGateway.transferOperatorship.selector;
            } else {
                continue; /* Ignore if unknown command received */
            }

            // Prevent a re-entrancy from executing this command before it can be marked as successful.
            slot.commands[commandId] = true;
            (bool success, ) = address(this).call(abi.encodeWithSelector(commandSelector, params[i], commandId));

            if (success) {
                // slither-disable-next-line reentrancy-events
                emit Executed(commandId);
            } else {
                slot.commands[commandId] = false;
            }
        }
    }

    /******************\
    |* Self Functions *|
    \******************/

    function approveContractCall(bytes calldata params, bytes32 commandId) external onlySelf {
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

    function transferOperatorship(bytes calldata newOperatorsData, bytes32) external onlySelf {
        authModule.transferOperatorship(newOperatorsData);

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
