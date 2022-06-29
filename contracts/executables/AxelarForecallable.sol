// SPDX-License-Identifier: MIT

pragma solidity 0.8.9;

import { IAxelarGateway } from '../interfaces/IAxelarGateway.sol';
import { IERC20 } from '../interfaces/IERC20.sol';
import { IAxelarExecutable } from '../interfaces/IAxelarExecutable.sol';

abstract contract AxelarForecallable is IAxelarExecutable{
    error AlreadyForecalled();
    error TransferFailed();

    //keccak256('gateway');
    uint256 public constant GATEWAY_SLOT = 0x00d936aa803619b075b0b1eaff89e1cf989dd683d61dc611f667f876bd8e3bc5;
    //keccak256('forecallers');
    uint256 public constant FORECALLERS_SALT = 0xdb79ee324babd8834c3c1a1a2739c004fce73b812ac9f637241ff47b19e4b71f;

    function gateway() public view override returns (IAxelarGateway gateway_) {
        // solhint-disable-next-line no-inline-assembly
        assembly {
            gateway_ := sload(GATEWAY_SLOT)
        }
    }

    function _setGateway(address gateway_) internal {
        // solhint-disable-next-line no-inline-assembly
        assembly {
            sstore(GATEWAY_SLOT, gateway_)
        }
    }
    
    function getForecaller(
        string calldata sourceChain, 
        string calldata sourceAddress, 
        bytes calldata payload
    ) public view returns (address forecaller) {
        bytes32 pos = keccak256(abi.encode(sourceChain, sourceAddress, payload, FORECALLERS_SALT));
        // solhint-disable-next-line no-inline-assembly
        assembly {
            forecaller := sload(pos)
        }
    }

    function _setForecaller(
        string calldata sourceChain, 
        string calldata sourceAddress, 
        bytes calldata payload, 
        address forecaller
    ) internal {
        bytes32 pos = keccak256(abi.encode(sourceChain, sourceAddress, payload, FORECALLERS_SALT));
        // solhint-disable-next-line no-inline-assembly
        assembly {
            sstore(pos, forecaller)
        }
    }

    function forecall(
        string calldata sourceChain,
        string calldata sourceAddress,
        bytes calldata payload,
        address forecaller
    ) external {
        _checkForecall(sourceChain, sourceAddress, payload, forecaller);
        if (getForecaller(sourceChain, sourceAddress, payload) != address(0)) revert AlreadyForecalled();
        _setForecaller(sourceChain, sourceAddress, payload, forecaller);
        _execute(sourceChain, sourceAddress, payload);
    }

    function execute(
        bytes32 commandId,
        string calldata sourceChain,
        string calldata sourceAddress,
        bytes calldata payload
    ) external override {
        bytes32 payloadHash = keccak256(payload);
        if (!gateway().validateContractCall(commandId, sourceChain, sourceAddress, payloadHash)) revert NotApprovedByGateway();
        address forecaller = getForecaller(sourceChain, sourceAddress, payload);
        if (forecaller != address(0)) {
            _setForecaller(sourceChain, sourceAddress, payload, address(0));
        } else {
            _execute(sourceChain, sourceAddress, payload);
        }
    }

    function getForecallerWithToken(
        string calldata sourceChain, 
        string calldata sourceAddress, 
        bytes calldata payload,
        string calldata symbol,
        uint256 amount
    ) public view returns (address forecaller) {
        bytes32 pos = keccak256(abi.encode(sourceChain, sourceAddress, payload, symbol, amount, FORECALLERS_SALT));
        // solhint-disable-next-line no-inline-assembly
        assembly {
            forecaller := sload(pos)
        }
    }

    function _setForecallerWithToken(
        string calldata sourceChain, 
        string calldata sourceAddress, 
        bytes calldata payload,
        string calldata symbol,
        uint256 amount,
        address forecaller
    ) internal {
        bytes32 pos = keccak256(abi.encode(sourceChain, sourceAddress, payload, symbol, amount, FORECALLERS_SALT));
        // solhint-disable-next-line no-inline-assembly
        assembly {
            sstore(pos, forecaller)
        }
    }

    function forecallWithToken(
        string calldata sourceChain,
        string calldata sourceAddress,
        bytes calldata payload,
        string calldata tokenSymbol,
        uint256 amount,
        address forecaller
    ) external {
        address token = gateway().tokenAddresses(tokenSymbol);
        uint256 amountPost = amountPostFee(amount, payload);
        _safeTransferFrom(token, msg.sender, amountPost);
        _checkForecallWithToken(sourceChain, sourceAddress, payload, tokenSymbol, amount, forecaller);
        if (getForecallerWithToken(sourceChain, sourceAddress, payload, tokenSymbol, amount) != address(0))
            revert AlreadyForecalled();
        _setForecallerWithToken(sourceChain, sourceAddress, payload, tokenSymbol, amount, forecaller);
        _executeWithToken(sourceChain, sourceAddress, payload, tokenSymbol, amountPost);
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
        if (!gateway().validateContractCallAndMint(commandId, sourceChain, sourceAddress, payloadHash, tokenSymbol, amount))
            revert NotApprovedByGateway();
        address forecaller = getForecallerWithToken(sourceChain, sourceAddress, payload, tokenSymbol, amount);
        if (forecaller != address(0)) {
            _setForecallerWithToken(sourceChain, sourceAddress, payload, tokenSymbol, amount, address(0));
            address token = gateway().tokenAddresses(tokenSymbol);
            _safeTransfer(token, forecaller, amount);
        } else {
            _executeWithToken(sourceChain, sourceAddress, payload, tokenSymbol, amount);
        }
    }

    function _execute(
        string memory sourceChain,
        string memory sourceAddress,
        bytes calldata payload
    ) internal virtual {}

    function _executeWithToken(
        string memory sourceChain,
        string memory sourceAddress,
        bytes calldata payload,
        string memory tokenSymbol,
        uint256 amount
    ) internal virtual {}

    // Override this to keep a fee.
    function amountPostFee(
        uint256 amount,
        bytes calldata /*payload*/
    ) public virtual returns (uint256) {
        return amount;
    }

    // Override this and revert if you want to only allow certain people/calls to be able to forecall.
    function _checkForecall(
        string calldata sourceChain,
        string calldata sourceAddress,
        bytes calldata payload,
        address forecaller
    ) internal virtual {}

    // Override this and revert if you want to only allow certain people/calls to be able to forecall.
    function _checkForecallWithToken(
        string calldata sourceChain,
        string calldata sourceAddress,
        bytes calldata payload,
        string calldata tokenSymbol,
        uint256 amount,
        address forecaller
    ) internal virtual {}

    function _safeTransfer(
        address tokenAddress,
        address receiver,
        uint256 amount
    ) internal {
        (bool success, bytes memory returnData) = tokenAddress.call(abi.encodeWithSelector(IERC20.transfer.selector, receiver, amount));
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
