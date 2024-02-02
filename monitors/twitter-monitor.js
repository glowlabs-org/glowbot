const fs = require('fs');
const path = require('path');
const axios = require('axios');
require('dotenv').config();

const TWITTER_BEARER_TOKEN = process.env.TWITTER_BEARER_TOKEN;
const DISCORD_CHANNEL_ID = 1169767222034567168; // #general channel
const twitterAccounts = {
    'DavidVorick': '1126889730227843132',
    'glowFND': '1126889730227843132',
};
const dbFilePath = path.join(__dirname, 'tweetDB.json'); // Adjust the directory as needed

async function checkTwitter(client, twitterHandle) {
    // Initialize or read the database
    let db = {};
    if (fs.existsSync(dbFilePath)) {
        db = JSON.parse(fs.readFileSync(dbFilePath, 'utf8'));
    }

    const url = `https://api.twitter.com/2/users/${twitterAccounts[twitterHandle]}/tweets`; // Fixed the URL
    try {
        const response = await axios.get(url, {
            headers: {
                'Authorization': `Bearer ${TWITTER_BEARER_TOKEN}`,
            },
        });
        const latestTweet = response.data.data ? response.data.data[0] : null;

        if (latestTweet) {
            const lastTweetIdNotified = db[twitterHandle] ? db[twitterHandle].lastTweetIdNotified : null;
            if (latestTweet.id !== lastTweetIdNotified) {
                // Update the database with the new tweet ID
                db[twitterHandle] = { lastTweetIdNotified: latestTweet.id };
                fs.writeFileSync(dbFilePath, JSON.stringify(db, null, 2));

                const channel = client.channels.cache.get(DISCORD_CHANNEL_ID);
                const tweetUrl = `https://twitter.com/${twitterHandle}/status/${latestTweet.id}`;
                channel.send(`New Tweet by @${twitterHandle}!: ${tweetUrl}`);
            }
        }
    } catch (error) {
        console.error(error);
    }
}

module.exports = { checkTwitter };
