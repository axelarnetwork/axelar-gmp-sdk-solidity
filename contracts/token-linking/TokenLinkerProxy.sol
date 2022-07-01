// SPDX-License-Identifier: MIT

pragma solidity 0.8.9;

import { Proxy } from '../upgradables/Proxy.sol';
import { IUpgradable } from '../interfaces/IUpgradable.sol';

contract TokenLinkerProxy is Proxy {
    function contractId() internal pure override returns (bytes32) {
        return keccak256('token-linker');
    }
    
    receive() external payable override{}
}
