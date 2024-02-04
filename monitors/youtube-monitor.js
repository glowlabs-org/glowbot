require('dotenv').config();

const fs = require('fs');
const path = require('path');
const axios = require('axios');
const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY;

const DISCORD_CHANNEL_ID = '1201983773030486126' // #glow-content channel
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
            pastVideos = JSON.stringify(pastVideos, null, 2);

            fs.writeFileSync(dbFilePath, pastVideos);
        }
    } catch (error) {
        console.error(error);
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

                const channel = client.channels.cache.get(DISCORD_CHANNEL_ID);
                const videoUrl = `https://www.youtube.com/watch?v=${latestVideoId}`;
                channel.send(`New video posted by Alma: ${videoUrl}`);
            }
        }
    } catch (error) {
        console.error(error);
    }
}

async function getUploadsPlaylistId() {
    const url = `https://www.googleapis.com/youtube/v3/channels?id=${YOUTUBE_CHANNEL_ID}&part=contentDetails&key=${YOUTUBE_API_KEY}`;
    try {
        const response = await axios.get(url);
        return response.data.items[0].contentDetails.relatedPlaylists.uploads;
    } catch (error) {
        console.error('Error fetching uploads playlist ID:', error);
    }
}

async function getLatestVideos(uploadsPlaylistId, maxResults) {
    const url = `https://www.googleapis.com/youtube/v3/playlistItems?playlistId=${uploadsPlaylistId}&part=snippet&maxResults=${maxResults}&key=${YOUTUBE_API_KEY}`;
    try {
        const response = await axios.get(url);
        return response.data.items;  // Array of the latest videos
    } catch (error) {
        console.error('Error fetching latest videos:', error);
    }
}

module.exports = { init, checkYouTube }