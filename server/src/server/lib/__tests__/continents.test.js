const test = require('node:test');
const assert = require('node:assert/strict');
const {
  CONTINENTS,
  decorateStoryLocation,
  indexClubs,
  normalizeCountryCode,
  resolveContinent,
} = require('../continents');

test('STAGE continents cover the football map', () => {
  assert.deepEqual(
    CONTINENTS.map((row) => row.id),
    ['europe', 'africa', 'asia', 'north_america', 'south_america', 'oceania', 'middle_east'],
  );
  assert.equal(resolveContinent({ country_code: 'BE' }), 'europe');
  assert.equal(resolveContinent({ country_code: 'GB' }), 'europe');
  assert.equal(resolveContinent({ country_code: 'BR' }), 'south_america');
  assert.equal(resolveContinent({ country_code: 'US' }), 'north_america');
  assert.equal(resolveContinent({ country_code: 'JP' }), 'asia');
  assert.equal(resolveContinent({ country_code: 'ZA' }), 'africa');
  assert.equal(resolveContinent({ country_code: 'AU' }), 'oceania');
  assert.equal(resolveContinent({ country_code: 'AE' }), 'middle_east');
  assert.equal(resolveContinent({ region: 'Europe' }), 'europe');
  assert.equal(resolveContinent({ region: 'North America', country_code: 'JP' }), 'asia');
});

test('country codes, names and FIFA codes all map onto continents', () => {
  assert.equal(normalizeCountryCode('be'), 'BE');
  assert.equal(normalizeCountryCode('Belgium'), 'BE');
  assert.equal(normalizeCountryCode('ENG'), 'ENG');
  assert.equal(normalizeCountryCode('England'), 'ENG');
  assert.equal(normalizeCountryCode('NGA'), 'NG');
  assert.equal(resolveContinent({ country_code: 'Belgium' }), 'europe');
  assert.equal(resolveContinent({ country_code: 'England' }), 'europe');
  assert.equal(resolveContinent({ country_code: 'Nigeria' }), 'africa');
  assert.equal(resolveContinent({ country_code: 'ENG' }), 'europe');
  assert.equal(resolveContinent({ region: 'UEFA' }), 'europe');
  assert.equal(resolveContinent({ region: 'CAF' }), 'africa');
});

test('stories without club_id still pick the club country code by name', () => {
  const catalog = indexClubs([
    { id: 'c1', name: 'Hooded F.C.', tag: 'HFC', country_code: 'BE', region: '' },
    { id: 'c2', name: 'Cairo Lights', tag: 'CAI', country_code: 'EG', region: '' },
  ]);
  const belgium = decorateStoryLocation(
    { id: 'n1', club_name: 'Hooded F.C.', title: 'Stadium upgrade' },
    { catalog },
  );
  const egypt = decorateStoryLocation(
    { id: 'n2', club_name: 'Cairo Lights', title: 'New shirts' },
    { catalog },
  );
  assert.equal(belgium.country_code, 'BE');
  assert.equal(belgium.continent, 'europe');
  assert.equal(egypt.country_code, 'EG');
  assert.equal(egypt.continent, 'africa');
});

