// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

/**
 * @title IInterchainAddressTracker
 * @dev Manages trusted addresses by chain, keeps track of addresses supported by the Axelar gateway contract
 */
interface IInterchainAddressTracker {
    error ZeroAddress();
    error LengthMismatch();
    error ZeroStringLength();
    error UntrustedChain();

    event TrustedAddressSet(string chain, string address_);
    event TrustedAddressRemoved(string chain);

    /**
     * @dev Gets the name of the chain this is deployed at
     */
    function chainName() external view returns (string memory);

    /**
     * @dev Gets the trusted address at a remote chain
     * @param chain Chain name of the remote chain
     * @return trustedAddress_ The trusted address for the chain. Returns '' if the chain is untrusted
     */
    function trustedAddress(string memory chain) external view returns (string memory trustedAddress_);

    /**
     * @dev Gets the trusted address hash for a chain
     * @param chain Chain name
     * @return trustedAddressHash_ the hash of the trusted address for that chain
     */
    function trustedAddressHash(string memory chain) external view returns (bytes32 trustedAddressHash_);

    /**
     * @dev Checks whether the interchain sender is a trusted address
     * @param chain Chain name of the sender
     * @param address_ Address of the sender
     * @return bool true if the sender chain/address are trusted, false otherwise
     */
    function isTrustedAddress(string calldata chain, string calldata address_) external view returns (bool);
}
