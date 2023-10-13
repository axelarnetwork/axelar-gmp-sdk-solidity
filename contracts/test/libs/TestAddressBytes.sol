// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import { AddressBytes } from '../../libs/AddressBytes.sol';

contract TestAddressBytes {
    using AddressBytes for address;
    using AddressBytes for bytes;

    function toAddress(bytes memory bytesAddress) external pure returns (address addr) {
        return bytesAddress.toAddress();
    }

    function toBytes(address addr) external pure returns (bytes memory bytesAddress) {
        return addr.toBytes();
    }
}
