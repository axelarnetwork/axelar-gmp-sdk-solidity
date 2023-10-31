// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

/**
 * @title IRolesBase Interface
 * @notice IRolesBase is an interface that abstracts the implementation of a
 * contract with role control internal functions.
 */
interface IRolesBase {
    error MissingRole(address account, uint8 role);
    error MissingAllRoles(address account, uint256 accountRoles);
    error MissingAnyOfRoles(address account, uint256 accountRoles);

    error InvalidProposedRoles(address fromAccount, address toAccount, uint256 accountRoles);

    event RolesProposed(address indexed fromAccount, address indexed toAccount, uint256 accountRoles);
    event RolesAdded(address indexed account, uint256 accountRoles);
    event RolesRemoved(address indexed account, uint256 accountRoles);

    /**
     * @notice Checks if an account has a role.
     * @param account The address to check
     * @param role The role to check
     * @return True if the account has the role, false otherwise
     */
    function hasRole(address account, uint8 role) external view returns (bool);
}
