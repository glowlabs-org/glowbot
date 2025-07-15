const axios = require("axios");
const logger = require("../utils/log-util");
const fs = require("fs");
const path = require("path");
const fileUtil = require("../utils/file-util");
const { EmbedBuilder } = require("discord.js");

const dbFilePath = path.join(__dirname, "../db/impact-db-v2.json");
let lastMetrics = {};
let lastPostDate = null;

async function init() {
  try {
    const data = await fileUtil.getFileData(dbFilePath);
    lastMetrics = data.lastMetrics || {};
    lastPostDate = data.lastPostDate ? new Date(data.lastPostDate) : null;

    if (Object.keys(lastMetrics).length === 0) {
      lastMetrics = await fetchImpactMetrics();
      await saveData();
    }
  } catch (error) {
    let msg = logger.appendErrorToMessage(
      "Error on init of impact monitor. ",
      error
    );
    logger.logMessage(msg, true);
    process.exit(1);
  }
}

function getWeekStartUTC(now) {
  const date = new Date(now.getTime());
  const day = date.getUTCDay();
  const diff = day;
  date.setUTCDate(date.getUTCDate() - diff);
  date.setUTCHours(0, 0, 0, 0);
  return date;
}

async function checkImpact(client, channelId) {
  try {
    const now = new Date();
    const weekStart = getWeekStartUTC(now);
    const isPostTime = now.getUTCDay() === 0 && now.getUTCHours() === 0;
    if (lastPostDate === null || (isPostTime && lastPostDate < weekStart)) {
      const currentMetrics = await fetchImpactMetrics();
      if (Object.keys(currentMetrics).length === 0) return;
      const channel = client.channels.cache.get(channelId);
      const embed = createImpactEmbed(currentMetrics);
      await channel.send({ embeds: [embed] });
      lastMetrics = currentMetrics;
      lastPostDate = now;
      await saveData();
    }
  } catch (error) {
    let msg = logger.appendErrorToMessage(
      "Error checking impact metrics. ",
      error
    );
    logger.logMessage(msg, true);
  }
}

async function fetchImpactMetrics() {
  try {
    const response = await axios.get("https://glow.org/api/impact-metrics");
    return response.data;
  } catch (error) {
    let msg = logger.appendErrorToMessage(
      "Error fetching impact metrics. ",
      error
    );
    logger.logMessage(msg, true);
    return {};
  }
}

function createImpactEmbed(metrics) {
  return new EmbedBuilder()
    .setTitle("Glow Weekly Impact Metrics")
    .setColor("#0099ff")
    .setTimestamp()
    .addFields(
      {
        name: "Solar Panels Installed",
        value: metrics.solarPanelsInstalled.toLocaleString(),
        inline: false,
      },
      {
        name: "Adult Trees Equivalent",
        value: metrics.adultTreesEquivalent.toLocaleString(),
        inline: false,
      },
      {
        name: "Flights Offset",
        value: metrics.flightsOffset.toLocaleString(),
        inline: false,
      },
      {
        name: "Homes Powered",
        value: metrics.homesPowered.toLocaleString(),
        inline: false,
      },
      {
        name: "Asthma Attacks Prevented",
        value: metrics.asthmaAttacksPrevented.toLocaleString(),
        inline: false,
      },
      {
        name: "Water Saved (Gallons)",
        value: metrics.waterSavedGallons.toLocaleString(),
        inline: false,
      },
      {
        name: "Daily Needs for Humans",
        value: metrics.dailyNeedsHumans.toLocaleString(),
        inline: false,
      }
    )
    .setFooter({ text: "Data from Glow Impact API" });
}

async function saveData() {
  const data = {
    lastMetrics,
    lastPostDate: lastPostDate ? lastPostDate.toISOString() : null,
  };
  await fs.promises.writeFile(dbFilePath, JSON.stringify(data, null, 2));
}

module.exports = { init, checkImpact };
