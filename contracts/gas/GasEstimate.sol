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
    // keccak256('GasEstimate.Slot') - 1
    bytes32 internal constant GAS_SERVICE_SLOT = 0x2fa150da4c9f4c3a28593398c65313dd42f63d0530ec6db4a2b46e6d837a3902;

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
                destinationChain,
                payload,
                slot.gasPrices['ethereum'].relativeGasPrice,
                gasInfo.l1ToL2BaseFee
            );
        }
    }

    /**
     * @notice Computes the L1 to L2 fee for a contract call on a destination chain.
     * @param destinationChain Axelar registered name of the destination chain
     * @param payload The payload of the contract call
     *  param l1GasPrice The gas price on the source chain
     * @param l1ToL2BaseFee The base fee for L1 to L2
     * @return l1DataFee The L1 to L2 data fee
     */
    function computeL1ToL2Fee(
        string calldata destinationChain,
        bytes calldata payload,
        uint256, /* l1GasPrice */
        uint256 l1ToL2BaseFee
    ) internal pure returns (uint256) {
        if (keccak256(bytes(destinationChain)) == keccak256(bytes('optimism'))) {
            return optimismL1ToL2Fee(payload, l1ToL2BaseFee);
        }

        revert UnsupportedL2Estimate(destinationChain);
    }

    /**
     * @notice Computes the L1 to L2 fee for a contract call on the Optimism chain.
     * @param payload The payload of the contract call
     * @param l1ToL2BaseFee The base fee for L1 to L2
     * @return l1DataFee The L1 to L2 data fee
     */
    function optimismL1ToL2Fee(bytes calldata payload, uint256 l1ToL2BaseFee)
        internal
        pure
        returns (uint256 l1DataFee)
    {
        /* Optimism Ecotone gas model https://docs.optimism.io/stack/transactions/fees#ecotone
             tx_compressed_size = [(count_zero_bytes(tx_data)*4 + count_non_zero_bytes(tx_data)*16)] / 16
             weighted_gas_price = 16*base_fee_scalar*base_fee + blob_base_fee_scalar*blob_base_fee
             l1_data_fee = tx_compressed_size * weighted_gas_price

           Reference implementation:
             https://github.com/ethereum-optimism/optimism/blob/876e16ad04968f0bb641eb76f98eb77e7e1a3e16/packages/contracts-bedrock/src/L2/GasPriceOracle.sol#L138
        */

        // The new base_fee_scalar is using old dynamic_overhead_multiplier value which is currently 0.684
        // We are setting it to un upper bound of 0.7 to encounter for future fluctuations
        uint256 scalarPrecision = 10**6;
        uint256 baseFeeScalar = 7 * 10**5; // 7e5 : 1e6 = 0.7

        // The blob_base_fee_scalar is currently set to 0. As the blob gas model is still in development.
        // https://eips.ethereum.org/EIPS/eip-4844
        uint256 blobBaseFeeScalar = 0 * scalarPrecision;
        uint256 blobBaseFee = 0;

        // Calculating transaction size in bytes that will later be divided by 16 to compress the size
        // 68 bytes for the TX RLP encoding overhead
        uint256 txSize = 68 * 16;
        // GMP executeWithToken call params
        // 32 bytes for the commandId, 96 bytes for the sourceChain, 128 bytes for the sourceAddress, 96 bytes for token symbol, 32 bytes for amount
        // Expecting half of the calldata to be zeroes. So multiplying by 10 as an average of 4 and 16
        txSize += (32 + 96 + 128 + 96 + 32) * 10;

        for (uint256 i; i < payload.length; ++i) {
            if (payload[i] == 0) {
                txSize += 4; // 4 for each zero byte
            } else {
                txSize += 16; // 16 for each non-zero byte
            }
        }

        uint256 weightedGasPrice = 16 * baseFeeScalar * l1ToL2BaseFee + blobBaseFeeScalar * blobBaseFee;

        l1DataFee = (weightedGasPrice * txSize) / (16 * scalarPrecision); // 16 for txSize compression and scalar precision conversion
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
