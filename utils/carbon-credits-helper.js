function getTotalCarbonCredits(weeklyCarbonCredit) {
  return weeklyCarbonCredit.reduce((acc, curr) => acc + curr.value, 0);
}

module.exports = { getTotalCarbonCredits };