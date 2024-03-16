require('dotenv').config();

const fs = require('fs');
const path = require('path');
const axios = require('axios');
const logger = require('../utils/log-util')
const { GLOW_CONTENT_CHANNEL_ID } = require('./../constants')


const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY;

const YOUTUBE_CHANNEL_ID = 'UCIw4NusO7Jcyut7DrTfL50A'
let UPLOADS_PLAYLIST_ID = null

const dbFilePath = path.join(__dirname, '../db/youtube-db.json');
let pastVideos = []

async function init() {
    try {
        UPLOADS_PLAYLIST_ID = await getUploadsPlaylistId();

        if (fs.existsSync(dbFilePath)) {
            pastVideos = JSON.parse(fs.readFileSync(dbFilePath, 'utf8'));
        } else {
            // create db folder if it doesn't exist already
            if (!fs.existsSync(path.join(__dirname, '../db'))) {
                fs.mkdirSync(path.join(__dirname, '../db'), { recursive: true });
            }

            const latestVideos = await getLatestVideos(UPLOADS_PLAYLIST_ID, 10);
            latestVideos.forEach(video => pastVideos.push(video.snippet.resourceId.videoId));

            fs.writeFileSync(dbFilePath, JSON.stringify(pastVideos, null, 2));
        }
    } catch (error) {
        let msg = logger.appendErrorToMessage('Error on init of youtube monitor. ', error);
        logger.logMessage(msg, true);
        process.exit(1); // exit here as we cannot monitor youtube without this data initialised
    }
}

async function checkYouTube(client) {
    try {

        const latestVideos = await getLatestVideos(UPLOADS_PLAYLIST_ID, 1);
        if (latestVideos && latestVideos.length > 0) {
            const latestVideo = latestVideos[0]
            const latestVideoId = latestVideo ? latestVideo.snippet.resourceId.videoId : null;
            if (latestVideoId && !pastVideos.includes(latestVideoId)) {
                pastVideos.push(latestVideoId)
                fs.writeFileSync(dbFilePath, JSON.stringify(pastVideos, null, 2));

                const channel = client.channels.cache.get(GLOW_CONTENT_CHANNEL_ID);
                const videoUrl = `https://www.youtube.com/watch?v=${latestVideoId}`;
                channel.send(`New video posted by Alma: ${videoUrl}`);
            }
        }
    } catch (error) {
        let msg = logger.appendErrorToMessage('Error checking youtube. ', error);
        logger.logMessage(msg, true);
    }
}

async function getUploadsPlaylistId() {
    const url = `https://www.googleapis.com/youtube/v3/channels?id=${YOUTUBE_CHANNEL_ID}&part=contentDetails&key=${YOUTUBE_API_KEY}`;
    try {
        const response = await axios.get(url);
        return response.data.items[0].contentDetails.relatedPlaylists.uploads;
    } catch (error) {
        let msg = logger.appendErrorToMessage('Error fetching uploads playlist ID. ', error);
        logger.logMessage(msg, true);
    }
}

async function getLatestVideos(uploadsPlaylistId, maxResults) {
    const url = `https://www.googleapis.com/youtube/v3/playlistItems?playlistId=${uploadsPlaylistId}&part=snippet&maxResults=${maxResults}&key=${YOUTUBE_API_KEY}`;
    try {
        const response = await axios.get(url);
        return response.data.items;  // Array of the latest videos
    } catch (error) {
        let msg = logger.appendErrorToMessage('Error fetching latest videos. ', error);
        logger.logMessage(msg, true);
    }
}

module.exports = { init, checkYouTube }