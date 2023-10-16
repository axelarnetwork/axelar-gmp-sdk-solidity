// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import { IRolesBase } from '../interfaces/IRolesBase.sol';

/**
 * @title RolesBase
 * @notice A contract module which provides a set if internal functions
 * for implementing role control features.
 */
contract RolesBase is IRolesBase {
    // keccak256('roles')
    bytes32 internal constant ROLES_PREFIX = 0xde9bdca322e1a848f72215bc15cf2c87fe7749145789a9ee281a2a6290af26ab;
    // keccak256('roles-proposal')
    bytes32 internal constant ROLES_PROPOSAL_PREFIX =
        0xba4194d54b1b77cbe0d65a9d86e72151cbe0cc321e0311638ec1dba0aa25bf82;

    /**
     * @notice Modifier that throws an error if called by any account missing the role.
     */
    modifier onlyRole(uint8 role) {
        if (!_hasRole(_getRoles(msg.sender), role)) {
            revert MissingRole(msg.sender, role);
        }

        _;
    }

    /**
     * @notice Modifier that throws an error if called by an account without all the roles.
     */
    modifier withEveryRole(uint8[] memory roles) {
        if (!_hasAllTheRoles(_getRoles(msg.sender), roles)) {
            revert MissingAllRoles(msg.sender, roles);
        }

        _;
    }

    /**
     * @notice Modifier that throws an error if called by an account without any of the roles.
     */
    modifier withAnyRole(uint8[] memory roles) {
        if (!_hasAnyOfRoles(_getRoles(msg.sender), roles)) {
            revert MissingAnyOfRoles(msg.sender, roles);
        }

        _;
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
        return keccak256(abi.encodePacked(ROLES_PROPOSAL_PREFIX, fromAccount, toAccount));
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
     * @notice Internal function to add roles to an account.
     * @dev emits a RolesAdded event.
     * @dev Called in the constructor to set the initial roles.
     * @param account The address to add roles to
     * @param roles The roles to add
     */
    function _addRoles(address account, uint8[] memory roles) internal {
        uint256 accountRoles = _getRoles(account);
        uint256 length = roles.length;

        for (uint256 i = 0; i < length; ++i) {
            accountRoles |= (1 << roles[i]);
        }

        _setRoles(account, accountRoles);

        emit RolesAdded(account, roles);
    }

    /**
     * @notice Internal function to remove roles from an account.
     * @dev emits a RolesRemoved event.
     * @param account The address to remove roles from
     * @param roles The roles to remove
     */
    function _removeRoles(address account, uint8[] memory roles) internal {
        uint256 accountRoles = _getRoles(account);
        uint256 length = roles.length;

        for (uint256 i = 0; i < length; ++i) {
            accountRoles &= ~(1 << roles[i]);
        }

        _setRoles(account, accountRoles);

        emit RolesRemoved(account, roles);
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
     * @param accountRoles The roles of the account in uint256 format
     * @param roles The roles to check
     * @return True if the account has all the roles, false otherwise
     */
    function _hasAllTheRoles(uint256 accountRoles, uint8[] memory roles) internal pure returns (bool) {
        uint256 length = roles.length;

        for (uint256 i = 0; i < length; ++i) {
            if (accountRoles & (1 << roles[i]) == 0) {
                return false;
            }
        }

        return true;
    }

    /**
     * @notice Internal function to check if an account has any of the roles.
     * @param accountRoles The roles of the account in uint256 format
     * @param roles The roles to check
     * @return True if the account has any of the roles, false otherwise
     */
    function _hasAnyOfRoles(uint256 accountRoles, uint8[] memory roles) internal pure returns (bool) {
        uint256 length = roles.length;

        for (uint256 i = 0; i < length; ++i) {
            if (accountRoles & (1 << roles[i]) != 0) {
                return true;
            }
        }

        return false;
    }

    /**
     * @notice Internal function to propose to transfer roles of message sender to a new account.
     * @dev Can only be called by the account with all the proposed roles.
     * @dev emits a RolesProposed event.
     * @dev Roles are not transferred until the new role accepts the role transfer.
     * @param toAccount The address to transfer role to
     * @param roles The roles to transfer
     */
    function _proposeRoles(address toAccount, uint8[] memory roles) internal {
        uint256 proposed = _toAccountRoles(roles);

        _setProposedRoles(msg.sender, toAccount, proposed);

        emit RolesProposed(msg.sender, toAccount, roles);
    }

    /**
     * @notice Internal function to accept roles transferred from another account.
     * @dev Can only be called by the pending account with all the proposed roles.
     * @dev Emits RolesRemoved and RolesAdded events.
     * @param fromAccount The address of the current role
     * @param roles The roles to accept
     */
    function _acceptRoles(address fromAccount, uint8[] memory roles) internal virtual {
        uint256 proposed = _getProposedRoles(fromAccount, msg.sender);

        if (proposed != _toAccountRoles(roles)) {
            revert InvalidProposedRoles(fromAccount, msg.sender, roles);
        }

        _setProposedRoles(fromAccount, msg.sender, 0);

        _transferRoles(fromAccount, msg.sender, roles);
    }

    /**
     * @notice Internal function to transfer roles from one account to another.
     * @param fromAccount The address of the current role
     * @param toAccount The address to transfer role to
     * @param roles The roles to transfer
     */
    function _transferRoles(
        address fromAccount,
        address toAccount,
        uint8[] memory roles
    ) internal {
        _removeRoles(fromAccount, roles);
        _addRoles(toAccount, roles);
    }
}
