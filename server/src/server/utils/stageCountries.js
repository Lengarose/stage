const fs = require('fs');
const path = require('path');

let cachedCountries = null;

function loadStageCountries() {
  if (cachedCountries) return cachedCountries;
  const file = path.resolve(__dirname, '../../../../src/lib/countries.js');
  const text = fs.readFileSync(file, 'utf8');
  const countries = [];
  const pattern = /"code":\s*"([^"]+)"\s*,\s*"name":\s*"([^"]+)"/g;
  let match = pattern.exec(text);
  while (match) {
    countries.push({ code: match[1], name: match[2] });
    match = pattern.exec(text);
  }
  cachedCountries = countries;
  return countries;
}

module.exports = { loadStageCountries };
