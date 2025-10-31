require("dotenv").config();
const axios = require("axios");

const fractionsBaseUrl =
  process.env.FRACTIONS_ROUTER_URL ||
  "https://gca-crm-backend-production-1f2a.up.railway.app/";
const createFractionsUrl = (endpoint) => fractionsBaseUrl + endpoint;

async function testFractionsSummary() {
  console.log("🧪 Testing /fractions/summary endpoint...\n");

  try {
    console.log("📡 Fetching fractions summary...");
    const response = await axios.get(createFractionsUrl("fractions/summary"));

    if (response.data) {
      const data = response.data;
      console.log("✅ Successfully fetched fractions summary:");
      console.log(`   Total GLW Delegated: ${data.totalGlwDelegated || "N/A"}`);
      console.log(
        `   Total GLW Delegated (formatted): ${data.totalGlwDelegated ? (parseFloat(data.totalGlwDelegated) / 1e18).toLocaleString(undefined, { maximumFractionDigits: 2 }) : "N/A"}`
      );
      console.log(
        `   Total Mining Center Volume: ${data.totalMiningCenterVolume || "N/A"}`
      );
      console.log(
        `   Launchpad Contributors: ${data.launchpadContributors || "N/A"}`
      );
      console.log(
        `   Mining Center Contributors: ${data.miningCenterContributors || "N/A"}`
      );
      console.log();
    } else {
      console.log("❌ No data returned from API\n");
    }
  } catch (error) {
    console.error("❌ Test failed:", error.message);
    if (error.response) {
      console.error(`   Status: ${error.response.status}`);
      console.error(`   Data: ${JSON.stringify(error.response.data)}`);
    }
    console.error(error.stack);
    console.log();
  }
}

async function testFractionsAverageApy() {
  console.log("🧪 Testing /fractions/average-apy endpoint...\n");

  try {
    console.log("📡 Fetching average APY data...");
    const response = await axios.get(
      createFractionsUrl("fractions/average-apy")
    );

    if (response.data) {
      const data = response.data;
      console.log("✅ Successfully fetched average APY:");
      console.log(`   Start Week: ${data.startWeek || "N/A"}`);
      console.log(`   End Week: ${data.endWeek || "N/A"}`);
      console.log(
        `   Total GLW Delegated: ${data.totals?.totalGlwDelegated || "N/A"}`
      );
      console.log(
        `   Total USDC Spent by Miners: ${data.totals?.totalUsdcSpentByMiners || "N/A"}`
      );
      console.log(
        `   Average Delegator APY: ${data.averageDelegatorApy || "N/A"}%`
      );
      console.log(
        `   Average Miner APY: ${data.averageMinerApyPercent || "N/A"}%`
      );
      if (data.debug) {
        console.log(`   Debug - Data Source: ${data.debug.dataSource || "N/A"}`);
        console.log(
          `   Debug - Wallets Processed: ${data.debug.walletsProcessed || "N/A"}`
        );
        console.log(
          `   Debug - Total Wallets: ${data.debug.totalWallets || "N/A"}`
        );
      }
      console.log();
    } else {
      console.log("❌ No data returned from API\n");
    }
  } catch (error) {
    console.error("❌ Test failed:", error.message);
    if (error.response) {
      console.error(`   Status: ${error.response.status}`);
      console.error(`   Data: ${JSON.stringify(error.response.data)}`);
    }
    console.error(error.stack);
    console.log();
  }
}

async function testFetchGlowStatsIntegration() {
  console.log("🧪 Testing fetchGlowStats integration with fractions data...\n");

  try {
    const [
      fractionsSummaryResponse,
      fractionsApyResponse,
    ] = await Promise.all([
      axios.get(createFractionsUrl("fractions/summary")).catch(() => null),
      axios
        .get(createFractionsUrl("fractions/average-apy"))
        .catch(() => null),
    ]);

    const fractionsSummary = fractionsSummaryResponse?.data || {};
    const fractionsApy = fractionsApyResponse?.data || {};

    const totalGlwDelegated = fractionsSummary.totalGlwDelegated || "0";
    const averageDelegatorApy = fractionsApy.averageDelegatorApy || "0";
    const averageMinerApy = fractionsApy.averageMinerApyPercent || "0";

    console.log("✅ Successfully fetched fractions data for stats:");
    console.log(
      `   Total GLW Delegated: ${totalGlwDelegated} (${totalGlwDelegated !== "0" ? (parseFloat(totalGlwDelegated) / 1e18).toLocaleString(undefined, { maximumFractionDigits: 2 }) : "0"})`
    );
    console.log(
      `   Average Delegator APY: ${averageDelegatorApy !== "0" ? parseFloat(averageDelegatorApy).toFixed(2) : "N/A"}%`
    );
    console.log(
      `   Average Miner APY: ${averageMinerApy !== "0" ? parseFloat(averageMinerApy).toFixed(2) : "N/A"}%`
    );
    console.log();
  } catch (error) {
    console.error("❌ Test failed:", error.message);
    console.error(error.stack);
    console.log();
  }
}

async function runAllTests() {
  console.log("🚀 Starting fractions router API tests...\n");
  console.log(`📡 Using base URL: ${fractionsBaseUrl}\n`);

  await testFractionsSummary();
  await testFractionsAverageApy();
  await testFetchGlowStatsIntegration();

  console.log("🎉 All tests completed!");
}

// Run the tests if this file is executed directly
if (require.main === module) {
  runAllTests();
}

module.exports = {
  testFractionsSummary,
  testFractionsAverageApy,
  testFetchGlowStatsIntegration,
};

