const logger = require('../utils/log-util')
const { GM_GN_CHANNEL_ID } = require('./../constants');

const greetings = ['gm', 'gn', 'yo', 'hey', 'hi', 'bye', 'sup', 'hello', 'heya', 'howdy', 'wassup', 'morning', 'night', 'cya', 'later', 'hola', 'ayy', 'oi', 'yo yo', 'hihi', 'hey hey', 'wazzup', 'greetings', 'evening', 'peace', 'farewell', 'take care', 'see ya', 'adios', 'cheers'];

async function checkMessageForGreeting(client, message) {
    const channelId = message.channel.id;

    if (channelId === GM_GN_CHANNEL_ID) {
        return;
    }

    const content = message.content;
    const contentsNormalised = content?.toLowerCase().trim()
    const contentsWithoutSpaces = contentsNormalised?.replace(' ', '')
    const contentsWithoutExclamation = contentsWithoutSpaces?.replace('!', '')

    if (greetings.includes(contentsNormalised) || greetings.includes(contentsWithoutSpaces) || greetings.includes(contentsWithoutExclamation)) {
        const channel = client.channels.cache.get(channelId);
        if (channel) {
            try {
                const msg = await channel.messages.fetch(message.id);
                await msg.delete();
                message.channel.send(`Please refrain from posting greeting messages so we can keep the chat clean.`);
            } catch (err) {
                const msg = logger.appendErrorToMessage(`Could not delete message ${message.id}. `, err);
                logger.logMessage(msg, true);
            }
        }
    }
}

module.exports = { checkMessageForGreeting };
