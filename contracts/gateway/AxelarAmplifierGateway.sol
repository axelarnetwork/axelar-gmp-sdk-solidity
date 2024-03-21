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
        string chainName;
        mapping(bytes32 => bool) commands;
        mapping(bytes32 => bool) approvals;
    }

    IAxelarGatewayWeightedAuth public immutable authModule;
    bytes32 public immutable chainNameHash;

    constructor(string memory chainName, address authModule_) {
        if (authModule_.code.length == 0) revert InvalidAuthModule();

        authModule = IAxelarGatewayWeightedAuth(authModule_);

        _axelarAmplifierGatewayStorage().chainName = chainName;
        chainNameHash = keccak256(bytes(chainName));
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

    function execute(SignedCommandBatch calldata signedBatch) external {
        CommandBatch calldata batch = signedBatch.batch;
        bytes memory data = abi.encode(batch);

        // This is the EVM convention for signing non-tx data to domain separate from regular EVM txs.
        // This should be customized per chain.
        bytes32 batchHash = ECDSA.toEthSignedMessageHash(keccak256(data));

        // returns true for current operators
        bool allowOperatorshipTransfer = authModule.validateProof(batchHash, signedBatch.proof);

        if (chainNameHash != keccak256(bytes(signedBatch.batch.chainName))) revert InvalidChainName();

        Command[] memory commands = batch.commands;

        for (uint256 i; i < commands.length; ++i) {
            Command memory command = commands[i];
            bytes32 commandId = command.commandId;

            // Ignore if commandId is already executed
            if (isCommandExecuted(commandId)) {
                continue;
            }

            if (command.command == CommandType.ApproveContractCall) {
                _approveContractCall(command);
            } else if (command.command == CommandType.TransferOperatorship) {
                if (!allowOperatorshipTransfer) {
                    continue;
                }

                allowOperatorshipTransfer = false;

                _transferOperatorship(command.params);
            } else {
                revert InvalidCommand();
            }

            _axelarAmplifierGatewayStorage().commands[commandId] = true;

            // slither-disable-next-line reentrancy-events
            emit Executed(commandId);
        }
    }

    /**********************\
    |* Internal Functions *|
    \**********************/

    function _approveContractCall(
        Command memory command
    ) internal {
        (
            string memory sourceChain,
            string memory sourceAddress,
            address contractAddress,
            bytes32 payloadHash,
            bytes32 sourceTxHash,
            uint256 sourceEventIndex
        ) = abi.decode(command.params, (string, string, address, bytes32, bytes32, uint256));

        bytes32 key = _getIsContractCallApprovedKey(
            command.commandId,
            sourceChain,
            sourceAddress,
            contractAddress,
            payloadHash
        );
        _axelarAmplifierGatewayStorage().approvals[key] = true;

        emit ContractCallApproved(
            command.commandId,
            sourceChain,
            sourceAddress,
            contractAddress,
            payloadHash,
            sourceTxHash,
            sourceEventIndex
        );
    }

    function _transferOperatorship(bytes memory newOperatorsData) internal {
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
     * @return slot containing the AxelarAmplifierGatewayStorage struct
     */
    function _axelarAmplifierGatewayStorage() private pure returns (AxelarAmplifierGatewayStorage storage slot) {
        assembly {
            slot.slot := AXELAR_AMPLIFIER_GATEWAY_SLOT
        }
    }
}
