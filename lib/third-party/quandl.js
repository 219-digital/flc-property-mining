const axios = require('axios');
const { simpleCache, defaultFileNameGenerator } = require('localism');
const qs = require('qs');
const _ = require('lodash');
const moment = require('moment');
const { median, mean, min, max, std } = require('mathjs');

const api = axios.create({ baseURL: 'https://www.quandl.com/api/v3/datatables/zillow' });

const getRegionsRequest = simpleCache({
  fn: async ({ cursor_id } = {}) => {
    const { data } = await api.get(`/regions?${qs.stringify(_.pickBy({
      api_key: process.env.QUANDL_API_KEY,
      'qopts.cursor_id': cursor_id
    }))}`);
    return data;
  },
  cacheDirectoryPath: 'tmp/cache/quandl-zillow-regions',
  fileNameGenerator: (...args) => `${defaultFileNameGenerator(...args)}.json`
});

const getHomeValuesTimeSeries = simpleCache({
  fn: async ({ region_id }) => {
    const { data } = await api.get(`/data?${qs.stringify({
      api_key: process.env.QUANDL_API_KEY,
      indicator_id: 'ZSFH',
      region_id
    })}`);
    return data;
  },
  cacheDirectoryPath: 'tmp/cache/quandl-zillow-median-home-sales',
  fileNameGenerator: (...args) => `${defaultFileNameGenerator(...args)}.json`
})

function transformRegions(regions) {
  return _.chain(regions)
    .compact()
    .map(([regionCode, regionType, region]) => ({
      regionCode,
      regionType,
      region,
      zip: _.first(_.split(region, ';'))
    }))
    .value();
}

async function getRegions({ cursor_id } = {}, payload = []) {
  const regions = await getRegionsRequest({ cursor_id });
  const nextCursorId = _.get(regions, 'meta.next_cursor_id');
  const newPayload = payload.concat(transformRegions(_.get(regions, 'datatable.data')));
  if (nextCursorId) {
    return getRegions({ cursor_id: nextCursorId }, newPayload);
  } else {
    return newPayload;
  }
}

function transformHomeValueTimeSeries(rows, threshold) {
  return _.chain(rows)
    .compact()
    .map(([indicatorId, regionId, date, value]) => ({
      date,
      value
    }))
    .filter(({ date }) => moment(date, 'YYYY-MM-DD').isAfter(threshold))
    .value();
}

async function getHomeSalesForZip({ zip, threshold = moment().subtract(3, 'years'), cursorId }, payload = []) {
  const indexedRegions = _.groupBy(await getRegions(), _.property('zip'));
  const regionCode = _.get(indexedRegions, [String(zip), 0, 'regionCode']);

  console.log(`Zip ${zip} translated to region ${regionCode}`);

  if (regionCode) {
    const homeValues = await getHomeValuesTimeSeries({ region_id: regionCode });
    const nextCursorId = _.get(homeValues, 'meta.next_cursor_id');
    const newPayload = payload.concat(transformHomeValueTimeSeries(_.get(homeValues, 'datatable.data'), threshold));
    if (nextCursorId) {
      return getHomeSalesForZip({
        zip,
        threshold,
        cursorId: nextCursorId
      }, newPayload);
    } else {
      const values = _.map(newPayload, 'value');
      return {
        series: newPayload,
        median: median(values),
        mean: mean(values),
        min: min(values),
        max: max(values),
        standardDeviation: std(values)
      };
    }
  } else {
    return null;
  }
}

module.exports = {
  getHomeSalesForZip
};
