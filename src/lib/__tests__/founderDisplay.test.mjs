import assert from 'node:assert/strict';
import test from 'node:test';
import {
  displayNamedFounder,
  FOUNDER_CONTRACT_LABEL,
  FOUNDER_PLAYER_CONTRACT_LABEL,
  FOUNDER_PUBLIC_ROLE_LABEL,
  isNamedFounder,
} from '../founderDisplay.js';

test('a named founder seat is Player everywhere except the contract', () => {
  assert.equal(isNamedFounder('founder'), true);
  assert.equal(isNamedFounder('founder_player'), true);
  assert.equal(isNamedFounder('president'), false);
  assert.equal(displayNamedFounder(), FOUNDER_PUBLIC_ROLE_LABEL);
  assert.equal(displayNamedFounder({ forContract: false }), 'Player');
  assert.equal(displayNamedFounder({ forContract: true }), FOUNDER_CONTRACT_LABEL);
  assert.equal(displayNamedFounder({ forContract: true, type: 'founder_player' }), FOUNDER_PLAYER_CONTRACT_LABEL);
});
