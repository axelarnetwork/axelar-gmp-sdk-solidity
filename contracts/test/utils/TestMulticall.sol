// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import { Multicall } from '../../utils/Multicall.sol';

contract TestMulticall is Multicall {
    uint256 public nonce;
    bytes[] public lastMulticallReturns;
    event Function1Called(uint256 nonce_);
    event Function2Called(uint256 nonce_);

    function function1() external returns (uint256) {
        uint256 nonce_ = nonce++;
        emit Function1Called(nonce_);
        return nonce_;
    }

    function function2() external returns (uint256) {
        uint256 nonce_ = nonce++;
        emit Function2Called(nonce_);
        return nonce_;
    }

    function function3() external pure {
        revert('function3 failed');
    }

    function function4() external pure {
        // solhint-disable-next-line reason-string
        revert();
    }

    function multicallTest(bytes[] calldata data) external {
        lastMulticallReturns = multicall(data);
    }

    function getLastMulticallReturns() external view returns (bytes[] memory r) {
        return lastMulticallReturns;
    }
}
