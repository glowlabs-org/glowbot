# Glow Discord Role Bot
This is a basic Discord bot which can be used to assign roles to users based on reactions to messages in a channel.

## Prereqs
You will need to have NodeJs v20.10.0 installed and NPM v10.2.3.

## Configuration
1. Create a copy of the `.env.example` file (without '.example' in the file name)
2. Populate the values in the file using the IDs from your discord channel.
   1. The id of the channel can be found by right-clicking on the channel and choosing `Copy Channel ID`
   2. The id of the role can be found by opening `Server Settings`, going to the `Roles` section and clicking `Copy Role Id` in the three dot menu for the role.
   3. The bot token can be generated in the [Discord developer portal](https://discord.com/developers/applications).

## Running the Bot
1. After following the configuration steps above and installing node, open a command window and navigate to the project root.
2. Run `npm install`
   1. This only needs to be run the first time.
3. Run `node role-bot.js`
4. That's it! The bot is now running and should assign your role to users which react to messages in the channel you configured.
   1. You can see any logs in the log file in the project root.
