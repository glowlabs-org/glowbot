require("dotenv").config();
const { Client, GatewayIntentBits, Events } = require("discord.js");
const press = require("./monitors/press-monitor");

async function testPressMonitor() {
  console.log("🧪 Testing press monitor...\n");

  try {
    const client = new Client({ intents: [GatewayIntentBits.Guilds] });

    const readyPromise = new Promise((resolve) => {
      client.once(Events.ClientReady, async () => {
        console.log("🚀 Initializing press monitor...");
        await press.init();
        console.log("✅ Press monitor initialized successfully\n");

        console.log("📊 Running checkPress...");
        await press.checkPress(client, "1394701624554950727");
        console.log("✅ checkPress completed successfully\n");

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
  testPressMonitor();
}

module.exports = { testPressMonitor };
