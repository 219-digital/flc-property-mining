const _ = require('lodash');
const fs = require('fs-extra');
const path = require('path');
const pdfParse = require('pdf-parse');

const createDecimalRe = () => /\d+(\.\d{1,2})?$/ig;

const extractDecimalNumberEndOfLine = line => parseFloat(line.match(createDecimalRe())[0]);

const selectLines = text => text.split('\n').filter(line => /RICHLAND\sCO\sFORFEITED\sLAND\sCOMM/ig.test(line));

const dataFromLines = lines => lines.map(line => {
  const split = line.split('RICHLAND CO FORFEITED LAND COMM');
  const taxMap = (split[0] || '').trim();

  const secondHalf = split[1].replace(/\s+/g, ' ');
  const price = extractDecimalNumberEndOfLine(secondHalf);

  const address = _.trim(secondHalf.replace(createDecimalRe(), ''));

  return {
    taxMap,
    address,
    price
  };
})

async function getCountyData() {
  const file = await fs.readFile(path.join('./resources/samples', 'FLC Properties.pdf'));
  const { text } = await pdfParse(file);
  const lines = selectLines(text);
  const data = dataFromLines(lines);
  return data;
}

module.exports = {
  getCountyData
};
