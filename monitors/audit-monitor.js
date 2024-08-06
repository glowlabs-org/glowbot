require('dotenv').config();

const fs = require('fs');
const path = require('path');
const axios = require('axios');
const logger = require('../utils/log-util')
const fileUtil = require('../utils/file-util')
const { GLOW_CONTENT_CHANNEL_ID } = require('./../constants')

const dbFilePath = path.join(__dirname, '../db/audit-db.json');
let auditsNotified = []

async function init() {
    try {
        auditsNotified = await fileUtil.getFileData(dbFilePath);

        if (!auditsNotified || auditsNotified.length == 0) {
            const latestAudits = await getLatestAudits();
            auditsNotified = getShortIdsOfCompletedAudits(latestAudits);
            fs.writeFileSync(dbFilePath, JSON.stringify(auditsNotified, null, 2));
        }
    } catch (error) {
        let msg = logger.appendErrorToMessage('Error on init of audit monitor. ', error);
        logger.logMessage(msg, true);
        process.exit(1); // exit here as we cannot monitor audits without this data initialised
    }
}

async function checkAudits(client) {
    try {
        const latestAudits = await getLatestAudits();
        if (latestAudits && latestAudits.length > 0) {
            const completedAuditShortIds = getShortIdsOfCompletedAudits(latestAudits);
            const auditsNotifiedSet = new Set(auditsNotified);
            for (const auditId of completedAuditShortIds) {
                if (!auditsNotifiedSet.has(auditId)) {
                    const formattedAuditId = auditId.replace(/-/g, ',');
                    // Send notification
                    const channel = client.channels.cache.get(GLOW_CONTENT_CHANNEL_ID);
                    await channel.send(`https://www.glow.org/audits/farm-${formattedAuditId}`);
                    // Update notified list and file after successful send
                    auditsNotified.push(auditId);
                    await fs.promises.writeFile(dbFilePath, JSON.stringify(auditsNotified, null, 2));
                }
            }
        }
    } catch (error) {
        let msg = logger.appendErrorToMessage('Error checking audits. ', error);
        logger.logMessage(msg, true);
    }
}

function getShortIdsOfCompletedAudits(audits) {
    return audits
        .filter(item => item.status === 'completed')
        .map(item => item.devices.map(d => d.shortId).join('-'));
}

async function getLatestAudits() {
    const url = 'https://gca-crm-backend-production-1f2a.up.railway.app/applications/completed';
    try {
        const response = await axios.get(url);
        return response.data;
    } catch (error) {
        let msg = logger.appendErrorToMessage('Error fetching audit data. ', error);
        logger.logMessage(msg, true);
    }
}

module.exports = { init, checkAudits }