// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import { IInterchainRouter } from '../interfaces/IInterchainRouter.sol';
import { Upgradable } from '../upgradable/Upgradable.sol';

import { StringStorage } from '../libs/StringStorage.sol';

/**
 * @title InterchainRouter
 * @dev Manages and validates remote addresses, keeps track of addresses supported by the Axelar gateway contract
 */
contract InterchainRouter is IInterchainRouter, Upgradable {
    using StringStorage for string;

    bytes32 internal constant PREFIX_ADDRESS_MAPPING = keccak256('interchain-router-address-mapping');
    bytes32 internal constant PREFIX_ADDRESS_HASH_MAPPING = keccak256('interchain-router-address-hash-mapping');
    // uint256(keccak256('interchain-router-chain-name-slot')) - 1
    uint256 internal constant CHAIN_NAME_SLOT = 0x6406a0b603e31e24a15e9f663879eedde3bef27687f318a9875bafac9d63fc1f;

    bytes32 private constant CONTRACT_ID = keccak256('interchain-router');

    /**
     * @dev Constructs the InterchainRouter contract, both array parameters must be equal in length.
     * @param chainName_ The name of the current chain.
     */
    constructor(string memory chainName_) {
        if (bytes(chainName_).length == 0) revert ZeroStringLength();
        chainName_.store(CHAIN_NAME_SLOT);
    }

    /**
     * @notice Getter for the contract id.
     */
    function contractId() external pure returns (bytes32) {
        return CONTRACT_ID;
    }

    function _setup(bytes calldata params) internal override {
        (string[] memory trustedChainNames, string[] memory trustedAddresses) = abi.decode(
            params,
            (string[], string[])
        );
        uint256 length = trustedChainNames.length;
        if (length != trustedAddresses.length) revert LengthMismatch();

        for (uint256 i; i < length; ++i) {
            addTrustedAddress(trustedChainNames[i], trustedAddresses[i]);
        }
    }

    /**
     * @dev Gets the name of the chain this is deployed at
     */
    function chainName() external view returns (string memory chainName_) {
        chainName_ = StringStorage.load(CHAIN_NAME_SLOT);
    }

    /**
     * @dev Gets the key for the trusted address at a remote chain
     * @param chain Chain name of the remote chain
     * @return slot the slot to store the trusted address in
     */
    function _getTrustedAddressSlot(string memory chain) internal pure returns (uint256 slot) {
        slot = uint256(keccak256(abi.encode(PREFIX_ADDRESS_MAPPING, chain)));
    }

    /**
     * @dev Gets the key for the trusted address at a remote chain
     * @param chain Chain name of the remote chain
     * @return slot the slot to store the trusted address hash in
     */
    function _getTrustedAddressHashSlot(string memory chain) internal pure returns (uint256 slot) {
        slot = uint256(keccak256(abi.encode(PREFIX_ADDRESS_HASH_MAPPING, chain)));
    }

    /**
     * @dev Sets the trusted address and its hash for a remote chain
     * @param chain Chain name of the remote chain
     * @param trustedAddress the string representation of the trusted address
     */
    function _setTrustedAddress(string memory chain, string memory trustedAddress) internal {
        trustedAddress.store(_getTrustedAddressSlot(chain));
        uint256 slot = _getTrustedAddressHashSlot(chain);
        bytes32 addressHash = keccak256(bytes(trustedAddress));
        assembly {
            sstore(slot, addressHash)
        }
    }

    /**
     * @dev Gets the trusted address at a remote chain
     * @param chain Chain name of the remote chain
     * @return trustedAddress the trusted address for the chain. Returns '' if the chain is untrusted
     */
    function getTrustedAddress(string memory chain) public view returns (string memory trustedAddress) {
        trustedAddress = StringStorage.load(_getTrustedAddressSlot(chain));
    }

    /**
     * @dev Gets  the trusted address hash at a remote chain
     * @param chain Chain name of the remote chain
     * @return trustedAddressHash the hash of the trusted address
     */
    function getTrustedAddressHash(string memory chain) public view returns (bytes32 trustedAddressHash) {
        uint256 slot = _getTrustedAddressHashSlot(chain);
        assembly {
            trustedAddressHash := sload(slot)
        }
    }

    /**
     * @dev Validates that the sender is a valid interchain token service address
     * @param sourceChain Source chain of the transaction
     * @param sourceAddress Source address of the transaction
     * @return bool true if the sender is validated, false otherwise
     */
    function validateSender(string calldata sourceChain, string calldata sourceAddress) external view returns (bool) {
        bytes32 sourceAddressHash = keccak256(bytes(sourceAddress));

        return sourceAddressHash == getTrustedAddressHash(sourceChain);
    }

    /**
     * @dev Adds a trusted interchain token service address for the specified chain
     * @param sourceChain Chain name of the interchain token service
     * @param sourceAddress Interchain token service address to be added
     */
    function addTrustedAddress(string memory sourceChain, string memory sourceAddress) public onlyOwner {
        if (bytes(sourceChain).length == 0) revert ZeroStringLength();
        if (bytes(sourceAddress).length == 0) revert ZeroStringLength();

        _setTrustedAddress(sourceChain, sourceAddress);

        emit TrustedAddressAdded(sourceChain, sourceAddress);
    }

    /**
     * @dev Removes a trusted interchain token service address
     * @param sourceChain Chain name of the interchain token service to be removed
     */
    function removeTrustedAddress(string calldata sourceChain) external onlyOwner {
        if (bytes(sourceChain).length == 0) revert ZeroStringLength();

        StringStorage.del(_getTrustedAddressSlot(sourceChain));
        uint256 slot = _getTrustedAddressHashSlot(sourceChain);
        assembly {
            sstore(slot, 0)
        }
        emit TrustedAddressRemoved(sourceChain);
    }
}
