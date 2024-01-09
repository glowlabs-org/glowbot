require('dotenv').config();
const { Client, GatewayIntentBits, Events, Partials } = require('discord.js');
const fs = require('fs');
const path = require('path');
const axios = require('axios');
const { log } = require('console');

const logStream = fs.createWriteStream(path.join(__dirname, 'bot.log'), { flags: 'a' });

// Create a new client instance
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.GuildMessageReactions,
        GatewayIntentBits.MessageContent,
    ],
    partials: [Partials.Message, Partials.Channel, Partials.Reaction],
});

const token = process.env.DISCORD_BOT_TOKEN;

const monitoredChannelID = process.env.DISCORD_CHANNEL_ID;

const roleID = process.env.DISCORD_ROLE_ID;

const logTypes = {
    INFO: 'INFO',
    ERROR: 'ERROR',
    WARN: 'WARN',
    DEBUG: 'DEBUG',
};

function logMessage(message, type = logTypes.INFO) {
    if (!Object.values(logTypes).includes(type)) {
        throw new Error('Invalid log type');
    }

    const timestamp = new Date().toISOString();
    const formattedMessage = `${timestamp} - ${type}: ${message}\n`;

    console.log(formattedMessage);
    logStream.write(formattedMessage);

    // Log stack trace for errors
    if (type === logTypes.ERROR && message instanceof Error && message.stack) {
        console.error(message.stack);
        logStream.write(`${timestamp} - ERROR STACK: ${message.stack}\n`);
    }
}

client.once('ready', () => {
    logMessage('Ready!');
});

async function fetchGlowStats() {
    try {
        const priceResponse = await axios.get('https://www.glowstats.xyz/api/tokenPrice');
        const holdersResponse = await axios.get('https://www.glowstats.xyz/api/tokenHolders');
        const farmsResponse = await axios.get(`https://www.glowstats.xyz/api/farmCount`);
        const outputResponse = await axios.get('https://www.glowstats.xyz/api/weeklyOutput');

        const priceData = priceResponse.data;
        const holdersData = holdersResponse.data;
        const farmsData = farmsResponse.data;
        const outputData = outputResponse.data;

        return {
            uniswapPrice: priceData.tokenPriceUniswap,
            contractPrice: priceData.tokenPriceContract / 10000,
            tokenHolders: holdersData.tokenHolderCount,
            numberOfFarms: farmsData[farmsData.length-1].count,
            powerOutput: outputData[outputData.length - 1].output / 1000000
        };
    } catch (error) {
        logMessage(`Something went wrong while fetching Glow stats: ${error}`, logTypes.ERROR);
        return null;
    }
}

client.on(Events.MessageCreate, async message => {
    if (message.content === '$stats') {
        const stats = await fetchGlowStats();
        if (stats) {
            const reply = `Glow price (Uniswap): $${(stats.uniswapPrice).toFixed(4)}\n` +
                          `Glow price (Contract): $${stats.contractPrice.toFixed(4)}\n` +
                          `Token holders: ${stats.tokenHolders}\n` +
                          `Number of farms: ${stats.numberOfFarms}\n` +
                          `Power output of Glow farms (last week): ${Math.round(stats.powerOutput)} KWh`;
            message.channel.send(reply);
        } else {
            message.channel.send('Sorry, I could not fetch the stats.');
        }
    }
});


client.on('messageReactionAdd', async (reaction, user) => {
    if (reaction.partial) {
        // If the message this reaction belongs to was removed, the fetching might result in an API error, which we need to handle
        try {
            await reaction.fetch();
        } catch (error) {
            logMessage(`Something went wrong when fetching the message: ${error}`);
            return;
        }
    }

    if (reaction.message.channel.id === monitoredChannelID) {
        let guildMember = reaction.message.guild.members.cache.get(user.id);
        let role = reaction.message.guild.roles.cache.get(roleID);
        if (guildMember && role) {
            guildMember.roles.add(role)
                .then(() => logMessage(`Assigned role to ${user.tag}`))
                .catch(error => logMessage(`Error assigning role: ${error}`));
        }
    }

});

client.login(token).catch(error => logMessage(`Login error: ${error}`));