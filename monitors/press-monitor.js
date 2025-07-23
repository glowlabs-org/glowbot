const axios = require("axios");
const logger = require("../utils/log-util");
const fs = require("fs");
const path = require("path");
const fileUtil = require("../utils/file-util");
const { EmbedBuilder } = require("discord.js");

const dbFilePath = path.join(__dirname, "../db/press-db-v2.json");

let pastPressPosts = [];

async function init() {
  try {
    pastPressPosts = await fileUtil.getFileData(dbFilePath);

    // Initialize with existing press posts if database is empty
    if (!pastPressPosts || pastPressPosts.length === 0) {
      let latestPress = await fetchLatestPressPosts();
      if (latestPress && latestPress.length > 0) {
        latestPress = latestPress.filter(
          (post) => post.date && post.title && post.href
        );

        latestPress.forEach((press) => {
          pastPressPosts.push({
            href: press.href,
            title: press.title,
            media: press.media || "Unknown",
            date: press.date,
            excerpt: press.excerpt || "",
            tags: press.tags || [],
            image: press.image,
            isTwitter: press.isTwitter || false,
            featured: press.featured || false,
          });
        });

        fs.writeFileSync(dbFilePath, JSON.stringify(pastPressPosts, null, 2));
        console.log(
          `Initialized press database with ${pastPressPosts.length} existing posts`
        );
      }
    }
  } catch (error) {
    let msg = logger.appendErrorToMessage(
      "Error on init of press monitor. ",
      error
    );
    logger.logMessage(msg, true);
    process.exit(1);
  }
}

async function checkPress(client, channelId) {
  try {
    let latestPress = await fetchLatestPressPosts();
    if (latestPress && latestPress.length > 0) {
      latestPress = latestPress.filter(
        (post) => post.date && post.title && post.href
      );
      latestPress.sort((a, b) => new Date(a.date) - new Date(b.date));
      const pastHrefs = new Set(pastPressPosts.map((p) => p.href));
      const newPosts = [];
      for (const press of latestPress) {
        if (!pastHrefs.has(press.href)) {
          const newPost = {
            href: press.href,
            title: press.title,
            media: press.media || "Unknown",
            date: press.date,
            excerpt: press.excerpt || "",
            tags: press.tags || [],
            image: press.image,
            isTwitter: press.isTwitter || false,
            featured: press.featured || false,
          };
          pastPressPosts.push(newPost);
          newPosts.push(newPost);
        }
      }
      console.log("newPressPosts", newPosts);
      if (newPosts.length > 0) {
        fs.writeFileSync(dbFilePath, JSON.stringify(pastPressPosts, null, 2));
        const channel = client.channels.cache.get(channelId);
        for (const np of newPosts) {
          let embedUrl = np.href;

          // Convert X.com/twitter.com links to fxtwitter.com for better Discord previews
          if (
            np.isTwitter &&
            (np.href.includes("x.com") || np.href.includes("twitter.com"))
          ) {
            embedUrl = np.href
              .replace("x.com", "fxtwitter.com")
              .replace("twitter.com", "fxtwitter.com");
          }

          const embed = new EmbedBuilder()
            .setTitle(np.title)
            .setURL(embedUrl)
            .setColor(np.isTwitter ? "#1DA1F2" : "#0099ff")
            .setTimestamp(new Date(np.date));

          if (np.isTwitter) {
            embed
              .setAuthor({
                name: `🐦 ${np.media}`,
                url: embedUrl,
                iconURL:
                  "https://abs.twimg.com/icons/apple-touch-icon-192x192.png",
              })
              .setDescription(
                `${np.excerpt}\n\n[View on Twitter →](${embedUrl})`
              )
              .setFooter({
                text: `Twitter • ${np.tags.join(" • ") || ""} • ${np.date}`,
              });
          } else {
            embed
              .setAuthor({
                name: `📰 ${np.media}`,
                url: np.href,
              })
              .setDescription(np.excerpt)
              .setFooter({
                text: `${np.tags.join(" • ") || ""} • Published on ${np.date}`,
              });
          }

          if (np.image) {
            const imageUrl = np.image.startsWith("http")
              ? np.image
              : `https://glow.org${np.image}`;
            embed.setImage(imageUrl);
          } else if (!np.isTwitter) {
            embed.setThumbnail(
              "https://glow.org/_next/image?url=%2Fimages%2Fbranding.jpg&w=3840&q=75"
            );
          }

          // Send the embed first, then the raw link for Twitter posts to get native preview
          await channel.send({ embeds: [embed] });

          if (np.isTwitter) {
            await channel.send(embedUrl);
          }
        }
      }
    }
  } catch (error) {
    let msg = logger.appendErrorToMessage("Error checking press. ", error);
    logger.logMessage(msg, true);
  }
}

const fetchLatestPressPosts = async () => {
  try {
    const response = await axios.get("https://glow.org/api/press");
    return response.data;
  } catch (error) {
    let msg = logger.appendErrorToMessage(
      "Error fetching latest press posts. ",
      error
    );
    logger.logMessage(msg, true);
    return [];
  }
};

module.exports = { init, checkPress };
