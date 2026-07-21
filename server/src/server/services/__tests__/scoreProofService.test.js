const assert = require('node:assert/strict');
const test = require('node:test');

const {
  extractScoreCandidates,
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
});

test('verifyScoreProofs requires review when OCR text does not contain the submitted score', () => {
  const result = verifyScoreProofs({
    homeSubmission: {
      home_score: 5,
      away_score: 0,
      proof_url: '/uploads/home.png',
      proof_ocr: { text: 'FINAL SCORE 2 - 1' },
    },
    awaySubmission: {
      home_score: 5,
      away_score: 0,
      proof_url: '/uploads/away.png',
      proof_ocr: { text: 'FINAL SCORE 2 - 1' },
    },
  });

  assert.equal(result.status, 'needs_review');
  assert.equal(result.reason, 'ocr_score_mismatch');
});
