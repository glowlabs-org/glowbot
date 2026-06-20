const axios = require("axios");
const logger = require("../utils/log-util");
const { CRM_BASE, BOT_API_KEY, fmtNum, fmtGlw } = require("./flex");
const { resolveTargetUser } = require("./wallets");

const METRIC_LABEL = { vault: "Vault", watts: "Power", carbon: "Carbon" };

// Map a leading command token to a metric (or null if it's not one).
function tokenToMetric(token) {
  const t = (token || "").toLowerCase();
  if (t === "vault") return "vault";
  if (t === "watts" || t === "power") return "watts";
  if (t === "carbon") return "carbon";
  return null;
}

function metricValue(metric, row) {
  if (metric === "watts") return `${fmtNum(row.totalWatts)} watts`;
  if (metric === "carbon") return `${fmtNum(row.totalCarbonCredits)} tons`;
  return `${fmtGlw(row.vaultedGlwWei)} GLW`;
}

/**
 * !leaderboard [metric] [@user|username] — grouped Glow leaderboard.
 *   !leaderboard                → top 10 by Vault (default)
 *   !leaderboard watts          → top 10 by Power
 *   !leaderboard taek           → 10 rows around taek (Vault)
 *   !leaderboard carbon taek    → 10 rows around taek (Carbon)
 */
async function handleLeaderboardCommand(message) {
  const tokens = message.content.trim().split(/\s+/).slice(1);

  let metric = "vault";
  if (tokens.length && tokenToMetric(tokens[0])) {
    metric = tokenToMetric(tokens[0]);
    tokens.shift();
  }
  const userArg = tokens.join(" ");

  try {
    let discordId;
    let targetName;
    if (userArg || message.mentions?.users?.size) {
      const target = await resolveTargetUser(message, userArg);
      if (!target) {
        await message.reply(`Couldn't find a Discord user matching "${userArg}".`);
        return;
      }
      discordId = target.id;
      targetName = target.name;
    }

    const res = await axios.get(`${CRM_BASE}/discord/leaderboard`, {
      params: { metric, limit: 10, ...(discordId ? { discordId } : {}) },
      headers: { "x-api-key": BOT_API_KEY },
      timeout: 8000,
    });
    const data = res.data || {};
    const rows = Array.isArray(data.rows) ? data.rows : [];

    if (rows.length === 0) {
      await message.reply("The leaderboard is empty right now.");
      return;
    }

    const label = METRIC_LABEL[metric] || "Vault";
    const lines = rows.map((r) => {
      const line = `\`#${r.rank}\` ${r.name} — ${metricValue(metric, r)}`;
      return r.isYou ? `➤ **${line}**` : line;
    });

    let title = `🏆 ${label} leaderboard`;
    if (targetName) title += ` — around ${targetName}`;

    const footerParts = [`${data.totalEntities ?? rows.length} ranked`];
    if (data.you && data.you.rank) footerParts.push(`you're #${data.you.rank}`);

    await message.reply({
      embeds: [
        {
          color: 0xffd60a,
          title,
          description: lines.join("\n"),
          footer: { text: `glow.org · ${footerParts.join(" · ")}` },
          timestamp: new Date().toISOString(),
        },
      ],
    });
  } catch (err) {
    if (err.response && err.response.status === 401) {
      logger.logMessage(
        "!leaderboard: 401 from /discord/leaderboard — check DISCORD_BOT_API_KEY",
        true
      );
    }
    logger.logMessage(
      logger.appendErrorToMessage("!leaderboard error: ", err),
      true
    );
    await message
      .reply("Couldn't fetch the leaderboard right now — try again in a bit.")
      .catch(() => {});
  }
}

module.exports = { handleLeaderboardCommand };
