const logger = require("../utils/log-util");
const { fetchFlex, buildFlexEmbed } = require("./flex");
const { resolveTargetUser } = require("./resolve-user");

/**
 * !wallets <@user | username> — flex someone else's aggregated Glow stats by
 * resolving their Discord account.
 */
async function handleWalletsCommand(message) {
  const arg = message.content.trim().split(/\s+/).slice(1).join(" ");
  if (!arg && !message.mentions?.users?.size) {
    await message.reply(
      "Usage: `!wallets @user` (or a username) to flex someone else's Glow stats."
    );
    return;
  }

  try {
    const target = await resolveTargetUser(message, arg);
    if (!target) {
      await message.reply(`Couldn't find a Discord user matching "${arg}".`);
      return;
    }

    const data = await fetchFlex(target.id);
    if (!data.linked) {
      await message.reply(`**${target.name}** hasn't linked a Glow wallet yet.`);
      return;
    }

    await message.reply({ embeds: [buildFlexEmbed(target.name, data)] });
  } catch (err) {
    logger.logMessage(
      logger.appendErrorToMessage("!wallets error: ", err),
      true
    );
    await message
      .reply("Couldn't fetch those stats right now — try again in a bit.")
      .catch(() => {});
  }
}

module.exports = { handleWalletsCommand };
