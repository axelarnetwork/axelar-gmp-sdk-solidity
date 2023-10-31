// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import { Roles } from '../../utils/Roles.sol';

contract TestRoles is Roles {
    error InvalidRolesLength();

    event NumSet(uint256 _num);

    uint256 public num;

    constructor(address[] memory accounts, uint8[][] memory roleSets) {
        uint256 length = accounts.length;
        if (length != roleSets.length) revert InvalidRolesLength();

        for (uint256 i = 0; i < length; ++i) {
            _addRoles(accounts[i], roleSets[i]);
        }
    }

    function setNum(uint256 _num, uint8 role) external onlyRole(role) {
        num = _num;
        emit NumSet(_num);
    }

    function setNumWithAllRoles(uint256 _num, uint8[] calldata roles) external withEveryRole(roles) {
        num = _num;
        emit NumSet(_num);
    }

    function setNumWithAnyRoles(uint256 _num, uint8[] calldata roles) external withAnyRole(roles) {
        num = _num;
        emit NumSet(_num);
    }

    function addRole(address account, uint8 role) external {
        _addRole(account, role);
    }

    function addRoles(address account, uint8[] calldata roles) external {
        _addRoles(account, roles);
    }

    function removeRole(address account, uint8 role) external {
        _removeRole(account, role);
    }

    function removeRoles(address account, uint8[] calldata roles) external {
        _removeRoles(account, roles);
    }

    function transferRole(
        address from,
        address to,
        uint8 role
    ) external {
        _transferRole(from, to, role);
    }

    function proposeRole(address account, uint8 role) external {
        _proposeRole(msg.sender, account, role);
    }

    function acceptRole(address account, uint8 role) external {
        _acceptRole(account, msg.sender, role);
    }
}
