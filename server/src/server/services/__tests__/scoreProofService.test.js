const assert = require('node:assert/strict');
const test = require('node:test');

const {
  declaredScoresAgree,
  extractScoreCandidates,
  fixtureScoreFromSubmission,
  verifyScoreProofs,
} = require('../scoreProofService');

test('extractScoreCandidates reads common scoreboard separators', () => {
  assert.deepEqual(extractScoreCandidates('FINAL\nStage United 3 - 2 Shadow FC'), [
    { home_score: 3, away_score: 2 },
  ]);
  assert.deepEqual(extractScoreCandidates('Score: 4:1'), [
    { home_score: 4, away_score: 1 },
  ]);
});

test('verifyScoreProofs verifies matching declared scores when both teams uploaded the same proof', () => {
  const result = verifyScoreProofs({
    homeSubmission: { home_score: 2, away_score: 1, proof_url: '/uploads/same-proof.png' },
    awaySubmission: { home_score: 2, away_score: 1, proof_url: 'https://stageleagues.com/uploads/same-proof.png' },
  });

  assert.equal(result.status, 'verified');
  assert.equal(result.score_match, true);
  assert.equal(result.proof_match, true);
  assert.equal(result.reason, 'declared_scores_agree');
});

test('verifyScoreProofs completes when declared scores agree even if OCR cannot read the screenshots', () => {
  const result = verifyScoreProofs({
    homeSubmission: {
      home_score: 5,
      away_score: 2,
      proof_url: '/uploads/home.png',
      proof_ocr: { text: 'Unreadable menu screen' },
    },
    awaySubmission: {
      home_score: 5,
      away_score: 2,
      proof_url: '/uploads/away.png',
      proof_ocr: { text: 'FINAL SCORE 2 - 1' },
    },
  });

  assert.equal(result.status, 'verified');
  assert.equal(result.reason, 'declared_scores_agree');
  assert.equal(result.score_match, true);
});

test('verifyScoreProofs flags a mismatch when the two sides declare different scores', () => {
  const result = verifyScoreProofs({
    homeSubmission: { home_score: 5, away_score: 2, proof_url: '/uploads/home.png' },
    awaySubmission: { home_score: 2, away_score: 5, proof_url: '/uploads/away.png' },
  });

  assert.equal(result.status, 'score_mismatch');
  assert.equal(result.reason, 'submitted_scores_disagree');
});

test('declaredScoresAgree compares team goals, not field order', () => {
  assert.equal(declaredScoresAgree(
    { home_score: 5, away_score: 2, own_score: 5, opponent_score: 2 },
    { home_score: 5, away_score: 2, own_score: 2, opponent_score: 5 },
  ), true);
  assert.equal(declaredScoresAgree(
    { own_score: 5, opponent_score: 2 },
    { own_score: 2, opponent_score: 5 },
  ), true);
  assert.equal(declaredScoresAgree(
    { home_score: 2, away_score: 5, own_score: 2, opponent_score: 5 },
    { own_score: 2, opponent_score: 5 },
  ), false);
  assert.deepEqual(fixtureScoreFromSubmission({ own_score: 2, opponent_score: 5 }, 'away'), {
    home: 5,
    away: 2,
  });
});
