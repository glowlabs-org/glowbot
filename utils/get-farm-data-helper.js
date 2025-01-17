const axios = require('axios');

async function getNumberOfFarms() {
  try {
    const response = await axios.get('https://glow.org/api/audits');
    const farmAudits = response.data;
    return farmAudits.length;
  } catch (error) {
    console.error('Error fetching number of farms:', error.message);
    throw error;
  }
}

module.exports = { getNumberOfFarms };