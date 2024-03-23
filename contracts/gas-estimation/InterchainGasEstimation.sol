// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import { IInterchainGasEstimation } from '../interfaces/IInterchainGasEstimation.sol';

/**
 * @title InterchainGasEstimation
 * @notice This is an abstract contract that allows for estimating gas fees for cross-chain communication on the Axelar network.
 */
abstract contract InterchainGasEstimation is IInterchainGasEstimation {
    // keccak256('GasEstimate.Slot') - 1
    bytes32 internal constant GAS_SERVICE_SLOT = 0x2fa150da4c9f4c3a28593398c65313dd42f63d0530ec6db4a2b46e6d837a3902;

    struct GasServiceStorage {
        mapping(string => GasInfo) gasPrices;
    }

    /**
     * @notice Returns the gas price for a specific chain.
     * @param chain The name of the chain
     * @return gasInfo The gas info for the chain
     */
    function getGasInfo(string calldata chain) external view returns (GasInfo memory) {
        return _gasServiceStorage().gasPrices[chain];
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
     * param params Additional parameters for the gas estimation
     * @return gasEstimate The cross-chain gas estimate, in terms of source chain's native gas token that should be forwarded to the gas service.
     */
    function estimateGasFee(
        string calldata destinationChain,
        string calldata, /* destinationAddress */
        bytes calldata payload,
        uint256 executionGasLimit,
        bytes calldata /* params */
    ) public view returns (uint256 gasEstimate) {
        GasServiceStorage storage slot = _gasServiceStorage();
        GasInfo storage gasInfo = slot.gasPrices[destinationChain];

        gasEstimate = gasInfo.axelarBaseFee + (executionGasLimit * gasInfo.relativeGasPrice);

        // if chain is L2, compute L1 data fee using L1 gas price info
        if (gasInfo.gasEstimationType != GasEstimationType.Default) {
            GasInfo storage l1GasInfo = slot.gasPrices['ethereum'];

            gasEstimate += computeL1DataFee(
                gasInfo.gasEstimationType,
                payload,
                l1GasInfo.relativeGasPrice,
                l1GasInfo.relativeBlobBaseFee
            );
        }
    }

    /**
     * @notice Computes the additional L1 data fee for an L2 destination chain.
     * @param gasEstimationType The gas estimation type
     * @param payload The payload of the contract call
     * @param relativeGasPrice The gas price on the source chain
     * @return l1DataFee The L1 to L2 data fee
     */
    function computeL1DataFee(
        GasEstimationType gasEstimationType,
        bytes calldata payload,
        uint256 relativeGasPrice,
        uint256 relativeBlobBaseFee
    ) internal pure returns (uint256) {
        if (gasEstimationType == GasEstimationType.OptimismEcotone) {
            return optimismEcotoneL1Fee(payload, relativeGasPrice, relativeBlobBaseFee);
        }

        revert UnsupportedEstimationType(gasEstimationType);
    }

    /**
     * @notice Computes the L1 to L2 fee for a contract call on the Optimism chain.
     * @param payload The payload of the contract call
     * @param relativeGasPrice The base fee for L1 to L2
     * @return l1DataFee The L1 to L2 data fee
     */
    function optimismEcotoneL1Fee(
        bytes calldata payload,
        uint256 relativeGasPrice,
        uint256 relativeBlobBaseFee
    ) internal pure returns (uint256 l1DataFee) {
        /* Optimism Ecotone gas model https://docs.optimism.io/stack/transactions/fees#ecotone
             tx_compressed_size = ((count_zero_bytes(tx_data) * 4 + count_non_zero_bytes(tx_data) * 16)) / 16
             weighted_gas_price = 16 * base_fee_scalar*base_fee + blob_base_fee_scalar * blob_base_fee
             l1_data_fee = tx_compressed_size * weighted_gas_price

           Reference implementation:
             https://github.com/ethereum-optimism/optimism/blob/876e16ad04968f0bb641eb76f98eb77e7e1a3e16/packages/contracts-bedrock/src/L2/GasPriceOracle.sol#L138
        */

        // The new base_fee_scalar is currently set to 0.001368
        // We are setting it to un upper bound of 0.0015 to account for possible fluctuations
        uint256 scalarPrecision = 10**6;
        uint256 baseFeeScalar = 1500; // 0.0015 multiplied by 10^6

        // The blob_base_fee_scalar is currently set to 0.810949. Setting it to 0.9 as an upper bound
        // https://eips.ethereum.org/EIPS/eip-4844
        uint256 blobBaseFeeScalar = 9 * 10**5; // 0.9 multiplied by scalarPrecision

        // Calculating transaction size in bytes that will later be divided by 16 to compress the size
        // 68 bytes for the TX RLP encoding overhead
        uint256 txSize = 68 * 16;
        // GMP executeWithToken call parameters
        // 4 bytes for method selector, 32 bytes for the commandId, 96 bytes for the sourceChain, 128 bytes for the sourceAddress, 96 bytes for token symbol, 32 bytes for amount
        // Expecting most of the calldata bytes to be zeroes. So multiplying by 8 as a weighted average of 4 and 16
        txSize += (4 + 32 + 96 + 128 + 96 + 32) * 8;

        for (uint256 i; i < payload.length; ++i) {
            if (payload[i] == 0) {
                txSize += 4; // 4 for each zero byte
            } else {
                txSize += 16; // 16 for each non-zero byte
            }
        }

        uint256 weightedGasPrice = 16 * baseFeeScalar * relativeGasPrice + blobBaseFeeScalar * relativeBlobBaseFee;

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
