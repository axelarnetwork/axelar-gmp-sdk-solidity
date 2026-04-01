// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import { AxelarExecutableWithToken } from '../../executable/AxelarExecutableWithToken.sol';
import { IERC20 } from '../../interfaces/IERC20.sol';
import { StringToAddress } from '../../libs/AddressString.sol';

contract SourceChainSwapCaller is AxelarExecutableWithToken {
    string public destinationChain;
    string public executableAddress;

    constructor(
        address gateway_,
        string memory destinationChain_,
        string memory executableAddress_
    ) AxelarExecutableWithToken(gateway_) {
        destinationChain = destinationChain_;
        executableAddress = executableAddress_;
    }

    function swapToken(
        string memory symbolA,
        string memory symbolB,
        uint256 amount,
        string memory recipient
    ) external payable {
        address tokenX = gatewayWithToken().tokenAddresses(symbolA);
        bytes memory payload = abi.encode(symbolB, recipient);

        IERC20(tokenX).transferFrom(msg.sender, address(this), amount);

        IERC20(tokenX).approve(address(gateway()), amount);
        gatewayWithToken().callContractWithToken(destinationChain, executableAddress, payload, symbolA, amount);
    }

    function _executeWithToken(
        bytes32, /*commandId*/
        string calldata, /*sourceChain*/
        string calldata, /*sourceAddress*/
        bytes calldata payload,
        string calldata tokenSymbolB,
        uint256 amount
    ) internal override {
        string memory recipientStr = abi.decode(payload, (string));
        address tokenB = gatewayWithToken().tokenAddresses(tokenSymbolB);
        IERC20(tokenB).transfer(StringToAddress.toAddress(recipientStr), amount);
    }

    function _execute(
        bytes32, /*commandId*/
        string calldata, /*sourceChain*/
        string calldata, /*sourceAddress*/
        bytes calldata /*payload*/
    ) internal pure override {
        revert('Not implemented');
    }
}
