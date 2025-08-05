// utils/contracts-data-helper.js
// Utility functions to fetch on-chain contract metrics using viem

const { createPublicClient, http, formatUnits } = require("viem");
const { mainnet } = require("viem/chains");

if (!process.env.MAINNET_RPC_URL) {
  throw new Error("MAINNET_RPC_URL is not set");
}

// --- Constants -------------------------------------------------------------
// USDC token contract (Ethereum mainnet)
const USDC_ADDRESS = "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48";
const GLW_USDG_POOL_ADDRESS = "0x6fa09ffc45f1ddc95c1bc192956717042f142c5d";

// Glow USDG redemption contract.
const USDG_REDEMPTION_ADDRESS = "0x1c2cA537757e1823400F857EdBe72B55bbAe0F08";

// Minimal ERC-20 ABI for balanceOf
const erc20Abi = [
  {
    type: "function",
    name: "balanceOf",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
];

// Uniswap V2 Pair ABI for getReserves
const uniswapV2PairAbi = [
  {
    type: "function",
    name: "getReserves",
    stateMutability: "view",
    inputs: [],
    outputs: [
      { name: "_reserve0", type: "uint112" },
      { name: "_reserve1", type: "uint112" },
      { name: "_blockTimestampLast", type: "uint32" },
    ],
  },
];

// ---------------------------------------------------------------------------

function getPublicClient() {
  const rpcUrl = process.env.MAINNET_RPC_URL;
  const chain = mainnet;

  return createPublicClient({ chain, transport: http(rpcUrl) });
}

/**
 * Returns the USDC balance held in the USDG Redemption contract.
 *
 * @returns {Promise<number|null>} Formatted balance (6 decimals) or null on error
 */
async function getUSDCBalanceOfRedemptionContract() {
  try {
    const publicClient = getPublicClient();

    const balance = await publicClient.readContract({
      address: USDC_ADDRESS,
      abi: erc20Abi,
      functionName: "balanceOf",
      args: [USDG_REDEMPTION_ADDRESS],
    });

    // USDC has 6 decimals
    return Number(formatUnits(balance, 6));
  } catch (error) {
    console.error("Error fetching USDC balance:", error);
    return null;
  }
}

/**
 * Returns the USDG liquidity available in the GLW/USDG pool.
 * Gets reserve0 from the Uniswap V2 pair contract.
 *
 * @returns {Promise<number|null>} Formatted USDG reserve (18 decimals) or null on error
 */
async function getUSDGLiquidityInPool() {
  try {
    const publicClient = getPublicClient();

    const reserves = await publicClient.readContract({
      address: GLW_USDG_POOL_ADDRESS,
      abi: uniswapV2PairAbi,
      functionName: "getReserves",
    });

    // reserves[0] is _reserve0 (USDG), reserves[1] is _reserve1 (GLW)
    // USDG has 6 decimals
    return Number(formatUnits(reserves[0], 6));
  } catch (error) {
    console.error("Error fetching USDG liquidity:", error);
    return null;
  }
}

/**
 * Fetches all required on-chain values in one go.
 * Extend this function as new requirements arise.
 */
async function fetchContractsData() {
  const [usdcInRedemption, usdgLiquidityInPool] = await Promise.all([
    getUSDCBalanceOfRedemptionContract(),
    getUSDGLiquidityInPool(),
  ]);

  return {
    usdcInRedemption,
    usdgLiquidityInPool,
  };
}

module.exports = {
  getUSDCBalanceOfRedemptionContract,
  getUSDGLiquidityInPool,
  fetchContractsData,
};
