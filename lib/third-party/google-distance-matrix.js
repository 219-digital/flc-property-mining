const axios = require('axios');
const convertUnits = require('convert-units');
const { randomTimeout } = require('data-mining-tools');
const fs = require('fs-extra');
const { simpleCache, defaultFileNameGenerator } = require('localism');
const _ = require('lodash');
const path = require('path');
const qs = require('qs');
const numeral = require('numeral');

const GOOGLE_DISTANCE_MATRIX_URL = 'https://maps.googleapis.com/maps/api/distancematrix/json';
const CACHE_DIRECTORY_PATH = 'tmp/cache/google-distance-matrix';

const swapSpaces = str => _.trim(str).replace(/,\s/g, ',').replace(/\s/g, '+');

const cleanFileName = str => str.replace(/\/|\+|,|\s/ig, '');

const fileNameGenerator = ({ from, to }) => `${defaultFileNameGenerator({
  from: cleanFileName(from),
  to: cleanFileName(to)
})}.json`;

const getDistance = simpleCache({
  fn: async ({ from, to }) => {
    const { data } = await axios.get(`${GOOGLE_DISTANCE_MATRIX_URL}?${qs.stringify({
      key: process.env.GOOGLE_API_KEY,
      units: 'imperial',
      origins: swapSpaces(from),
      destinations: swapSpaces(to)
    })}`);

    await randomTimeout(200, 800);

    return data;
  },
  cacheDirectoryPath: CACHE_DIRECTORY_PATH,
  fileNameGenerator
});

async function getDistanceInMiles(from, to, attempt = 0) {
  const data = await getDistance({
    from,
    to
  });
  if (data.error_message) {
    if (attempt < 5) {
      console.log(`${from} failed with ${data.error_message}. Retrying, attempt ${attempt + 1}`);

      // NOTE - Removes cache entry
      await fs.remove(path.join(CACHE_DIRECTORY_PATH, fileNameGenerator({
        from,
        to
      })));

      await randomTimeout(attempt * 1000, attempt * 2000);
      return getDistanceInMiles(from, to, attempt + 1);
    } else {
      console.log(`${from} failed 5 times, returning -1 for the mileage.`);
      return -1;
    }
  } else {
    const meters = _.get(data, ['rows', 0, 'elements', 0, 'distance', 'value']);
    const address = _.get(data, ['origin_addresses', 0]);
    return {
      distance: parseFloat(numeral(convertUnits(meters).from('m').to('mi')).format('0.00')),
      address
    };
  }
}

module.exports = {
  getDistanceInMiles
};
