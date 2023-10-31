// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import { IContractIdentifier } from './IContractIdentifier.sol';

/**
 * @title IRemoteAddressValidator
 * @dev Manages and validates remote addresses, keeps track of addresses supported by the Axelar gateway contract
 */
interface IInterchainAddressTracker is IContractIdentifier {
    error ZeroAddress();
    error LengthMismatch();
    error ZeroStringLength();
    error UntrustedChain();

    event TrustedAddressAdded(string sourceChain, string sourceAddress);
    event TrustedAddressRemoved(string sourceChain);

    /**
     * @dev Gets the name of the chain this is deployed at
     */
    function chainName() external view returns (string memory);

    /**
     * @dev Gets the trusted address at a remote chain
     * @param chain Chain name of the remote chain
     * @return trustedAddress the trusted address for the chain. Returns '' if the chain is untrusted
     */
    function trustedAddress(string memory chain) external view returns (string memory trustedAddress);

    /**
     * @dev Gets the trusted address hash at a remote chain
     * @param chain Chain name of the remote chain
     * @return trustedAddressHash the hash of the trusted address
     */
    function trustedAddressHash(string memory chain) external view returns (bytes32 trustedAddressHash);

    /**
     * @dev Validates that the sender is a valid interchain token service address
     * @param sourceChain Source chain of the transaction
     * @param sourceAddress Source address of the transaction
     * @return bool true if the sender is validated, false otherwise
     */
    function isTrustedAddress(string calldata sourceChain, string calldata sourceAddress) external view returns (bool);

    /**
     * @dev Adds a trusted interchain token service address for the specified chain
     * @param sourceChain Chain name of the interchain token service
     * @param sourceAddress Interchain token service address to be added
     */
    function setTrustedAddress(string memory sourceChain, string memory sourceAddress) external;

    /**
     * @dev Removes a trusted interchain token service address
     * @param sourceChain Chain name of the interchain token service to be removed
     */
    function removeTrustedAddress(string calldata sourceChain) external;
}
