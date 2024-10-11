// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import { IAxelarGatewayWithToken } from '../../interfaces/IAxelarGatewayWithToken.sol';
import { IERC20 } from '../../interfaces/IERC20.sol';
import { IERC20MintableBurnable } from '../../interfaces/IERC20MintableBurnable.sol';

import { ERC20MintableBurnable } from '../token/ERC20MintableBurnable.sol';

contract MockGateway is IAxelarGatewayWithToken {
    enum TokenType {
        InternalBurnable,
        InternalBurnableFrom,
        External
    }

    bytes32 internal constant PREFIX_COMMAND_EXECUTED = keccak256('command-executed');
    bytes32 internal constant PREFIX_TOKEN_ADDRESS = keccak256('token-address');
    bytes32 internal constant PREFIX_TOKEN_TYPE = keccak256('token-type');
    bytes32 internal constant PREFIX_CONTRACT_CALL_APPROVED = keccak256('contract-call-approved');
    bytes32 internal constant PREFIX_CONTRACT_CALL_APPROVED_WITH_MINT = keccak256('contract-call-approved-with-mint');

    mapping(bytes32 => bool) public bools;
    mapping(bytes32 => address) public addresses;
    mapping(bytes32 => uint256) public uints;
    mapping(bytes32 => string) public strings;
    mapping(bytes32 => bytes32) public bytes32s;

    event ContractCallApproved(
        bytes32 indexed commandId,
        string sourceChain,
        string sourceAddress,
        address indexed contractAddress,
        bytes32 indexed payloadHash,
        bytes32 sourceTxHash,
        uint256 sourceEventIndex
    );

    /******************\
    |* Public Methods *|
    \******************/

    function sendToken(
        string calldata destinationChain,
        string calldata destinationAddress,
        string calldata symbol,
        uint256 amount
    ) external {
        _burnTokenFrom(msg.sender, symbol, amount);
        emit TokenSent(msg.sender, destinationChain, destinationAddress, symbol, amount);
    }

    function callContract(
        string calldata destinationChain,
        string calldata destinationContractAddress,
        bytes calldata payload
    ) external {
        emit ContractCall(msg.sender, destinationChain, destinationContractAddress, keccak256(payload), payload);
    }

    function callContractWithToken(
        string calldata destinationChain,
        string calldata destinationContractAddress,
        bytes calldata payload,
        string calldata symbol,
        uint256 amount
    ) external {
        _burnTokenFrom(msg.sender, symbol, amount);
        emit ContractCallWithToken(
            msg.sender,
            destinationChain,
            destinationContractAddress,
            keccak256(payload),
            payload,
            symbol,
            amount
        );
    }

    function isContractCallApproved(
        bytes32 commandId,
        string calldata sourceChain,
        string calldata sourceAddress,
        address contractAddress,
        bytes32 payloadHash
    ) external view override returns (bool) {
        return
            bools[_getIsContractCallApprovedKey(commandId, sourceChain, sourceAddress, contractAddress, payloadHash)];
    }

    function isContractCallAndMintApproved(
        bytes32 commandId,
        string calldata sourceChain,
        string calldata sourceAddress,
        address contractAddress,
        bytes32 payloadHash,
        string calldata symbol,
        uint256 amount
    ) external view override returns (bool) {
        return
            bools[
                _getIsContractCallApprovedWithMintKey(
                    commandId,
                    sourceChain,
                    sourceAddress,
                    contractAddress,
                    payloadHash,
                    symbol,
                    amount
                )
            ];
    }

    function validateContractCall(
        bytes32 commandId,
        string calldata sourceChain,
        string calldata sourceAddress,
        bytes32 payloadHash
    ) external override returns (bool valid) {
        bytes32 key = _getIsContractCallApprovedKey(commandId, sourceChain, sourceAddress, msg.sender, payloadHash);
        valid = bools[key];
        if (valid) bools[key] = false;
    }

    function validateContractCallAndMint(
        bytes32 commandId,
        string calldata sourceChain,
        string calldata sourceAddress,
        bytes32 payloadHash,
        string calldata symbol,
        uint256 amount
    ) external override returns (bool valid) {
        bytes32 key = _getIsContractCallApprovedWithMintKey(
            commandId,
            sourceChain,
            sourceAddress,
            msg.sender,
            payloadHash,
            symbol,
            amount
        );
        valid = bools[key];
        if (valid) {
            // Prevent re-entrancy
            bools[key] = false;
            _mintToken(symbol, msg.sender, amount);
        }
    }

    /***********\
    |* Getters *|
    \***********/

    function tokenAddresses(string memory symbol) public view returns (address) {
        return addresses[_getTokenAddressKey(symbol)];
    }

    function isCommandExecuted(bytes32 commandId) public view override returns (bool) {
        return bools[_getIsCommandExecutedKey(commandId)];
    }

    /******************\
    |* Self Functions *|
    \******************/

    function deployToken(bytes calldata params, bytes32 commandId) external {
        _setCommandExecuted(commandId, true);
        (string memory name, string memory symbol, uint8 decimals, uint256 cap, address tokenAddress, ) = abi.decode(
            params,
            (string, string, uint8, uint256, address, uint256)
        );

        if (tokenAddress == address(0)) {
            // If token address is no specified, it indicates a request to deploy one.
            bytes32 salt = keccak256(abi.encodePacked(symbol));

            tokenAddress = _deployToken(name, symbol, decimals, cap, salt);

            _setTokenType(symbol, TokenType.InternalBurnableFrom);
        } else {
            // Mark that this symbol is an external token, which is needed to differentiate between operations on mint and burn.
            _setTokenType(symbol, TokenType.External);
        }

        _setTokenAddress(symbol, tokenAddress);
    }

    function mintToken(bytes calldata params, bytes32 commandId) external {
        _setCommandExecuted(commandId, true);
        (string memory symbol, address account, uint256 amount) = abi.decode(params, (string, address, uint256));

        _mintToken(symbol, account, amount);
    }

    function approveContractCall(bytes calldata params, bytes32 commandId) external {
        _setCommandExecuted(commandId, true);
        (
            string memory sourceChain,
            string memory sourceAddress,
            address contractAddress,
            bytes32 payloadHash,
            bytes32 sourceTxHash,
            uint256 sourceEventIndex
        ) = abi.decode(params, (string, string, address, bytes32, bytes32, uint256));

        _setContractCallApproved(commandId, sourceChain, sourceAddress, contractAddress, payloadHash);
        emit ContractCallApproved(
            commandId,
            sourceChain,
            sourceAddress,
            contractAddress,
            payloadHash,
            sourceTxHash,
            sourceEventIndex
        );
    }

    function approveContractCallWithMint(bytes calldata params, bytes32 commandId) external {
        _setCommandExecuted(commandId, true);
        (
            string memory sourceChain,
            string memory sourceAddress,
            address contractAddress,
            bytes32 payloadHash,
            string memory symbol,
            uint256 amount,
            bytes32 sourceTxHash,
            uint256 sourceEventIndex
        ) = abi.decode(params, (string, string, address, bytes32, string, uint256, bytes32, uint256));

        _setContractCallApprovedWithMint(
            commandId,
            sourceChain,
            sourceAddress,
            contractAddress,
            payloadHash,
            symbol,
            amount
        );
        emit ContractCallApprovedWithMint(
            commandId,
            sourceChain,
            sourceAddress,
            contractAddress,
            payloadHash,
            symbol,
            amount,
            sourceTxHash,
            sourceEventIndex
        );
    }

    /********************\
    |* Internal Methods *|
    \********************/

    function _callERC20Token(address tokenAddress, bytes memory callData) internal returns (bool) {
        (bool success, bytes memory returnData) = tokenAddress.call(callData);
        return success && (returnData.length == uint256(0) || abi.decode(returnData, (bool)));
    }

    function _deployToken(
        string memory name,
        string memory symbol,
        uint8 decimals,
        uint256, /*cap*/
        bytes32 salt
    ) internal returns (address tokenAddress) {
        tokenAddress = address(new ERC20MintableBurnable{ salt: salt }(name, symbol, decimals));
    }

    function _mintToken(
        string memory symbol,
        address account,
        uint256 amount
    ) internal {
        address tokenAddress = tokenAddresses(symbol);

        if (_getTokenType(symbol) == TokenType.External) {
            _callERC20Token(tokenAddress, abi.encodeWithSelector(IERC20.transfer.selector, account, amount));
        } else {
            IERC20MintableBurnable(tokenAddress).mint(account, amount);
        }
    }

    function _burnTokenFrom(
        address sender,
        string memory symbol,
        uint256 amount
    ) internal {
        address tokenAddress = tokenAddresses(symbol);
        TokenType tokenType = _getTokenType(symbol);
        bool burnSuccess;

        if (tokenType == TokenType.External) {
            burnSuccess = _callERC20Token(
                tokenAddress,
                abi.encodeWithSelector(IERC20.transferFrom.selector, sender, address(this), amount)
            );

            return;
        }

        if (tokenType == TokenType.InternalBurnableFrom) {
            burnSuccess = _callERC20Token(
                tokenAddress,
                abi.encodeWithSelector(IERC20MintableBurnable.burn.selector, sender, amount)
            );

            return;
        }
    }

    /********************\
    |* Pure Key Getters *|
    \********************/

    function _getTokenTypeKey(string memory symbol) internal pure returns (bytes32) {
        return keccak256(abi.encodePacked(PREFIX_TOKEN_TYPE, symbol));
    }

    function _getTokenAddressKey(string memory symbol) internal pure returns (bytes32) {
        return keccak256(abi.encodePacked(PREFIX_TOKEN_ADDRESS, symbol));
    }

    function _getIsCommandExecutedKey(bytes32 commandId) internal pure returns (bytes32) {
        return keccak256(abi.encodePacked(PREFIX_COMMAND_EXECUTED, commandId));
    }

    function _getIsContractCallApprovedKey(
        bytes32 commandId,
        string memory sourceChain,
        string memory sourceAddress,
        address contractAddress,
        bytes32 payloadHash
    ) internal pure returns (bytes32) {
        return
            keccak256(
                abi.encode(
                    PREFIX_CONTRACT_CALL_APPROVED,
                    commandId,
                    sourceChain,
                    sourceAddress,
                    contractAddress,
                    payloadHash
                )
            );
    }

    function _getIsContractCallApprovedWithMintKey(
        bytes32 commandId,
        string memory sourceChain,
        string memory sourceAddress,
        address contractAddress,
        bytes32 payloadHash,
        string memory symbol,
        uint256 amount
    ) internal pure returns (bytes32) {
        return
            keccak256(
                abi.encode(
                    PREFIX_CONTRACT_CALL_APPROVED_WITH_MINT,
                    commandId,
                    sourceChain,
                    sourceAddress,
                    contractAddress,
                    payloadHash,
                    symbol,
                    amount
                )
            );
    }

    /********************\
    |* Internal Getters *|
    \********************/

    function _getTokenType(string memory symbol) internal view returns (TokenType) {
        return TokenType(uints[_getTokenTypeKey(symbol)]);
    }

    /********************\
    |* Internal Setters *|
    \********************/

    function _setTokenType(string memory symbol, TokenType tokenType) internal {
        uints[_getTokenTypeKey(symbol)] = uint256(tokenType);
    }

    function _setTokenAddress(string memory symbol, address tokenAddress) internal {
        addresses[_getTokenAddressKey(symbol)] = tokenAddress;
    }

    function _setCommandExecuted(bytes32 commandId, bool executed) internal {
        bools[_getIsCommandExecutedKey(commandId)] = executed;
    }

    function _setContractCallApproved(
        bytes32 commandId,
        string memory sourceChain,
        string memory sourceAddress,
        address contractAddress,
        bytes32 payloadHash
    ) internal {
        bools[
            _getIsContractCallApprovedKey(commandId, sourceChain, sourceAddress, contractAddress, payloadHash)
        ] = true;
    }

    function _setContractCallApprovedWithMint(
        bytes32 commandId,
        string memory sourceChain,
        string memory sourceAddress,
        address contractAddress,
        bytes32 payloadHash,
        string memory symbol,
        uint256 amount
    ) internal {
        bools[
            _getIsContractCallApprovedWithMintKey(
                commandId,
                sourceChain,
                sourceAddress,
                contractAddress,
                payloadHash,
                symbol,
                amount
            )
        ] = true;
    }
}
