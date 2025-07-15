require("dotenv").config();
const { Client, GatewayIntentBits, Events } = require("discord.js");
const impact = require("./monitors/impact-monitor");

async function testImpactMonitor() {
  console.log("🧪 Testing impact monitor...\n");

  try {
    const client = new Client({ intents: [GatewayIntentBits.Guilds] });

    const readyPromise = new Promise((resolve) => {
      client.once(Events.ClientReady, async () => {
        console.log("🚀 Initializing impact monitor...");
        await impact.init();
        console.log("✅ Impact monitor initialized successfully\n");

        console.log("📊 Running checkImpact...");
        await impact.checkImpact(client, "1394701624554950727");
        console.log("✅ checkImpact completed successfully\n");

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
  testImpactMonitor();
}

module.exports = { testImpactMonitor };
