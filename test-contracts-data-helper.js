require("dotenv").config();
const {
  getUSDCBalanceOfRedemptionContract,
  getUSDGLiquidityInPool,
  fetchContractsData,
} = require("./utils/contracts-data-helper");

async function testUSDCBalanceOfRedemptionContract() {
  console.log("🧪 Testing getUSDCBalanceOfRedemptionContract with viem...\n");

  try {
    console.log("📡 Fetching USDC balance of redemption contract...");
    const usdcBalance = await getUSDCBalanceOfRedemptionContract();

    if (usdcBalance !== null) {
      console.log(`💰 USDC balance: $${usdcBalance.toLocaleString()}\n`);
    } else {
      console.log("❌ Failed to fetch USDC balance\n");
    }
  } catch (error) {
    console.error("❌ Test failed:", error.message);
    console.error(error.stack);
  }
}

async function testUSDGLiquidityInPool() {
  console.log("🧪 Testing getUSDGLiquidityInPool with viem...\n");

  try {
    console.log("📡 Fetching USDG liquidity in GLW/USDG pool...");
    const usdgLiquidity = await getUSDGLiquidityInPool();

    if (usdgLiquidity !== null) {
      console.log(`🏊 USDG liquidity: ${usdgLiquidity.toLocaleString()}\n`);
    } else {
      console.log("❌ Failed to fetch USDG liquidity\n");
    }
  } catch (error) {
    console.error("❌ Test failed:", error.message);
    console.error(error.stack);
  }
}

async function testFetchContractsData() {
  console.log("🧪 Testing fetchContractsData...\n");

  try {
    console.log("📡 Fetching all contracts data...");
    const contractsData = await fetchContractsData();

    console.log("📊 Contracts data:", JSON.stringify(contractsData, null, 2));
    console.log();
  } catch (error) {
    console.error("❌ Test failed:", error.message);
    console.error(error.stack);
  }
}

async function runAllTests() {
  console.log("🚀 Starting contracts data helper tests...\n");

  await testUSDCBalanceOfRedemptionContract();
  await testUSDGLiquidityInPool();
  await testFetchContractsData();

  console.log("🎉 All tests completed!");
}

// Run the tests if this file is executed directly
if (require.main === module) {
  runAllTests();
}

module.exports = {
  testUSDCBalanceOfRedemptionContract,
  testUSDGLiquidityInPool,
  testFetchContractsData,
};
