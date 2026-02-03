const axios = require("axios");
const logger = require("./log-util");
const { createPublicClient, http, formatUnits } = require("viem");
const { mainnet } = require("viem/chains");
const { getTotalCarbonCredits } = require("./carbon-credits-helper");
const { getGlowHolderCount } = require("./ponder-helper");
const { getNumberOfFarms } = require("./get-farm-data-helper");
const { fetchContractsData } = require("./contracts-data-helper");

const GENESIS_TIMESTAMP = 1700352000;
const SECONDS_PER_WEEK = 7 * 86_400;
const GLW_DECIMALS = 18;
const USDG_DECIMALS = 6;

const GLW_ADDRESS = "0xf4fbC617A5733EAAF9af08E1Ab816B103388d8B6";
const USDG_ADDRESS = "0xe010ec500720bE9EF3F82129E7eD2Ee1FB7955F2";
const GLW_USDG_POOL_ADDRESS = "0x6fa09ffc45f1ddc95c1bc192956717042f142c5d";
const EARLY_LIQUIDITY_ADDRESS = "0xD5aBe236d2F2F5D10231c054e078788Ea3447DFc";
const ENDOWMENT_WALLET = "0x868D99B4a6e81b4683D10ea5665f13579A9d1607";

const CARBON_CREDIT_AUCTION = "0x85fbB04DEBBDEa052a6422E74bFeA57B17e50A80";
const GRANTS_TREASURY = "0x0116DA066517F010E59b32274BF18083aF34e108";
const VETO_COUNCIL = "0xA3A32d3c9a5A593bc35D69BACbe2dF5Ea2C3cF5C";
const GCA_AND_MINER_POOL = "0x6Fa8C7a89b22bf3212392b778905B12f3dBAF5C4";

const INFLATION_TO_MINER_PER_WEEK = 175_000;

const erc20Abi = [
  {
    type: "function",
    name: "balanceOf",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "totalSupply",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
];

const uniswapV2PairAbi = [
  {
    type: "function",
    name: "token0",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "address" }],
  },
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

const earlyLiquidityAbi = [
  {
    type: "function",
    name: "getCurrentPrice",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
];

function getPublicClient() {
  const rpcUrl = process.env.MAINNET_RPC_URL;
  if (!rpcUrl) return null;
  return createPublicClient({ chain: mainnet, transport: http(rpcUrl) });
}

function getCurrentWeekNumber(referenceDate = Date.now()) {
  const genesisMs = GENESIS_TIMESTAMP * 1000;
  const diffMs = Math.max(0, referenceDate - genesisMs);
  const msPerWeek = SECONDS_PER_WEEK * 1000;
  return Math.floor(diffMs / msPerWeek);
}

async function fetchOnchainPriceData() {
  const publicClient = getPublicClient();
  if (!publicClient) throw new Error("MAINNET_RPC_URL is not set");

  const [token0, [reserve0, reserve1]] = await publicClient.multicall({
    contracts: [
      {
        address: GLW_USDG_POOL_ADDRESS,
        abi: uniswapV2PairAbi,
        functionName: "token0",
      },
      {
        address: GLW_USDG_POOL_ADDRESS,
        abi: uniswapV2PairAbi,
        functionName: "getReserves",
      },
    ],
    allowFailure: false,
  });

  const isToken0USDG = token0.toLowerCase() === USDG_ADDRESS.toLowerCase();
  const usdgReserve = isToken0USDG ? reserve0 : reserve1;
  const glwReserve = isToken0USDG ? reserve1 : reserve0;

  const usdg = Number(formatUnits(usdgReserve, USDG_DECIMALS));
  const glw = Number(formatUnits(glwReserve, GLW_DECIMALS));
  const uniswapPrice = glw > 0 ? usdg / glw : 0;

  let earlyLiquidityPrice = 0;
  try {
    const rawPrice = await publicClient.readContract({
      address: EARLY_LIQUIDITY_ADDRESS,
      abi: earlyLiquidityAbi,
      functionName: "getCurrentPrice",
    });
    earlyLiquidityPrice =
      Number(formatUnits(rawPrice, USDG_DECIMALS)) * 100;
  } catch (error) {
    logger.logMessage(
      logger.appendErrorToMessage(
        "Error fetching early liquidity price: ",
        error
      ),
      true
    );
  }

  const candidatePrices = [uniswapPrice, earlyLiquidityPrice].filter(
    (value) => Number.isFinite(value) && value > 0
  );
  const spotPrice =
    candidatePrices.length > 0 ? Math.min(...candidatePrices) : 0;

  return {
    uniswapPrice: Number.isFinite(uniswapPrice) ? uniswapPrice : 0,
    earlyLiquidityPrice:
      Number.isFinite(earlyLiquidityPrice) && earlyLiquidityPrice > 0
        ? earlyLiquidityPrice
        : 0,
    spotPrice,
  };
}

async function fetchTotalActivelyDelegatedWei(fractionsBaseUrl) {
  if (!fractionsBaseUrl) return null;
  const url = new URL("fractions/total-actively-delegated", fractionsBaseUrl);
  const response = await axios.get(url.toString());
  const wei = response?.data?.totalGlwDelegatedWei;
  if (!wei) return null;
  return BigInt(wei);
}

async function fetchTotalMinerClaimedWei() {
  const base =
    process.env.PONDER_API_BASE ||
    "https://glow-ponder-listener-2-production.up.railway.app/";
  const url = new URL("/rewards/total-glow-payouts", base);
  const response = await axios.get(url.toString());
  const payload = response?.data ?? {};
  if (!payload.indexingComplete) {
    throw new Error(payload.error ?? "Ponder is still indexing");
  }
  return BigInt(payload.totalGlowPayouts ?? "0");
}

async function fetchOnchainSupplyBalances() {
  const publicClient = getPublicClient();
  if (!publicClient) throw new Error("MAINNET_RPC_URL is not set");

  const calls = [
    {
      address: GLW_ADDRESS,
      abi: erc20Abi,
      functionName: "totalSupply",
    },
    {
      address: GLW_ADDRESS,
      abi: erc20Abi,
      functionName: "balanceOf",
      args: [CARBON_CREDIT_AUCTION],
    },
    {
      address: GLW_ADDRESS,
      abi: erc20Abi,
      functionName: "balanceOf",
      args: [GRANTS_TREASURY],
    },
    {
      address: GLW_ADDRESS,
      abi: erc20Abi,
      functionName: "balanceOf",
      args: [VETO_COUNCIL],
    },
    {
      address: GLW_ADDRESS,
      abi: erc20Abi,
      functionName: "balanceOf",
      args: [GCA_AND_MINER_POOL],
    },
    {
      address: GLW_ADDRESS,
      abi: erc20Abi,
      functionName: "balanceOf",
      args: [GLW_ADDRESS],
    },
    {
      address: GLW_ADDRESS,
      abi: erc20Abi,
      functionName: "balanceOf",
      args: [EARLY_LIQUIDITY_ADDRESS],
    },
    {
      address: GLW_ADDRESS,
      abi: erc20Abi,
      functionName: "balanceOf",
      args: [ENDOWMENT_WALLET],
    },
  ];

  const results = await publicClient.multicall({
    contracts: calls,
    allowFailure: false,
  });

  const [
    totalSupply,
    carbonCreditAuctionBalance,
    grantsContractBalance,
    vetoCouncilContractBalance,
    minerPoolAndGcaContractBalance,
    glowStakedOrLockedBalance,
    earlyLiquidityBalance,
    endowmentBalance,
  ] = results;

  return {
    totalSupply,
    carbonCreditAuctionBalance,
    grantsContractBalance,
    vetoCouncilContractBalance,
    minerPoolAndGcaContractBalance,
    glowStakedOrLockedBalance,
    earlyLiquidityBalance,
    endowmentBalance,
  };
}

async function fetchGlowStats() {
  const baseUrl = "https://glowstats-api-production.up.railway.app/";
  const createUrl = (endpoint) => baseUrl + endpoint;
  const fractionsBaseUrl =
    process.env.FRACTIONS_ROUTER_URL ||
    "https://gca-crm-backend-production-1f2a.up.railway.app/";
  const createFractionsUrl = (endpoint) => fractionsBaseUrl + endpoint;
  const sources = {
    onchainPrice: { label: "onchain price" },
    onchainSupply: { label: "onchain supply" },
    vaultBalance: { label: "actively delegated", required: false },
    minerPayouts: { label: "miner payouts", required: false },
    allData: { label: "glowstats allData" },
    farmCount: { label: "farm count", required: false },
    tokenHolders: { label: "token holders", required: false },
    contractsData: { label: "contracts data", required: false },
    fractionsApy: { label: "fractions APY", required: false },
  };

  const classifyAxiosError = (error) => {
    const status = error?.response?.status;
    const code = error?.code;
    const message = error?.message || "Unknown error";
    const isTimeout =
      code === "ECONNABORTED" ||
      /timeout/i.test(message) ||
      error?.message?.toLowerCase().includes("timed out");
    let kind = "unknown";
    if (isTimeout) kind = "timeout";
    else if (status === 429) kind = "rate_limit";
    else if (status >= 500) kind = "upstream_5xx";
    else if (status >= 400) kind = "upstream_4xx";
    else if (code) kind = "network";
    return { status, code, kind, message };
  };

  const formatFailureForLog = (failure) => {
    const details = [];
    if (failure.status) details.push(`HTTP ${failure.status}`);
    if (failure.code) details.push(failure.code);
    const detailSuffix = details.length ? ` (${details.join(", ")})` : "";
    return `Stats source "${failure.label}" failed: ${failure.kind}${detailSuffix}.`;
  };

  const logFailure = (failure) => {
    if (failure.error) {
      const msg = logger.appendErrorToMessage(
        `${formatFailureForLog(failure)} `,
        failure.error
      );
      logger.logMessage(msg, true);
      return;
    }
    logger.logMessage(formatFailureForLog(failure), true);
  };

  const failures = [];
  const recordFailure = (key, error) => {
    const meta = sources[key];
    const { status, code, kind, message } = classifyAxiosError(error);
    failures.push({
      key,
      label: meta.label,
      required: meta.required,
      status,
      code,
      kind,
      message,
      error,
    });
  };

  const results = await Promise.allSettled([
    fetchOnchainPriceData(),
    fetchOnchainSupplyBalances(),
    fetchTotalActivelyDelegatedWei(fractionsBaseUrl),
    fetchTotalMinerClaimedWei(),
    axios.get(createUrl("allData")),
    getNumberOfFarms(),
    getGlowHolderCount(),
    fetchContractsData(),
    axios.get(createFractionsUrl("fractions/average-apy")),
  ]);

  const onchainPriceResult = results[0];
  const onchainSupplyResult = results[1];
  const vaultBalanceResult = results[2];
  const minerClaimedResult = results[3];
  const allDataResult = results[4];
  const farmCountResult = results[5];
  const tokenHoldersResult = results[6];
  const contractsDataResult = results[7];
  const fractionsApyResult = results[8];

  if (onchainPriceResult.status !== "fulfilled") {
    recordFailure("onchainPrice", onchainPriceResult.reason);
  }
  if (onchainSupplyResult.status !== "fulfilled") {
    recordFailure("onchainSupply", onchainSupplyResult.reason);
  }
  if (vaultBalanceResult.status !== "fulfilled") {
    recordFailure("vaultBalance", vaultBalanceResult.reason);
  }
  if (minerClaimedResult.status !== "fulfilled") {
    recordFailure("minerPayouts", minerClaimedResult.reason);
  }
  if (allDataResult.status !== "fulfilled") {
    recordFailure("allData", allDataResult.reason);
  }
  if (farmCountResult.status !== "fulfilled") {
    recordFailure("farmCount", farmCountResult.reason);
  }
  if (tokenHoldersResult.status !== "fulfilled") {
    recordFailure("tokenHolders", tokenHoldersResult.reason);
  }
  if (contractsDataResult.status !== "fulfilled") {
    recordFailure("contractsData", contractsDataResult.reason);
  }
  if (fractionsApyResult.status !== "fulfilled") {
    recordFailure("fractionsApy", fractionsApyResult.reason);
  }

  failures.forEach((failure) => logFailure(failure));

  const onchainPrice =
    onchainPriceResult.status === "fulfilled"
      ? onchainPriceResult.value || null
      : null;
  const onchainSupply =
    onchainSupplyResult.status === "fulfilled"
      ? onchainSupplyResult.value || null
      : null;
  const vaultBalanceWei =
    vaultBalanceResult.status === "fulfilled"
      ? vaultBalanceResult.value ?? null
      : null;
  const minerClaimedWei =
    minerClaimedResult.status === "fulfilled"
      ? minerClaimedResult.value ?? null
      : null;
  const allData =
    allDataResult.status === "fulfilled"
      ? allDataResult.value?.data?.farmsWeeklyMetrics || []
      : null;
  const farmCount =
    farmCountResult.status === "fulfilled" ? farmCountResult.value || 0 : null;
  const tokenHolders =
    tokenHoldersResult.status === "fulfilled"
      ? tokenHoldersResult.value || 0
      : null;
  const contractsData =
    contractsDataResult.status === "fulfilled"
      ? contractsDataResult.value || null
      : null;
  const fractionsApy =
    fractionsApyResult.status === "fulfilled"
      ? fractionsApyResult.value?.data || {}
      : null;

  const missingFields = [];
  const candidatePrices = [
    onchainPrice?.uniswapPrice,
    onchainPrice?.earlyLiquidityPrice,
  ].filter((value) => Number.isFinite(value) && value > 0);
  const glowPrice =
    candidatePrices.length > 0 ? Math.min(...candidatePrices) : null;

  if (!candidatePrices.length) missingFields.push("price");
  if (!onchainSupply) missingFields.push("supply");
  if (!allData || !allData.length) missingFields.push("weekly metrics");

  if (missingFields.length) {
    logger.logMessage(
      `Glow stats incomplete: missing ${missingFields.join(", ")}.`,
      true
    );
  }

  const totalGlwDelegated =
    vaultBalanceWei !== null && vaultBalanceWei !== undefined
      ? Number(formatUnits(vaultBalanceWei, GLW_DECIMALS))
      : null;
  const averageDelegatorApy = fractionsApy
    ? fractionsApy.averageDelegatorApy || "0"
    : null;
  const averageMinerApy = fractionsApy
    ? fractionsApy.averageMinerApyPercent || "0"
    : null;

  let totalSupply = null;
  let circulatingSupply = null;
  let marketCap = null;

  if (onchainSupply) {
    const currentWeek = getCurrentWeekNumber();
    const totalAllocatedToMiners =
      BigInt(currentWeek * INFLATION_TO_MINER_PER_WEEK) * 1_000_000_000_000_000_000n;
    let yetToBeClaimedFromMiners =
      totalAllocatedToMiners - (minerClaimedWei ?? 0n);
    if (yetToBeClaimedFromMiners < 0n) yetToBeClaimedFromMiners = 0n;

    let circulatingSupplyWei =
      onchainSupply.totalSupply -
      onchainSupply.carbonCreditAuctionBalance -
      onchainSupply.grantsContractBalance -
      onchainSupply.vetoCouncilContractBalance -
      onchainSupply.minerPoolAndGcaContractBalance +
      yetToBeClaimedFromMiners -
      onchainSupply.glowStakedOrLockedBalance -
      onchainSupply.earlyLiquidityBalance -
      (vaultBalanceWei ?? 0n) -
      onchainSupply.endowmentBalance;
    if (circulatingSupplyWei < 0n) circulatingSupplyWei = 0n;

    totalSupply = Number(formatUnits(onchainSupply.totalSupply, GLW_DECIMALS));
    circulatingSupply = Number(
      formatUnits(circulatingSupplyWei, GLW_DECIMALS)
    );
    if (Number.isFinite(glowPrice ?? NaN) && glowPrice !== null) {
      marketCap = circulatingSupply * glowPrice;
    }
  }

  const failureLabels = Array.from(
    new Set(failures.map((failure) => failure.label))
  );

  return {
    stats: {
      uniswapPrice: onchainPrice?.uniswapPrice ?? null,
      contractPrice: onchainPrice?.earlyLiquidityPrice ?? null,
      tokenHolders,
      totalSupply:
        typeof totalSupply === "number" ? Math.round(totalSupply) : null,
      circulatingSupply:
        typeof circulatingSupply === "number"
          ? Math.round(circulatingSupply)
          : null,
      marketCap: typeof marketCap === "number" ? Math.round(marketCap) : null,
      numberOfFarms: farmCount,
      powerOutput: allData ? allData[0]?.powerOutput || 0 : null,
      carbonCredits: allData ? getTotalCarbonCredits(allData) || 0 : null,
      contractsData,
      totalGlwDelegated,
      averageDelegatorApy,
      averageMinerApy,
    },
    failureLabels,
    missingFields,
    userMessage: null,
  };
}

module.exports = { fetchGlowStats };
