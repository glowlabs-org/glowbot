require('dotenv').config();
const { Client, GatewayIntentBits, Events, Partials, ChannelType } = require('discord.js');
const fs = require('fs');
const path = require('path');
const axios = require('axios');
const youtube = require('./monitors/youtube-monitor')
const { farmCountHelper } = require('./utils/farm-count-helper');
const { addresses } = require('./utils/addresses');
const logger = require('./utils/log-util')

const logsDir = './discord-logs';

const monitoredChannels = {
    '1126889730227843132': { // '#start-here' channel
        emojis: ['☀️'],
        roleId: '1193745444308795392' // 'regen' role
    }
}

// Create a new client instance
const client = new Client({
    intents: [
        GatewayIntentBits.DirectMessages,
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.GuildMessageReactions,
        GatewayIntentBits.MessageContent,
    ],
    partials: [Partials.Message, Partials.Channel, Partials.Reaction],
});

const token = process.env.DISCORD_BOT_TOKEN;

client.once('ready', async () => {
    logger.logMessage('Ready!');

    // create logs directory if it doesn't exist
    if (!fs.existsSync(logsDir)) {
        fs.mkdirSync(logsDir, { recursive: true });
    }

    // initialise youtube data
    await youtube.init();

    // Check for youtube videos periodically
    setInterval(async () => {
        await youtube.checkYouTube(client);
    }, 120000); // every two minutes
});

async function fetchGlowStats() {
    const baseUrl = 'https://www.glowstats.xyz/api/'; 
    const createUrl = (endpoint) => baseUrl + endpoint;

    try {
        const priceResponse = await axios.get(createUrl('tokenPrice'));
        const holdersResponse = await axios.get(createUrl('tokenHolders'));
        const farmsResponse = await axios.get(createUrl('farmData'));
        const outputResponse = await axios.get(createUrl('currentOutput'));
        const carbonCreditsResponse = await axios.get(createUrl('carbonCredits'));
        const tokenResponse = await axios.get(createUrl('glowStats'));
        
        const priceData = priceResponse.data;
        const holdersData = holdersResponse.data;
        const farmsData = farmsResponse.data;
        const outputData = outputResponse.data;
        const carbonCreditsData = carbonCreditsResponse.data;
        const tokenData = tokenResponse.data;

        return {
            uniswapPrice: priceData.tokenPriceUniswap,
            contractPrice: priceData.tokenPriceContract / 10000,
            tokenHolders: holdersData.tokenHolderCount,
            numberOfFarms: farmCountHelper(farmsData),
            powerOutput: outputData[0].value / 1000000,
            carbonCredits: carbonCreditsData.GCCSupply,
            totalSupply: Math.round(tokenData.totalSupply),
            circulatingSupply: Math.round(tokenData.circulatingSupply),
            marketCap: Math.round(tokenData.marketCap)
        };
    } catch (error) {
        const msg = logger.appendErrorToMessage('Error fetching glow stats: ', error)
        logger.logMessage(msg, true)
        return null;
    }
}

client.on(Events.MessageCreate, async message => {
    if (message.content === '!stats') {
        await sendGlowStats(message)
    }

    if (message.content === '!ca') {
        message.channel.send(addresses);
    }

    if (message.author.bot) return; // Ignore messages from bots

    if (message.content === '!ping') {
        message.channel.send('pong')
    }

    // log all other messages to a file
    if (message.channel.type === ChannelType.DM) {
        handleDM(message)
    } else {
        handleServerMessage(message)
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
    const stats = await fetchGlowStats();
    if (stats) {
        const reply = "**Token stats:**\n" +
            `Glow price (Uniswap): $${(stats.uniswapPrice).toFixed(4)}\n` +
            `Glow price (Contract): $${stats.contractPrice.toFixed(4)}\n` +
            `Token holders: ${stats.tokenHolders.toLocaleString()}\n` +
            `Total supply: ${stats.totalSupply.toLocaleString()}\n` +
            `Circulating supply: ${stats.circulatingSupply.toLocaleString()}\n` +
            `Market cap: $${stats.marketCap.toLocaleString()}\n\n` +
            `**Farm stats:**\n` +
            `Number of active farms: ${stats.numberOfFarms}\n` +
            `Power output of Glow farms (current week): ${Math.round(stats.powerOutput)} kWh\n` + 
            `Carbon credits created (real time): ${stats.carbonCredits}`;

        message.channel.send(reply);
    } else {
        message.channel.send('Sorry, I could not fetch the stats.');
    }
}

client.on(Events.MessageReactionAdd, async (reaction, user) => {
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

});

client.login(token).catch(error => logger.logMessage(logger.appendErrorToMessage(`Login error: ${error}. `, error), true));
