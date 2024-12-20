// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import { IAxelarGatewayWithToken } from '../../interfaces/IAxelarGatewayWithToken.sol';
import { IERC20 } from '../../interfaces/IERC20.sol';

contract SourceChainSwapCaller {
    IAxelarGatewayWithToken public gateway;
    string public destinationChain;
    string public executableAddress;

    constructor(
        address gateway_,
        string memory destinationChain_,
        string memory executableAddress_
    ) {
        gateway = IAxelarGatewayWithToken(gateway_);
        destinationChain = destinationChain_;
        executableAddress = executableAddress_;
    }

    function swapToken(
        string memory symbolA,
        string memory symbolB,
        uint256 amount,
        string memory recipient
    ) external payable {
        address tokenX = gateway.tokenAddresses(symbolA);
        bytes memory payload = abi.encode(symbolB, recipient);

        IERC20(tokenX).transferFrom(msg.sender, address(this), amount);

        IERC20(tokenX).approve(address(gateway), amount);
        gateway.callContractWithToken(destinationChain, executableAddress, payload, symbolA, amount);
    }
}
