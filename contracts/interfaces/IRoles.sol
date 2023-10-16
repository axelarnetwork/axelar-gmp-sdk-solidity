// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

/**
 * @title IRoles Interface
 * @notice IRoles is an interface that abstracts the implementation of a
 * contract with role control features. It's commonly used in upgradable
 * contracts and includes the functionality to get current role, transfer
 * role, and propose and accept role.
 */
interface IRoles {
    error MissingRole(address account, uint8 role);
    error MissingAllRoles(address account, uint8[] roles);
    error MissingAnyOfRoles(address account, uint8[] roles);

    error InvalidRolesLength();
    error InvalidProposedAccount(address account);
    error InvalidProposedRoles(address fromAccount, address toAccount, uint8[] roles);

    event RolesProposed(address indexed fromAccount, address indexed toAccount, uint8[] roles);
    event RolesAdded(address indexed account, uint8[] roles);
    event RolesRemoved(address indexed account, uint8[] roles);

    /**
     * @notice Checks if an account has a role.
     * @param account The address to check
     * @param role The role to check
     * @return True if the account has the role, false otherwise
     */
    function hasRole(address account, uint8 role) external view returns (bool);

    /**
     * @notice Checks if an account has all the roles.
     * @param account The address to check
     * @param roles The roles to check
     * @return True if the account has all the roles, false otherwise
     */
    function hasAllTheRoles(address account, uint8[] calldata roles) external view returns (bool);

    /**
     * @notice Checks if an account has any of the roles.
     * @param account The address to check
     * @param roles The roles to check
     * @return True if the account has any of the roles, false otherwise
     */
    function hasAnyOfRoles(address account, uint8[] calldata roles) external view returns (bool);

    /**
     * @notice Returns the roles of an account.
     * @param account The address to get the roles for
     * @return accountRoles The roles of the account in uint256 format
     */
    function getAccountRoles(address account) external view returns (uint256 accountRoles);

    /**
     * @notice Returns the pending role of the contract.
     * @param fromAccount The address of the current role
     * @param toAccount The address with the pending roles
     * @return proposedRoles_ The pending role of the contract in uint256 format
     */
    function proposedRoles(address fromAccount, address toAccount) external view returns (uint256 proposedRoles_);

    /**
     * @notice Transfers roles of the contract to a new account.
     * @dev Can only be called by the account with all the roles.
     * @dev Emits RolesRemoved and RolesAdded events.
     * @param toAccount The address to transfer role to
     * @param roles The roles to transfer
     */
    function transferRoles(address toAccount, uint8[] calldata roles) external;

    /**
     * @notice Propose to transfer roles of message sender to a new account.
     * @dev Can only be called by the account with all the proposed roles.
     * @dev emits a RolesProposed event.
     * @dev Roles are not transferred until the new role accepts the role transfer.
     * @param toAccount The address to transfer role to
     * @param roles The roles to transfer
     */
    function proposeRoles(address toAccount, uint8[] calldata roles) external;

    /**
     * @notice Accepts roles transferred from another account.
     * @dev Can only be called by the pending account with all the proposed roles.
     * @dev Emits RolesRemoved and RolesAdded events.
     * @param fromAccount The address of the current role
     * @param roles The roles to accept
     */
    function acceptRoles(address fromAccount, uint8[] calldata roles) external;
}
