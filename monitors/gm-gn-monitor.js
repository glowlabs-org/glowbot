const logger = require('../utils/log-util')
const { GM_GN_CHANNEL_ID } = require('./../constants');


async function checkMessageForGmGn(client, message) {
    const channelId = message.channel.id;

    if (channelId === GM_GN_CHANNEL_ID) {
        return;
    }

    const content = message.content;
    const contentsNormalised = content?.toLowerCase().trim()

    if (contentsNormalised === 'gm' || contentsNormalised === 'gn') {
        const channel = client.channels.cache.get(channelId);
        if (channel) {
            try {
                const msg = await channel.messages.fetch(message.id);
                await msg.delete();
                message.channel.send(`Please keep 'gm-gn' messages in the <#${GM_GN_CHANNEL_ID}> channel.`);
            } catch (err) {
                logger.logMessage(`Could not delete message ${message.id}:`, true);
            }
        }
    }
}

module.exports = { checkMessageForGmGn };
