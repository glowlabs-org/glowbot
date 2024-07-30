require('dotenv').config();
const { getWeekNumber } = require('./get-week-number-helper');
const axios = require('axios');

const FARM_STATS_URL = process.env.FARM_STATS_URL;
const GCA_SERVER_URL= process.env.GCA_SERVER_URL;

async function getNumberOfFarms() {
  const url = FARM_STATS_URL;
  const data = {
    urls: [GCA_SERVER_URL],
    week_number: getWeekNumber(),
  };

  try {
    const response = await axios.post(url, data);
    return response.data;
  } catch (error) {
    console.error('Error fetching number of farms:', error.message);
    throw error;
  }
}

module.exports = { getNumberOfFarms };