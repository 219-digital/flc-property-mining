const { getCountyData } = require('../third-party/richland-county-land-commission');

async function main() {
  const countyData = await getCountyData();
}

main();
