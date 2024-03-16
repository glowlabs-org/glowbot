const { Events } = require('discord.js');

const GENERAL_CHANNEL_ID = '1169767222034567168'; // #general

async function sendNotification(client, message) {
    const channel = await client.channels.fetch(GENERAL_CHANNEL_ID);
    channel.send(message);
}

function setupModerationListeners(client) {

    // Threads
    client.on(Events.ThreadCreate, thread => sendNotification(client, `Moderator Note: A thread named '${thread.name}' was created.`));
    client.on(Events.ThreadDelete, thread => sendNotification(client, `Moderator Note: The thread '${thread.name}' was deleted.`));

    // Messages
    client.on(Events.MessageDelete, message => message.partial || sendNotification(client, `Moderator Note: A message was deleted in <#${message.channel.id}>.`));
    client.on(Events.MessageBulkDelete, messages => sendNotification(client, `Moderator Note: ${messages.size} messages were bulk deleted in <#${messages.first().channel.id}>.`));
    client.on(Events.MessageUpdate, (oldMessage, newMessage) => {
        if (!oldMessage.pinned && newMessage.pinned) {
            sendNotification(client, `A message was pinned in <#${newMessage.channel.id}>.`);
        } else if (oldMessage.pinned && !newMessage.pinned) {
            sendNotification(client, `A message was unpinned in <#${newMessage.channel.id}>.`);
        }
    });

    // Guild / Server
    client.on(Events.GuildUpdate, oldGuild => sendNotification(client, `Moderator Note: The server '${oldGuild.name}' was updated.`));
    client.on(Events.GuildDelete, guild => sendNotification(client, `Moderator Note: A bot was removed from server: '${guild.name}'.`));

    // Users
    client.on(Events.GuildMemberRemove, member => sendNotification(client, `Moderator Note: The member '${member.user.tag}' left or was kicked from the guild.`));
    client.on(Events.GuildBanAdd, ban => sendNotification(client, `Moderator Note: The user '${ban.user.tag}' was banned.`));
    client.on(Events.GuildBanRemove, ban => sendNotification(client, `Moderator Note: The user '${ban.user.tag}' had their ban removed.`));

    // Roles
    client.on(Events.GuildRoleCreate, () => sendNotification(client, `Moderator Note: A new role was created.`));
    client.on(Events.GuildRoleDelete, role => sendNotification(client, `Moderator Note: The role '${role.name}' was deleted.`));

    // Channels
    client.on(Events.ChannelCreate, channel => sendNotification(client, `Moderator Note: A channel named <#${channel.id}> was created.`));
    client.on(Events.ChannelDelete, channel => sendNotification(client, `Moderator Note: The channel #${channel.name} was deleted.`));
    client.on(Events.ChannelUpdate, (oldChannel, newChannel) => sendNotification(client, `Moderator Note: The channel <#${newChannel.id}> was updated.`));

    // Emojis
    client.on(Events.GuildEmojiCreate, () => sendNotification(client, `Moderator Note: A new emoji was added.`));
    client.on(Events.GuildEmojiDelete, emoji => sendNotification(client, `Moderator Note: The emoji '${emoji.name}' was deleted.`));
    client.on(Events.GuildEmojiUpdate, (oldEmoji, newEmoji) => sendNotification(client, `Moderator Note: The emoji '${newEmoji.name}' was updated.`));
}

module.exports = { setupModerationListeners }