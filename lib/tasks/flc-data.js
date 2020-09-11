const fs = require('fs-extra');
const path = require('path');
const pdfParse = require('pdf-parse');

async function main() {
  const file = await fs.readFile(path.join('./resources/samples', 'FLC Properties.pdf'));
  const { text } = await pdfParse(file);
  console.log(text);
}

main();
