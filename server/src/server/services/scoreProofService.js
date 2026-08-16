const fs = require('node:fs');
const path = require('node:path');
const { ensureUploadsDir } = require('../../constants/paths');

function normalizeProofUrl(url) {
  if (!url) return null;
  const value = String(url).trim();
  if (!value) return null;
  try {
    const parsed = new URL(value, 'https://stageleagues.com');
    return parsed.pathname.replace(/\/+/g, '/').toLowerCase();
  } catch (_) {
    return value.split('?')[0].replace(/\/+/g, '/').toLowerCase();
  }
}

function extractScoreCandidates(text) {
  if (!text) return [];
  const normalized = String(text)
    .replace(/[–—−]/g, '-')
    .replace(/\s+/g, ' ');
  const candidates = [];
  const seen = new Set();
  const pattern = /\b(\d{1,2})\s*[-:]\s*(\d{1,2})\b/g;
  let match;
  while ((match = pattern.exec(normalized)) !== null) {
    const home = Number(match[1]);
    const away = Number(match[2]);
    if (home > 30 || away > 30) continue;
    const key = `${home}:${away}`;
    if (seen.has(key)) continue;
    seen.add(key);
    candidates.push({ home_score: home, away_score: away });
  }
  return candidates;
}

function scorePairMatches(candidate, expectedHome, expectedAway) {
  return Number(candidate?.home_score) === Number(expectedHome) &&
    Number(candidate?.away_score) === Number(expectedAway);
}

function submissionOcrText(submission) {
  const proofOcr = submission?.proof_ocr;
  if (!proofOcr) return '';
  if (typeof proofOcr === 'string') return proofOcr;
  return proofOcr.text || '';
}

function proofUrlsMatch(homeSubmission, awaySubmission) {
  const homeProof = normalizeProofUrl(homeSubmission?.proof_url);
  const awayProof = normalizeProofUrl(awaySubmission?.proof_url);
  return Boolean(homeProof && awayProof && homeProof === awayProof);
}

function hasOwnOpponentScores(submission) {
  return submission?.own_score != null && submission?.own_score !== ''
    && submission?.opponent_score != null && submission?.opponent_score !== '';
}

function fixtureScoreFromSubmission(submission, side) {
  if (hasOwnOpponentScores(submission)) {
    const own = Number(submission.own_score);
    const opponent = Number(submission.opponent_score);
    if (side === 'away') return { home: opponent, away: own };
    return { home: own, away: opponent };
  }
  return {
    home: Number(submission?.home_score),
    away: Number(submission?.away_score),
  };
}

function declaredScoresAgree(homeSubmission, awaySubmission) {
  const home = fixtureScoreFromSubmission(homeSubmission, 'home');
  const away = fixtureScoreFromSubmission(awaySubmission, 'away');
  return Number.isFinite(home.home)
    && Number.isFinite(home.away)
    && home.home === away.home
    && home.away === away.away;
}

function verifyScoreProofs({ homeSubmission, awaySubmission }) {
  const home = fixtureScoreFromSubmission(homeSubmission, 'home');
  const homeScore = home.home;
  const awayScore = home.away;
  const scoreMatch = declaredScoresAgree(homeSubmission, awaySubmission);
  const proofMatch = proofUrlsMatch(homeSubmission, awaySubmission);
  const homeProofUrl = normalizeProofUrl(homeSubmission?.proof_url);
  const awayProofUrl = normalizeProofUrl(awaySubmission?.proof_url);
  const homeCandidates = extractScoreCandidates(submissionOcrText(homeSubmission));
  const awayCandidates = extractScoreCandidates(submissionOcrText(awaySubmission));
  const homeOcrMatches = homeCandidates.some((candidate) => scorePairMatches(candidate, homeScore, awayScore));
  const awayOcrMatches = awayCandidates.some((candidate) => scorePairMatches(candidate, homeScore, awayScore));

  if (!scoreMatch) {
    return {
      status: 'score_mismatch',
      reason: 'submitted_scores_disagree',
      score_match: false,
      proof_match: proofMatch,
      home_ocr_scores: homeCandidates,
      away_ocr_scores: awayCandidates,
      home_ocr_matches: homeOcrMatches,
      away_ocr_matches: awayOcrMatches,
    };
  }

  // Declared scores already agree. Proof/OCR is audit-only and must not
  // block completion — screenshots are often unreadable to Tesseract.
  return {
    status: 'verified',
    reason: 'declared_scores_agree',
    score_match: true,
    proof_match: proofMatch,
    home_ocr_scores: homeCandidates,
    away_ocr_scores: awayCandidates,
    home_ocr_matches: homeOcrMatches,
    away_ocr_matches: awayOcrMatches,
    home_proof_url: homeProofUrl,
    away_proof_url: awayProofUrl,
  };
}

function localUploadPathFromUrl(url) {
  const normalized = normalizeProofUrl(url);
  if (!normalized || !normalized.startsWith('/uploads/')) return null;
  const filename = path.basename(normalized);
  if (!filename) return null;
  const filePath = path.join(ensureUploadsDir(), filename);
  return fs.existsSync(filePath) ? filePath : null;
}

async function recognizeScoreFromImageUrl(url) {
  const filePath = localUploadPathFromUrl(url);
  if (!filePath) return { ok: false, reason: 'local_upload_not_found', text: '' };

  let createWorker;
  try {
    ({ createWorker } = require('tesseract.js'));
  } catch (err) {
    return { ok: false, reason: 'ocr_dependency_unavailable', error: err.message, text: '' };
  }

  let worker;
  try {
    worker = await createWorker('eng');
    const result = await worker.recognize(filePath);
    return {
      ok: true,
      text: result?.data?.text || '',
      confidence: result?.data?.confidence ?? null,
    };
  } catch (err) {
    return { ok: false, reason: 'ocr_failed', error: err.message, text: '' };
  } finally {
    if (worker) await worker.terminate().catch(() => {});
  }
}

module.exports = {
  declaredScoresAgree,
  extractScoreCandidates,
  fixtureScoreFromSubmission,
  localUploadPathFromUrl,
  normalizeProofUrl,
  proofUrlsMatch,
  recognizeScoreFromImageUrl,
  scorePairMatches,
  verifyScoreProofs,
};
