const logger = require("../utils/log-util");
const { fetchFlex, buildFlexEmbed } = require("./flex");

/**
 * Resolve a !command argument to a Discord user: a mention, a raw id, or a
 * username / display-name search within the guild. Returns { id, name } or null.
 */
async function resolveTargetUser(message, arg) {
  const mentioned = message.mentions?.users?.first();
  if (mentioned) {
    return { id: mentioned.id, name: mentioned.globalName || mentioned.username };
  }

  const cleaned = (arg || "").trim();
  if (!cleaned) return null;

  // Raw snowflake id.
  if (/^\d{15,25}$/.test(cleaned) && message.guild) {
    try {
      const m = await message.guild.members.fetch(cleaned);
      if (m) return { id: m.id, name: m.displayName || m.user.username };
    } catch {
      /* fall through to name search */
    }
  }

  // Username / display-name search.
  if (message.guild) {
    try {
      const members = await message.guild.members.fetch({
        query: cleaned,
        limit: 1,
      });
      const m = members?.first?.();
      if (m) return { id: m.id, name: m.displayName || m.user.username };
    } catch (err) {
      logger.logMessage(
        logger.appendErrorToMessage("resolveTargetUser search failed: ", err),
        true
      );
    }
  }

  return null;
}

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

module.exports = { handleWalletsCommand, resolveTargetUser };
