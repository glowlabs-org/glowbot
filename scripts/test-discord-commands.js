/**
 * test-discord-commands.js — exercise every Discord <-> Glow command end to end
 * WITHOUT a running bot or Discord gateway.
 *
 * It drives the REAL command handlers (commands/connect, flex, wallets,
 * leaderboard) with a mock `message` object that captures whatever the handler
 * would reply / DM, then renders it to the terminal exactly as Discord would
 * lay out the embed. So it tests the true bot data path (same axios calls, same
 * x-api-key, same embed builders), just with the network reply mocked.
 *
 * Usage:
 *   # key comes from the environment (never committed); base defaults to staging
 *   DISCORD_BOT_API_KEY=xxxxx node scripts/test-discord-commands.js [discordId] [otherDiscordId]
 *
 *   # hit a different CRM (e.g. prod) instead of staging
 *   DISCORD_BOT_API_KEY=xxxxx node scripts/test-discord-commands.js --base https://gca-crm-backend-production-1f2a.up.railway.app
 *
 * Args:
 *   discordId        the account to !flex / !leaderboard-around   (default: 589137060825399317)
 *   otherDiscordId   the account to !wallets                       (default: same as discordId)
 *   --base <url>     CRM base URL                                  (default: staging)
 */

// Load the bot's own .env regardless of the current working directory, so the
// harness can be run from anywhere (it does not depend on $PWD == glowbot root).
require("dotenv").config({
  path: require("path").join(__dirname, "..", ".env"),
});

const argv = process.argv.slice(2);
const baseIdx = argv.indexOf("--base");
const base =
  (baseIdx >= 0 && argv[baseIdx + 1]) ||
  process.env.TEST_CRM_BASE ||
  "https://gca-crm-backend-staging.up.railway.app";

// Force the CRM base BEFORE requiring the command modules — they read
// GCA_SERVER_URL once at import time to compute CRM_BASE.
process.env.GCA_SERVER_URL = base;
// A connect URL so the !connect embed renders a real link in the preview.
process.env.GLOW_CONNECT_URL =
  process.env.GLOW_CONNECT_URL || "https://glow.org/connect";

const positional = argv.filter((a, i) => a !== "--base" && argv[i - 1] !== "--base");
const SELF_ID = positional[0] || "589137060825399317";
const OTHER_ID = positional[1] || SELF_ID;

const { handleConnectCommand } = require("../commands/connect");
const { handleFlexCommand } = require("../commands/flex");
const { handleWalletsCommand } = require("../commands/wallets");
const { handleLeaderboardCommand } = require("../commands/leaderboard");

// ---- terminal rendering -----------------------------------------------------

const DIM = "\x1b[2m";
const BOLD = "\x1b[1m";
const YELLOW = "\x1b[33m";
const CYAN = "\x1b[36m";
const RESET = "\x1b[0m";

// Render a captured reply/DM payload the way Discord would draw it.
function renderPayload({ kind, payload }) {
  const tag =
    kind === "dm" ? `${CYAN}[DM to user]${RESET}` : `${DIM}[reply]${RESET}`;
  if (typeof payload === "string") {
    console.log(`  ${tag} ${payload}`);
    return;
  }
  if (payload && Array.isArray(payload.embeds)) {
    for (const e of payload.embeds) {
      console.log(`  ${tag} ${YELLOW}┌─ embed ─────────────────────${RESET}`);
      if (e.title) console.log(`  ${YELLOW}│${RESET} ${BOLD}${e.title}${RESET}`);
      if (e.description) {
        for (const line of String(e.description).split("\n")) {
          console.log(`  ${YELLOW}│${RESET} ${line}`);
        }
      }
      if (e.footer && e.footer.text) {
        console.log(`  ${YELLOW}│${RESET} ${DIM}${e.footer.text}${RESET}`);
      }
      console.log(`  ${YELLOW}└─────────────────────────────${RESET}`);
    }
    return;
  }
  console.log(`  ${tag} ${JSON.stringify(payload)}`);
}

// ---- mock Discord message ---------------------------------------------------

// A minimal stand-in for a discord.js Message. Captures reply()/author.send()
// and resolves guild member lookups (used by !wallets / !leaderboard) to a
// synthetic member so the handler's real resolution path runs.
function makeMockMessage({ content, authorId, authorName }) {
  const sent = [];
  const capture = (kind) => (payload) => {
    sent.push({ kind, payload });
    return Promise.resolve({ id: "mock-message" });
  };
  const memberFor = (id) => ({
    id,
    displayName: authorName,
    user: { id, username: authorName },
  });

  return {
    content,
    author: {
      id: authorId,
      username: authorName,
      globalName: authorName,
      send: capture("dm"),
    },
    // No real mentions in this harness; args are passed as raw snowflakes.
    mentions: { users: { first: () => undefined, size: 0 } },
    guild: {
      members: {
        // raw-id fetch -> a member; query-object fetch -> a collection with .first()
        fetch: async (q) => {
          if (typeof q === "string") return memberFor(q);
          const col = new Map([[authorId, memberFor(authorId)]]);
          col.first = () => memberFor(authorId);
          return col;
        },
      },
    },
    reply: capture("reply"),
    _sent: sent,
  };
}

async function run(title, { content, authorId, authorName }, handler) {
  console.log(`\n${BOLD}▶ ${title}${RESET}`);
  console.log(`  ${DIM}message.content = "${content}"${RESET}`);
  const msg = makeMockMessage({ content, authorId, authorName });
  try {
    await handler(msg);
  } catch (err) {
    console.log(`  ${"\x1b[31m"}handler threw:${RESET} ${err.message}`);
  }
  if (msg._sent.length === 0) {
    console.log(`  ${DIM}(no reply captured)${RESET}`);
  } else {
    msg._sent.forEach(renderPayload);
  }
}

async function main() {
  console.log(`${BOLD}Discord command test harness${RESET}`);
  console.log(`  CRM base : ${base}`);
  console.log(`  bot key  : ${process.env.DISCORD_BOT_API_KEY ? "set" : "NOT SET (key-gated commands will 401)"}`);
  console.log(`  self id  : ${SELF_ID}`);
  console.log(`  other id : ${OTHER_ID}`);

  const self = { authorId: SELF_ID, authorName: "you" };

  await run("!connect", { ...self, content: "!connect" }, handleConnectCommand);
  await run("!flex", { ...self, content: "!flex" }, handleFlexCommand);
  await run(
    "!wallets <id>",
    { ...self, content: `!wallets ${OTHER_ID}` },
    handleWalletsCommand
  );
  await run(
    "!leaderboard (top 10, Vault)",
    { ...self, content: "!leaderboard" },
    handleLeaderboardCommand
  );
  await run(
    "!leaderboard watts (top 10, Power)",
    { ...self, content: "!leaderboard watts" },
    handleLeaderboardCommand
  );
  await run(
    "!leaderboard carbon (top 10, Carbon)",
    { ...self, content: "!leaderboard carbon" },
    handleLeaderboardCommand
  );
  await run(
    "!leaderboard <id> (window around you, Vault)",
    { ...self, content: `!leaderboard ${SELF_ID}` },
    handleLeaderboardCommand
  );

  console.log(`\n${BOLD}Done.${RESET}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
