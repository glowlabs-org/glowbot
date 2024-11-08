const logger = require('../utils/log-util')

const userActivity = {};

async function checkMessageForSpam(client, message) {
    const userId = message.author.id;
    const channelId = message.channel.id;
    const messageId = message.id;
    const timestamp = Date.now();

    const member = await message.guild.members.fetch(userId);
    const joinTimestamp = member.joinedTimestamp;

    // Check if the user has been in the server for more than 15 minutes (900000 ms)
    if (timestamp - joinTimestamp > 900000) {
        return;
    }

    if (!userActivity[userId]) {
        userActivity[userId] = [];
    }

    userActivity[userId].push({ channelId, messageId, timestamp });

    // Remove entries older than 5 minutes (300000 ms)
    userActivity[userId] = userActivity[userId].filter(entry => timestamp - entry.timestamp < 300000);

    const uniqueChannels = new Set(userActivity[userId].map(entry => entry.channelId));

    // Check if user has posted in more than 5 channels
    if (uniqueChannels.size >= 5) {
        try {
            await member.ban({ reason: 'Excessive posting across multiple channels shortly after joining' });

            // Delete all recent messages from this user
            for (const activity of userActivity[userId]) {
                const channel = client.channels.cache.get(activity.channelId);
                if (channel) {
                    try {
                        const msg = await channel.messages.fetch(activity.messageId);
                        await msg.delete();
                    } catch (err) {
                        logger.logMessage(`Could not delete message ${activity.messageId}:`, true);
                    }
                }
            }
            message.channel.send(`User ${message.author.tag} has been banned for excessive posting across channels shortly after joining.`);
        } catch (error) {
            logger.logMessage(`Could not ban or delete messages for user ${message.author.tag}:`, true);
        }
    }
}

// Regular cleanup to prevent memory leaks (runs every 5 minutes)
setInterval(() => {
    const now = Date.now();
    for (const userId in userActivity) {
        userActivity[userId] = userActivity[userId].filter(entry => now - entry.timestamp < 300000);
        if (userActivity[userId].length === 0) {
            delete userActivity[userId]; // Remove empty entries
        }
    }
}, 300000);

module.exports = { checkMessageForSpam };
