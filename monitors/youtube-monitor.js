require('dotenv').config();

const fs = require('fs');
const path = require('path');
const axios = require('axios');
const logger = require('../utils/log-util')
const { GLOW_CONTENT_CHANNEL_ID } = require('./../constants')

const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY;

const dbFilePath = path.join(__dirname, '../db/youtube-multi-db.json');
let pastVideos = {};  // Stores past videos for multiple channels
let monitoredChannels = {};  // Stores {channelId: uploadsPlaylistId}

async function init(channelIds) {
    try {
        if (!Array.isArray(channelIds)) {
            throw new Error("init() must receive an array of YouTube channel IDs");
        }

        if (fs.existsSync(dbFilePath)) {
            pastVideos = JSON.parse(fs.readFileSync(dbFilePath, 'utf8'));
        }

        for (const channelId of channelIds) {
            const uploadsPlaylistId = await getUploadsPlaylistId(channelId);
            monitoredChannels[channelId] = uploadsPlaylistId;

            if (!pastVideos[channelId]) {
                pastVideos[channelId] = [];
            }

            const latestVideos = await getLatestVideos(uploadsPlaylistId, 10);
            latestVideos?.forEach(video => {
                if (!pastVideos[channelId].includes(video.snippet.resourceId.videoId)) {
                    pastVideos[channelId].push(video.snippet.resourceId.videoId);
                }
            });
        }

        fs.writeFileSync(dbFilePath, JSON.stringify(pastVideos, null, 2));
    } catch (error) {
        let msg = logger.appendErrorToMessage('Error on init of youtube monitor. ', error);
        logger.logMessage(msg, true);
        process.exit(1); // exit here as we cannot monitor youtube without this data initialised
    }
}

async function checkYouTube(client) {
    try {
        for (const channelId of Object.keys(monitoredChannels)) {
            const uploadsPlaylistId = monitoredChannels[channelId];
            const latestVideos = await getLatestVideos(uploadsPlaylistId, 1);

            if (latestVideos && latestVideos.length > 0) {
                const latestVideoId = latestVideos[0].snippet.resourceId.videoId;
                if (latestVideoId && !pastVideos[channelId].includes(latestVideoId)) {
                    pastVideos[channelId].push(latestVideoId);
                    fs.writeFileSync(dbFilePath, JSON.stringify(pastVideos, null, 2));

                    const channel = client.channels.cache.get(GLOW_CONTENT_CHANNEL_ID);
                    const videoUrl = `https://www.youtube.com/watch?v=${latestVideoId}`;
                    channel.send(`New video posted on YouTube by ${channelId}: ${videoUrl}`);
                }
            }
        }
    } catch (error) {
        let msg = logger.appendErrorToMessage('Error checking YouTube. ', error);
        logger.logMessage(msg, true);
    }
}

async function getUploadsPlaylistId(channelId) {
    const url = `https://www.googleapis.com/youtube/v3/channels?id=${channelId}&part=contentDetails&key=${YOUTUBE_API_KEY}`;
    try {
        const response = await axios.get(url);
        return response.data.items[0].contentDetails.relatedPlaylists.uploads;
    } catch (error) {
        let msg = logger.appendErrorToMessage(`Error fetching uploads playlist ID for ${channelId}. `, error);
        logger.logMessage(msg, true);
    }
}

async function getLatestVideos(uploadsPlaylistId, maxResults) {
    const url = `https://www.googleapis.com/youtube/v3/playlistItems?playlistId=${uploadsPlaylistId}&part=snippet&maxResults=${maxResults}&key=${YOUTUBE_API_KEY}`;
    try {
        const response = await axios.get(url);
        return response.data.items;
    } catch (error) {
        if (!error?.message.includes('code 404')) { // likely monitoring a new channel here which has no videos yet (such as Glow Regens on 20250223)
            let msg = logger.appendErrorToMessage(`Error fetching latest videos for playlist id ${uploadsPlaylistId}. `, error);
            logger.logMessage(msg, true);
        }
    }
}

module.exports = { init, checkYouTube };
