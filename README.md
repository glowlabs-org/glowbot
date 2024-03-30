# Glow Luna Bot
This is a Discord bot which can be used to:
 * Assign roles to users based on reactions to messages in a channel.
 * Monitor for messages requesting the current stats of Glow and send a message to the channel containing the stats.
 * Monitor YouTube channels for Glow content and update the community when new videos are posted.
 * Monitor moderator activity and log the actions to a file.
 * Log all messages sent by users in the community.

## Prereqs
You will need to have NodeJs v20.10.0 installed and NPM v10.2.3.

## Configuration
1. Create a copy of the `.env.example` file (without '.example' in the file name)
2. Populate the values in the file using the IDs from your discord channel.
   1. The bot token can be generated in the [Discord developer portal](https://discord.com/developers/applications).
   2. The YouTube token can be taken from the developers section in YouTube.

## Running the Bot
1. After following the configuration steps above and installing node, open a command window and navigate to the project root.
2. Run `npm install`
   1. This only needs to be run the first time.
3. Run `node bot.js`
4. That's it! The bot is now running.
   1. You can see any logs in the log file in the root/logs folder.
