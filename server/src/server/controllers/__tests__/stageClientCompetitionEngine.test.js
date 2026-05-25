const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const client = fs.readFileSync(path.resolve(__dirname, '../../../../../src/api/stageClient.js'), 'utf8');

test('stageClient registers competition engine entities and command wrapper', () => {
  for (const entity of [
    'CompetitionInstance',
    'CompetitionParticipant',
    'CompetitionFixture',
    'CompetitionScheduleProposal',
    'CompetitionResultSubmission',
    'CompetitionStanding',
    'CompetitionPhaseState',
    'CompetitionPayout',
  ]) {
    assert.match(client, new RegExp(`["']${entity}["']`));
  }
  assert.match(client, /competitionEngine/);
  assert.match(client, /createMatchFromFixture/);
  assert.match(client, /submitResult/);
});
