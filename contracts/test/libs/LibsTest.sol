// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import { StringToAddress, AddressToString } from '../../libs/AddressString.sol';
import { Bytes32ToString, StringToBytes32 } from '../../libs/Bytes32String.sol';
import { SafeNativeTransfer } from '../../libs/SafeNativeTransfer.sol';

contract LibsTest {
    using AddressToString for address;
    using StringToAddress for string;
    using Bytes32ToString for bytes32;
    using StringToBytes32 for string;
    using SafeNativeTransfer for address;

    function addressToString(address address_) external pure returns (string memory) {
        return address_.toString();
    }

    function stringToAddress(string calldata string_) external pure returns (address) {
        return string_.toAddress();
    }

    function bytes32ToString(bytes32 bytes_) external pure returns (string memory) {
        return bytes_.toTrimmedString();
    }

    function stringToBytes32(string calldata string_) external pure returns (bytes32) {
        return string_.toBytes32();
    }

    function nativeTransfer(address receiver, uint256 amount) external {
        receiver.safeNativeTransfer(amount);
    }

    receive() external payable {}
}
