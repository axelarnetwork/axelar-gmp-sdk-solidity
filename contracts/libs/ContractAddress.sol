// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

// remove this lib with: `address(...).code.length > 0` reduces code size
// OZ did it recently: https://github.com/OpenZeppelin/openzeppelin-contracts/pull/3945
library ContractAddress {
    // check gas comparizon with OZ
    function isContract(address contractAddress) internal view returns (bool) {
        bytes32 existingCodeHash = contractAddress.codehash;

        // https://eips.ethereum.org/EIPS/eip-1052
        // keccak256('') == 0xc5d2460186f7233c927e7db2dcc703c0e500b653ca82273b7bfad8045d85a470
        return
            existingCodeHash != bytes32(0) &&
            existingCodeHash != 0xc5d2460186f7233c927e7db2dcc703c0e500b653ca82273b7bfad8045d85a470;
    }
}
