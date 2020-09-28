require('dotenv').config();

const _ = require('lodash');
const parseAddress = require('parse-address');
const moment = require('moment');
const { getCountyData } = require('../third-party/richland-county-land-commission');
const { getDistanceInMiles } = require('../third-party/google-distance-matrix');
const { getHomeSalesForZip } = require('../third-party/quandl');

const FORT_JACKSON_GOLF_CLUB = '3652 Semmes Rd, Columbia, SC 29207';

async function getDistanceToFortJackson(flcs, payload = []) {
  const flc = _.first(flcs);
  if (flc) {
    const from = `${flc.address} Richland County South Carolina`;

    console.log(`Retrieving distance from ${from} to ${FORT_JACKSON_GOLF_CLUB}`);

    const { distance: distanceToFortJackson, address } = await getDistanceInMiles(from, FORT_JACKSON_GOLF_CLUB);

    const parsedAddress = parseAddress.parseLocation(address);

    return getDistanceToFortJackson(_.tail(flcs), payload.concat({
      ...flc,
      distanceToFortJackson,
      address: {
        raw: address,
        ...parsedAddress
      }
    }))
  } else {
    return payload;
  }
}

async function getHomeValues(flcs, payload = []) {
  const flc = _.first(flcs);
  if (flc) {
    const zip = _.get(flc, 'address.zip');
    if (zip) {
      const homeValues = await getHomeSalesForZip({
        zip,
        threshold: moment().subtract(3, 'years')
      });
      return getHomeValues(_.tail(flcs), payload.concat({
        ...flc,
        homeValues: _.omit(homeValues, 'series')
      }));
    } else {
      return getHomeValues(_.tail(flcs), payload.concat({
        ...flc,
        homeValues: {}
      }));
    }
  } else {
    return payload;
  }
}

async function main() {
  const land = await getCountyData();
  const landWithDistance = await getDistanceToFortJackson(land);
  const landWithHomeValues = await getHomeValues(landWithDistance);
  console.log(landWithHomeValues);
}

main();
