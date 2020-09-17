require('dotenv').config();

const _ = require('lodash');
const { getCountyData } = require('../third-party/richland-county-land-commission');
const { getDistanceInMiles } = require('../third-party/google-distance-matrix');

const FORT_JACKSON_GOLF_CLUB = '3652 Semmes Rd, Columbia, SC 29207';

async function getDistanceToFortJackson(flcs, payload = []) {
  const flc = _.first(flcs);
  if (flc) {
    const from = `${flc.address} Richland County South Carolina`;

    console.log(`Retrieving distance from ${from} to ${FORT_JACKSON_GOLF_CLUB}`);

    const distanceToFortJackson = await getDistanceInMiles(from, FORT_JACKSON_GOLF_CLUB);

    return getDistanceToFortJackson(_.tail(flcs), payload.concat({
      ...flc,
      distanceToFortJackson
    }))
  } else {
    return payload;
  }
}

async function main() {
  const land = await getCountyData();
  const landWithDistance = await getDistanceToFortJackson(land);
  console.log(landWithDistance);
}

main();
