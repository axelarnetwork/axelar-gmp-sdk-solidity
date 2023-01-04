// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import { IAxelarGateway } from '../interfaces/IAxelarGateway.sol';
import { IERC20 } from '../interfaces/IERC20.sol';
import { IExpressExecutable } from '../interfaces/IExpressExecutable.sol';
import { IGMPExpressService } from '../interfaces/IGMPExpressService.sol';
import { Proxy } from '../upgradable/Proxy.sol';

contract ExpressExecutableProxy is Proxy, IExpressExecutable {
    IAxelarGateway public immutable gateway;
    IGMPExpressService public immutable gmpExpressService;

    constructor(address gmpExpressService_, address gateway_) {
        gmpExpressService = IGMPExpressService(gmpExpressService_);

        IAxelarGateway resolvedGateway;
        if (gateway_ == address(0)) {
            resolvedGateway = gmpExpressService.gateway();
        } else {
            resolvedGateway = IAxelarGateway(gateway_);
        }

        gateway = resolvedGateway;
    }

    modifier onlyService() {
        if (msg.sender != address(gmpExpressService)) revert NotGMPExpressService();

        _;
    }

    function expressExecute(
        string calldata sourceChain,
        string calldata sourceAddress,
        bytes calldata payload
    ) external onlyService {
        _execute(sourceChain, sourceAddress, payload);
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

        bool expressCalled = gmpExpressService.completeCall(sourceChain, sourceAddress, payloadHash);

        if (!expressCalled) _execute(sourceChain, sourceAddress, payload);
    }

    /// @notice This method is relying on exact amount of ERC20 token to be transferred to it before the call
    /// @notice For best security practices Express contract shouldn't hold any token between transactions
    function expressExecuteWithToken(
        string calldata sourceChain,
        string calldata sourceAddress,
        bytes calldata payload,
        string calldata tokenSymbol,
        uint256 amount
    ) external override onlyService {
        _executeWithToken(sourceChain, sourceAddress, payload, tokenSymbol, amount);
    }

    function executeWithToken(
        bytes32 commandId,
        string calldata sourceChain,
        string calldata sourceAddress,
        bytes calldata payload,
        string calldata tokenSymbol,
        uint256 amount
    ) external override {
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

        bool expressCalled = gmpExpressService.completeCallWithToken(
            sourceChain,
            sourceAddress,
            payloadHash,
            tokenSymbol,
            amount
        );

        if (!expressCalled) {
            _executeWithToken(sourceChain, sourceAddress, payload, tokenSymbol, amount);
        } else {
            // Returning the lent token
            address token = gateway.tokenAddresses(tokenSymbol);
            _safeTransfer(token, address(gmpExpressService), amount);
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
}
