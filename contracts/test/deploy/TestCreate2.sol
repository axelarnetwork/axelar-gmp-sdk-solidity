// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import { Create2 } from '../../deploy/Create2.sol';

contract TestCreate2 is Create2 {
    event Deployed(address addr);

    function deploy(bytes memory code, bytes32 salt) public payable returns (address addr) {
        addr = _create2(code, salt);

        emit Deployed(addr);
    }

    function deployedAddress(bytes memory code, bytes32 salt) public view returns (address addr) {
        addr = _create2Address(code, salt);
    }
}
