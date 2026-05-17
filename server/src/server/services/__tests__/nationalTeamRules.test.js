const assert = require('node:assert/strict');
const test = require('node:test');

const {
  canVoteForCandidate,
  chooseElectionWinner,
  normalizeCountryCode,
  validateSquadSelection,
} = require('../nationalTeamRules');

test('normalizeCountryCode uppercases and trims values', () => {
  assert.equal(normalizeCountryCode(' be '), 'BE');
});

test('normalizeCountryCode returns empty string for null', () => {
  assert.equal(normalizeCountryCode(null), '');
});

test('canVoteForCandidate rejects self votes with reason self_vote', () => {
  const result = canVoteForCandidate({
    voter: { id: 'player-1', country: 'BE', created_date: '2026-01-01T00:00:00Z' },
    candidate: { id: 'player-1', country: 'BE' },
    election: {
      status: 'voting_open',
      country: 'BE',
      voting_opens_at: '2026-02-01T00:00:00Z',
      voting_closes_at: '2026-03-01T00:00:00Z',
    },
    now: new Date('2026-02-15T00:00:00Z'),
  });

  assert.deepEqual(result, { ok: false, reason: 'self_vote' });
});

test('canVoteForCandidate rejects candidate country mismatch with reason candidate_country_mismatch', () => {
  const result = canVoteForCandidate({
    voter: { id: 'player-1', country: 'BE', created_date: '2026-01-01T00:00:00Z' },
    candidate: { id: 'player-2', country: 'FR' },
    election: {
      status: 'voting_open',
      country: 'BE',
      voting_opens_at: '2026-02-01T00:00:00Z',
      voting_closes_at: '2026-03-01T00:00:00Z',
    },
    now: new Date('2026-02-15T00:00:00Z'),
  });

  assert.deepEqual(result, { ok: false, reason: 'candidate_country_mismatch' });
});

test('canVoteForCandidate rejects missing voter ids with reason missing_voter', () => {
  const result = canVoteForCandidate({
    voter: { country: 'BE', created_date: '2026-01-01T00:00:00Z' },
    candidate: { id: 'player-2', country: 'BE' },
    election: {
      status: 'voting_open',
      country: 'BE',
      voting_opens_at: '2026-02-01T00:00:00Z',
      voting_closes_at: '2026-03-01T00:00:00Z',
    },
  });

  assert.deepEqual(result, { ok: false, reason: 'missing_voter' });
});

test('canVoteForCandidate rejects missing candidate ids with reason missing_candidate', () => {
  const result = canVoteForCandidate({
    voter: { id: 'player-1', country: 'BE', created_date: '2026-01-01T00:00:00Z' },
    candidate: { country: 'BE' },
    election: {
      status: 'voting_open',
      country: 'BE',
      voting_opens_at: '2026-02-01T00:00:00Z',
      voting_closes_at: '2026-03-01T00:00:00Z',
    },
  });

  assert.deepEqual(result, { ok: false, reason: 'missing_candidate' });
});

test('canVoteForCandidate rejects closed election status with reason election_not_open', () => {
  const result = canVoteForCandidate({
    voter: { id: 'player-1', country: 'BE', created_date: '2026-01-01T00:00:00Z' },
    candidate: { id: 'player-2', country: 'BE' },
    election: { status: 'closed', country: 'BE' },
  });

  assert.deepEqual(result, { ok: false, reason: 'election_not_open' });
});

test('canVoteForCandidate rejects voter country mismatch with reason voter_country_mismatch', () => {
  const result = canVoteForCandidate({
    voter: { id: 'player-1', country: 'FR', created_date: '2026-01-01T00:00:00Z' },
    candidate: { id: 'player-2', country: 'BE' },
    election: {
      status: 'voting_open',
      country: 'BE',
      voting_opens_at: '2026-02-01T00:00:00Z',
      voting_closes_at: '2026-03-01T00:00:00Z',
    },
  });

  assert.deepEqual(result, { ok: false, reason: 'voter_country_mismatch' });
});

test('canVoteForCandidate rejects votes after voting closes with reason voting_closed', () => {
  const result = canVoteForCandidate({
    voter: { id: 'player-1', country: 'BE', created_date: '2026-01-01T00:00:00Z' },
    candidate: { id: 'player-2', country: 'BE' },
    election: {
      status: 'voting_open',
      country: 'BE',
      voting_opens_at: '2026-02-01T00:00:00Z',
      voting_closes_at: '2026-03-01T00:00:00Z',
    },
    now: new Date('2026-03-02T00:00:00Z'),
  });

  assert.deepEqual(result, { ok: false, reason: 'voting_closed' });
});

test('canVoteForCandidate rejects votes before voting opens with reason voting_not_open_yet', () => {
  const result = canVoteForCandidate({
    voter: { id: 'player-1', country: 'BE', created_date: '2026-01-01T00:00:00Z' },
    candidate: { id: 'player-2', country: 'BE' },
    election: {
      status: 'voting_open',
      country: 'BE',
      voting_opens_at: '2026-02-01T00:00:00Z',
      voting_closes_at: '2026-03-01T00:00:00Z',
    },
    now: new Date('2026-01-31T23:59:59Z'),
  });

  assert.deepEqual(result, { ok: false, reason: 'voting_not_open_yet' });
});

test('canVoteForCandidate accepts valid same-country non-self vote', () => {
  const result = canVoteForCandidate({
    voter: { id: 'player-1', country: 'be', created_date: '2026-01-01T00:00:00Z' },
    candidate: { id: 'player-2', country: 'BE' },
    election: {
      status: 'voting_open',
      country: ' BE ',
      voting_opens_at: '2026-02-01T00:00:00Z',
      voting_closes_at: '2026-03-01T00:00:00Z',
    },
    now: new Date('2026-02-15T00:00:00Z'),
  });

  assert.deepEqual(result, { ok: true });
});

test('canVoteForCandidate rejects voters created after voting opened with reason voter_created_after_open', () => {
  const result = canVoteForCandidate({
    voter: { id: 'player-1', country: 'BE', created_date: '2026-02-02T00:00:00Z' },
    candidate: { id: 'player-2', country: 'BE' },
    election: {
      status: 'voting_open',
      country: 'BE',
      voting_opens_at: '2026-02-01T00:00:00Z',
      voting_closes_at: '2026-03-01T00:00:00Z',
    },
    now: new Date('2026-02-15T00:00:00Z'),
  });

  assert.deepEqual(result, { ok: false, reason: 'voter_created_after_open' });
});

test('validateSquadSelection rejects more than 26 unique players with reason too_many_players', () => {
  const playerIds = Array.from({ length: 27 }, (_, index) => `player-${index + 1}`);

  const result = validateSquadSelection({ playerIds });

  assert.deepEqual(result, { ok: false, reason: 'too_many_players' });
});

test('validateSquadSelection rejects duplicate player ids with reason duplicate_players', () => {
  const result = validateSquadSelection({ playerIds: ['player-1', 'player-2', 'player-1'] });

  assert.deepEqual(result, { ok: false, reason: 'duplicate_players' });
});

test('validateSquadSelection rejects non-array input with reason invalid_player_ids', () => {
  const result = validateSquadSelection({ playerIds: 'player-1' });

  assert.deepEqual(result, { ok: false, reason: 'invalid_player_ids' });
});

test('validateSquadSelection rejects blank player ids with reason blank_player_id', () => {
  const result = validateSquadSelection({ playerIds: ['player-1', ' '] });

  assert.deepEqual(result, { ok: false, reason: 'blank_player_id' });
});

test('validateSquadSelection returns trimmed ids for valid squads', () => {
  const result = validateSquadSelection({ playerIds: [' player-1 ', 'player-2'] });

  assert.deepEqual(result, { ok: true, playerIds: ['player-1', 'player-2'] });
});

test('chooseElectionWinner uses vote_count then overall_rating tiebreaker', () => {
  const winner = chooseElectionWinner([
    { player_id: 'player-1', vote_count: 10, overall_rating: 86 },
    { player_id: 'player-2', vote_count: 10, overall_rating: 91 },
    { player_id: 'player-3', vote_count: 9, overall_rating: 99 },
  ]);

  assert.deepEqual(winner, { player_id: 'player-2', vote_count: 10, overall_rating: 91 });
});

test('chooseElectionWinner uses player_id as final deterministic tiebreaker', () => {
  const winner = chooseElectionWinner([
    { player_id: 'player-2', vote_count: 10, overall_rating: 91 },
    { player_id: 'player-1', vote_count: 10, overall_rating: 91 },
  ]);

  assert.deepEqual(winner, { player_id: 'player-1', vote_count: 10, overall_rating: 91 });
});
