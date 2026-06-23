const logger = require("../utils/log-util");

/**
 * Resolve a !command argument to a Discord user: a mention, a raw id, or a
 * username / display-name search within the guild. Returns { id, name } or null.
 *
 * Shared by !wallets, !flex and !leaderboard. Kept in its own module so the
 * command handlers can reuse it without a circular require (wallets/leaderboard
 * already depend on flex).
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

module.exports = { resolveTargetUser };
