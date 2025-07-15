const blog = require("./monitors/blog-monitor");

// Mock Discord client similar to the real one
const mockClient = {
  channels: {
    cache: {
      get: (channelId) => {
        console.log(`📤 Getting channel: ${channelId}`);
        return {
          send: async (message) => {
            console.log(`📤 Would send message to channel ${channelId}:`);
            console.log(`   Message: ${JSON.stringify(message)}`);
            return { id: "mock-message-id" };
          },
        };
      },
    },
  },
};

async function testBlogMonitor() {
  console.log("🧪 Testing blog monitor...\n");

  try {
    console.log("🚀 Initializing blog monitor...");
    await blog.init();
    console.log("✅ Blog monitor initialized successfully\n");

    console.log("📊 Running checkBlog...");
    await blog.checkBlog(mockClient);
    console.log("✅ checkBlog completed successfully\n");

    console.log("🎉 Test completed!");
  } catch (error) {
    console.error("❌ Test failed:", error.message);
    console.error(error.stack);
  }
}

// Run the test if this file is executed directly
if (require.main === module) {
  testBlogMonitor();
}

module.exports = { testBlogMonitor, mockClient };
