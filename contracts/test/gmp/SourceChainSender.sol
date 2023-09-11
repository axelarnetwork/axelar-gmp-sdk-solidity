// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import { IAxelarGateway } from '../../interfaces/IAxelarGateway.sol';

contract SourceChainSender {
    IAxelarGateway public gateway;
    string public destinationChain;
    string public executableAddress;

    event Sent(uint256 num);

    constructor(
        address gateway_,
        string memory destinationChain_,
        string memory executableAddress_
    ) {
        gateway = IAxelarGateway(gateway_);
        destinationChain = destinationChain_;
        executableAddress = executableAddress_;
    }

    function send(uint256 num) external {
        bytes memory payload = abi.encode(num);
        gateway.callContract(destinationChain, executableAddress, payload);
        emit Sent(num);
    }
}
