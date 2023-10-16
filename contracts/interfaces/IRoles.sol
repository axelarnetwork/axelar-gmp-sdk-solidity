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

    error InvalidProposedAccount(address account);
    error InvalidProposedRoles(address fromAccount, address toAccount, uint8[] roles);

    event RolesProposed(address indexed fromAccount, address indexed toAccount, uint8[] roles);
    event RolesAdded(address indexed account, uint8[] roles);
    event RolesRemoved(address indexed account, uint8[] roles);
}
