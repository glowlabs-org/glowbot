require('dotenv').config();
const { Client, GatewayIntentBits, Partials } = require('discord.js');
const fs = require('fs');
const path = require('path');

const logStream = fs.createWriteStream(path.join(__dirname, 'bot.log'), { flags: 'a' });

// Create a new client instance
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.GuildMessageReactions,
    ],
    partials: [Partials.Message, Partials.Channel, Partials.Reaction],
});

const token = process.env.DISCORD_BOT_TOKEN;

const monitoredChannelID = process.env.DISCORD_CHANNEL_ID;

const roleID = process.env.DISCORD_ROLE_ID;

function logMessage(message) {
    console.log(message);
    logStream.write(`${new Date().toISOString()} - ${message}\n`);
}

client.once('ready', () => {
    logMessage('Ready!');
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