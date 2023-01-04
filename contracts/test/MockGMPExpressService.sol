// SPDX-License-Identifier: MIT

pragma solidity 0.8.9;

import { IExpressExecutable } from '../interfaces/IExpressExecutable.sol';
import { IAxelarGateway } from '../interfaces/IAxelarGateway.sol';
import { IGMPExpressService } from '../interfaces/IGMPExpressService.sol';
import { IERC20 } from '../interfaces/IERC20.sol';
import { AxelarExecutable } from '../executable/AxelarExecutable.sol';
import { ExpressExecutableProxy } from '../executable/ExpressExecutableProxy.sol';

contract MockGMPExpressService is AxelarExecutable, IGMPExpressService {
    address public immutable expressOperator;
    bytes32 public immutable expressProxyCodeHash;

    // keccak256('expressCall');
    uint256 public constant PREFIX_EXPRESS_CALL = 0xb69cf1f8825a92733483adddaad491ac8f187461114a82800cd710f02221879c;
    // keccak256('expressCallWithToken');
    uint256 public constant PREFIX_EXPRESS_CALL_WITH_TOKEN =
        0xb6e1623c5ea036036acb68a60ec2e4e88041d19595383b291882990df411b4dd;

    constructor(address gateway_, address expressOperator_) AxelarExecutable(gateway_) {
        if (expressOperator_ == address(0)) revert InvalidOperator();

        expressOperator = expressOperator_;
        expressProxyCodeHash = address(new ExpressExecutableProxy(address(this), gateway_)).codehash;
    }

    modifier onlyOperator() {
        if (msg.sender != expressOperator) revert NotOperator();

        _;
    }

    function call(
        bytes32 commandId,
        string calldata sourceChain,
        string calldata sourceAddress,
        address contractAddress,
        bytes calldata payload
    ) external onlyOperator {
        if (contractAddress == address(0)) revert InvalidContractAddress();

        if (commandId != bytes32(0) && gateway.isCommandExecuted(commandId)) {
            IExpressExecutable(contractAddress).execute(commandId, sourceChain, sourceAddress, payload);
        } else {
            if (contractAddress.codehash != expressProxyCodeHash) revert NotExpressProxy();

            (bytes32 slot, uint256 count) = _getExpressCall(
                sourceChain,
                sourceAddress,
                contractAddress,
                keccak256(payload)
            );
            _setExpressCall(slot, count + 1);
            IExpressExecutable(contractAddress).expressExecute(sourceChain, sourceAddress, payload);
        }
    }

    function callWithToken(
        bytes32 commandId,
        string calldata sourceChain,
        string calldata sourceAddress,
        address contractAddress,
        bytes calldata payload,
        string calldata tokenSymbol,
        uint256 amount
    ) external onlyOperator {
        if (contractAddress == address(0)) revert InvalidContractAddress();

        if (commandId != bytes32(0) && gateway.isCommandExecuted(commandId)) {
            IExpressExecutable(contractAddress).executeWithToken(
                commandId,
                sourceChain,
                sourceAddress,
                payload,
                tokenSymbol,
                amount
            );
        } else {
            if (contractAddress.codehash != expressProxyCodeHash) revert NotExpressProxy();

            (bytes32 slot, uint256 count) = _getExpressCallWithToken(
                sourceChain,
                sourceAddress,
                contractAddress,
                keccak256(payload),
                tokenSymbol,
                amount
            );
            _setExpressCallWithToken(slot, count + 1);
            _safeTransfer(gateway.tokenAddresses(tokenSymbol), contractAddress, amount);
            IExpressExecutable(contractAddress).expressExecuteWithToken(
                sourceChain,
                sourceAddress,
                payload,
                tokenSymbol,
                amount
            );
        }
    }

    function getPendingExpressCallCount(
        string calldata sourceChain,
        string calldata sourceAddress,
        address contractAddress,
        bytes32 payloadHash
    ) external view returns (uint256 count) {
        (, count) = _getExpressCall(sourceChain, sourceAddress, contractAddress, payloadHash);
    }

    function getPendingExpressCallWithTokenCount(
        string calldata sourceChain,
        string calldata sourceAddress,
        address contractAddress,
        bytes32 payloadHash,
        string calldata tokenSymbol,
        uint256 amount
    ) external view returns (uint256 count) {
        (, count) = _getExpressCallWithToken(
            sourceChain,
            sourceAddress,
            contractAddress,
            payloadHash,
            tokenSymbol,
            amount
        );
    }

    function completeCall(
        string calldata sourceChain,
        string calldata sourceAddress,
        bytes32 payloadHash
    ) external returns (bool expressCalled) {
        (bytes32 slot, uint256 count) = _getExpressCall(sourceChain, sourceAddress, msg.sender, payloadHash);
        expressCalled = count != 0;

        if (expressCalled) _setExpressCall(slot, count - 1);
    }

    function completeCallWithToken(
        string calldata sourceChain,
        string calldata sourceAddress,
        bytes32 payloadHash,
        string calldata tokenSymbol,
        uint256 amount
    ) external returns (bool expressCalled) {
        (bytes32 slot, uint256 count) = _getExpressCallWithToken(
            sourceChain,
            sourceAddress,
            msg.sender,
            payloadHash,
            tokenSymbol,
            amount
        );
        expressCalled = count != 0;

        if (expressCalled) _setExpressCallWithToken(slot, count - 1);
    }

    function deployExpressProxy(
        bytes32,
        address,
        address,
        bytes calldata
    ) external pure returns (address) {
        return address(0);
    }

    function deployExpressExecutable(
        bytes32,
        bytes memory,
        address,
        bytes calldata
    ) external pure returns (address) {
        return address(0);
    }

    function deployExpressExecutableOnChains(
        bytes32,
        bytes memory,
        address,
        bytes calldata,
        string[] calldata,
        uint256[] calldata,
        address
    ) external {}

    function withdraw(
        address payable receiver,
        address token,
        uint256 amount
    ) external onlyOperator {
        if (receiver == address(0)) revert InvalidAddress();

        if (token == address(0)) {
            receiver.transfer(amount);
        } else {
            _safeTransfer(token, receiver, amount);
        }
    }

    function _getExpressCall(
        string calldata sourceChain,
        string calldata sourceAddress,
        address contractAddress,
        bytes32 payloadHash
    ) internal view returns (bytes32 slot, uint256 count) {
        slot = keccak256(abi.encode(PREFIX_EXPRESS_CALL, sourceChain, sourceAddress, contractAddress, payloadHash));
        // solhint-disable-next-line no-inline-assembly
        assembly {
            count := sload(slot)
        }
    }

    function _setExpressCall(bytes32 slot, uint256 count) internal {
        // solhint-disable-next-line no-inline-assembly
        assembly {
            sstore(slot, count)
        }
    }

    function _getExpressCallWithToken(
        string calldata sourceChain,
        string calldata sourceAddress,
        address contractAddress,
        bytes32 payloadHash,
        string calldata symbol,
        uint256 amount
    ) internal view returns (bytes32 slot, uint256 count) {
        slot = keccak256(
            abi.encode(
                PREFIX_EXPRESS_CALL_WITH_TOKEN,
                sourceChain,
                sourceAddress,
                contractAddress,
                payloadHash,
                symbol,
                amount
            )
        );
        // solhint-disable-next-line no-inline-assembly
        assembly {
            count := sload(slot)
        }
    }

    function _setExpressCallWithToken(bytes32 slot, uint256 count) internal {
        // solhint-disable-next-line no-inline-assembly
        assembly {
            sstore(slot, count)
        }
    }

    function _safeTransfer(
        address tokenAddress,
        address receiver,
        uint256 amount
    ) internal {
        // solhint-disable-next-line avoid-low-level-calls
        (bool success, bytes memory returnData) = tokenAddress.call(
            abi.encodeWithSelector(IERC20.transfer.selector, receiver, amount)
        );
        bool transferred = success && (returnData.length == uint256(0) || abi.decode(returnData, (bool)));

        if (!transferred || tokenAddress.code.length == 0) revert TransferFailed();
    }

    function contractId() external pure returns (bytes32) {
        return keccak256('gmp-express-service');
    }
}
