function getTotalCarbonCredits(weeklyCarbonCredit) {
  return weeklyCarbonCredit.reduce((acc, curr) => acc + curr.carbonCredits, 0);
}

module.exports = { getTotalCarbonCredits };