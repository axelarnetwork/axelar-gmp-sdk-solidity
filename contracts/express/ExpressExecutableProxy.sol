// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import { IAxelarGateway } from '../interfaces/IAxelarGateway.sol';
import { IERC20 } from '../interfaces/IERC20.sol';
import { IExpressExecutable } from '../interfaces/IExpressExecutable.sol';
import { IGMPExpressService } from '../interfaces/IGMPExpressService.sol';
import { IExpressRegistry } from '../interfaces/IExpressRegistry.sol';
import { Proxy } from '../upgradable/Proxy.sol';
import { ExpressRegistry } from './ExpressRegistry.sol';

contract ExpressExecutableProxy is Proxy, IExpressExecutable {
    IAxelarGateway public immutable gateway;
    // Integrity of ExpressRegistry bytecode is included in ExpressExecutableProxy codehash
    bytes32 public immutable registryCodeHash;

    constructor(address gmpExpressService_, address gateway_) {
        IAxelarGateway resolvedGateway;

        // Providing gateway_ as address(0) allows having the same address across chains
        // assuming condition that gmpExpressService_ address is the same
        // and gateway address is different across chains.
        if (gateway_ == address(0)) {
            resolvedGateway = IGMPExpressService(gmpExpressService_).gateway();
        } else {
            resolvedGateway = IAxelarGateway(gateway_);
        }

        gateway = resolvedGateway;
        IExpressRegistry deployedRegistry = new ExpressRegistry(address(resolvedGateway));
        registryCodeHash = address(deployedRegistry).codehash;
    }

    modifier onlyRegistry() {
        if (msg.sender != address(registry())) revert NotExpressRegistry();

        _;
    }

    function registry() public view returns (IExpressRegistry) {
        // Computing address is cheaper than using storage
        // Can't use immutable storage as it will alter the codehash for each instance
        return
            IExpressRegistry(
                address(
                    uint160(
                        uint256(
                            keccak256(
                                abi.encodePacked(
                                    // 0xd6 = 0xc0 (short RLP prefix) + 0x16 (length of: 0x94 ++ proxy ++ 0x01)
                                    // 0x94 = 0x80 + 0x14 (0x14 = the length of an address, 20 bytes, in hex)
                                    hex'd6_94',
                                    address(this),
                                    hex'01' // Nonce of the registry contract deployment
                                )
                            )
                        )
                    )
                )
            );
    }

    function execute(
        bytes32 commandId,
        string calldata sourceChain,
        string calldata sourceAddress,
        bytes calldata payload
    ) external override {
        bytes32 payloadHash = keccak256(payload);

        if (!gateway.validateContractCall(commandId, sourceChain, sourceAddress, payloadHash))
            revert NotApprovedByGateway();

        _execute(sourceChain, sourceAddress, payload);
    }

    function expressExecuteWithToken(
        string calldata sourceChain,
        string calldata sourceAddress,
        bytes calldata payload,
        string calldata tokenSymbol,
        uint256 amount
    ) external override {
        bytes32 payloadHash = keccak256(payload);
        address token = gateway.tokenAddresses(tokenSymbol);

        registry().registerExpressCallWithToken(
            msg.sender,
            sourceChain,
            sourceAddress,
            payloadHash,
            tokenSymbol,
            amount
        );

        _safeTransferFrom(token, msg.sender, amount);
        _executeWithToken(sourceChain, sourceAddress, payload, tokenSymbol, amount);
    }

    /// @notice used to handle a normal GMP call when it arrives
    function executeWithToken(
        bytes32 commandId,
        string calldata sourceChain,
        string calldata sourceAddress,
        bytes calldata payload,
        string calldata tokenSymbol,
        uint256 amount
    ) external override {
        registry().processCallWithToken(commandId, sourceChain, sourceAddress, payload, tokenSymbol, amount);
    }

    function completeExecuteWithToken(
        address expressCaller,
        bytes32 commandId,
        string calldata sourceChain,
        string calldata sourceAddress,
        bytes calldata payload,
        string calldata tokenSymbol,
        uint256 amount
    ) external override onlyRegistry {
        bytes32 payloadHash = keccak256(payload);

        if (
            !gateway.validateContractCallAndMint(
                commandId,
                sourceChain,
                sourceAddress,
                payloadHash,
                tokenSymbol,
                amount
            )
        ) revert NotApprovedByGateway();

        if (expressCaller == address(0)) {
            _executeWithToken(sourceChain, sourceAddress, payload, tokenSymbol, amount);
        } else {
            // Returning the lent token
            address token = gateway.tokenAddresses(tokenSymbol);

            _safeTransfer(token, expressCaller, amount);
        }
    }

    // Doing internal call to the implementation
    function _execute(
        string calldata sourceChain,
        string calldata sourceAddress,
        bytes calldata payload
    ) internal {
        // solhint-disable-next-line avoid-low-level-calls
        (bool success, ) = implementation().delegatecall(
            abi.encodeWithSelector(
                ExpressExecutableProxy.execute.selector,
                bytes32(0),
                sourceChain,
                sourceAddress,
                payload
            )
        );

        // if not success revert with the original revert data
        if (!success) {
            // solhint-disable-next-line no-inline-assembly
            assembly {
                let ptr := mload(0x40)
                let size := returndatasize()
                returndatacopy(ptr, 0, size)
                revert(ptr, size)
            }
        }
    }

    // Doing internal call to the implementation
    function _executeWithToken(
        string calldata sourceChain,
        string calldata sourceAddress,
        bytes calldata payload,
        string calldata tokenSymbol,
        uint256 amount
    ) internal {
        // solhint-disable-next-line avoid-low-level-calls
        (bool success, ) = implementation().delegatecall(
            abi.encodeWithSelector(
                ExpressExecutableProxy.executeWithToken.selector,
                bytes32(0),
                sourceChain,
                sourceAddress,
                payload,
                tokenSymbol,
                amount
            )
        );

        // if not success revert with the original revert data
        if (!success) {
            // solhint-disable-next-line no-inline-assembly
            assembly {
                let ptr := mload(0x40)
                let size := returndatasize()
                returndatacopy(ptr, 0, size)
                revert(ptr, size)
            }
        }
    }

    function _safeTransfer(
        address tokenAddress,
        address receiver,
        uint256 amount
    ) internal {
        (bool success, bytes memory returnData) = tokenAddress.call(
            abi.encodeWithSelector(IERC20.transfer.selector, receiver, amount)
        );
        bool transferred = success && (returnData.length == uint256(0) || abi.decode(returnData, (bool)));

        if (!transferred || tokenAddress.code.length == 0) revert TransferFailed();
    }

    function _safeTransferFrom(
        address tokenAddress,
        address from,
        uint256 amount
    ) internal {
        // solhint-disable-next-line avoid-low-level-calls
        (bool success, bytes memory returnData) = tokenAddress.call(
            abi.encodeWithSelector(IERC20.transferFrom.selector, from, address(this), amount)
        );
        bool transferred = success && (returnData.length == uint256(0) || abi.decode(returnData, (bool)));

        if (!transferred || tokenAddress.code.length == 0) revert TransferFailed();
    }
}
