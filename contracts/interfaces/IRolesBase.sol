// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

/**
 * @title IRolesBase Interface
 * @notice IRolesBase is an interface that abstracts the implementation of a
 * contract with role control internal functions.
 */
interface IRolesBase {
    error MissingRole(address account, uint8 role);
    error MissingAllRoles(address account, uint8[] roles);
    error MissingAnyOfRoles(address account, uint8[] roles);

    event RolesProposed(address indexed fromAccount, address indexed toAccount, uint8[] roles);
    event RolesAdded(address indexed account, uint8[] roles);
    event RolesRemoved(address indexed account, uint8[] roles);
}
