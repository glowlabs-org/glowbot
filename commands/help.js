/**
 * !help — list the public Glow bot commands and what they do.
 *
 * Keep this in sync with the command handlers wired up in bot.js. Each entry is
 * `usage` (the literal command, with optional args) + a one-line description.
 */
const COMMANDS = [
  { usage: "!stats", desc: "Latest Glow network stats (price, power, carbon)." },
  { usage: "!connect", desc: "Link your Discord to your Glow wallet." },
  { usage: "!flex [@user]", desc: "Show your (or someone else's) power and vaulted GLW." },
  { usage: "!wallets @user", desc: "Show someone else's Glow stats." },
  {
    usage: "!leaderboard [metric] [@user]",
    desc: "Top 10, or a window around a user. Metrics: `vault` (default), `power`, `carbon`/`co2`.",
  },
  { usage: "!ca", desc: "Glow contract addresses." },
  { usage: "!help", desc: "Show this message." },
];

async function handleHelpCommand(message) {
  const lines = COMMANDS.map((c) => `\`${c.usage}\` — ${c.desc}`);

  await message.reply({
    embeds: [
      {
        color: 0xffd60a,
        title: "🤖 Glow bot commands",
        description: lines.join("\n"),
        footer: { text: "glow.org" },
        timestamp: new Date().toISOString(),
      },
    ],
  });
}

module.exports = { handleHelpCommand };
