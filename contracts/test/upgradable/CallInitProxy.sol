// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import { InitProxy } from '../../upgradable/InitProxy.sol';

contract CallInitProxy is InitProxy {
    function getContractId() external pure returns (bytes32) {
        return contractId();
    }
}
