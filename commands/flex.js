const axios = require("axios");
const { formatUnits } = require("viem");
const logger = require("../utils/log-util");

// CRM base + bot key for the read-only Discord resolve endpoints. These live on
// the production Glow CRM backend, which is a SEPARATE service from the gca
// server (GCA_SERVER_URL); don't read that here or !flex hits the wrong host.
// Staging: set DISCORD_CRM_URL to the staging CRM and use its matching DISCORD_BOT_API_KEY.
const CRM_BASE = (
  process.env.DISCORD_CRM_URL ||
  "https://gca-crm-backend-production-1f2a.up.railway.app"
).replace(/\/$/, "");
const BOT_API_KEY = process.env.DISCORD_BOT_API_KEY || "";

function fmtNum(s) {
  const n = Number.parseFloat(s || "0");
  if (!Number.isFinite(n)) return "0";
  return n.toLocaleString("en-US", { maximumFractionDigits: 2 });
}

function fmtGlw(wei) {
  try {
    const n = Number.parseFloat(formatUnits(BigInt(wei || "0"), 18));
    if (!Number.isFinite(n)) return "0";
    return n.toLocaleString("en-US", { maximumFractionDigits: 2 });
  } catch {
    return "0";
  }
}

// Best-rank metric → label as David specced it (watts shows as "Power").
function metricLabel(metric) {
  if (metric === "watts") return "Power";
  if (metric === "carbon") return "Carbon";
  return "Vault";
}

// Resolve a Discord id to its aggregated flex stats (sums across all the user's
// verified wallets; the wallet itself is never returned).
async function fetchFlex(discordId) {
  const res = await axios.get(`${CRM_BASE}/discord/flex`, {
    params: { discordId },
    headers: { "x-api-key": BOT_API_KEY },
    timeout: 8000,
  });
  return res.data || {};
}

// David's copy: User / Vault / Total Power / Total Carbon / Best rank. The
// wallet is deliberately omitted (multiple wallets may back one user).
function buildFlexEmbed(displayName, data) {
  const best = data.bestRank;
  const lines = [
    `**User:** ${displayName}`,
    `**Vault:** ${fmtGlw(data.vaultedGlwWei)} GLW`,
    `**Total Power:** ${fmtNum(data.totalWatts)} watts`,
    `**Total Carbon:** ${fmtNum(data.totalCarbonCredits)} tons`,
    "",
    `**Best rank:** ${
      best ? `${best.rank} (${metricLabel(best.metric)})` : "Unranked"
    }`,
  ];
  return {
    color: 0xffd60a,
    description: lines.join("\n"),
    footer: { text: "glow.org" },
    timestamp: new Date().toISOString(),
  };
}

/**
 * !flex — show the caller's aggregated Glow stats. If the Discord account isn't
 * sign-verified to a wallet, prompt them to run !connect.
 */
async function handleFlexCommand(message) {
  const discordId = message.author.id;

  try {
    const data = await fetchFlex(discordId);

    if (!data.linked) {
      await message.reply(
        "You haven't linked a wallet yet — run `!connect` to bind your " +
          "Discord to your Glow wallet, then try `!flex` again."
      );
      return;
    }

    const name = message.author.globalName || message.author.username;
    await message.reply({ embeds: [buildFlexEmbed(name, data)] });
  } catch (err) {
    if (err.response && err.response.status === 401) {
      logger.logMessage(
        "!flex: 401 from /discord/flex — check DISCORD_BOT_API_KEY matches the CRM env",
        true
      );
    }
    logger.logMessage(logger.appendErrorToMessage("!flex error: ", err), true);
    await message
      .reply("Couldn't fetch your stats right now — try again in a bit.")
      .catch(() => {});
  }
}

module.exports = {
  handleFlexCommand,
  fetchFlex,
  buildFlexEmbed,
  fmtNum,
  fmtGlw,
  metricLabel,
  CRM_BASE,
  BOT_API_KEY,
};
