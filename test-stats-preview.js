require("dotenv").config();
const { fetchGlowStats } = require("./utils/glow-stats");
const { formatGlowStatsMessage } = require("./utils/glow-stats-message");

function previewStats(uppercase = false) {
  return fetchGlowStats().then((payload) => {
    const processed = formatGlowStatsMessage(payload, { uppercase });
    if (processed) return processed;
    return payload?.userMessage || "Sorry, I could not fetch the stats.";
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
