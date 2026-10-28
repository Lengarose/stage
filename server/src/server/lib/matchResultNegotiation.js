'use strict';

const RESULT_STATES = {
  AWAITING_RESULT: 'AWAITING_RESULT',
  AWAITING_AWAY_CONFIRMATION: 'AWAITING_AWAY_CONFIRMATION',
  AWAITING_HOME_REVIEW: 'AWAITING_HOME_REVIEW',
  DISPUTED: 'DISPUTED',
  ADMIN_REVIEW: 'ADMIN_REVIEW',
  CONFIRMED: 'CONFIRMED',
  AUTO_CONFIRMED_TIMEOUT: 'AUTO_CONFIRMED_TIMEOUT',
  RESULT_OVERDUE: 'RESULT_OVERDUE',
  VOIDED: 'VOIDED',
};

const TERMINAL_RESULT_STATES = new Set([
  RESULT_STATES.CONFIRMED,
  RESULT_STATES.AUTO_CONFIRMED_TIMEOUT,
  RESULT_STATES.VOIDED,
]);

const RESULT_WINDOW_HOURS = 48;
const CONFIRM_WINDOW_HOURS = 48;
const REVIEW_WINDOW_HOURS = 48;

const KNOCKOUT_MARKERS = /knockout_r16|knockout_qf|knockout_sf|knockout_final|\bknockout\b|\bplayoff\b|round of 16|quarter-finals?|semi-finals?|(?:^|[·\-–]\s*)final\b/;

function hoursFromNow(hours, now = new Date()) {
  return new Date(now.getTime() + Number(hours) * 3600 * 1000);
}

function matchBlob(match) {
  return [
    match?.competition_context,
    match?.source_fixture_type,
    match?.type,
    match?.mode,
    match?.phase,
  ].filter(Boolean).join(' ').toLowerCase();
}

function isArrangeGame(match) {
  const blob = matchBlob(match);
  const source = String(match?.source_fixture_type || '').toLowerCase();
  const type = String(match?.type || '').toLowerCase();
  return source === 'arranged_game'
    || type === 'ranked'
    || type === 'friendly'
    || blob.includes('arrange');
}

function hasWager(match) {
  return Number(match?.wager_stc || 0) > 0;
}

function evidenceRequired(match) {
  if (hasWager(match)) return true;
  return !isArrangeGame(match);
}

function penaltiesFlagForCreatedMatch({ phase, type, format } = {}) {
  const blob = [phase, type, format].filter(Boolean).join(' ').toLowerCase();
  return /knockout|playoff|\bfinal\b/.test(blob) ? 1 : 0;
}

function penaltiesAllowed(match) {
  if (Number(match?.allow_penalties) === 1) return true;
  const blob = matchBlob(match);
  if (/regional_league/.test(blob) && !KNOCKOUT_MARKERS.test(blob)) return false;
  if (KNOCKOUT_MARKERS.test(blob)) return true;
  return false;
}

function httpError(message, status, code) {
  const err = new Error(message);
  err.status = status;
  err.code = code;
  return err;
}

const snapshotContract = require('./resultSnapshotContract.json');
const RESULT_SNAPSHOT_FIELDS = [...snapshotContract.jsonFields, ...snapshotContract.stateFields, 'result_submit_side', ...snapshotContract.counterFields];

function stableJson(value) {
  if (Array.isArray(value)) return value.map(stableJson);
  if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().map(key => [key, stableJson(value[key])]));
  return value;
}

function canonicalSnapshotValue(key, value) {
  if (snapshotContract.jsonFields.includes(key)) {
    let parsed = value ?? null;
    if (key !== 'result_history' && typeof parsed === 'string' && !parsed.trim()) parsed = null;
    if (typeof parsed === 'string') {
      try { parsed = JSON.parse(parsed); } catch { return ['malformed-json', parsed]; }
    }
    if (key === 'result_history') {
      if (parsed == null) parsed = [];
      if (!Array.isArray(parsed)) return ['invalid-shape', stableJson(parsed)];
      if (Array.isArray(parsed)) parsed = parsed.filter(event => !snapshotContract.ignoredHistoryEvents.includes(event?.event));
    } else if (parsed != null && (typeof parsed !== 'object' || Array.isArray(parsed))) return ['invalid-shape', stableJson(parsed)];
    return ['json', stableJson(parsed)];
  }
  if (key === 'result_submit_side') return String(value || 'home').toLowerCase();
  if (snapshotContract.counterFields.includes(key)) return Number(value || 0);
  if (value == null) return null;
  return key === 'status' ? String(value).trim().toLowerCase() : String(value).trim().toUpperCase();
}

function resultSnapshotFingerprint(match) {
  return require('crypto').createHash('sha256').update(JSON.stringify([String(match.id || ''), ...RESULT_SNAPSHOT_FIELDS.map(key => canonicalSnapshotValue(key, match[key]))])).digest('hex');
}

function resultSnapshotValues(match) {
  return RESULT_SNAPSHOT_FIELDS.map(key => {
    const value = match[key] ?? null;
    return value && typeof value === 'object' ? JSON.stringify(value) : value;
  });
}

function assertResultSnapshotCurrent(expected, current, guard = 'snapshot') {
  const invalid = snapshotContract.jsonFields.filter(key => ['malformed-json','invalid-shape'].includes(canonicalSnapshotValue(key,current[key])[0]));
  if (invalid.length) {
    const error = httpError('Stored result data needs review before this report can be processed.',409,'INVALID_RESULT_DATA');
    error.conflict = { guard, fields: invalid };
    throw error;
  }
  // Older clients supplied the original JSON/lifecycle snapshot without these
  // extra scalar fields. Their complete submissions/history still protect review.
  const optional = ['result_submit_side', ...snapshotContract.counterFields];
  const fields = RESULT_SNAPSHOT_FIELDS.filter(key => !(optional.includes(key) && !Object.hasOwn(expected,key)) && JSON.stringify(canonicalSnapshotValue(key, expected[key])) !== JSON.stringify(canonicalSnapshotValue(key, current[key])));
  if (fields.length) {
    const error = httpError('A newer result proposal or match state is available. Refresh and review it before confirming.', 409, 'RESULT_CHANGED');
    error.conflict = { guard, fields };
    throw error;
  }
}

function matchingConfirmationReceipt(expected, current, side, action) {
  if (!expected || Number(current.report_finalized) !== 1 || !['CONFIRMED', 'AUTO_CONFIRMED_TIMEOUT'].includes(current.result_state) || current.status !== 'completed') return false;
  let history;
  try { history = typeof current.result_history === 'string' ? JSON.parse(current.result_history) : current.result_history; } catch { return false; }
  if (!Array.isArray(history)) return false;
  const last = history.filter(event => !snapshotContract.ignoredHistoryEvents.includes(event?.event)).at(-1);
  const reviewed = { ...expected, id: current.id };
  for (const field of ['result_submit_side', ...snapshotContract.counterFields]) if (!Object.hasOwn(expected,field)) reviewed[field] = current[field];
  return last?.review_fingerprint === resultSnapshotFingerprint(reviewed) && last.side === side && last.review_action === action
    && Number(last.home_score) === Number(current.home_score) && Number(last.away_score) === Number(current.away_score)
    && Number(last.decided_on_penalties || 0) === Number(current.decided_on_penalties || 0)
    && (last.penalty_winner_side || null) === (current.penalty_winner_side || null);
}

function normalizePenaltySelection({
  homeScore,
  awayScore,
  decidedOnPenalties,
  penaltyWinnerSide,
  allowed,
  eligibility,
}) {
  const isDraw = Number(homeScore) === Number(awayScore);
  if (!eligibility && !isDraw) {
    return { decided_on_penalties: 0, penalty_winner_side: null };
  }
  const wantsPenalties = decidedOnPenalties === true
    || decidedOnPenalties === 1
    || decidedOnPenalties === '1'
    || decidedOnPenalties === 'true';
  const side = String(penaltyWinnerSide || '').toLowerCase();
  if (eligibility && wantsPenalties && !allowed) {
    throw httpError(eligibility.reason || 'Penalties are not allowed for this fixture.', 400, 'PENALTIES_NOT_ALLOWED');
  }
  if (eligibility && wantsPenalties && !['home', 'away'].includes(side)) {
    throw httpError('Select the penalty winner.', 400, 'INVALID_PENALTY_SIDE');
  }
  if (!wantsPenalties || !side || side === 'none') {
    if (eligibility?.required) throw httpError('Select the penalty winner to resolve this level tie.',400,'PENALTY_WINNER_REQUIRED');
    return { decided_on_penalties: 0, penalty_winner_side: null };
  }
  if (!allowed) {
    throw httpError(eligibility?.reason || 'Penalties are not allowed for this fixture.', 400, 'PENALTIES_NOT_ALLOWED');
  }
  if (side !== 'home' && side !== 'away') {
    throw httpError('penalty_winner_side must be home or away.', 400, 'INVALID_PENALTY_SIDE');
  }
  return { decided_on_penalties: 1, penalty_winner_side: side };
}

function currentSubmitSide(match) {
  return String(match?.result_submit_side || 'home').toLowerCase() === 'away' ? 'away' : 'home';
}

function oppositeSide(side) {
  return side === 'home' ? 'away' : 'home';
}

function clubIdForSide(match, side) {
  return side === 'home' ? match?.home_club_id : match?.away_club_id;
}

function playerIdForSide(match, side) {
  return side === 'home' ? match?.home_player_id : match?.away_player_id;
}

function isClubMatch(match) {
  if (match?.mode === 'club') return true;
  if (match?.mode === 'solo') return false;
  return Boolean(match?.home_club_id || match?.away_club_id);
}

function assertNoForeignPlayerStats(stats, match, side) {
  const list = Array.isArray(stats) ? stats : [];
  const ownClub = clubIdForSide(match, side);
  const otherClub = clubIdForSide(match, oppositeSide(side));
  const ownPlayer = playerIdForSide(match, side);
  for (const stat of list) {
    if (otherClub && stat?.club_id && String(stat.club_id) === String(otherClub)) {
      throw httpError('You cannot submit stats for the other club.', 403, 'FOREIGN_PLAYER_STATS');
    }
    if (ownClub && stat?.club_id && String(stat.club_id) !== String(ownClub)) {
      throw httpError('You cannot submit stats for the other club.', 403, 'FOREIGN_PLAYER_STATS');
    }
    if (!isClubMatch(match) && ownPlayer && stat?.player_id && String(stat.player_id) !== String(ownPlayer)) {
      throw httpError('You cannot submit stats for the other player.', 403, 'FOREIGN_PLAYER_STATS');
    }
  }
  return list;
}

function filterOwnSideStats(stats, match, side) {
  const list = Array.isArray(stats) ? stats : [];
  const ownClub = clubIdForSide(match, side);
  const ownPlayer = playerIdForSide(match, side);
  if (ownClub) {
    return list.filter((stat) => !stat?.club_id || String(stat.club_id) === String(ownClub));
  }
  if (ownPlayer) {
    return list.filter((stat) => !stat?.player_id || String(stat.player_id) === String(ownPlayer));
  }
  return list;
}

function parseDueMs(value) {
  if (!value) return null;
  const ms = new Date(value).getTime();
  return Number.isFinite(ms) ? ms : null;
}

function settleDeadlinesPure(match, now = new Date()) {
  const status = String(match?.status || '');
  if (['completed', 'forfeit', 'cancelled'].includes(status)) {
    return { changed: false };
  }
  const state = String(match?.result_state || RESULT_STATES.AWAITING_RESULT);
  if (TERMINAL_RESULT_STATES.has(state) || state === RESULT_STATES.ADMIN_REVIEW) {
    return { changed: false };
  }
  const t = now.getTime();
  const submitSide = currentSubmitSide(match);

  if (state === RESULT_STATES.AWAITING_RESULT || !match?.result_state) {
    const resultDue = parseDueMs(match?.result_due_at);
    if (resultDue && t > resultDue) {
      if (submitSide === 'home') {
        return {
          changed: true,
          patch: {
            result_submit_side: 'away',
            result_due_at: hoursFromNow(RESULT_WINDOW_HOURS, now).toISOString(),
            result_state: RESULT_STATES.AWAITING_RESULT,
          },
          event: 'home_submit_window_passed',
        };
      }
      return {
        changed: true,
        patch: { result_state: RESULT_STATES.RESULT_OVERDUE },
        event: 'result_overdue',
      };
    }
    return { changed: false };
  }

  if (state === RESULT_STATES.AWAITING_AWAY_CONFIRMATION) {
    const confirmDue = parseDueMs(match?.confirmation_due_at);
    if (confirmDue && t > confirmDue) {
      return {
        changed: true,
        patch: {
          result_state: RESULT_STATES.AUTO_CONFIRMED_TIMEOUT,
          status: 'completed',
        },
        event: 'auto_confirm_timeout',
        autoConfirm: true,
      };
    }
    return { changed: false };
  }

  if (state === RESULT_STATES.AWAITING_HOME_REVIEW) {
    const reviewDue = parseDueMs(match?.review_due_at);
    if (reviewDue && t > reviewDue) {
      return {
        changed: true,
        patch: {
          result_state: RESULT_STATES.AUTO_CONFIRMED_TIMEOUT,
          status: 'completed',
        },
        event: 'review_timeout_apply_original',
        autoConfirm: true,
        appliedFrom: 'original_submission',
      };
    }
    return { changed: false };
  }

  return { changed: false };
}

function scoresAgree(left, right) {
  if (!left || !right) return false;
  return Number(left.home_score) === Number(right.home_score)
    && Number(left.away_score) === Number(right.away_score);
}

function formatScoreLine(homeScore, awayScore, homeName = 'Home', awayName = 'Away') {
  return `${homeName} submitted ${Number(homeScore)}–${Number(awayScore)}. Is this result correct?`;
}

module.exports = {
  RESULT_SNAPSHOT_FIELDS,
  canonicalSnapshotValue,
  resultSnapshotFingerprint,
  matchingConfirmationReceipt,
  resultSnapshotValues,
  assertResultSnapshotCurrent,
  RESULT_STATES,
  TERMINAL_RESULT_STATES,
  RESULT_WINDOW_HOURS,
  CONFIRM_WINDOW_HOURS,
  REVIEW_WINDOW_HOURS,
  hoursFromNow,
  isArrangeGame,
  evidenceRequired,
  penaltiesFlagForCreatedMatch,
  penaltiesAllowed,
  normalizePenaltySelection,
  currentSubmitSide,
  oppositeSide,
  isClubMatch,
  assertNoForeignPlayerStats,
  filterOwnSideStats,
  settleDeadlinesPure,
  scoresAgree,
  formatScoreLine,
  httpError,
};
