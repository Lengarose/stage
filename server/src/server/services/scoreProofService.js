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

function verifyScoreProofs({ homeSubmission, awaySubmission }) {
  const homeScore = Number(homeSubmission?.home_score ?? NaN);
  const awayScore = Number(homeSubmission?.away_score ?? NaN);
  const scoreMatch = Number.isFinite(homeScore) &&
    Number.isFinite(awayScore) &&
    homeScore === Number(awaySubmission?.home_score) &&
    awayScore === Number(awaySubmission?.away_score);
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
    };
  }

  if (!homeProofUrl || !awayProofUrl) {
    return {
      status: 'needs_review',
      reason: 'missing_proof',
      score_match: true,
      proof_match: false,
      home_ocr_scores: homeCandidates,
      away_ocr_scores: awayCandidates,
    };
  }

  if (proofMatch) {
    return {
      status: 'verified',
      reason: 'matching_proof',
      score_match: true,
      proof_match: true,
      home_ocr_scores: homeCandidates,
      away_ocr_scores: awayCandidates,
    };
  }

  if ((homeCandidates.length || awayCandidates.length) && (!homeOcrMatches || !awayOcrMatches)) {
    return {
      status: 'needs_review',
      reason: 'ocr_score_mismatch',
      score_match: true,
      proof_match: false,
      home_ocr_scores: homeCandidates,
      away_ocr_scores: awayCandidates,
    };
  }

  if (homeOcrMatches && awayOcrMatches) {
    return {
      status: 'verified',
      reason: 'ocr_score_match',
      score_match: true,
      proof_match: false,
      home_ocr_scores: homeCandidates,
      away_ocr_scores: awayCandidates,
    };
  }

  return {
    status: 'needs_review',
    reason: 'proofs_differ_without_readable_score',
    score_match: true,
    proof_match: false,
    home_ocr_scores: homeCandidates,
    away_ocr_scores: awayCandidates,
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
  extractScoreCandidates,
  localUploadPathFromUrl,
  normalizeProofUrl,
  proofUrlsMatch,
  recognizeScoreFromImageUrl,
  scorePairMatches,
  verifyScoreProofs,
};
