const axios = require('axios');
const cheerio = require('cheerio');
const logger = require('../utils/log-util')
const fs = require('fs');
const path = require('path');
const { EmbedBuilder } = require('discord.js');
const { GLOW_CONTENT_CHANNEL_ID } = require('./../constants')

const dbFilePath = path.join(__dirname, '../db/blog-db.json');

let pastBlogPosts = []

async function init() {
    try {

        if (fs.existsSync(dbFilePath)) {
            pastBlogPosts = JSON.parse(fs.readFileSync(dbFilePath, 'utf8'));
        } else {
            // create db folder if it doesn't exist already
            if (!fs.existsSync(path.join(__dirname, '../db'))) {
                fs.mkdirSync(path.join(__dirname, '../db'), { recursive: true });
            }

            const latestBlogs = await fetchLatestBlogPosts();
            latestBlogs.forEach(blog => pastBlogPosts.push(blog));

            fs.writeFileSync(dbFilePath, JSON.stringify(pastBlogPosts, null, 2));
        }
    } catch (error) {
        let msg = logger.appendErrorToMessage('Error on init of blog monitor. ', error);
        logger.logMessage(msg, true);
        process.exit(1); // exit here as we cannot monitor blogs without this data initialised
    }
}

async function checkBlog(client) {
    try {

        const latestBlogs = await fetchLatestBlogPosts();
        if (latestBlogs && latestBlogs.length > 0) {
            const latestBlog = latestBlogs[0]

            const isNewPost = !pastBlogPosts.some(post =>
                post.title === latestBlog.title && post.link === latestBlog.link
            );
            if (isNewPost) {
                pastBlogPosts.push(latestBlog)
                fs.writeFileSync(dbFilePath, JSON.stringify(pastBlogPosts, null, 2));

                const channel = client.channels.cache.get(GLOW_CONTENT_CHANNEL_ID);
                const embed = new EmbedBuilder()
                    .setAuthor({
                        name: `Check out the latest blog post from ${latestBlog.author}!`,
                        url: latestBlog.link
                    })
                    .setThumbnail('https://assets-global.website-files.com/652e93c47c75719bb499dcef/6553b9a5fa4a3bf0f3345ca3_favicon.png')
                    .setDescription(latestBlog.description)
                    .setTitle(latestBlog.title)
                    .setURL(latestBlog.link)
                    .setColor('#0099ff');

                channel.send({ embeds: [embed] });
            }
        }
    } catch (error) {
        let msg = logger.appendErrorToMessage('Error checking blogs. ', error);
        logger.logMessage(msg, true);
    }
}

const fetchLatestBlogPosts = async () => {
    try {
        const { data } = await axios.get('https://glowlabs.org/blog');
        const $ = cheerio.load(data);

        // This selector targets the "Latest articles" section
        const latestPosts = [];
        $('div[class="articles-featured-col-list w-dyn-items"] div[class="articles-featured-col-item w-dyn-item"]').each((index, element) => {
            const postLink = $(element).find('a').attr('href'); // assuming the first 'a' tag within the item contains the link
            const postTitle = $(element).find('h2').text(); // assuming the title is within an 'h2' tag
            // Scope the selections for author, date, and description within each post element
            const author = $(element).find('.article-blog-hero-content__date-name-wr p').first().text().trim();
            const date = $(element).find('.article-blog-hero-content__date-name-wr p').eq(2).text().trim(); // Adjust the index if needed
            const paragraphs = $(element).find('.blog-preview-item-text-wr p');
            const description = paragraphs.last().text().trim(); // Only get the last <p> tag's text

            const fullPostLink = `https://glowlabs.org${postLink}`;

            latestPosts.push({ title: postTitle, link: fullPostLink, description: description, author: author, date: date });
        });

        return latestPosts;
    } catch (error) {
        let msg = logger.appendErrorToMessage('Error fetching latest blog posts. ', error);
        logger.logMessage(msg, true);
    }
};

module.exports = { init, checkBlog }