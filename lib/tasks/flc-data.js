require('dotenv').config();

const _ = require('lodash');
const parseAddress = require('parse-address');
const moment = require('moment');
const numeral = require('numeral');
const { jsonArrayToCsvFile } = require('data-mining-tools');
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

    if (!parsedAddress.zip) {
      // NOTE - Not in love with setting the key here, but doing a quick fix.
      parsedAddress['zip'] = _.first(address.match(/\d{5}/));
    }

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

function applyRatios(flcs) {
  return _.map(flcs, flc => ({
    ...flc,
    distanceToFortJackson: parseFloat(flc.distanceToFortJackson),
    medianPropertyValueToPrice: parseFloat(_.get(flc, 'homeValues.median', 0)) / parseFloat(_.get(flc, 'price'))
  }));
}

function removeExtraneousColumns(flcs) {
  return _.map(flcs, flc => _.omit(flc, [
    'taxMap',
    'address.street',
    'address.type',
    'address.city',
    'address.state',
    'address.zip',
    'address.number',
    'address.prefix',
    'address.suffix'
  ]));
}

function sortForAnalysis(flcs) {
  return _.chain(flcs)
    .sortBy(['medianPropertyValueToPrice', 'distanceToFortJackson'])
    .reverse()
    .value();
}

function formatNumberIfExists(val) {
  return val || String(parseInt(val)) === 0 ? numeral(val).format('0.00') : '';
}

function formatNumericValues(flcs) {
  return _.map(flcs, (flc) => ({
    ...flc,
    price: formatNumberIfExists(flc.price),
    medianPropertyValueToPrice: formatNumberIfExists(flc.medianPropertyValueToPrice),
    homeValues: {
      ...flc.homeValues,
      median: formatNumberIfExists(_.get(flc, 'homeValues.median')),
      mean: formatNumberIfExists(_.get(flc, 'homeValues.mean')),
      min: formatNumberIfExists(_.get(flc, 'homeValues.min')),
      max: formatNumberIfExists(_.get(flc, 'homeValues.max')),
      standardDeviation: formatNumberIfExists(_.get(flc, 'homeValues.standardDeviation')),
    }
  }))
}

async function main() {
  const land = await getCountyData();
  const landWithDistance = await getDistanceToFortJackson(land);
  const landWithHomeValues = await getHomeValues(landWithDistance);
  await jsonArrayToCsvFile('tmp/output.csv', formatNumericValues(sortForAnalysis(removeExtraneousColumns(applyRatios(landWithHomeValues)))), [
    'address.raw',
    'price',
    'distanceToFortJackson',
    'medianPropertyValueToPrice',
    'homeValues.median',
    'homeValues.mean',
    'homeValues.min',
    'homeValues.max',
    'homeValues.standardDeviation'
  ]);
}

main();
