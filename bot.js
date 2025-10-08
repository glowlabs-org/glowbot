require("dotenv").config();

const {
  Client,
  GatewayIntentBits,
  Events,
  Partials,
  ChannelType,
} = require("discord.js");
const fs = require("fs");
const packageJson = require("./package.json");
const path = require("path");
const axios = require("axios");
const youtube = require("./monitors/youtube-monitor");
const blog = require("./monitors/blog-monitor");
const audit = require("./monitors/audit-monitor");
const impact = require("./monitors/impact-monitor");
const press = require("./monitors/press-monitor");
const { getTotalCarbonCredits } = require("./utils/carbon-credits-helper");
const { addresses } = require("./utils/addresses");
const logger = require("./utils/log-util");
const { getGlowHolderCount } = require("./utils/ponder-helper");
const moderatorMonitor = require("./monitors/moderator-activity-monitor");
const {
  GLOW_MAIN_YOUTUBE_CHANNEL_ID,
  GLOW_REGEN_YOUTUBE_CHANNEL_ID,
  START_HERE_CHANNEL_ID,
  TEST_BOT_CHANNEL_ID,
  TRADING_CHANNEL_ID,
  REGEN_ROLE_ID,
  GLOW_CONTENT_CHANNEL_ID,
} = require("./constants");
const { checkMessageForSpam } = require("./monitors/spam-monitor");
const { checkMessageForGreeting } = require("./monitors/gm-gn-monitor");
const { getNumberOfFarms } = require("./utils/get-farm-data-helper");
const { fetchContractsData } = require("./utils/contracts-data-helper");
const logsDir = "./discord-logs";

const monitoredChannels = {
  [START_HERE_CHANNEL_ID]: {
    // '#start-here' channel
    emojis: ["☀️"],
    roleId: REGEN_ROLE_ID, // 'regen' role
  },
};

// Create a new client instance
const client = new Client({
  intents: [
    GatewayIntentBits.DirectMessages,
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildMessageReactions,
    GatewayIntentBits.GuildEmojisAndStickers,
    GatewayIntentBits.MessageContent,
  ],
  partials: [Partials.Message, Partials.Channel, Partials.Reaction],
});

const token = process.env.DISCORD_BOT_TOKEN;

client.once("ready", async () => {
  logger.logMessage("Ready!");

  moderatorMonitor.setupModerationListeners(client);

  // create logs directory if it doesn't exist
  if (!fs.existsSync(logsDir)) {
    fs.mkdirSync(logsDir, { recursive: true });
  }
  console.log("blog.init()");
  // initialise our content monitors
  await youtube.init([
    GLOW_MAIN_YOUTUBE_CHANNEL_ID,
    GLOW_REGEN_YOUTUBE_CHANNEL_ID,
  ]);
  await blog.init();
  await audit.init();
  await impact.init();
  await press.init();

  // initialise our global error handlers after bot has started successfully
  initGlobalErrorHandlers();

  try {
    // Check for youtube videos, audits and blog posts periodically
    setInterval(async () => {
      await youtube.checkYouTube(client);
      console.log("blog.checkBlog()");
      await blog.checkBlog(client, GLOW_CONTENT_CHANNEL_ID);
      console.log("audit.checkAudits()");
      await audit.checkAudits(client, GLOW_CONTENT_CHANNEL_ID);
      console.log("impact.checkImpact()");
      await impact.checkImpact(client, GLOW_CONTENT_CHANNEL_ID);
      console.log("press.checkPress()");
      await press.checkPress(client, GLOW_CONTENT_CHANNEL_ID);
    }, 120000); // every two minutes
  } catch (error) {
    const msg = logger.appendErrorToMessage(
      "Error monitoring glow content: ",
      error
    );
    logger.logMessage(msg, true);
    return null;
  }
});

// Global error handlers
function initGlobalErrorHandlers() {
  process.on("unhandledRejection", (reason, promise) => {
    console.error("Unhandled Rejection at:", promise, "reason:", reason);
  });

  process.on("uncaughtException", (err) => {
    console.error("Uncaught Exception:", err);
  });
}

async function fetchGlowStats() {
  const baseUrl = "https://glowstats-api-production.up.railway.app/";
  const createUrl = (endpoint) => baseUrl + endpoint;

  try {
    const [
      tokenStatsResponse,
      allDataResponse,
      farmCountResponse,
      tokenHoldersResponse,
      contractsData,
    ] = await Promise.all([
      axios.get(createUrl("tokenStats")),
      axios.get(createUrl("allData")),
      getNumberOfFarms(),
      getGlowHolderCount(),
      fetchContractsData(),
    ]);

    const tokenStats = tokenStatsResponse?.data?.GlowMetrics || {};
    const allData = allDataResponse?.data?.farmsWeeklyMetrics || [];
    const farmCount = farmCountResponse || 0;
    const tokenHolders = tokenHoldersResponse || 0;

    if (!tokenStats.price || !allData.length) {
      throw new Error("Missing required data from API response");
    }

    return {
      uniswapPrice: tokenStats.price || 0,
      contractPrice: tokenStats.glowPriceFromContract || 0,
      tokenHolders,
      totalSupply: Math.round(tokenStats.totalSupply || 0),
      circulatingSupply: Math.round(tokenStats.circulatingSupply || 0),
      marketCap: Math.round(tokenStats.marketCap || 0),
      numberOfFarms: farmCount,
      powerOutput: allData[0]?.powerOutput || 0,
      carbonCredits: getTotalCarbonCredits(allData) || 0,
      contractsData,
    };
  } catch (error) {
    const msg = logger.appendErrorToMessage(
      "Error fetching glow stats: ",
      error
    );
    logger.logMessage(msg, true);
    return null;
  }
}

function calculateLevenshteinDistance(a, b) {
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;
  const dp = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    const ai = a.charCodeAt(i - 1);
    for (let j = 1; j <= n; j++) {
      const cost = ai === b.charCodeAt(j - 1) ? 0 : 1;
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + cost
      );
    }
  }
  return dp[m][n];
}

function isStatsLikeCommand(token) {
  if (!token) return false;
  if (token[0] !== "!") return false;
  const command = token.slice(1).trim().toLowerCase();
  if (command === "stats" || command === "sta") return true;
  return calculateLevenshteinDistance(command, "stats") <= 1;
}

client.on(Events.MessageCreate, async (message) => {
  try {
    const firstToken = (message.content || "").trim().split(/\s+/)[0];
    if (isStatsLikeCommand(firstToken)) {
      if (
        message.channel.type === ChannelType.DM ||
        message.channel.id === TRADING_CHANNEL_ID ||
        message.channel.id === TEST_BOT_CHANNEL_ID
      ) {
        const cmd = firstToken.slice(1);
        const isAllCapsCommand =
          cmd && cmd === cmd.toUpperCase() && cmd !== cmd.toLowerCase();
        await sendGlowStats(message, { uppercase: isAllCapsCommand });
      } else {
        message.channel.send(
          `Checking Glow stats is only supported in the channel <#${TRADING_CHANNEL_ID}>`
        );
      }
    }

    if (
      message.content === "!ca" ||
      message.content === "!contract" ||
      message.content === "!contracts"
    ) {
      message.channel.send(addresses);
    }

    if (message.author.bot) return; // Ignore messages from bots

    if (message.content === "!ping") {
      message.channel.send("pong");
    }

    await checkMessageForSpam(client, message);
    await checkMessageForGreeting(client, message);

    // log all other messages to a file
    if (message.channel.type === ChannelType.DM) {
      handleDM(message);
    } else {
      handleServerMessage(message);
    }

    // hidden version checker message
    if (message.content === "^lunaVersionCheck") {
      message.channel.send(`Current version is ${packageJson.version}`);
    }
  } catch (error) {
    const msg = logger.appendErrorToMessage("Error handling message: ", error);
    logger.logMessage(msg, true);
  }
});

function handleDM(message) {
  const logDict = formatMessageForLog(message, true);
  const filePath = path.join(logsDir, `dm_${message.channel.id}.log`);

  fs.appendFileSync(filePath, JSON.stringify(logDict) + "\n");
}

function handleServerMessage(message) {
  const logDict = formatMessageForLog(message, false);
  const serverPath = path.join(
    logsDir,
    `${message.guild.name}_${message.guild.id}`
  );
  if (!fs.existsSync(serverPath)) {
    fs.mkdirSync(serverPath, { recursive: true });
  }
  const filePath = path.join(serverPath, `${message.channel.name}.log`);

  fs.appendFileSync(filePath, JSON.stringify(logDict) + "\n");
}

function formatMessageForLog(message, isDM) {
  const log = {
    IsDM: isDM,
    author: `${message.author.username}#${message.author.discriminator}`,
    content: message.content,
    timestamp: Math.floor(message.createdTimestamp / 1000),
    milliseconds: message.createdTimestamp % 1000,
  };
  return log;
}

async function sendGlowStats(message, options = {}) {
  const { uppercase = false } = options;
  const TOTAL_SUPPLY = 180000000;
  const stats = await fetchGlowStats();

  if (stats) {
    const lowerPrice = Math.min(stats.uniswapPrice, stats.contractPrice);

    const lines = [
      "**Token stats:**",
      `Glow price: $${lowerPrice.toFixed(4)}`,
      `Uniswap Liquidity: $$${
        stats.contractsData?.usdgLiquidityInPool?.toLocaleString(undefined, {
          maximumFractionDigits: 0,
        }) || "N/A"
      }`,
      `Token holders: ${stats.tokenHolders.toLocaleString()}`,
      `Total supply: ${stats.totalSupply.toLocaleString()}`,
      `Circulating supply: ${stats.circulatingSupply.toLocaleString()}`,
      `Market cap: $${stats.marketCap.toLocaleString()}`,
      `FDV (over 6 years): $${(lowerPrice * TOTAL_SUPPLY).toLocaleString()}`,
      `<https://www.defined.fi/eth/0x6fa09ffc45f1ddc95c1bc192956717042f142c5d?quoteToken=token1&cache=1dafc>`,
      "",
      "**Farm stats:**",
      `Number of active farms: ${stats.numberOfFarms}`,
      `Power output of Glow farms (current week): ${Math.round(
        stats.powerOutput
      ).toLocaleString()} kWh`,
      `Carbon credits created (total): ${Math.round(
        stats.carbonCredits
      ).toLocaleString()}`,
    ];

    const processed = uppercase
      ? lines
          .map((line) =>
            /https?:\/\//i.test(line) ? line : line.toUpperCase()
          )
          .join("\n")
      : lines.join("\n");

    message.channel.send(processed);
  } else {
    message.channel.send("Sorry, I could not fetch the stats.");
  }
}

client.on(Events.MessageReactionAdd, async (reaction, user) => {
  try {
    if (reaction.partial) {
      // If the message this reaction belongs to was removed, the fetching might result in an API error, which we need to handle
      try {
        await reaction.fetch();
      } catch (error) {
        logger.logMessage(
          logger.appendErrorToMessage(
            `Something went wrong when fetching the message: ${error}. `,
            error
          ),
          true
        );
        return;
      }
    }
    const channelId = reaction.message.channel.id;
    const emoji = reaction.emoji.name;

    // received a 'no-prototype-builtins' warning from eslint here so calling hasOwnProperty this way to be safe
    if (
      Object.prototype.hasOwnProperty.call(monitoredChannels, channelId) &&
      monitoredChannels[channelId].emojis.includes(emoji)
    ) {
      let guildMember = reaction.message.guild.members.cache.get(user.id);
      let role = reaction.message.guild.roles.cache.get(
        monitoredChannels[channelId].roleId
      );
      if (guildMember && role) {
        guildMember.roles
          .add(role)
          .then(() => logger.logMessage(`Assigned role to ${user.tag}`))
          .catch((error) =>
            logger.logMessage(
              logger.appendErrorToMessage(
                `Error assigning role: ${error}. `,
                error
              ),
              true
            )
          );
      }
    }
  } catch (error) {
    const msg = logger.appendErrorToMessage("Error assigning role: ", error);
    logger.logMessage(msg, true);
  }
});

client
  .login(token)
  .catch((error) =>
    logger.logMessage(
      logger.appendErrorToMessage(`Login error: ${error}. `, error),
      true
    )
  );
