// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import { IERC20 } from '../interfaces/IERC20.sol';
import { IAxelarGateway } from '../interfaces/IAxelarGateway.sol';
import { IExpressProxy } from '../interfaces/IExpressProxy.sol';
import { IGMPExpressService } from '../interfaces/IGMPExpressService.sol';
import { IExpressRegistry } from '../interfaces/IExpressRegistry.sol';
import { IExpressExecutable } from '../interfaces/IExpressExecutable.sol';
import { FinalProxy } from '../upgradable/FinalProxy.sol';
import { SafeTokenTransfer, SafeTokenTransferFrom } from '../utils/SafeTransfer.sol';
import { Create3 } from '../deploy/Create3.sol';

contract ExpressProxy is FinalProxy, IExpressProxy {
    using SafeTokenTransfer for IERC20;
    using SafeTokenTransferFrom for IERC20;

    bytes32 internal constant REGISTRY_SALT = keccak256('express-registry');

    IAxelarGateway public immutable gateway;

    constructor(
        address implementationAddress,
        address owner,
        bytes memory setupParams,
        address gateway_
    ) FinalProxy(implementationAddress, owner, setupParams) {
        if (gateway_ == address(0)) revert InvalidAddress();

        gateway = IAxelarGateway(gateway_);
    }

    modifier onlyRegistry() {
        if (msg.sender != address(registry())) revert NotExpressRegistry();

        _;
    }

    function registry() public view returns (IExpressRegistry) {
        // Computing address is cheaper than using storage
        // Can't use immutable storage as it will alter the codehash for each proxy instance
        return IExpressRegistry(Create3.deployedAddress(REGISTRY_SALT, address(this)));
    }

    // @notice should be called right after the proxy is deployed
    function deployRegistry(bytes calldata registryCreationCode) external {
        Create3.deploy(
            REGISTRY_SALT,
            abi.encodePacked(registryCreationCode, abi.encode(address(gateway), address(this)))
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

        if (
            IExpressExecutable(address(this)).acceptExpressCallWithToken(
                msg.sender,
                sourceChain,
                sourceAddress,
                payloadHash,
                tokenSymbol,
                amount
            ) == false
        ) revert ExpressCallNotAccepted();

        if (token == address(0)) revert InvalidTokenSymbol();

        registry().registerExpressCallWithToken(
            msg.sender,
            sourceChain,
            sourceAddress,
            payloadHash,
            tokenSymbol,
            amount
        );

        IERC20(token).safeTransferFrom(msg.sender, address(this), amount);
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
        registry().processExecuteWithToken(commandId, sourceChain, sourceAddress, payload, tokenSymbol, amount);
    }

    /// @notice callback to complete the GMP call
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

            if (token == address(0)) revert InvalidTokenSymbol();

            IERC20(token).safeTransfer(expressCaller, amount);
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
            abi.encodeWithSelector(ExpressProxy.execute.selector, bytes32(0), sourceChain, sourceAddress, payload)
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
                ExpressProxy.executeWithToken.selector,
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
}
