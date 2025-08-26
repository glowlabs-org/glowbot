require("dotenv").config();

const fs = require("fs");
const path = require("path");
const axios = require("axios");
const logger = require("../utils/log-util");
const fileUtil = require("../utils/file-util");

const dbFilePath = path.join(__dirname, "../db/audit-db-v2.json");
let auditsNotified = [];

async function init() {
  try {
    auditsNotified = await fileUtil.getFileData(dbFilePath);

    if (!auditsNotified || auditsNotified.length == 0) {
      const latestAudits = await getLatestAudits();
      const completedAudits = getShortIdsOfCompletedAudits(latestAudits);
      const shortIds = completedAudits.map((audit) => audit.shortIds);

      fs.writeFileSync(dbFilePath, JSON.stringify(shortIds, null, 2));
    }
  } catch (error) {
    let msg = logger.appendErrorToMessage(
      "Error on init of audit monitor. ",
      error
    );
    logger.logMessage(msg, true);
    process.exit(1); // exit here as we cannot monitor audits without this data initialised
  }
}

async function checkAudits(client, channelId) {
  try {
    const latestAudits = await getLatestAudits();
    if (latestAudits && latestAudits.length > 0) {
      const completedAuditShortIds = getShortIdsOfCompletedAudits(latestAudits);
      const auditsNotifiedSet = new Set(auditsNotified);
      for (const { shortIds, auditId, farmId } of completedAuditShortIds) {
        if (shortIds && !auditsNotifiedSet.has(shortIds)) {
          if (auditId) {
            console.log("Sending notification for audit: ", auditId);
            // Send notification
            const channel = client.channels.cache.get(channelId);
            await channel.send(`https://www.glow.org/audits/${farmId}`);
            // Update notified list and file after successful send
            auditsNotified.push(shortIds);
            await fs.promises.writeFile(
              dbFilePath,
              JSON.stringify(auditsNotified, null, 2)
            );
          }
        }
      }
    }
  } catch (error) {
    let msg = logger.appendErrorToMessage("Error checking audits. ", error);
    logger.logMessage(msg, true);
  }
}

function getShortIdsOfCompletedAudits(audits) {
  const nowUTC = Date.now(); // UTC timestamp in milliseconds
  const TEN_MINUTES_MS = 10 * 60 * 1000; // 10 minutes in milliseconds

  return audits
    .filter((item) => {
      // Must be completed status
      if (item.status !== "completed") {
        return false;
      }

      // Must have farm with auditCompleteDate
      if (!item.farm || !item.farm.auditCompleteDate) {
        return false;
      }

      // Check if 10 minutes have passed since auditCompleteDate
      // Convert auditCompleteDate to UTC timestamp for timezone-independent comparison
      const auditCompleteDate = new Date(item.farm.auditCompleteDate);
      const auditCompleteUTC = auditCompleteDate.getTime();
      const timeSinceCompletion = nowUTC - auditCompleteUTC;

      return timeSinceCompletion >= TEN_MINUTES_MS;
    })
    .map((item) => {
      return {
        shortIds: item.devices.map((d) => d.shortId).join("-"),
        auditId: item.id,
        farmId: item.farm.id,
      };
    });
}

async function getLatestAudits() {
  const url =
    "https://gca-crm-backend-production-1f2a.up.railway.app/applications/completed";
  try {
    const response = await axios.get(url);
    return response.data;
  } catch (error) {
    let msg = logger.appendErrorToMessage("Error fetching audit data. ", error);
    logger.logMessage(msg, true);
  }
}

module.exports = { init, checkAudits };
