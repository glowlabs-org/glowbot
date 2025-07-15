require("dotenv").config();
const { Client, GatewayIntentBits, Events } = require("discord.js");
const blog = require("./monitors/blog-monitor");

async function testBlogMonitor() {
  console.log("🧪 Testing blog monitor...\n");

  try {
    const client = new Client({ intents: [GatewayIntentBits.Guilds] });

    const readyPromise = new Promise((resolve) => {
      client.once(Events.ClientReady, async () => {
        console.log("🚀 Initializing blog monitor...");
        await blog.init();
        console.log("✅ Blog monitor initialized successfully\n");

        console.log("📊 Running checkBlog...");
        await blog.checkBlog(client, "1394701624554950727");
        console.log("✅ checkBlog completed successfully\n");

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
  testBlogMonitor();
}

module.exports = { testBlogMonitor };
