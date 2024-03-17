const fs = require('fs');
const path = require('path');
const { Events } = require('discord.js');
const logger = require('../utils/log-util')

const dbFilePath = path.join(__dirname, '../db/moderator-activity-db.csv');

async function logModActionToFile(message) {
    fs.appendFile(dbFilePath, `${message},\n`, (error) => {
        if (error) {
            let msg = logger.appendErrorToMessage('Error adding mod activity to file. ', error);
            logger.logMessage(msg, true);
            return;
        }
    });
}

function setupModerationListeners(client) {

    // Threads
    client.on(Events.ThreadCreate, thread => logModActionToFile(`A thread named '${thread.name}' was created`));
    client.on(Events.ThreadDelete, thread => logModActionToFile(`The thread '${thread.name}' was deleted`));

    // Messages
    client.on(Events.MessageDelete, message => message.partial || logModActionToFile(`A message was deleted in ${message.channel.name}`));
    client.on(Events.MessageBulkDelete, messages => logModActionToFile(`${messages.size} messages were bulk deleted in ${messages.first().channel.name}`));
    client.on(Events.MessageUpdate, (oldMessage, newMessage) => {
        if (!oldMessage.pinned && newMessage.pinned) {
            logModActionToFile(`A message was pinned in ${newMessage.channel.name}`);
        } else if (oldMessage.pinned && !newMessage.pinned) {
            logModActionToFile(`A message was unpinned in ${newMessage.channel.name}`);
        }
    });

    // Guild / Server
    client.on(Events.GuildUpdate, oldGuild => logModActionToFile(`The server '${oldGuild.name}' was updated`));
    client.on(Events.GuildDelete, guild => logModActionToFile(`A bot was removed from server: '${guild.name}'`));

    // Users
    client.on(Events.GuildMemberRemove, member => logModActionToFile(`The member '${member.user.tag}' left or was kicked from the guild`));
    client.on(Events.GuildBanAdd, ban => logModActionToFile(`The user '${ban.user.tag}' was banned`));
    client.on(Events.GuildBanRemove, ban => logModActionToFile(`The user '${ban.user.tag}' had their ban removed`));

    // Roles
    client.on(Events.GuildRoleCreate, () => logModActionToFile(`A new role was created`));
    client.on(Events.GuildRoleDelete, role => logModActionToFile(`The role '${role.name}' was deleted`));

    // Channels
    client.on(Events.ChannelCreate, channel => logModActionToFile(`A channel named ${channel.name} was created`));
    client.on(Events.ChannelDelete, channel => logModActionToFile(`The channel #${channel.name} was deleted`));
    client.on(Events.ChannelUpdate, (oldChannel, newChannel) => logModActionToFile(`The channel ${newChannel.name} was updated`));

    // Emojis
    client.on(Events.GuildEmojiCreate, () => logModActionToFile(`A new emoji was added`));
    client.on(Events.GuildEmojiDelete, emoji => logModActionToFile(`The emoji '${emoji.name}' was deleted`));
    client.on(Events.GuildEmojiUpdate, (oldEmoji, newEmoji) => logModActionToFile(`The emoji '${newEmoji.name}' was updated`));
}

module.exports = { setupModerationListeners }