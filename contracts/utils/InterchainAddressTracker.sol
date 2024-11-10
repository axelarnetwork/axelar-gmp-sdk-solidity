// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import { IInterchainAddressTracker } from '../interfaces/IInterchainAddressTracker.sol';
import { StringStorage } from '../libs/StringStorage.sol';

/**
 * @title InterchainAddressTracker
 * @dev Manages and validates trusted interchain addresses of an application.
 */
contract InterchainAddressTracker is IInterchainAddressTracker {
    bytes32 internal constant PREFIX_ADDRESS_MAPPING = keccak256('interchain-address-tracker-address-mapping');
    bytes32 internal constant PREFIX_ADDRESS_HASH_MAPPING =
        keccak256('interchain-address-tracker-address-hash-mapping');
    // bytes32(uint256(keccak256('interchain-address-tracker-chain-name')) - 1)
    bytes32 internal constant _CHAIN_NAME_SLOT = 0x0e2c162a1f4b5cff9fdbd6b34678a9bcb9898a0b9fbca695b112d61688d8b2ac;

    function _setChainName(string memory chainName_) internal {
        StringStorage.set(_CHAIN_NAME_SLOT, chainName_);
    }

    /**
     * @dev Gets the name of the chain this is deployed at
     */
    function chainName() public view returns (string memory chainName_) {
        chainName_ = StringStorage.get(_CHAIN_NAME_SLOT);
    }

    /**
     * @dev Gets the trusted address at a remote chain
     * @param chain Chain name of the remote chain
     * @return trustedAddress_ The trusted address for the chain. Returns '' if the chain is untrusted
     */
    function trustedAddress(string memory chain) public view returns (string memory trustedAddress_) {
        trustedAddress_ = StringStorage.get(_getTrustedAddressSlot(chain));
    }

    /**
     * @dev Gets the trusted address hash for a chain
     * @param chain Chain name
     * @return trustedAddressHash_ the hash of the trusted address for that chain
     */
    function trustedAddressHash(string memory chain) public view returns (bytes32 trustedAddressHash_) {
        bytes32 slot = _getTrustedAddressHashSlot(chain);
        assembly {
            trustedAddressHash_ := sload(slot)
        }
    }

    /**
     * @dev Checks whether the interchain sender is a trusted address
     * @param chain Chain name of the sender
     * @param address_ Address of the sender
     * @return bool true if the sender chain/address are trusted, false otherwise
     */
    function isTrustedAddress(string calldata chain, string calldata address_) public view returns (bool) {
        bytes32 addressHash = keccak256(bytes(address_));

        return addressHash == trustedAddressHash(chain);
    }

    /**
     * @dev Gets the key for the trusted address at a remote chain
     * @param chain Chain name of the remote chain
     * @return slot the slot to store the trusted address in
     */
    function _getTrustedAddressSlot(string memory chain) internal pure returns (bytes32 slot) {
        slot = keccak256(abi.encode(PREFIX_ADDRESS_MAPPING, chain));
    }

    /**
     * @dev Gets the key for the trusted address at a remote chain
     * @param chain Chain name of the remote chain
     * @return slot the slot to store the trusted address hash in
     */
    function _getTrustedAddressHashSlot(string memory chain) internal pure returns (bytes32 slot) {
        slot = keccak256(abi.encode(PREFIX_ADDRESS_HASH_MAPPING, chain));
    }

    /**
     * @dev Sets the trusted address and its hash for a remote chain
     * @param chain Chain name of the remote chain
     * @param address_ the string representation of the trusted address
     */
    function _setTrustedAddress(string memory chain, string memory address_) internal {
        if (bytes(chain).length == 0) revert ZeroStringLength();
        if (bytes(address_).length == 0) revert ZeroStringLength();

        StringStorage.set(_getTrustedAddressSlot(chain), address_);

        bytes32 slot = _getTrustedAddressHashSlot(chain);
        bytes32 addressHash = keccak256(bytes(address_));
        assembly {
            sstore(slot, addressHash)
        }

        emit TrustedAddressSet(chain, address_);
    }

    /**
     * @dev Remove the trusted address of the chain.
     * @param chain Chain name that should be made untrusted
     */
    function _removeTrustedAddress(string memory chain) internal {
        if (bytes(chain).length == 0) revert ZeroStringLength();

        StringStorage.clear(_getTrustedAddressSlot(chain));

        bytes32 slot = _getTrustedAddressHashSlot(chain);
        assembly {
            sstore(slot, 0)
        }

        emit TrustedAddressRemoved(chain);
    }
}
