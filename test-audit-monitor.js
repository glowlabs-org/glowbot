require("dotenv").config();

const audit = require("./monitors/audit-monitor");

// Mock Discord client similar to the real one
const mockClient = {
  channels: {
    cache: {
      get: (channelId) => {
        console.log(`📤 Getting channel: ${channelId}`);
        return {
          send: async (message) => {
            console.log(`📤 Would send message to channel ${channelId}:`);
            console.log(`   Message: ${message}`);
            return { id: "mock-message-id" };
          },
        };
      },
    },
  },
};

async function testAuditMonitor() {
  console.log("🧪 Testing audit monitor...\n");

  try {
    console.log("🚀 Initializing audit monitor...");
    await audit.init();
    console.log("✅ Audit monitor initialized successfully\n");

    console.log("📊 Running checkAudits...");
    await audit.checkAudits(mockClient);
    console.log("✅ checkAudits completed successfully\n");

    console.log("🎉 Test completed!");
  } catch (error) {
    console.error("❌ Test failed:", error.message);
    console.error(error.stack);
  }
}

// Run the test if this file is executed directly
if (require.main === module) {
  testAuditMonitor();
}

module.exports = { testAuditMonitor, mockClient };
