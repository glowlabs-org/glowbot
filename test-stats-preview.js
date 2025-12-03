require("dotenv").config();
const axios = require("axios");
const { getTotalCarbonCredits } = require("./utils/carbon-credits-helper");
const { getGlowHolderCount } = require("./utils/ponder-helper");
const { getNumberOfFarms } = require("./utils/get-farm-data-helper");
const { fetchContractsData } = require("./utils/contracts-data-helper");

async function fetchGlowStats() {
  const baseUrl = "https://glowstats-api-production.up.railway.app/";
  const createUrl = (endpoint) => baseUrl + endpoint;
  const fractionsBaseUrl =
    process.env.FRACTIONS_ROUTER_URL ||
    "https://gca-crm-backend-production-1f2a.up.railway.app/";
  const createFractionsUrl = (endpoint) => fractionsBaseUrl + endpoint;
  const glowGreenApiUrl =
    "https://glow-green-api.simonnfts.workers.dev/headline-stats";

  try {
    const [
      glowGreenResponse,
      allDataResponse,
      farmCountResponse,
      tokenHoldersResponse,
      contractsData,
      fractionsSummaryResponse,
      fractionsApyResponse,
    ] = await Promise.all([
      axios.get(glowGreenApiUrl),
      axios.get(createUrl("allData")),
      getNumberOfFarms(),
      getGlowHolderCount(),
      fetchContractsData(),
      axios.get(createFractionsUrl("fractions/summary")).catch(() => null),
      axios.get(createFractionsUrl("fractions/average-apy")).catch(() => null),
    ]);

    const glowGreenStats = glowGreenResponse?.data || {};
    const allData = allDataResponse?.data?.farmsWeeklyMetrics || [];
    const farmCount = farmCountResponse || 0;
    const tokenHolders = tokenHoldersResponse || 0;
    const fractionsSummary = fractionsSummaryResponse?.data || {};
    const fractionsApy = fractionsApyResponse?.data || {};

    const hasPrice =
      glowGreenStats.uniswapPrice !== undefined ||
      glowGreenStats.earlyLiquidityPrice !== undefined;
    if (!hasPrice || !allData.length) {
      throw new Error("Missing required data from API response");
    }

    const totalGlwDelegated = fractionsSummary.totalGlwDelegated || "0";
    const averageDelegatorApy = fractionsApy.averageDelegatorApy || "0";
    const averageMinerApy = fractionsApy.averageMinerApyPercent || "0";

    return {
      uniswapPrice: glowGreenStats.uniswapPrice || 0,
      contractPrice: glowGreenStats.earlyLiquidityPrice || 0,
      tokenHolders,
      totalSupply: Math.round(glowGreenStats.totalSupply || 0),
      circulatingSupply: Math.round(glowGreenStats.circulatingSupply || 0),
      marketCap: Math.round(glowGreenStats.marketCap || 0),
      numberOfFarms: farmCount,
      powerOutput: allData[0]?.powerOutput || 0,
      carbonCredits: getTotalCarbonCredits(allData) || 0,
      contractsData,
      totalGlwDelegated,
      averageDelegatorApy,
      averageMinerApy,
    };
  } catch (error) {
    console.error("Error fetching glow stats:", error.message);
    return null;
  }
}

function previewStats(uppercase = false) {
  const TOTAL_SUPPLY = 180000000;

  return fetchGlowStats().then((stats) => {
    if (stats) {
      const lowerPrice = Math.min(stats.uniswapPrice, stats.contractPrice);

      const totalGlwDelegatedFormatted = stats.totalGlwDelegated
        ? (parseFloat(stats.totalGlwDelegated) / 1e18).toLocaleString(
            undefined,
            {
              maximumFractionDigits: 2,
            }
          )
        : "N/A";

      const delegatorApyFormatted = stats.averageDelegatorApy
        ? parseFloat(stats.averageDelegatorApy).toFixed(2)
        : "N/A";

      const minerApyFormatted = stats.averageMinerApy
        ? parseFloat(stats.averageMinerApy).toFixed(2)
        : "N/A";

      const lines = [
        "**Token stats:**",
        `Glow price: $${lowerPrice.toFixed(4)}`,
        `Uniswap Liquidity: $${
          stats.contractsData?.usdgLiquidityInPool?.toLocaleString(undefined, {
            maximumFractionDigits: 0,
          }) || "N/A"
        }`,
        `Token holders: ${stats.tokenHolders.toLocaleString()}`,
        `Total supply: ${stats.totalSupply.toLocaleString()}`,
        `Circulating supply: ${stats.circulatingSupply.toLocaleString()}`,
        `Market cap: $${stats.marketCap.toLocaleString()}`,
        `FDV (over 6 years): $${(lowerPrice * TOTAL_SUPPLY).toLocaleString(
          undefined,
          {
            maximumFractionDigits: 0,
          }
        )}`,
        `Number of Delegated Tokens: ${totalGlwDelegatedFormatted}`,
        `Average Delegator APY: ${delegatorApyFormatted}%`,
        `Average Miner APY: ${minerApyFormatted}%`,
        `<https://www.defined.fi/eth/0x6fa09ffc45f1ddc95c1bc192956717042f142c5d?quoteToken=token1&cache=1dafc>`,
        "",
        "**Farm stats:**",
        `Number of active farms: ${stats.numberOfFarms}`,
        `Power output of Glow farms (current week): ${Math.round(
          stats.powerOutput
        ).toLocaleString()} kWh`,
        `Carbon credits created (total): ${Math.round(
          stats.carbonCredits
        ).toLocaleString()}`,
      ];

      const processed = uppercase
        ? lines
            .map((line) =>
              /https?:\/\//i.test(line) ? line : line.toUpperCase()
            )
            .join("\n")
        : lines.join("\n");

      return processed;
    } else {
      return "Sorry, I could not fetch the stats.";
    }
  });
}

async function runPreview() {
  console.log("🚀 Previewing !stats output for Discord...\n");
  console.log("=".repeat(60));
  console.log();
  console.log(await previewStats(false));
  console.log();
  console.log("=".repeat(60));
  console.log();
  console.log("🚀 Previewing !STATS (uppercase) output...\n");
  console.log("=".repeat(60));
  console.log();
  console.log(await previewStats(true));
  console.log();
  console.log("=".repeat(60));
}

if (require.main === module) {
  runPreview().catch((error) => {
    console.error("❌ Error:", error.message);
    console.error(error.stack);
  });
}

module.exports = { previewStats };
