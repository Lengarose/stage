import test from 'node:test';
import assert from 'node:assert/strict';
import {calculatePlayerValue,suggestSalaryRange} from '../playerValue.js';
test('contract-only recruitment never invents or exposes a player purchase valuation',()=>{
  assert.equal(calculatePlayerValue({matches_played:0,card_level:1}),null);
  assert.equal(calculatePlayerValue({market_value_stc:25000000,card_level:1}),null);
  const band=suggestSalaryRange('squad',99,25000000,1);
  assert.equal(band.min,5000);assert.equal(band.max,15000);
});
