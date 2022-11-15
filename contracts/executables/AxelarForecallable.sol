// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import { IAxelarGateway } from '../interfaces/IAxelarGateway.sol';
import { IERC20 } from '../interfaces/IERC20.sol';
import { IAxelarForecallable } from '../interfaces/IAxelarForecallable.sol';

contract AxelarForecallable is IAxelarForecallable {
    IAxelarGateway public immutable gateway;
    address public immutable forecallService;

    // keccak256('forecall');
    uint256 public constant PREFIX_FORECALL = 0xf1aaf9d468ca954ceeb575b8219bb627c97f319a0b6f11da046e9a513f6a7159;
    // keccak256('forecallWithToken');
    uint256 public constant PREFIX_FORECALL_WITH_TOKEN =
        0x863fd763cde7f124f9f58ffa48b233da1b7dab397d43949cd55e3885b252a28c;

    constructor(address gateway_, address forecallService_) {
        if (gateway_ == address(0) || forecallService_ == address(0)) revert InvalidAddress();

        gateway = IAxelarGateway(gateway_);
        forecallService = forecallService_;
    }

    function _getForecallSlot(
        string calldata sourceChain,
        string calldata sourceAddress,
        bytes calldata payload
    ) public pure returns (bytes32) {
        return keccak256(abi.encode(PREFIX_FORECALL, sourceChain, sourceAddress, payload));
    }

    function _getForecaller(bytes32 forecallSlot) public view returns (address forecaller) {
        // solhint-disable-next-line no-inline-assembly
        assembly {
            forecaller := sload(forecallSlot)
        }
    }

    function getForecaller(
        string calldata sourceChain,
        string calldata sourceAddress,
        bytes calldata payload
    ) external view override returns (address) {
        return _getForecaller(_getForecallSlot(sourceChain, sourceAddress, payload));
    }

    function _setForecaller(bytes32 forecallSlot, address forecaller) internal {
        // solhint-disable-next-line no-inline-assembly
        assembly {
            sstore(forecallSlot, forecaller)
        }
    }

    function forecall(
        string calldata sourceChain,
        string calldata sourceAddress,
        bytes calldata payload
    ) external {
        _authForecall(sourceChain, sourceAddress, payload, msg.sender);

        bytes32 forecallSlot = _getForecallSlot(sourceChain, sourceAddress, payload);

        if (_getForecaller(forecallSlot) != address(0)) revert AlreadyForecalled();
        _setForecaller(forecallSlot, msg.sender);
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

        bytes32 forecallSlot = _getForecallSlot(sourceChain, sourceAddress, payload);
        address forecaller = _getForecaller(forecallSlot);

        if (forecaller != address(0)) {
            _setForecaller(forecallSlot, address(0));
        } else {
            _execute(sourceChain, sourceAddress, payload);
        }
    }

    function _getForecallWithTokenSlot(
        string calldata sourceChain,
        string calldata sourceAddress,
        bytes calldata payload,
        string calldata symbol,
        uint256 amount
    ) public pure returns (bytes32) {
        return keccak256(abi.encode(PREFIX_FORECALL_WITH_TOKEN, sourceChain, sourceAddress, payload, symbol, amount));
    }

    function _getForecallerWithToken(bytes32 forecallSlot) public view returns (address forecaller) {
        // solhint-disable-next-line no-inline-assembly
        assembly {
            forecaller := sload(forecallSlot)
        }
    }

    function getForecallerWithToken(
        string calldata sourceChain,
        string calldata sourceAddress,
        bytes calldata payload,
        string calldata symbol,
        uint256 amount
    ) external view override returns (address) {
        return _getForecallerWithToken(_getForecallWithTokenSlot(sourceChain, sourceAddress, payload, symbol, amount));
    }

    function _setForecallerWithToken(bytes32 forecallSlot, address forecaller) internal {
        // solhint-disable-next-line no-inline-assembly
        assembly {
            sstore(forecallSlot, forecaller)
        }
    }

    /// @notice This method is relying on exact amount of ERC20 token to be transferred to it before the call
    /// @notice For best security practice Forecallable contract shouldn't hold any token between transactions
    function forecallWithToken(
        string calldata sourceChain,
        string calldata sourceAddress,
        bytes calldata payload,
        string calldata tokenSymbol,
        uint256 amount
    ) external override {
        _authForecallWithToken(sourceChain, sourceAddress, payload, tokenSymbol, amount, msg.sender);

        bytes32 forecallSlot = _getForecallWithTokenSlot(sourceChain, sourceAddress, payload, tokenSymbol, amount);

        if (_getForecallerWithToken(forecallSlot) != address(0)) revert AlreadyForecalled();

        _setForecallerWithToken(forecallSlot, msg.sender);
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

        bytes32 forecallSlot = _getForecallWithTokenSlot(sourceChain, sourceAddress, payload, tokenSymbol, amount);
        address forecaller = _getForecallerWithToken(forecallSlot);

        if (forecaller != address(0)) {
            _setForecallerWithToken(forecallSlot, address(0));
            address token = gateway.tokenAddresses(tokenSymbol);
            _safeTransfer(token, forecaller, amount);
        } else {
            _executeWithToken(sourceChain, sourceAddress, payload, tokenSymbol, amount);
        }
    }

    function _execute(
        string calldata sourceChain,
        string calldata sourceAddress,
        bytes calldata payload
    ) internal virtual {}

    function _executeWithToken(
        string calldata sourceChain,
        string calldata sourceAddress,
        bytes calldata payload,
        string calldata tokenSymbol,
        uint256 amount
    ) internal virtual {}

    // Override this and revert if you want to only allow certain addresses/txs to be able to forecall.
    function _authForecall(
        string calldata, /* sourceChain */
        string calldata, /* sourceAddress */
        bytes calldata, /* payload */
        address /* forecaller */
    ) internal virtual {
        if (msg.sender != forecallService) revert InvalidForecaller();
    }

    // Override this and revert if you want to only allow certain addresses/txs to be able to forecall.
    function _authForecallWithToken(
        string calldata, /* sourceChain */
        string calldata, /* sourceAddress */
        bytes calldata, /* payload */
        string calldata, /* tokenSymbol */
        uint256, /* amount */
        address /* forecaller */
    ) internal virtual {
        if (msg.sender != forecallService) revert InvalidForecaller();
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
        (bool success, bytes memory returnData) = tokenAddress.call(
            abi.encodeWithSelector(IERC20.transferFrom.selector, from, address(this), amount)
        );
        bool transferred = success && (returnData.length == uint256(0) || abi.decode(returnData, (bool)));

        if (!transferred || tokenAddress.code.length == 0) revert TransferFailed();
    }
}
