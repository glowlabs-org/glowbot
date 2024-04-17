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

            completedAuditShortIds.forEach(auditId => {

                if (!auditsNotified.includes(auditId)) {

                    if (isAuditReportPosted(auditId)) { // check that the audit report is available on the Glow website
                        // update our list and file
                        auditsNotified = completedAuditShortIds;
                        fs.writeFileSync(dbFilePath, JSON.stringify(auditsNotified, null, 2));

                        const channel = client.channels.cache.get(GLOW_CONTENT_CHANNEL_ID);
                        channel.send(`A new audit was completed by Glow: https://www.glow.org/audits/farm-${auditId}`);
                        return;
                    }
                }
            })
        }
    } catch (error) {
        let msg = logger.appendErrorToMessage('Error checking audits. ', error);
        logger.logMessage(msg, true);
    }
}

async function isAuditReportPosted(auditId) {
    try {
        const response = await axios.get(`https://www.glow.org/api/audits?shortId=${auditId}`);
        return response.status === 200

    } catch (error) {
        let msg = logger.appendErrorToMessage('Error checking audit report on Glow. ', error);
        logger.logMessage(msg, true);
        return false
    }
}

function getShortIdsOfCompletedAudits(audits) {
    return audits
        .filter(item => Object.prototype.hasOwnProperty.call(item.status, 'AuditCompleted'))
        .map(item => item.short_id);
}

async function getLatestAudits() {
    const url = 'https://fun-rust-production.up.railway.app/get_farm_statuses';
    try {
        const response = await axios.get(url);
        return response.data;
    } catch (error) {
        let msg = logger.appendErrorToMessage('Error fetching audit data. ', error);
        logger.logMessage(msg, true);
    }
}

module.exports = { init, checkAudits }