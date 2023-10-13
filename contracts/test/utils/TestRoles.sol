// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import { Roles } from '../../utils/Roles.sol';

contract TestRoles is Roles {
    uint256 public num;

    event NumSet(uint256 _num);

    constructor(address[] memory accounts, uint8[][] memory roleSets) Roles(accounts, roleSets) {}

    function setNum(uint256 _num, uint8 role) external onlyRole(role) {
        num = _num;
        emit NumSet(_num);
    }

    function setNumWithAllRoles(uint256 _num, uint8[] calldata roles) external withAllTheRoles(roles) {
        num = _num;
        emit NumSet(_num);
    }

    function setNumWithAnyRoles(uint256 _num, uint8[] calldata roles) external withAnyOfRoles(roles) {
        num = _num;
        emit NumSet(_num);
    }
}
