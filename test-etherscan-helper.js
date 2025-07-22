require("dotenv").config();
const { getGlowHolderCount } = require("./utils/ponder-helper");

async function testGlowHolderCount() {
  console.log("🧪 Testing getGlowHolderCount with Ponder GraphQL...\n");

  try {
    console.log("📡 Fetching Glow holder count from Ponder...");
    const holderCount = await getGlowHolderCount();
    console.log(`🏆 Holder count: ${holderCount.toLocaleString()}\n`);

    console.log("🎉 Test completed successfully!");
  } catch (error) {
    console.error("❌ Test failed:", error.message);
    console.error(error.stack);
  }
}

// Run the test if this file is executed directly
if (require.main === module) {
  testGlowHolderCount();
}

module.exports = { testGlowHolderCount };
