const axios = require("axios");
const logger = require("./log-util");

/**
 * Retrieves the current number of token holders for Glow token
 * by querying the Ponder GraphQL endpoint.
 *
 * @returns {Promise<number>} The holder count or 0 if an error occurs.
 */
async function getGlowHolderCount() {
  const url =
    "https://glow-ponder-listener-2-production.up.railway.app/graphql";
  const query = {
    query: '{ glowBalancess(where: { balance_gt: "0" }) { totalCount } }',
  };

  try {
    const { data } = await axios.post(url, query, {
      headers: {
        "Content-Type": "application/json",
      },
    });

    if (data && data.data && data.data.glowBalancess) {
      const count = parseInt(data.data.glowBalancess.totalCount, 10);
      return Number.isNaN(count) ? 0 : count;
    }

    logger.logMessage(
      `Unexpected response fetching Glow holder count: ${JSON.stringify(data)}`,
      true
    );
    return 0;
  } catch (error) {
    logger.logMessage(
      logger.appendErrorToMessage("Error fetching Glow holder count: ", error),
      true
    );
    return 0;
  }
}

module.exports = { getGlowHolderCount };
