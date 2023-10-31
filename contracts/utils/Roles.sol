// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import { IRoles } from '../interfaces/IRoles.sol';
import { RolesBase } from './RolesBase.sol';

/**
 * @title Roles
 * @notice A contract module which provides set of external functions providing basic role transferring functionality.
 *
 * @notice The role account is set through role transfer. This module makes
 * it possible to transfer the role of the contract to a new account in one
 * step, as well as to an interim pending role. In the second flow the role does not
 * change until the pending role accepts the role transfer.
 */
contract Roles is RolesBase, IRoles {
    /**
     * @notice Checks if an account has all the roles.
     * @param account The address to check
     * @param roles The roles to check
     * @return True if the account has all the roles, false otherwise
     */
    function hasAllTheRoles(address account, uint8[] memory roles) public view returns (bool) {
        return _hasAllTheRoles(_getRoles(account), _toAccountRoles(roles));
    }

    /**
     * @notice Checks if an account has any of the roles.
     * @param account The address to check
     * @param roles The roles to check
     * @return True if the account has any of the roles, false otherwise
     */
    function hasAnyOfRoles(address account, uint8[] memory roles) public view returns (bool) {
        return _hasAnyOfRoles(_getRoles(account), _toAccountRoles(roles));
    }

    /**
     * @notice Returns the roles of an account.
     * @param account The address to get the roles for
     * @return accountRoles The roles of the account in uint256 format
     */
    function getAccountRoles(address account) public view returns (uint256 accountRoles) {
        accountRoles = _getRoles(account);
    }

    /**
     * @notice Returns the pending role of the contract.
     * @param fromAccount The address with the current roles
     * @param toAccount The address with the pending roles
     * @return proposedRoles_ The pending role of the contract in uint256 format
     */
    function getProposedRoles(address fromAccount, address toAccount) public view returns (uint256 proposedRoles_) {
        proposedRoles_ = _getProposedRoles(fromAccount, toAccount);
    }

    /**
     * @notice Propose to transfer roles of message sender to a new account.
     * @dev Can only be called by the account with all the proposed roles.
     * @dev emits a RolesProposed event.
     * @dev Roles are not transferred until the new role accepts the role transfer.
     * @param toAccount The address to transfer role to
     * @param roles The roles to transfer
     */
    function proposeRoles(address toAccount, uint8[] memory roles) external virtual {
        if (toAccount == address(0) || toAccount == msg.sender) revert InvalidProposedAccount(toAccount);

        _proposeRoles(msg.sender, toAccount, roles);
    }

    /**
     * @notice Accepts roles transferred from another account.
     * @dev Can only be called by the pending account with all the proposed roles.
     * @dev Emits RolesRemoved and RolesAdded events.
     * @param fromAccount The address of the current role
     * @param roles The roles to accept
     */
    function acceptRoles(address fromAccount, uint8[] memory roles) external virtual {
        _acceptRoles(fromAccount, msg.sender, roles);
    }

    /**
     * @notice Transfers roles of the contract to a new account.
     * @dev Can only be called by the account with all the roles.
     * @dev Emits RolesRemoved and RolesAdded events.
     * @param toAccount The address to transfer role to
     * @param roles The roles to transfer
     */
    function transferRoles(address toAccount, uint8[] memory roles) external virtual {
        if (toAccount == address(0) || toAccount == msg.sender) revert InvalidProposedAccount(toAccount);

        _transferRoles(msg.sender, toAccount, roles);
    }
}
