require('dotenv').config();

const axios = require('axios');
const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY;

let lastVideoIdNotified = null
const DISCORD_CHANNEL_ID = 1169767222034567168 // #general channel
const YOUTUBE_CHANNEL_ID = 'TBD'


async function checkYouTube(client) {
    const url = `https://www.googleapis.com/youtube/v3/search?key=${YOUTUBE_API_KEY}&channelId=${YOUTUBE_CHANNEL_ID}&part=snippet,id&order=date&maxResults=1`;
    try {
        const response = await axios.get(url);
        const latestVideo = response.data.items[0];

        if (!lastVideoIdNotified && latestVideo) {
            lastVideoIdNotified = latestVideo.id.videoId
        } else if (latestVideo && latestVideo.id.videoId !== lastVideoIdNotified) {
            lastVideoIdNotified = latestVideo.id.videoId
            const channel = client.channels.cache.get(DISCORD_CHANNEL_ID);
            const videoUrl = `https://www.youtube.com/watch?v=${latestVideo.id.videoId}`;
            channel.send(`New video posted: ${videoUrl}`);
        }
    } catch (error) {
        console.error(error);
    }
}

module.exports = { checkYouTube }