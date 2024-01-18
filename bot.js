require('dotenv').config();
const { Client, GatewayIntentBits, Events, Partials, ChannelType } = require('discord.js');
const fs = require('fs');
const path = require('path');
const axios = require('axios');

const logsDir = './discord-logs';

const logStream = fs.createWriteStream(path.join(__dirname, 'bot.log'), { flags: 'a' });

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

function logMessage(message, isError = false) {
    isError ? console.error(message) : console.log(message);
    logStream.write(`${new Date().toISOString()} - ${message}\n`);
}

function appendErrorToMessage(msg, error) {
    if (error) {
        if (error.message) {
            msg += error.message;
        }
        if (error.stack) {
            msg += ' | stack: ' + error.stack;
        }
    }
    return msg;
}

client.once('ready', () => {
    logMessage('Ready!');

    // create logs directory if it doesn't exist
    if (!fs.existsSync(logsDir)) {
        fs.mkdirSync(logsDir, { recursive: true });
    }
});

async function fetchGlowStats() {
    try {
        const priceResponse = await axios.get('https://www.glowstats.xyz/api/tokenPrice');
        const holdersResponse = await axios.get('https://www.glowstats.xyz/api/tokenHolders');
        const farmsResponse = await axios.get(`https://www.glowstats.xyz/api/farmCount`);
        const outputResponse = await axios.get('https://www.glowstats.xyz/api/weeklyOutput');
        const carbonCreditsResponse = await axios.get('https://www.glowstats.xyz/api/carbonCredits');

        const priceData = priceResponse.data;
        const holdersData = holdersResponse.data;
        const farmsData = farmsResponse.data;
        const outputData = outputResponse.data;
        const carbonCreditsData = carbonCreditsResponse.data;

        return {
            uniswapPrice: priceData.tokenPriceUniswap,
            contractPrice: priceData.tokenPriceContract / 10000,
            tokenHolders: holdersData.tokenHolderCount,
            numberOfFarms: farmsData[farmsData.length - 1].count,
            powerOutput: outputData[outputData.length - 1].output / 1000000,
            carbonCredits: carbonCreditsData.GCCSupply
        };
    } catch (error) {
        const msg = appendErrorToMessage('Error fetching glow stats: ', error)
        logMessage(msg, true)
        return null;
    }
}

client.on(Events.MessageCreate, async message => {
    if (message.content === '!stats') {
        await sendGlowStats(message)
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
        const reply = `Glow price (Uniswap): $${(stats.uniswapPrice).toFixed(4)}\n` +
            `Glow price (Contract): $${stats.contractPrice.toFixed(4)}\n` +
            `Token holders: ${stats.tokenHolders}\n` +
            `Number of farms: ${stats.numberOfFarms}\n` +
            `Power output of Glow farms (current week): ${Math.round(stats.powerOutput)} KWh\n` + 
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
            logMessage(appendErrorToMessage(`Something went wrong when fetching the message: ${error}. `, error), true);
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
                .then(() => logMessage(`Assigned role to ${user.tag}`))
                .catch(error => logMessage(appendErrorToMessage(`Error assigning role: ${error}. `, error), true));
        }
    }

});

client.login(token).catch(error => logMessage(appendErrorToMessage(`Login error: ${error}. `, error), true));
