// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import { Distributable } from '../../utils/Distributable.sol';

contract DistributableTest is Distributable {
    uint256 public nonce;

    constructor(address distributor) {
        _setDistributor(distributor);
    }

    function testDistributable() external onlyDistributor {
        nonce++;
    }
}
