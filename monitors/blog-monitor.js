const axios = require("axios");
const logger = require("../utils/log-util");
const fs = require("fs");
const path = require("path");
const fileUtil = require("../utils/file-util");
const { EmbedBuilder } = require("discord.js");
const { TEST_BOT_CHANNEL_ID } = require("./../constants");

const dbFilePath = path.join(__dirname, "../db/blog-db-v2-test.json");

let pastBlogPosts = [];

async function init() {
  try {
    pastBlogPosts = await fileUtil.getFileData(dbFilePath);

    // if (!pastBlogPosts || pastBlogPosts.length == 0) {
    //   let latestBlogs = await fetchLatestBlogPosts();
    //   latestBlogs = latestBlogs.filter((post) => !post.hidden);
    //   latestBlogs.forEach((blog) =>
    //     pastBlogPosts.push({
    //       slug: blog.slug,
    //       title: blog.title,
    //       link: `https://glow.org/blog/${blog.slug}`,
    //       description: blog.description,
    //       author: blog.author?.name || "Unknown",
    //       date: blog.publishedAt,
    //       image: blog.image,
    //     })
    //   );

    //   fs.writeFileSync(dbFilePath, JSON.stringify(pastBlogPosts, null, 2));
    // }
  } catch (error) {
    let msg = logger.appendErrorToMessage(
      "Error on init of blog monitor. ",
      error
    );
    logger.logMessage(msg, true);
    process.exit(1); // exit here as we cannot monitor blogs without this data initialised
  }
}

async function checkBlog(client) {
  try {
    let latestBlogs = await fetchLatestBlogPosts();
    if (latestBlogs && latestBlogs.length > 0) {
      latestBlogs = latestBlogs.filter(
        (post) => !post.hidden && post.publishedAt && post.title && post.slug
      );
      latestBlogs.sort(
        (a, b) => new Date(a.publishedAt) - new Date(b.publishedAt)
      );
      const pastSlugs = new Set(pastBlogPosts.map((p) => p.slug));
      const newPosts = [];
      for (const blog of latestBlogs) {
        if (!pastSlugs.has(blog.slug)) {
          const newPost = {
            slug: blog.slug,
            title: blog.title,
            link: `https://glow.org/blog/${blog.slug}`,
            description: blog.description || "",
            author: blog.author?.name || "Unknown",
            date: blog.publishedAt,
            image: blog.image,
          };
          pastBlogPosts.push(newPost);
          newPosts.push({
            ...newPost,
            category: blog.category,
            readTime: blog.readTime,
            avatar: blog.author?.avatar,
          });
        }
      }
      console.log("newPosts", newPosts);
      if (newPosts.length > 0) {
        fs.writeFileSync(dbFilePath, JSON.stringify(pastBlogPosts, null, 2));
        const channel = client.channels.cache.get(TEST_BOT_CHANNEL_ID);
        for (const np of newPosts) {
          const embed = new EmbedBuilder()
            .setAuthor({
              name: `Check out the new blog post from ${np.author}!`,
              url: np.link,
              iconURL: np.avatar
                ? `https://glow.org/_next/image?url=${encodeURIComponent(
                    np.avatar
                  )}&w=96&q=75`
                : undefined,
            })
            .setDescription(np.description)
            .setTitle(np.title)
            .setURL(np.link)
            .setColor("#0099ff")
            .setFooter({
              text: `${np.category || ""} • ${
                np.readTime || ""
              } • Published on ${np.date}`,
            });
          if (np.image) {
            const imageUrl = `https://glow.org/_next/image?url=${encodeURIComponent(
              np.image
            )}&w=3840&q=75`;
            embed.setImage(imageUrl);
          } else {
            embed.setThumbnail(
              "https://glow.org/_next/image?url=%2Fimages%2Fbranding.jpg&w=3840&q=75"
            );
          }

          channel.send({ embeds: [embed] });
        }
      }
    }
  } catch (error) {
    let msg = logger.appendErrorToMessage("Error checking blogs. ", error);
    logger.logMessage(msg, true);
  }
}

const fetchLatestBlogPosts = async () => {
  try {
    const response = await axios.get("https://glow.org/api/blog");
    return response.data;
  } catch (error) {
    let msg = logger.appendErrorToMessage(
      "Error fetching latest blog posts. ",
      error
    );
    logger.logMessage(msg, true);
    return [];
  }
};

module.exports = { init, checkBlog };
