// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import { IRolesBase } from '../interfaces/IRolesBase.sol';

/**
 * @title RolesBase
 * @notice A contract module which provides a set if internal functions
 * for implementing role control features.
 */
contract RolesBase is IRolesBase {
    bytes32 internal constant ROLES_PREFIX = keccak256('roles');
    bytes32 internal constant PROPOSE_ROLES_PREFIX = keccak256('propose-roles');

    /**
     * @notice Modifier that throws an error if called by any account missing the role.
     */
    modifier onlyRole(uint8 role) {
        if (!_hasRole(_getRoles(msg.sender), role)) revert MissingRole(msg.sender, role);

        _;
    }

    /**
     * @notice Modifier that throws an error if called by an account without all the roles.
     */
    modifier withEveryRole(uint8[] memory roles) {
        uint256 accountRoles = _toAccountRoles(roles);
        if (!_hasAllTheRoles(_getRoles(msg.sender), accountRoles)) revert MissingAllRoles(msg.sender, accountRoles);

        _;
    }

    /**
     * @notice Modifier that throws an error if called by an account without any of the roles.
     */
    modifier withAnyRole(uint8[] memory roles) {
        uint256 accountRoles = _toAccountRoles(roles);
        if (!_hasAnyOfRoles(_getRoles(msg.sender), accountRoles)) revert MissingAnyOfRoles(msg.sender, accountRoles);

        _;
    }

    /**
     * @notice Checks if an account has a role.
     * @param account The address to check
     * @param role The role to check
     * @return True if the account has the role, false otherwise
     */
    function hasRole(address account, uint8 role) public view returns (bool) {
        return _hasRole(_getRoles(account), role);
    }

    /**
     * @notice Internal function to convert an array of roles to a uint256.
     * @param roles The roles to convert
     * @return accountRoles The roles in uint256 format
     */
    function _toAccountRoles(uint8[] memory roles) internal pure returns (uint256) {
        uint256 length = roles.length;
        uint256 accountRoles;

        for (uint256 i = 0; i < length; ++i) {
            accountRoles |= (1 << roles[i]);
        }

        return accountRoles;
    }

    /**
     * @notice Internal function to get the key of the roles mapping.
     * @param account The address to get the key for
     * @return key The key of the roles mapping
     */
    function _rolesKey(address account) internal view virtual returns (bytes32 key) {
        return keccak256(abi.encodePacked(ROLES_PREFIX, account));
    }

    /**
     * @notice Internal function to get the roles of an account.
     * @param account The address to get the roles for
     * @return accountRoles The roles of the account in uint256 format
     */
    function _getRoles(address account) internal view returns (uint256 accountRoles) {
        bytes32 key = _rolesKey(account);
        assembly {
            accountRoles := sload(key)
        }
    }

    /**
     * @notice Internal function to set the roles of an account.
     * @param account The address to set the roles for
     * @param accountRoles The roles to set
     */
    function _setRoles(address account, uint256 accountRoles) private {
        bytes32 key = _rolesKey(account);
        assembly {
            sstore(key, accountRoles)
        }
    }

    /**
     * @notice Internal function to get the key of the proposed roles mapping.
     * @param fromAccount The address of the current role
     * @param toAccount The address of the pending role
     * @return key The key of the proposed roles mapping
     */
    function _proposalKey(address fromAccount, address toAccount) internal view virtual returns (bytes32 key) {
        return keccak256(abi.encodePacked(PROPOSE_ROLES_PREFIX, fromAccount, toAccount));
    }

    /**
     * @notice Internal function to get the proposed roles of an account.
     * @param fromAccount The address of the current role
     * @param toAccount The address of the pending role
     * @return proposedRoles_ The proposed roles of the account in uint256 format
     */
    function _getProposedRoles(address fromAccount, address toAccount) internal view returns (uint256 proposedRoles_) {
        bytes32 key = _proposalKey(fromAccount, toAccount);
        assembly {
            proposedRoles_ := sload(key)
        }
    }

    /**
     * @notice Internal function to set the proposed roles of an account.
     * @param fromAccount The address of the current role
     * @param toAccount The address of the pending role
     * @param proposedRoles_ The proposed roles to set in uint256 format
     */
    function _setProposedRoles(
        address fromAccount,
        address toAccount,
        uint256 proposedRoles_
    ) private {
        bytes32 key = _proposalKey(fromAccount, toAccount);
        assembly {
            sstore(key, proposedRoles_)
        }
    }

    /**
     * @notice Internal function to add a role to an account.
     * @dev emits a RolesAdded event.
     * @param account The address to add the role to
     * @param role The role to add
     */
    function _addRole(address account, uint8 role) internal {
        _addAccountRoles(account, 1 << role);
    }

    /**
     * @notice Internal function to add roles to an account.
     * @dev emits a RolesAdded event.
     * @dev Called in the constructor to set the initial roles.
     * @param account The address to add roles to
     * @param roles The roles to add
     */
    function _addRoles(address account, uint8[] memory roles) internal {
        _addAccountRoles(account, _toAccountRoles(roles));
    }

    /**
     * @notice Internal function to add roles to an account.
     * @dev emits a RolesAdded event.
     * @dev Called in the constructor to set the initial roles.
     * @param account The address to add roles to
     * @param accountRoles The roles to add
     */
    function _addAccountRoles(address account, uint256 accountRoles) internal {
        uint256 newAccountRoles = _getRoles(account) | accountRoles;

        _setRoles(account, newAccountRoles);

        emit RolesAdded(account, accountRoles);
    }

    /**
     * @notice Internal function to remove a role from an account.
     * @dev emits a RolesRemoved event.
     * @param account The address to remove the role from
     * @param role The role to remove
     */
    function _removeRole(address account, uint8 role) internal {
        _removeAccountRoles(account, 1 << role);
    }

    /**
     * @notice Internal function to remove roles from an account.
     * @dev emits a RolesRemoved event.
     * @param account The address to remove roles from
     * @param roles The roles to remove
     */
    function _removeRoles(address account, uint8[] memory roles) internal {
        _removeAccountRoles(account, _toAccountRoles(roles));
    }

    /**
     * @notice Internal function to remove roles from an account.
     * @dev emits a RolesRemoved event.
     * @param account The address to remove roles from
     * @param accountRoles The roles to remove
     */
    function _removeAccountRoles(address account, uint256 accountRoles) internal {
        uint256 newAccountRoles = _getRoles(account) & ~accountRoles;

        _setRoles(account, newAccountRoles);

        emit RolesRemoved(account, accountRoles);
    }

    /**
     * @notice Internal function to check if an account has a role.
     * @param accountRoles The roles of the account in uint256 format
     * @param role The role to check
     * @return True if the account has the role, false otherwise
     */
    function _hasRole(uint256 accountRoles, uint8 role) internal pure returns (bool) {
        return accountRoles & (1 << role) != 0;
    }

    /**
     * @notice Internal function to check if an account has all the roles.
     * @param hasAccountRoles The roles of the account in uint256 format
     * @param mustHaveAccountRoles The roles the account must have
     * @return True if the account has all the roles, false otherwise
     */
    function _hasAllTheRoles(uint256 hasAccountRoles, uint256 mustHaveAccountRoles) internal pure returns (bool) {
        return (hasAccountRoles & mustHaveAccountRoles) == mustHaveAccountRoles;
    }

    /**
     * @notice Internal function to check if an account has any of the roles.
     * @param hasAccountRoles The roles of the account in uint256 format
     * @param mustHaveAnyAccountRoles The roles to check in uint256 format
     * @return True if the account has any of the roles, false otherwise
     */
    function _hasAnyOfRoles(uint256 hasAccountRoles, uint256 mustHaveAnyAccountRoles) internal pure returns (bool) {
        return (hasAccountRoles & mustHaveAnyAccountRoles) != 0;
    }

    /**
     * @notice Internal function to propose to transfer roles of message sender to a new account.
     * @dev Original account must have all the proposed roles.
     * @dev Emits a RolesProposed event.
     * @dev Roles are not transferred until the new role accepts the role transfer.
     * @param fromAccount The address of the current roles
     * @param toAccount The address to transfer roles to
     * @param role The role to transfer
     */
    function _proposeRole(
        address fromAccount,
        address toAccount,
        uint8 role
    ) internal {
        _proposeAccountRoles(fromAccount, toAccount, 1 << role);
    }

    /**
     * @notice Internal function to propose to transfer roles of message sender to a new account.
     * @dev Original account must have all the proposed roles.
     * @dev Emits a RolesProposed event.
     * @dev Roles are not transferred until the new role accepts the role transfer.
     * @param fromAccount The address of the current roles
     * @param toAccount The address to transfer roles to
     * @param roles The roles to transfer
     */
    function _proposeRoles(
        address fromAccount,
        address toAccount,
        uint8[] memory roles
    ) internal {
        _proposeAccountRoles(fromAccount, toAccount, _toAccountRoles(roles));
    }

    /**
     * @notice Internal function to propose to transfer roles of message sender to a new account.
     * @dev Original account must have all the proposed roles.
     * @dev Emits a RolesProposed event.
     * @dev Roles are not transferred until the new role accepts the role transfer.
     * @param fromAccount The address of the current roles
     * @param toAccount The address to transfer roles to
     * @param accountRoles The account roles to transfer
     */
    function _proposeAccountRoles(
        address fromAccount,
        address toAccount,
        uint256 accountRoles
    ) internal {
        if (!_hasAllTheRoles(_getRoles(fromAccount), accountRoles)) revert MissingAllRoles(fromAccount, accountRoles);

        _setProposedRoles(fromAccount, toAccount, accountRoles);

        emit RolesProposed(fromAccount, toAccount, accountRoles);
    }

    /**
     * @notice Internal function to accept roles transferred from another account.
     * @dev Pending account needs to pass all the proposed roles.
     * @dev Emits RolesRemoved and RolesAdded events.
     * @param fromAccount The address of the current role
     * @param role The role to accept
     */
    function _acceptRole(
        address fromAccount,
        address toAccount,
        uint8 role
    ) internal virtual {
        _acceptAccountRoles(fromAccount, toAccount, 1 << role);
    }

    /**
     * @notice Internal function to accept roles transferred from another account.
     * @dev Pending account needs to pass all the proposed roles.
     * @dev Emits RolesRemoved and RolesAdded events.
     * @param fromAccount The address of the current role
     * @param roles The roles to accept
     */
    function _acceptRoles(
        address fromAccount,
        address toAccount,
        uint8[] memory roles
    ) internal virtual {
        _acceptAccountRoles(fromAccount, toAccount, _toAccountRoles(roles));
    }

    /**
     * @notice Internal function to accept roles transferred from another account.
     * @dev Pending account needs to pass all the proposed roles.
     * @dev Emits RolesRemoved and RolesAdded events.
     * @param fromAccount The address of the current role
     * @param accountRoles The account roles to accept
     */
    function _acceptAccountRoles(
        address fromAccount,
        address toAccount,
        uint256 accountRoles
    ) internal virtual {
        if (_getProposedRoles(fromAccount, toAccount) != accountRoles) {
            revert InvalidProposedRoles(fromAccount, toAccount, accountRoles);
        }

        _setProposedRoles(fromAccount, toAccount, 0);
        _transferAccountRoles(fromAccount, toAccount, accountRoles);
    }

    /**
     * @notice Internal function to transfer roles from one account to another.
     * @dev Original account must have all the proposed roles.
     * @param fromAccount The address of the current role
     * @param toAccount The address to transfer role to
     * @param role The role to transfer
     */
    function _transferRole(
        address fromAccount,
        address toAccount,
        uint8 role
    ) internal {
        _transferAccountRoles(fromAccount, toAccount, 1 << role);
    }

    /**
     * @notice Internal function to transfer roles from one account to another.
     * @dev Original account must have all the proposed roles.
     * @param fromAccount The address of the current role
     * @param toAccount The address to transfer role to
     * @param roles The roles to transfer
     */
    function _transferRoles(
        address fromAccount,
        address toAccount,
        uint8[] memory roles
    ) internal {
        _transferAccountRoles(fromAccount, toAccount, _toAccountRoles(roles));
    }

    /**
     * @notice Internal function to transfer roles from one account to another.
     * @dev Original account must have all the proposed roles.
     * @param fromAccount The address of the current role
     * @param toAccount The address to transfer role to
     * @param accountRoles The account roles to transfer
     */
    function _transferAccountRoles(
        address fromAccount,
        address toAccount,
        uint256 accountRoles
    ) internal {
        if (!_hasAllTheRoles(_getRoles(fromAccount), accountRoles)) revert MissingAllRoles(fromAccount, accountRoles);

        _removeAccountRoles(fromAccount, accountRoles);
        _addAccountRoles(toAccount, accountRoles);
    }
}
