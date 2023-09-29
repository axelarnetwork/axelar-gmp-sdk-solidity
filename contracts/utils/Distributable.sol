// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import { IDistributable } from '../interfaces/IDistributable.sol';

/**
 * @title Distributable Contract
 * @dev A contract module which provides a basic access control mechanism, where
 * there is an account (a distributor) that can be granted exclusive access to
 * specific functions. This module is used through inheritance.
 */
contract Distributable is IDistributable {
    // uint256(keccak256('distributor')) - 1
    uint256 internal constant DISTRIBUTOR_SLOT = 0x71c5a35e45a25c49e8f747acd4bcb869814b3d104c492d2554f4c46e12371f56;

    // uint256(keccak256('proposed-distributor')) - 1
    uint256 internal constant PROPOSED_DISTRIBUTOR_SLOT = 0xbb1aa7d30971a97896e14e460c5ace030e39b624cf8f7c1ce200eeb378d7dcf1;

    /**
     * @dev Throws a NotDistributor custom error if called by any account other than the distributor.
     */
    modifier onlyDistributor() {
        if (distributor() != msg.sender) revert NotDistributor();
        _;
    }

    /**
     * @notice Get the address of the distributor
     * @return distributor_ of the distributor
     */
    function distributor() public view returns (address distributor_) {
        assembly {
            distributor_ := sload(DISTRIBUTOR_SLOT)
        }
    }

    /**
     * @dev Internal function that stores the new distributor address in the correct storage slot
     * @param distributor_ The address of the new distributor
     */
    function _setDistributor(address distributor_) internal {
        assembly {
            sstore(DISTRIBUTOR_SLOT, distributor_)
        }
        emit DistributorshipTransferred(distributor_);
    }

    /**
     * @notice Change the distributor of the contract
     * @dev Can only be called by the current distributor
     * @param distributor_ The address of the new distributor
     */
    function transferDistributorship(address distributor_) external onlyDistributor {
        _setDistributor(distributor_);
    }

    /**
     * @notice Proposed a change of the distributor of the contract
     * @dev Can only be called by the current distributor
     * @param distributor_ The address of the new distributor
     */
    function proposeDistributorship(address distributor_) external onlyDistributor {
        assembly {
            sstore(PROPOSED_DISTRIBUTOR_SLOT, distributor_)
        }
        emit DistributorshipTransferStarted(distributor_);
    }

    /**
     * @notice Accept a change of the distributor of the contract
     * @dev Can only be called by the proposed distributor
     */
    function acceptDistributorship() external {
        address proposedDistributor;
        assembly {
            proposedDistributor := sload(PROPOSED_DISTRIBUTOR_SLOT)
            sstore(PROPOSED_DISTRIBUTOR_SLOT, 0)
        }
        if (msg.sender != proposedDistributor) revert NotProposedDistributor();
        _setDistributor(proposedDistributor);
    }
}
