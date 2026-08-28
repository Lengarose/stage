const assert = require('node:assert/strict');
const test = require('node:test');
const {
  RESULT_STATES,
  evidenceRequired,
  penaltiesAllowed,
  normalizePenaltySelection,
  assertNoForeignPlayerStats,
  filterOwnSideStats,
  settleDeadlinesPure,
  hoursFromNow,
} = require('../matchResultNegotiation');

test('evidence is required for league and knockout, optional for Arrange Game', () => {
  assert.equal(evidenceRequired({ source_fixture_type: 'regional_league' }), true);
  assert.equal(evidenceRequired({ source_fixture_type: 'competition', competition_context: 'Supreme · knockout_sf' }), true);
  assert.equal(evidenceRequired({ type: 'ranked', source_fixture_type: 'arranged_game' }), false);
});

test('penalties are offered on knockout phases only, never on a normal league draw', () => {
  assert.equal(penaltiesAllowed({ competition_context: 'Supreme · knockout_final' }), true);
  assert.equal(penaltiesAllowed({ source_fixture_type: 'regional_league', competition_context: 'Regional League · Division 1 · Matchday 4' }), false);
  assert.equal(penaltiesAllowed({ type: 'ranked' }), false);
  assert.equal(penaltiesAllowed({ type: 'ranked', allow_penalties: 1 }), true);
});

test('penalty selection is ignored unless the score is a draw, and rejected when ineligible', () => {
  assert.deepEqual(
    normalizePenaltySelection({ homeScore: 2, awayScore: 1, decidedOnPenalties: true, penaltyWinnerSide: 'home', allowed: true }),
    { decided_on_penalties: 0, penalty_winner_side: null }
  );
  assert.deepEqual(
    normalizePenaltySelection({ homeScore: 2, awayScore: 2, decidedOnPenalties: true, penaltyWinnerSide: 'away', allowed: true }),
    { decided_on_penalties: 1, penalty_winner_side: 'away' }
  );
  assert.throws(
    () => normalizePenaltySelection({ homeScore: 1, awayScore: 1, decidedOnPenalties: true, penaltyWinnerSide: 'home', allowed: false }),
    (err) => err.code === 'PENALTIES_NOT_ALLOWED'
  );
});

test('a club cannot write the other club’s player stats', () => {
  const match = { home_club_id: 'h', away_club_id: 'a', mode: 'club' };
  assert.throws(
    () => assertNoForeignPlayerStats([{ club_id: 'a', player_id: 'p1' }], match, 'home'),
    (err) => err.code === 'FOREIGN_PLAYER_STATS'
  );
  const own = filterOwnSideStats(
    [{ club_id: 'h', player_id: 'p1' }, { club_id: 'a', player_id: 'p2' }],
    match,
    'home'
  );
  assert.equal(own.length, 1);
  assert.equal(own[0].player_id, 'p1');
});

test('home missing the 48h window passes submission to away; nobody submitting marks RESULT_OVERDUE', () => {
  const now = new Date('2026-08-28T12:00:00Z');
  const passed = settleDeadlinesPure({
    status: 'in_progress',
    result_state: RESULT_STATES.AWAITING_RESULT,
    result_submit_side: 'home',
    result_due_at: '2026-08-26T12:00:00Z',
  }, now);
  assert.equal(passed.patch.result_submit_side, 'away');
  assert.equal(passed.patch.result_state, RESULT_STATES.AWAITING_RESULT);

  const overdue = settleDeadlinesPure({
    status: 'in_progress',
    result_state: RESULT_STATES.AWAITING_RESULT,
    result_submit_side: 'away',
    result_due_at: '2026-08-26T12:00:00Z',
  }, now);
  assert.equal(overdue.patch.result_state, RESULT_STATES.RESULT_OVERDUE);
});

test('away silence auto-confirms; home review silence applies the correction', () => {
  const now = new Date('2026-08-28T12:00:00Z');
  const auto = settleDeadlinesPure({
    status: 'in_progress',
    result_state: RESULT_STATES.AWAITING_AWAY_CONFIRMATION,
    confirmation_due_at: '2026-08-26T12:00:00Z',
  }, now);
  assert.equal(auto.autoConfirm, true);
  assert.equal(auto.patch.result_state, RESULT_STATES.AUTO_CONFIRMED_TIMEOUT);

  const review = settleDeadlinesPure({
    status: 'in_progress',
    result_state: RESULT_STATES.AWAITING_HOME_REVIEW,
    review_due_at: '2026-08-26T12:00:00Z',
  }, now);
  assert.equal(review.useAwayCorrection, true);
  assert.equal(review.patch.result_state, RESULT_STATES.AUTO_CONFIRMED_TIMEOUT);
});

test('hoursFromNow is a server-side offset, not a client clock', () => {
  const now = new Date('2026-08-01T00:00:00Z');
  assert.equal(hoursFromNow(48, now).toISOString(), '2026-08-03T00:00:00.000Z');
});
