require('dotenv').config();

const Zillow = require('node-zillow');
const { simpleCache, defaultFileNameGenerator } = require('localism');

const CACHE_DIRECTORY_PATH = 'tmp/cache/zillow-search-results';

const cleanFileName = str => str.replace(/\/|\+|,|\s/ig, '');

const fileNameGenerator = ({ street, cityStateZip }) => `${defaultFileNameGenerator({
  street: cleanFileName(street),
  cityStateZip: cleanFileName(cityStateZip)
})}.json`;

const zillow = new Zillow(process.env.ZILLOW_API_KEY);

const getSearchResults = simpleCache({
  fn: async ({ street, cityStateZip }) => {
    return zillow.get('GetSearchResults', {
      address: street,
      citystatezip: cityStateZip
    });
  },
  cacheDirectoryPath: CACHE_DIRECTORY_PATH,
  fileNameGenerator
});

async function getNeighborhoodData(street, cityStateZip) {
  const data = await getSearchResults({
    street,
    cityStateZip
  });
  return data;
}

async function test() {
  console.log(await getNeighborhoodData('330 Penrose Dr', 'Columbia, SC 29203'));
}

test();

// Alternatives to consider
// For neighborhood data: https://blog.quandl.com/api-for-housing-data
// For individual address data: https://www.melissa.com/property-data
// Also a resource: https://www.cleveroad.com/blog/real-estate-apis

module.exports = {
  getNeighborhoodData
};
