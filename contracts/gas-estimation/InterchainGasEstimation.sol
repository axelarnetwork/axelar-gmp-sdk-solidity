// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import { GasEstimationType, GasInfo } from '../types/GasEstimationTypes.sol';
import { IInterchainGasEstimation } from '../interfaces/IInterchainGasEstimation.sol';

/**
 * @title InterchainGasEstimation
 * @notice This is an abstract contract that allows for estimating gas fees for cross-chain communication on the Axelar network.
 */
abstract contract InterchainGasEstimation is IInterchainGasEstimation {
    // keccak256('GasEstimate.Slot') - 1
    bytes32 internal constant GAS_SERVICE_SLOT = 0x2fa150da4c9f4c3a28593398c65313dd42f63d0530ec6db4a2b46e6d837a3902;

    // 68 bytes for the TX RLP encoding overhead
    uint256 internal constant TX_ENCODING_OVERHEAD = 68;
    // GMP executeWithToken call parameters
    // 4 bytes for method selector, 32 bytes for the commandId, 96 bytes for the sourceChain, 128 bytes for the sourceAddress, 96 bytes for token symbol, 32 bytes for amount
    // Expecting most of the calldata bytes to be zeroes. So multiplying by 8 as a weighted average of 4 and 16
    uint256 internal constant GMP_CALLDATA_SIZE = 4 + 32 + 96 + 128 + 96 + 32; // 388 bytes

    struct GasServiceStorage {
        mapping(string => GasInfo) gasPrices;
    }

    /**
     * @notice Returns the gas price for a specific chain.
     * @param chain The name of the chain
     * @return gasInfo The gas info for the chain
     */
    function getGasInfo(string calldata chain) external view returns (GasInfo memory) {
        return _storage().gasPrices[chain];
    }

    /**
     * @notice Sets the gas price for a specific chain.
     * @dev This function is called by the gas oracle to update the gas price for a specific chain.
     * @param chain The name of the chain
     * @param gasInfo The gas info for the chain
     */
    function _setGasInfo(string calldata chain, GasInfo calldata gasInfo) internal {
        emit GasInfoUpdated(chain, gasInfo);

        _storage().gasPrices[chain] = gasInfo;
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
        GasInfo storage gasInfo = _storage().gasPrices[destinationChain];
        GasEstimationType gasEstimationType = GasEstimationType(gasInfo.gasEstimationType);

        gasEstimate = gasInfo.axelarBaseFee + (executionGasLimit * gasInfo.relativeGasPrice);

        // if chain is L2, compute L1 data fee using L1 gas price info
        if (gasEstimationType != GasEstimationType.Default) {
            GasInfo storage l1GasInfo = _storage().gasPrices['ethereum'];

            gasEstimate += computeL1DataFee(gasEstimationType, payload, gasInfo, l1GasInfo);
        }
    }

    /**
     * @notice Computes the additional L1 data fee for an L2 destination chain.
     * @param gasEstimationType The gas estimation type
     * @param payload The payload of the contract call
     * @param l1GasInfo The L1 gas info
     * @return l1DataFee The L1 to L2 data fee
     */
    function computeL1DataFee(
        GasEstimationType gasEstimationType,
        bytes calldata payload,
        GasInfo storage gasInfo,
        GasInfo storage l1GasInfo
    ) internal view returns (uint256) {
        if (gasEstimationType == GasEstimationType.OptimismEcotone) {
            return optimismEcotoneL1Fee(payload, gasInfo, l1GasInfo);
        }
        if (gasEstimationType == GasEstimationType.OptimismBedrock) {
            return optimismBedrockL1Fee(payload, gasInfo, l1GasInfo);
        }
        if (gasEstimationType == GasEstimationType.Arbitrum) {
            return arbitrumL1Fee(payload, gasInfo, l1GasInfo);
        }
        if (gasEstimationType == GasEstimationType.Scroll) {
            return scrollL1Fee(payload, gasInfo, l1GasInfo);
        }

        revert UnsupportedEstimationType(gasEstimationType);
    }

    /**
     * @notice Computes the L1 to L2 fee for an OP chain with Ecotone gas model.
     * @param payload The payload of the contract call
     * @param gasInfo Destination chain gas info
     * @param l1GasInfo The L1 gas info
     * @return l1DataFee The L1 to L2 data fee
     */
    function optimismEcotoneL1Fee(
        bytes calldata payload,
        GasInfo storage gasInfo,
        GasInfo storage l1GasInfo
    ) internal view returns (uint256 l1DataFee) {
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

        // The blob_base_fee_scalar is currently set to 0.810949. Setting it to 0.9 as an upper bound
        // https://eips.ethereum.org/EIPS/eip-4844
        uint256 blobBaseFeeScalar = 9 * 10**5; // 0.9 multiplied by scalarPrecision

        // Calculating transaction size in bytes that will later be divided by 16 to compress the size
        uint256 txSize = _l1TxSize(payload);

        uint256 weightedGasPrice = 16 *
            gasInfo.l1FeeScalar *
            l1GasInfo.relativeGasPrice +
            blobBaseFeeScalar *
            l1GasInfo.relativeBlobBaseFee;

        l1DataFee = (weightedGasPrice * txSize) / (16 * scalarPrecision); // 16 for txSize compression and scalar precision conversion
    }

    /**
     * @notice Computes the L1 to L2 fee for an OP chain with Bedrock gas model.
     * @param payload The payload of the contract call
     * @param gasInfo Destination chain gas info
     * @param l1GasInfo The L1 gas info
     * @return l1DataFee The L1 to L2 data fee
     */
    function optimismBedrockL1Fee(
        bytes calldata payload,
        GasInfo storage gasInfo,
        GasInfo storage l1GasInfo
    ) internal view returns (uint256 l1DataFee) {
        // Resembling OP Bedrock gas price model
        // https://docs.optimism.io/stack/transactions/fees#bedrock
        // https://docs-v2.mantle.xyz/devs/concepts/tx-fee/ef
        // Reference https://github.com/mantlenetworkio/mantle-v2/blob/a29f01045191344b0ba89542215e6a02bd5e7fcc/packages/contracts-bedrock/contracts/L2/GasPriceOracle.sol#L98-L105
        uint256 overhead = 188;
        uint256 precision = 1e6;

        uint256 txSize = _l1TxSize(payload) + overhead;

        return (l1GasInfo.relativeGasPrice * txSize * gasInfo.l1FeeScalar) / precision;
    }

    /**
     * @notice Computes the L1 to L2 fee for a contract call on the Arbitrum chain.
     * @param payload The payload of the contract call
     * param gasInfo Destination chain gas info
     * @param l1GasInfo The L1 gas info
     * @return l1DataFee The L1 to L2 data fee
     */
    function arbitrumL1Fee(
        bytes calldata payload,
        GasInfo storage, /* gasInfo */
        GasInfo storage l1GasInfo
    ) internal view returns (uint256 l1DataFee) {
        // https://docs.arbitrum.io/build-decentralized-apps/how-to-estimate-gas
        // https://docs.arbitrum.io/arbos/l1-pricing
        // Reference https://github.com/OffchainLabs/nitro/blob/master/arbos/l1pricing/l1pricing.go#L565-L578
        uint256 oneInBips = 10000;
        uint256 txDataNonZeroGasEIP2028 = 16;
        uint256 estimationPaddingUnits = 16 * txDataNonZeroGasEIP2028;
        uint256 estimationPaddingBasisPoints = 100;

        uint256 l1Bytes = TX_ENCODING_OVERHEAD + GMP_CALLDATA_SIZE + payload.length;
        // Brotli baseline compression rate as 2x
        uint256 units = (txDataNonZeroGasEIP2028 * l1Bytes) / 2;

        return
            (l1GasInfo.relativeGasPrice *
                (units + estimationPaddingUnits) *
                (oneInBips + estimationPaddingBasisPoints)) / oneInBips;
    }

    /**
     * @notice Computes the L1 to L2 fee for a contract call on the Scroll chain.
     * @param payload The payload of the contract call
     * @param gasInfo Destination chain gas info
     * @param l1GasInfo The L1 gas info
     * @return l1DataFee The L1 to L2 data fee
     */
    function scrollL1Fee(
        bytes calldata payload,
        GasInfo storage gasInfo,
        GasInfo storage l1GasInfo
    ) internal view returns (uint256 l1DataFee) {
        // https://docs.scroll.io/en/developers/guides/estimating-gas-and-tx-fees/
        // Reference https://github.com/scroll-tech/scroll/blob/af2913903b181f3492af1c62b4da4c1c99cc552d/contracts/src/L2/predeploys/L1GasPriceOracle.sol#L63-L86
        uint256 overhead = 2500;
        uint256 precision = 1e9;

        uint256 txSize = _l1TxSize(payload) + overhead + (4 * 16);

        return (l1GasInfo.relativeGasPrice * txSize * gasInfo.l1FeeScalar) / precision;
    }

    /**
     * @notice Computes the transaction size for an L1 transaction
     * @param payload The payload of the contract call
     * @return txSize The transaction size
     */
    function _l1TxSize(bytes calldata payload) private pure returns (uint256 txSize) {
        txSize = TX_ENCODING_OVERHEAD * 16;
        // GMP executeWithToken call parameters
        // Expecting most of the calldata bytes to be zeroes. So multiplying by 8 as a weighted average of 4 and 16
        txSize += GMP_CALLDATA_SIZE * 8;

        uint256 length = payload.length;
        for (uint256 i; i < length; ++i) {
            if (payload[i] == 0) {
                txSize += 4; // 4 for each zero byte
            } else {
                txSize += 16; // 16 for each non-zero byte
            }
        }
    }

    /**
     * @notice Get the storage slot for the GasServiceStorage struct
     */
    function _storage() private pure returns (GasServiceStorage storage slot) {
        assembly {
            slot.slot := GAS_SERVICE_SLOT
        }
    }
}
