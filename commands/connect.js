const logger = require("../utils/log-util");

// Frontend page where the user connects wallet -> Discord OAuth -> sign-to-bind.
// Staging: set GLOW_CONNECT_URL to the staging frontend's /connect.
const CONNECT_URL = (
  process.env.GLOW_CONNECT_URL || "https://app.glow.org/connect"
).replace(/\/$/, "");

/**
 * !connect — DM the caller a link to bind their Discord to their Glow wallet.
 * The actual binding (OAuth + EIP-712 sign-to-bind) happens on the web page.
 */
async function handleConnectCommand(message) {
  const userName =
    message.author.globalName || message.author.username || "there";

  const embed = {
    color: 0x5865f2,
    title: "Link your Glow wallet",
    description:
      `Hey ${userName} — connect your Discord to your Glow wallet so you can ` +
      "`!flex` your watts and actively-delegated GLW.\n\n" +
      `**[→ Open the link page](${CONNECT_URL})**\n\n` +
      "You'll connect your wallet, authorize Discord (we only read your ID), " +
      "and sign one free message to prove ownership. Then come back and run " +
      "`!flex`.",
    timestamp: new Date().toISOString(),
  };

  try {
    await message.author.send({ embeds: [embed] });
    // If the command came from a server channel, nudge them to check DMs.
    if (message.guild) {
      await message
        .reply("📬 Sent you a DM with your wallet-linking link.")
        .catch(() => {});
    }
  } catch (err) {
    // DMs are closed — fall back to an in-place reply with the bare link.
    await message
      .reply(`Connect your wallet here: ${CONNECT_URL}`)
      .catch(() => {});
    logger.logMessage(
      logger.appendErrorToMessage("!connect DM failed: ", err),
      true
    );
  }
}

module.exports = { handleConnectCommand };
