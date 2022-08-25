// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import { Proxy } from '../upgradables/Proxy.sol';

contract NftLinkerProxy is Proxy {
    function contractId() internal pure override returns (bytes32) {
        return keccak256('nft-linker');
    }

    receive() external payable override {}
}
