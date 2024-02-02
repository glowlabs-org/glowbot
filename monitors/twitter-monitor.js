require('dotenv').config();

const axios = require('axios');
const TWITTER_BEARER_TOKEN = process.env.TWITTER_BEARER_TOKEN;

let lastTweetIdNotified = null
const DISCORD_CHANNEL_ID = 1169767222034567168 // #general channel
const twitterAccouts = {
    'DavidVorick': '1126889730227843132',
    'glowFND': '1126889730227843132',
}

async function checkTwitter(client, twitterHandle) {
    const url = `https://api.twitter.com/2/users/:${twitterAccouts[twitterHandle]}/tweets`;
    try {
        const response = await axios.get(url, {
            headers: {
                'Authorization': `Bearer ${TWITTER_BEARER_TOKEN}`
            }
        });
        const latestTweet = response.data.data ? response.data.data[0] : null; 

        if (!lastTweetIdNotified && latestTweet) {
            lastTweetIdNotified = latestTweet.id
        } else if (latestTweet && latestTweet.id !== lastTweetIdNotified) {
            lastTweetIdNotified = latestTweet.id
            const channel = client.channels.cache.get(DISCORD_CHANNEL_ID);
            const tweetUrl = `https://twitter.com/${twitterHandle}/status/${lastTweetIdNotified}`;
            channel.send(`New Tweet by @${twitterHandle}!: ${tweetUrl}`);
        }
    } catch (error) {
        console.error(error);
    }
}

module.exports = { checkTwitter }