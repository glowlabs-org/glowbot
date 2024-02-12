function farmCountHelper(farmData) {
  let count = 0;
  for (let farm in farmData) {
    if (farmData[farm].totalOutput > 0) {
      count++;
    }
  }
  return count;
}

module.exports = { farmCountHelper };