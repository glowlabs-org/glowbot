require("dotenv").config();

const { Client, GatewayIntentBits, Events } = require("discord.js");
const audit = require("./monitors/audit-monitor");

// Mock Discord client similar to the real one
// Removed mockClient

async function testAuditMonitor() {
  console.log("🧪 Testing audit monitor...\n");

  try {
    const client = new Client({ intents: [GatewayIntentBits.Guilds] });

    const readyPromise = new Promise((resolve) => {
      client.once(Events.ClientReady, async () => {
        console.log("🚀 Initializing audit monitor...");
        await audit.init();
        console.log("✅ Audit monitor initialized successfully\n");

        console.log("📊 Running checkAudits...");
        await audit.checkAudits(client, "1394701624554950727"); // Using the same test channel as blog
        console.log("✅ checkAudits completed successfully\n");

        console.log("🎉 Test completed!");
        client.destroy();
        resolve();
      });
    });

    await client.login(process.env.DISCORD_BOT_TOKEN);
    await readyPromise;
  } catch (error) {
    console.error("❌ Test failed:", error.message);
    console.error(error.stack);
  }
}

// Run the test if this file is executed directly
if (require.main === module) {
  testAuditMonitor();
}

module.exports = { testAuditMonitor };
