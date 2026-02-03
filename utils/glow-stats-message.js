const TOTAL_SUPPLY = 180000000;

function formatGlowStatsMessage(payload, options = {}) {
  const { stats, failureLabels, missingFields } = payload || {};
  const { uppercase = false } = options;

  if (!stats) return null;

  const prices = [stats.uniswapPrice, stats.contractPrice].filter(
    (value) => typeof value === "number" && !Number.isNaN(value)
  );
  const lowerPrice = prices.length ? Math.min(...prices) : null;

  const formatNumber = (value, formatOptions) => {
    if (typeof value !== "number" || Number.isNaN(value)) {
      return "Unavailable";
    }
    return value.toLocaleString(undefined, formatOptions);
  };

  const formatUsd = (value, formatOptions) => {
    if (typeof value !== "number" || Number.isNaN(value)) {
      return "Unavailable";
    }
    return `$${value.toLocaleString(undefined, formatOptions)}`;
  };

  const formatPercent = (value) => {
    if (value === null || value === undefined) return "Unavailable";
    const parsed = Number(value);
    if (Number.isNaN(parsed)) return "Unavailable";
    return parsed.toFixed(2);
  };

  const totalGlwDelegatedFormatted =
    typeof stats.totalGlwDelegated === "number"
      ? stats.totalGlwDelegated.toLocaleString(undefined, {
          maximumFractionDigits: 2,
        })
      : "Unavailable";

  const delegatorApyFormatted = formatPercent(stats.averageDelegatorApy);
  const minerApyFormatted = formatPercent(stats.averageMinerApy);
  const withPercent = (value) =>
    value === "Unavailable" ? value : `${value}%`;

  const powerOutputValue =
    typeof stats.powerOutput === "number" ? Math.round(stats.powerOutput) : null;
  const carbonCreditsValue =
    typeof stats.carbonCredits === "number"
      ? Math.round(stats.carbonCredits)
      : null;

  const fdvValue =
    typeof lowerPrice === "number" ? lowerPrice * TOTAL_SUPPLY : null;

  let dataNote = null;
  if (
    (failureLabels && failureLabels.length) ||
    (missingFields && missingFields.length)
  ) {
    dataNote =
      failureLabels && failureLabels.length
        ? `Some data is temporarily unavailable (${failureLabels.join(", ")}).`
        : "Some data is temporarily unavailable.";
  }

  const lines = [
    "**Token stats:**",
    `Glow price: ${
      typeof lowerPrice === "number" ? `$${lowerPrice.toFixed(4)}` : "Unavailable"
    }`,
    `Uniswap Liquidity: ${formatUsd(stats.contractsData?.usdgLiquidityInPool, {
      maximumFractionDigits: 0,
    })}`,
    `Token holders: ${formatNumber(stats.tokenHolders)}`,
    `Total supply: ${formatNumber(stats.totalSupply)}`,
    `Circulating supply: ${formatNumber(stats.circulatingSupply)}`,
    `Market cap: ${formatUsd(stats.marketCap)}`,
    `FDV (over 6 years): ${formatUsd(fdvValue, {
      maximumFractionDigits: 0,
    })}`,
    `Number of Actively Delegated Tokens: ${totalGlwDelegatedFormatted}`,
    `Average Delegator APY: ${withPercent(delegatorApyFormatted)}`,
    `Average Miner APY: ${withPercent(minerApyFormatted)}`,
    "<https://www.defined.fi/eth/0x6fa09ffc45f1ddc95c1bc192956717042f142c5d?quoteToken=token1&cache=1dafc>",
    "",
    "**Farm stats:**",
    `Number of active farms: ${formatNumber(stats.numberOfFarms)}`,
    `Power output of Glow farms (current week): ${formatNumber(
      powerOutputValue
    )} kWh`,
    `Carbon credits created (total): ${formatNumber(carbonCreditsValue)}`,
    ...(dataNote ? ["", `**Note:** ${dataNote}`] : []),
  ];

  const processed = uppercase
    ? lines
        .map((line) => (/https?:\/\//i.test(line) ? line : line.toUpperCase()))
        .join("\n")
    : lines.join("\n");

  return processed;
}

module.exports = { formatGlowStatsMessage };
