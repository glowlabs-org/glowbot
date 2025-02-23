require('dotenv').config();

const { Client, GatewayIntentBits, Events, Partials, ChannelType } = require('discord.js');
const fs = require('fs');
const packageJson = require('./package.json');
const path = require('path');
const axios = require('axios');
const youtube = require('./monitors/youtube-monitor')
const blog = require('./monitors/blog-monitor')
const audit = require('./monitors/audit-monitor')
const { getTotalCarbonCredits } = require('./utils/carbon-credits-helper');
const { addresses } = require('./utils/addresses');
const logger = require('./utils/log-util');
const moderatorMonitor = require('./monitors/moderator-activity-monitor')
const { GLOW_MAIN_YOUTUBE_CHANNEL_ID, GLOW_REGEN_YOUTUBE_CHANNEL_ID, START_HERE_CHANNEL_ID, TEST_BOT_CHANNEL_ID, TRADING_CHANNEL_ID, REGEN_ROLE_ID } = require('./constants');
const { checkMessageForSpam } = require('./monitors/spam-monitor')
const { checkMessageForGreeting } = require('./monitors/gm-gn-monitor')
const { getNumberOfFarms } = require('./utils/get-farm-data-helper');
const logsDir = './discord-logs';

const monitoredChannels = {
    [START_HERE_CHANNEL_ID]: { // '#start-here' channel
        emojis: ['☀️'],
        roleId: REGEN_ROLE_ID // 'regen' role
    }
}

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

client.once('ready', async () => {

    logger.logMessage('Ready!');

    moderatorMonitor.setupModerationListeners(client);

    // create logs directory if it doesn't exist
    if (!fs.existsSync(logsDir)) {
        fs.mkdirSync(logsDir, { recursive: true });
    }

    // initialise our content monitors
    await youtube.init([GLOW_MAIN_YOUTUBE_CHANNEL_ID, GLOW_REGEN_YOUTUBE_CHANNEL_ID]);
    await blog.init();
    await audit.init();

    // initialise our global error handlers after bot has started successfully
    initGlobalErrorHandlers()

    try {

        // Check for youtube videos, audits and blog posts periodically
        setInterval(async () => {
            await youtube.checkYouTube(client);
            await blog.checkBlog(client);
            await audit.checkAudits(client);
        }, 120000); // every two minutes
    } catch (error) {
        const msg = logger.appendErrorToMessage('Error monitoring glow content: ', error)
        logger.logMessage(msg, true)
        return null;
    }
});

// Global error handlers
function initGlobalErrorHandlers() {
    process.on('unhandledRejection', (reason, promise) => {
        console.error('Unhandled Rejection at:', promise, 'reason:', reason);
    });

    process.on('uncaughtException', (err) => {
        console.error('Uncaught Exception:', err);
    });
}

async function fetchGlowStats() {
    const baseUrl = 'https://glowstats-api-production.up.railway.app/';
    const createUrl = (endpoint) => baseUrl + endpoint;

    try {
        const [
            tokenStatsResponse,
            allDataResponse,
            farmCountResponse
        ] = await Promise.all([
            axios.get(createUrl('tokenStats')),
            axios.get(createUrl('allData')),
            getNumberOfFarms()
        ]);

        const tokenStats = tokenStatsResponse?.data?.GlowMetrics || {};
        const allData = allDataResponse?.data?.farmsWeeklyMetrics || [];
        const farmCount = farmCountResponse || 0;

        if (!tokenStats.price || !allData.length) {
            throw new Error('Missing required data from API response');
        }

        return {
            uniswapPrice: tokenStats.price || 0,
            contractPrice: tokenStats.glowPriceFromContract || 0,
            tokenHolders: tokenStats.holders || 0,
            totalSupply: Math.round(tokenStats.totalSupply || 0),
            circulatingSupply: Math.round(tokenStats.circulatingSupply || 0),
            marketCap: Math.round(tokenStats.marketCap || 0),
            numberOfFarms: farmCount,
            powerOutput: allData[0]?.powerOutput || 0,
            carbonCredits: getTotalCarbonCredits(allData) || 0,
        };
    } catch (error) {
        const msg = logger.appendErrorToMessage('Error fetching glow stats: ', error);
        logger.logMessage(msg, true);
        return null;
    }
}

client.on(Events.MessageCreate, async message => {
    try {

        if (message.content === '!stats') {
            if (message.channel.type === ChannelType.DM || message.channel.id === TRADING_CHANNEL_ID || message.channel.id === TEST_BOT_CHANNEL_ID) {
                await sendGlowStats(message)
            } else {
                message.channel.send(`Checking Glow stats is only supported in the channel <#${TRADING_CHANNEL_ID}>`)
            }
        }

        if (message.content === '!ca' || message.content === '!contract' || message.content === '!contracts') {
            message.channel.send(addresses);
        }

        if (message.author.bot) return; // Ignore messages from bots

        if (message.content === '!ping') {
            message.channel.send('pong')
        }

        await checkMessageForSpam(client, message)
        await checkMessageForGreeting(client, message)

        // log all other messages to a file
        if (message.channel.type === ChannelType.DM) {
            handleDM(message)
        } else {
            handleServerMessage(message)
        }

        // hidden version checker message 
        if (message.content === '^lunaVersionCheck') {
            message.channel.send(`Current version is ${packageJson.version}`)
        }

    } catch (error) {
        const msg = logger.appendErrorToMessage('Error handling message: ', error)
        logger.logMessage(msg, true)
    }
});

function handleDM(message) {
    const logDict = formatMessageForLog(message, true);
    const filePath = path.join(logsDir, `dm_${message.channel.id}.log`);

    fs.appendFileSync(filePath, JSON.stringify(logDict) + "\n");
}

function handleServerMessage(message) {
    const logDict = formatMessageForLog(message, false);
    const serverPath = path.join(logsDir, `${message.guild.name}_${message.guild.id}`);
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
        milliseconds: message.createdTimestamp % 1000
    };
    return log;
}

async function sendGlowStats(message) {
    const TOTAL_SUPPLY = 180000000;
    const stats = await fetchGlowStats();

    if (stats) {
        const reply = "**Token stats:**\n" +
            `Glow price (Uniswap): $${(stats.uniswapPrice).toFixed(4)}\n` +
            `Glow price (Contract): $${stats.contractPrice.toFixed(4)}\n` +
            `Token holders: ${stats.tokenHolders.toLocaleString()}\n` +
            `Total supply: ${stats.totalSupply.toLocaleString()}\n` +
            `Circulating supply: ${stats.circulatingSupply.toLocaleString()}\n` +
            `Market cap: $${stats.marketCap.toLocaleString()}\n` +
            `FDV (over 6 years): $${(stats.uniswapPrice * TOTAL_SUPPLY).toLocaleString()}\n` +
            `<https://www.defined.fi/eth/0x6fa09ffc45f1ddc95c1bc192956717042f142c5d?quoteToken=token1&cache=1dafc>\n\n` +
            `**Farm stats:**\n` +
            `Number of active farms: ${stats.numberOfFarms}\n` +
            `Power output of Glow farms (current week): ${Math.round(stats.powerOutput).toLocaleString()} kWh\n` +
            `Carbon credits created (total): ${Math.round(stats.carbonCredits).toLocaleString()}`;

        message.channel.send(reply);
    } else {
        message.channel.send('Sorry, I could not fetch the stats.');
    }
}

client.on(Events.MessageReactionAdd, async (reaction, user) => {
    try {
        if (reaction.partial) {
            // If the message this reaction belongs to was removed, the fetching might result in an API error, which we need to handle
            try {
                await reaction.fetch();
            } catch (error) {
                logger.logMessage(logger.appendErrorToMessage(`Something went wrong when fetching the message: ${error}. `, error), true);
                return;
            }
        }
        const channelId = reaction.message.channel.id
        const emoji = reaction.emoji.name

        // received a 'no-prototype-builtins' warning from eslint here so calling hasOwnProperty this way to be safe
        if (Object.prototype.hasOwnProperty.call(monitoredChannels, channelId) &&
            monitoredChannels[channelId].emojis.includes(emoji)) {

            let guildMember = reaction.message.guild.members.cache.get(user.id);
            let role = reaction.message.guild.roles.cache.get(monitoredChannels[channelId].roleId);
            if (guildMember && role) {
                guildMember.roles.add(role)
                    .then(() => logger.logMessage(`Assigned role to ${user.tag}`))
                    .catch(error => logger.logMessage(logger.appendErrorToMessage(`Error assigning role: ${error}. `, error), true));
            }
        }
    } catch (error) {
        const msg = logger.appendErrorToMessage('Error assigning role: ', error)
        logger.logMessage(msg, true)
    }

});

client.login(token).catch(error => logger.logMessage(logger.appendErrorToMessage(`Login error: ${error}. `, error), true));
