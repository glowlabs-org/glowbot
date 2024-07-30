const GENESIS_TIMESTAMP = 1700352000;

function getWeekNumber() {
  const start = new Date(GENESIS_TIMESTAMP * 1000);
  const date = new Date();
  const diff = date.getTime() - start.getTime();
  const weeks = Math.floor(diff / (1000 * 60 * 60 * 24 * 7));
  return weeks;
}

module.exports = { getWeekNumber };