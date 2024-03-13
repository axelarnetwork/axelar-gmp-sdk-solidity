// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import { IGasEstimate } from '../interfaces/IGasEstimate.sol';

/**
 * @title AxelarGasService
 * @notice This contract manages gas payments and refunds for cross-chain communication on the Axelar network.
 * @dev The owner address of this contract should be the microservice that pays for gas.
 * @dev Users pay gas for cross-chain calls, and the gasCollector can collect accumulated fees and/or refund users if needed.
 */
contract GasEstimate is IGasEstimate {
    // keccak256('GasEstimate.Slot')
    bytes32 internal constant GAS_SERVICE_SLOT = 0x2fa150da4c9f4c3a28593398c65313dd42f63d0530ec6db4a2b46e6d837a3903;

    struct GasServiceStorage {
        mapping(string => GasInfo) gasPrices;
    }

    /**
     * @notice Sets the gas price for a specific chain.
     * @dev This function is called by the gas oracle to update the gas price for a specific chain.
     * @param chain The name of the chain
     * @param gasInfo The gas info for the chain
     */
    function _setGasInfo(string calldata chain, GasInfo calldata gasInfo) internal {
        emit GasInfoUpdated(chain, gasInfo);

        _gasServiceStorage().gasPrices[chain] = gasInfo;
    }

    /**
     * @notice Estimates the gas fee for a contract call on a destination chain.
     * @param destinationChain Axelar registered name of the destination chain
     * param destinationAddress Destination contract address being called
     * @param executionGasLimit The gas limit to be used for the destination contract execution,
     *        e.g. pass in 200k if your app consumes needs upto 200k for this contract call
     * @return gasEstimate The cross-chain gas estimate, in terms of source chain's native gas token that should be forwarded to the gas service.
     */
    function estimateGasFee(
        string calldata destinationChain,
        string calldata, /* destinationAddress */
        bytes calldata payload,
        uint256 executionGasLimit
    ) external view returns (uint256 gasEstimate) {
        GasServiceStorage storage slot = _gasServiceStorage();
        GasInfo storage gasInfo = slot.gasPrices[destinationChain];

        gasEstimate = gasInfo.baseFee + (executionGasLimit * gasInfo.relativeGasPrice);

        // if chain is L2, compute L1 data fee using L1 gas price info
        if (gasInfo.l1ToL2BaseFee != 0) {
            gasEstimate += computeL1ToL2Fee(
                payload,
                slot.gasPrices['ethereum'].relativeGasPrice,
                gasInfo.l1ToL2BaseFee
            );
        }
    }

    /**
     * @notice Computes the L1 to L2 fee for a contract call on a destination chain.
     * @param payload The payload of the contract call
     * @param l1GasPrice The gas price on the source chain
     * @param l1ToL2BaseFee The base fee for L1 to L2
     * @return l1DataFee The L1 to L2 data fee
     */
    function computeL1ToL2Fee(
        bytes calldata payload,
        uint256 l1GasPrice,
        uint256 l1ToL2BaseFee
    ) internal pure returns (uint256 l1DataFee) {
        /* Optimism Bedrock gas model https://docs.optimism.io/stack/transactions/fees#bedrock
            tx_data_gas = count_zero_bytes(tx_data) * 4 + count_non_zero_bytes(tx_data) * 16
            tx_total_gas = (tx_data_gas + fixed_overhead) * dynamic_overhead
            l1_data_fee = tx_total_gas * ethereum_base_fee
        */

        // We are using upper bounds for gas estimates
        // Current OP fixed_overhead value is 188, using 200 to account for fluctuations
        uint256 fixedOverhead = 200;
        // Current OP dynamic_overhead_multiplier value is 0.684, using 0.7 to encounter for fluctuations
        uint256 dynamicOverheadMultiplier = 7;
        uint256 dynamicOverheadDivisor = 10; // 7 : 10 = 0.7

        uint256 zeroBytesCount;
        uint256 nonZeroBytesCount;
        for (uint256 i; i < payload.length; ++i) {
            if (payload[i] == 0) {
                ++zeroBytesCount;
            } else {
                ++nonZeroBytesCount;
            }
        }

        uint256 txDataGas = zeroBytesCount * 4 + nonZeroBytesCount * 16;
        uint256 txTotalGas = ((txDataGas + fixedOverhead) * l1ToL2BaseFee * dynamicOverheadMultiplier) /
            dynamicOverheadDivisor;

        l1DataFee = txTotalGas * l1GasPrice;
    }

    /**
     * @notice Get the storage slot for the GasServiceStorage struct
     */
    function _gasServiceStorage() private pure returns (GasServiceStorage storage slot) {
        assembly {
            slot.slot := GAS_SERVICE_SLOT
        }
    }
}
