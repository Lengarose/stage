'use strict';

const { EXECUTESQL } = require('../db/database');
const {
  fixtureScoreFromSubmission,
} = require('./scoreProofService');
const { sendActionMessage } = require('./messageDeliveryService');
const { notifyMatchSide, resolveMatchSideEmails } = require('./matchNotificationService');
const {
  RESULT_STATES,
  RESULT_WINDOW_HOURS,
  CONFIRM_WINDOW_HOURS,
  REVIEW_WINDOW_HOURS,
  hoursFromNow,
  evidenceRequired,
  penaltiesAllowed,
  normalizePenaltySelection,
  currentSubmitSide,
  oppositeSide,
  assertNoForeignPlayerStats,
  filterOwnSideStats,
  settleDeadlinesPure,
  scoresAgree,
  httpError,
} = require('../lib/matchResultNegotiation');

function parseSubmission(raw) {
  if (!raw) return null;
  if (typeof raw === 'object') return raw;
  try { return JSON.parse(raw); } catch { return null; }
}

function stringify(value) {
  if (value == null) return null;
  return typeof value === 'string' ? value : JSON.stringify(value);
}

function parseHistory(raw) {
  const parsed = parseSubmission(raw);
  return Array.isArray(parsed) ? parsed : [];
}

async function patchMatch(matchId, fields) {
  const keys = Object.keys(fields).filter((key) => fields[key] !== undefined);
  if (!keys.length) return;
  const sets = keys.map((key) => `\`${key}\` = ?`).join(', ');
  await EXECUTESQL(
    `UPDATE matches SET ${sets}, updated_date = NOW() WHERE id = ?`,
    [...keys.map((key) => fields[key]), matchId]
  );
}

async function loadMatch(matchId) {
  const rows = await EXECUTESQL('SELECT * FROM matches WHERE id = ? LIMIT 1', [matchId]);
  return rows[0] || null;
}

function sideName(match, side) {
  if (side === 'home') return match.home_club_name || match.home_player_name || 'Home';
  return match.away_club_name || match.away_player_name || 'Away';
}

function appendHistory(match, event) {
  const history = parseHistory(match.result_history);
  history.push({ at: new Date().toISOString(), ...event });
  return JSON.stringify(history.slice(-40));
}

async function sendResultInbox(match, side, { subject, body, eventKey, messageType = 'match_result' }) {
  const emails = await resolveMatchSideEmails(match, side).catch(() => []);
  for (const recipientEmail of emails || []) {
    await sendActionMessage({
      recipientEmail,
      subject,
      body,
      messageType,
      actionType: 'open_match',
      relatedEntityId: match.id,
      relatedEntityType: 'match',
      idempotencyKey: `match:${match.id}:${eventKey}:${String(recipientEmail).toLowerCase()}`,
      isSystem: true,
      metadata: { match_id: match.id, link: `/game-day?match=${match.id}` },
    }).catch(() => {});
  }
}

function declaredFromArgs(args, side) {
  const declared = fixtureScoreFromSubmission({
    home_score: args.home_score,
    away_score: args.away_score,
    own_score: args.own_score,
    opponent_score: args.opponent_score,
  }, side);
  return {
    home_score: declared.home,
    away_score: declared.away,
  };
}

function participatingStats(playerStats, participatingIds) {
  const list = Array.isArray(playerStats) ? playerStats : [];
  if (!Array.isArray(participatingIds) || !participatingIds.length) return list;
  const allowed = new Set(participatingIds.map(String));
  return list.filter((stat) => allowed.has(String(stat.player_id)));
}

function buildSubmission({ args, side, scores, penalty, proofOcr }) {
  return {
    home_score: scores.home_score,
    away_score: scores.away_score,
    own_score: side === 'home' ? scores.home_score : scores.away_score,
    opponent_score: side === 'home' ? scores.away_score : scores.home_score,
    player_stats: args.player_stats || [],
    participating_player_ids: args.participating_player_ids || null,
    goal_events: args.goal_events || [],
    proof_url: args.proof_url || null,
    proof_ocr: proofOcr || null,
    explanation: args.explanation || null,
    decided_on_penalties: penalty.decided_on_penalties,
    penalty_winner_side: penalty.penalty_winner_side,
    submitted_at: new Date().toISOString(),
    side,
  };
}

async function notifySubmitted(match, scores) {
  const homeName = sideName(match, 'home');
  const awayName = sideName(match, 'away');
  const body = `${homeName} submitted ${scores.home_score}–${scores.away_score}. Is this result correct?`;
  await notifyMatchSide(match, 'away', 'result_submitted', 'Result submitted — confirm', body, 'result_submitted').catch(() => {});
  await sendResultInbox(match, 'away', {
    subject: 'Confirm match result',
    body,
    eventKey: 'result_submitted',
  });
}

async function notifyCorrection(match, scores) {
  const awayName = sideName(match, 'away');
  const body = `${awayName} has proposed a correction: ${scores.home_score}–${scores.away_score}.`;
  await notifyMatchSide(match, 'home', 'result_submitted', 'Result correction proposed', body, 'result_corrected').catch(() => {});
  await sendResultInbox(match, 'home', {
    subject: 'Result correction proposed',
    body,
    eventKey: 'result_corrected',
  });
}

async function notifyDispute(match, toSide, eventKey) {
  const body = 'Result Dispute — Evidence Required. Submit the claimed final score, a screenshot, and an optional short explanation.';
  await notifyMatchSide(match, toSide, 'match_disputed', 'Result Dispute — Evidence Required', body, eventKey).catch(() => {});
  await sendResultInbox(match, toSide, {
    subject: 'Result Dispute — Evidence Required',
    body,
    eventKey,
    messageType: 'match_dispute',
  });
}

async function finalizeOfficial(match, accepted, secondary, resultState) {
  const { processMatchCompletion } = require('../functions/legacyFunctions');
  const result = await processMatchCompletion(match, accepted, secondary || null);
  await patchMatch(match.id, { result_state: resultState });
  const scores = { home_score: accepted.home_score, away_score: accepted.away_score };
  const eventKey = resultState === RESULT_STATES.AUTO_CONFIRMED_TIMEOUT ? 'auto_confirmed_timeout' : 'result_confirmed';
  const title = eventKey === 'auto_confirmed_timeout' ? 'Result auto-confirmed' : 'Result confirmed';
  const line = `${sideName(match, 'home')} ${scores.home_score}–${scores.away_score} ${sideName(match, 'away')}`;
  await sendResultInbox(match, 'home', { subject: title, body: line, eventKey });
  await sendResultInbox(match, 'away', { subject: title, body: line, eventKey });
  return result;
}

function acceptedForMatch(match, homeSub, awaySub, options) {
  const scoreSource = options?.useAway && awaySub ? awaySub : (homeSub || awaySub);
  return {
    home_score: scoreSource.home_score,
    away_score: scoreSource.away_score,
    decided_on_penalties: Number(scoreSource.decided_on_penalties || match.decided_on_penalties || 0),
    penalty_winner_side: scoreSource.penalty_winner_side || match.penalty_winner_side || null,
    home_player_stats: filterOwnSideStats(homeSub?.player_stats, match, 'home'),
    away_player_stats: filterOwnSideStats(awaySub?.player_stats, match, 'away'),
    home_goal_events: homeSub?.goal_events || [],
    away_goal_events: awaySub?.goal_events || [],
    player_stats: [
      ...filterOwnSideStats(homeSub?.player_stats, match, 'home'),
      ...filterOwnSideStats(awaySub?.player_stats, match, 'away'),
    ],
    goal_events: [
      ...(homeSub?.goal_events || []),
      ...(awaySub?.goal_events || []),
    ],
    result_state: options?.resultState,
  };
}

async function applyTimeoutSettlement(match, decision) {
  const homeSub = parseSubmission(match.home_submission);
  const awaySub = parseSubmission(match.away_submission);
  const useAway = decision.appliedFrom === 'away_correction' || Boolean(decision.useAwayCorrection);
  const appliedFrom = decision.appliedFrom || (useAway ? 'away_correction' : 'original_submission');
  const primary = useAway ? (awaySub || homeSub) : (homeSub || awaySub);

  await patchMatch(match.id, {
    ...decision.patch,
    result_history: appendHistory(match, {
      event: decision.event,
      applied_from: appliedFrom,
      home_score: primary?.home_score ?? null,
      away_score: primary?.away_score ?? null,
      patch: decision.patch,
    }),
  });
  const fresh = await loadMatch(match.id);
  if (!decision.autoConfirm) {
    if (decision.event === 'home_submit_window_passed') {
      await notifyMatchSide(fresh, 'away', 'result_requested', 'Your turn to submit the result', `${sideName(fresh, 'home')} missed the 48h window. Submit the result.`, 'home_window_passed').catch(() => {});
      await sendResultInbox(fresh, 'away', {
        subject: 'Your turn to submit the result',
        body: `${sideName(fresh, 'home')} missed the submission window. Submit the result from Game Day.`,
        eventKey: 'home_window_passed',
      });
    }
    return { data: { status: 'settled', result_state: fresh.result_state, event: decision.event }, match: fresh };
  }

  if (!primary) {
    await patchMatch(fresh.id, { result_state: RESULT_STATES.RESULT_OVERDUE, status: 'in_progress' });
    return { data: { status: 'overdue', result_state: RESULT_STATES.RESULT_OVERDUE }, match: await loadMatch(fresh.id) };
  }
  const accepted = acceptedForMatch(fresh, homeSub, awaySub, {
    useAway,
    resultState: RESULT_STATES.AUTO_CONFIRMED_TIMEOUT,
  });
  return finalizeOfficial(fresh, accepted, null, RESULT_STATES.AUTO_CONFIRMED_TIMEOUT);
}

async function settleMatchDeadlines(match, now = new Date()) {
  if (!match?.id) return { data: { skipped: true } };
  const decision = settleDeadlinesPure(match, now);
  if (!decision.changed) return { data: { status: 'unchanged', result_state: match.result_state }, match };
  return applyTimeoutSettlement(match, decision);
}

async function settleClubMatches(clubId, now = new Date()) {
  if (!clubId) return { data: { settled: 0 } };
  const rows = await EXECUTESQL(
    `SELECT * FROM matches
      WHERE (home_club_id = ? OR away_club_id = ?)
        AND status IN ('in_progress', 'awaiting_confirmation', 'disputed')
        AND (result_state IS NULL OR result_state IN (?, ?, ?, ?, ?))
      LIMIT 80`,
    [
      clubId,
      clubId,
      RESULT_STATES.AWAITING_RESULT,
      RESULT_STATES.AWAITING_AWAY_CONFIRMATION,
      RESULT_STATES.AWAITING_HOME_REVIEW,
      RESULT_STATES.DISPUTED,
      RESULT_STATES.RESULT_OVERDUE,
    ]
  ).catch(() => []);
  let settled = 0;
  for (const row of rows || []) {
    const out = await settleMatchDeadlines(row, now);
    if (out?.data?.status && out.data.status !== 'unchanged') settled += 1;
  }
  return { data: { settled } };
}

async function submitInitialResult(match, actor, args, proofOcr) {
  const submitSide = currentSubmitSide(match);
  if (actor.side !== submitSide) {
    throw httpError(
      submitSide === 'home'
        ? 'Home team must submit their result first.'
        : 'The submission window has passed to the away side.',
      409,
      'AWAITING_HOME_SUBMISSION'
    );
  }
  if (match.result_state && ![RESULT_STATES.AWAITING_RESULT, ''].includes(String(match.result_state))
    && !(Number(match.result_home_submitted) && !match.result_state)) {
    throw httpError('This match is not waiting for an initial result.', 409, 'RESULT_ALREADY_SUBMITTED');
  }

  if (evidenceRequired(match) && !args.proof_url) {
    throw httpError('Screenshot proof is required before submitting a result.', 400, 'PROOF_REQUIRED');
  }

  const scores = declaredFromArgs(args, actor.side);
  const penalty = normalizePenaltySelection({
    homeScore: scores.home_score,
    awayScore: scores.away_score,
    decidedOnPenalties: args.decided_on_penalties,
    penaltyWinnerSide: args.penalty_winner_side,
    allowed: penaltiesAllowed(match),
  });
  const stats = participatingStats(args.player_stats, args.participating_player_ids);
  assertNoForeignPlayerStats(stats, match, actor.side);
  const submission = buildSubmission({
    args: { ...args, player_stats: stats },
    side: actor.side,
    scores,
    penalty,
    proofOcr,
  });

  const column = actor.side === 'home' ? 'home_submission' : 'away_submission';
  const flag = actor.side === 'home' ? 'result_home_submitted' : 'result_away_submitted';
  const confirmer = oppositeSide(actor.side);

  await patchMatch(match.id, {
    [column]: stringify(submission),
    [flag]: 1,
    first_submission_at: match.first_submission_at || new Date().toISOString(),
    result_state: RESULT_STATES.AWAITING_AWAY_CONFIRMATION,
    confirmation_due_at: hoursFromNow(CONFIRM_WINDOW_HOURS).toISOString(),
    decided_on_penalties: penalty.decided_on_penalties,
    penalty_winner_side: penalty.penalty_winner_side,
    result_history: appendHistory(match, {
      event: 'initial_result',
      side: actor.side,
      home_score: scores.home_score,
      away_score: scores.away_score,
    }),
  });

  const fresh = await loadMatch(match.id);
  await notifySubmitted(fresh, scores);
  if (confirmer === 'home') {
    await notifyMatchSide(fresh, 'home', 'result_submitted', 'Result submitted — confirm', `${sideName(fresh, 'away')} submitted ${scores.home_score}–${scores.away_score}. Is this result correct?`, 'result_submitted').catch(() => {});
  }
  return { data: { status: 'waiting', result_state: RESULT_STATES.AWAITING_AWAY_CONFIRMATION } };
}

async function confirmResult(match, actor, args) {
  const state = match.result_state || (Number(match.result_home_submitted) ? RESULT_STATES.AWAITING_AWAY_CONFIRMATION : '');
  if (state !== RESULT_STATES.AWAITING_AWAY_CONFIRMATION) {
    throw httpError('This match is not waiting for confirmation.', 409, 'NOT_AWAITING_CONFIRMATION');
  }
  const submitSide = currentSubmitSide(match);
  if (actor.side === submitSide) {
    throw httpError('The submitting side cannot confirm its own result.', 403, 'MATCH_SIDE_REQUIRED');
  }
  const homeSub = parseSubmission(match.home_submission);
  const awayExisting = parseSubmission(match.away_submission);
  const scoreSource = submitSide === 'away' ? awayExisting : homeSub;
  if (!scoreSource) throw httpError('No submitted result to confirm.', 409, 'NO_SUBMITTED_RESULT');

  const stats = participatingStats(args.player_stats, args.participating_player_ids);
  assertNoForeignPlayerStats(stats, match, actor.side);
  const confirmSheet = {
    ...scoreSource,
    player_stats: stats,
    participating_player_ids: args.participating_player_ids || null,
    goal_events: args.goal_events || [],
    proof_url: args.proof_url || null,
    submitted_at: new Date().toISOString(),
    side: actor.side,
    confirmed: true,
  };
  const confirmColumn = actor.side === 'home' ? 'home_submission' : 'away_submission';
  const confirmFlag = actor.side === 'home' ? 'result_home_submitted' : 'result_away_submitted';
  await patchMatch(match.id, {
    [confirmColumn]: stringify(
      actor.side === 'home'
        ? { ...homeSub, ...confirmSheet, home_score: scoreSource.home_score, away_score: scoreSource.away_score }
        : confirmSheet
    ),
    [confirmFlag]: 1,
    result_history: appendHistory(match, { event: 'confirmed', side: actor.side }),
  });
  const fresh = await loadMatch(match.id);
  const nextHome = parseSubmission(fresh.home_submission);
  const nextAway = parseSubmission(fresh.away_submission);
  const accepted = acceptedForMatch(fresh, nextHome, nextAway, { resultState: RESULT_STATES.CONFIRMED });
  return finalizeOfficial(fresh, accepted, null, RESULT_STATES.CONFIRMED);
}

async function proposeCorrection(match, actor, args) {
  const state = match.result_state || (Number(match.result_home_submitted) ? RESULT_STATES.AWAITING_AWAY_CONFIRMATION : '');
  if (state !== RESULT_STATES.AWAITING_AWAY_CONFIRMATION) {
    throw httpError('A correction can only be proposed while confirming a result.', 409, 'NOT_AWAITING_CONFIRMATION');
  }
  const submitSide = currentSubmitSide(match);
  if (actor.side === submitSide) {
    throw httpError('Only the confirming side can propose a correction.', 403, 'MATCH_SIDE_REQUIRED');
  }
  if (Number(match.correction_count || 0) >= 1) {
    throw httpError('A correction has already been proposed. Dispute the result instead.', 409, 'CORRECTION_LIMIT');
  }
  const scores = declaredFromArgs(args, actor.side);
  const penalty = normalizePenaltySelection({
    homeScore: scores.home_score,
    awayScore: scores.away_score,
    decidedOnPenalties: args.decided_on_penalties,
    penaltyWinnerSide: args.penalty_winner_side,
    allowed: penaltiesAllowed(match),
  });
  const stats = participatingStats(args.player_stats, args.participating_player_ids);
  assertNoForeignPlayerStats(stats, match, actor.side);
  const submission = buildSubmission({
    args: { ...args, player_stats: stats, proof_url: args.proof_url || null },
    side: actor.side,
    scores,
    penalty,
    proofOcr: null,
  });
  const column = actor.side === 'home' ? 'home_submission' : 'away_submission';
  const flag = actor.side === 'home' ? 'result_home_submitted' : 'result_away_submitted';
  await patchMatch(match.id, {
    [column]: stringify(submission),
    [flag]: 1,
    correction_count: Number(match.correction_count || 0) + 1,
    result_state: RESULT_STATES.AWAITING_HOME_REVIEW,
    review_due_at: hoursFromNow(REVIEW_WINDOW_HOURS).toISOString(),
    decided_on_penalties: penalty.decided_on_penalties,
    penalty_winner_side: penalty.penalty_winner_side,
    result_history: appendHistory(match, {
      event: 'correction_proposed',
      side: actor.side,
      home_score: scores.home_score,
      away_score: scores.away_score,
    }),
  });
  const fresh = await loadMatch(match.id);
  await notifyCorrection(fresh, scores);
  return { data: { status: 'awaiting_home_review', result_state: RESULT_STATES.AWAITING_HOME_REVIEW } };
}

async function acceptCorrection(match, actor) {
  if (match.result_state !== RESULT_STATES.AWAITING_HOME_REVIEW) {
    throw httpError('This match is not waiting for a correction review.', 409, 'NOT_AWAITING_REVIEW');
  }
  const submitSide = currentSubmitSide(match);
  if (actor.side !== submitSide) {
    throw httpError('Only the original submitting side can accept the correction.', 403, 'MATCH_SIDE_REQUIRED');
  }
  const homeSub = parseSubmission(match.home_submission);
  const awaySub = parseSubmission(match.away_submission);
  await patchMatch(match.id, {
    result_history: appendHistory(match, { event: 'correction_accepted', side: actor.side }),
  });
  const fresh = await loadMatch(match.id);
  const accepted = acceptedForMatch(fresh, homeSub, awaySub, {
    useAway: true,
    resultState: RESULT_STATES.CONFIRMED,
  });
  return finalizeOfficial(fresh, accepted, null, RESULT_STATES.CONFIRMED);
}

async function counterResult(match, actor, args, proofOcr) {
  if (match.result_state !== RESULT_STATES.AWAITING_HOME_REVIEW) {
    throw httpError('A counter-result is only allowed during home review.', 409, 'NOT_AWAITING_REVIEW');
  }
  if (actor.side !== currentSubmitSide(match)) {
    throw httpError('Only the original submitting side can send a counter-result.', 403, 'MATCH_SIDE_REQUIRED');
  }
  if (Number(match.home_counter_count || 0) >= 1) {
    throw httpError('The one allowed counter-result has already been used. Accept or dispute.', 409, 'COUNTER_LIMIT');
  }
  if (evidenceRequired(match) && !args.proof_url) {
    throw httpError('Screenshot proof is required before submitting a result.', 400, 'PROOF_REQUIRED');
  }
  const scores = declaredFromArgs(args, actor.side);
  const penalty = normalizePenaltySelection({
    homeScore: scores.home_score,
    awayScore: scores.away_score,
    decidedOnPenalties: args.decided_on_penalties,
    penaltyWinnerSide: args.penalty_winner_side,
    allowed: penaltiesAllowed(match),
  });
  const stats = participatingStats(args.player_stats, args.participating_player_ids);
  assertNoForeignPlayerStats(stats, match, actor.side);
  const submission = buildSubmission({
    args: { ...args, player_stats: stats },
    side: actor.side,
    scores,
    penalty,
    proofOcr,
  });
  const column = actor.side === 'home' ? 'home_submission' : 'away_submission';
  await patchMatch(match.id, {
    [column]: stringify(submission),
    home_counter_count: Number(match.home_counter_count || 0) + 1,
    result_state: RESULT_STATES.AWAITING_AWAY_CONFIRMATION,
    confirmation_due_at: hoursFromNow(CONFIRM_WINDOW_HOURS).toISOString(),
    decided_on_penalties: penalty.decided_on_penalties,
    penalty_winner_side: penalty.penalty_winner_side,
    result_history: appendHistory(match, {
      event: 'counter_result',
      side: actor.side,
      home_score: scores.home_score,
      away_score: scores.away_score,
    }),
  });
  const fresh = await loadMatch(match.id);
  await notifySubmitted(fresh, scores);
  return { data: { status: 'waiting', result_state: RESULT_STATES.AWAITING_AWAY_CONFIRMATION } };
}

function disputeSheet(args, side, scores) {
  return {
    home_score: scores.home_score,
    away_score: scores.away_score,
    proof_url: args.proof_url || null,
    explanation: args.explanation || null,
    player_stats: args.player_stats || [],
    submitted_at: new Date().toISOString(),
    side,
  };
}

async function disputeResult(match, actor, args) {
  if (![RESULT_STATES.AWAITING_HOME_REVIEW, RESULT_STATES.AWAITING_AWAY_CONFIRMATION].includes(match.result_state)) {
    throw httpError('This match cannot be disputed in its current state.', 409, 'CANNOT_DISPUTE');
  }
  if (!args.proof_url) {
    throw httpError('Screenshot proof is required to open a dispute.', 400, 'PROOF_REQUIRED');
  }
  const scores = declaredFromArgs(args, actor.side);
  const sheet = disputeSheet(args, actor.side, scores);
  const column = actor.side === 'home' ? 'home_dispute_submission' : 'away_dispute_submission';
  const other = oppositeSide(actor.side);
  const otherColumn = other === 'home' ? 'home_dispute_submission' : 'away_dispute_submission';
  const otherAlready = parseSubmission(match[otherColumn]);
  const nextState = otherAlready ? RESULT_STATES.ADMIN_REVIEW : RESULT_STATES.DISPUTED;
  await patchMatch(match.id, {
    [column]: stringify(sheet),
    result_state: nextState,
    status: nextState === RESULT_STATES.ADMIN_REVIEW ? 'disputed' : match.status,
    result_history: appendHistory(match, {
      event: 'dispute_opened',
      side: actor.side,
      home_score: scores.home_score,
      away_score: scores.away_score,
    }),
  });
  const fresh = await loadMatch(match.id);
  if (nextState === RESULT_STATES.ADMIN_REVIEW) {
    await notifyMatchSide(fresh, 'home', 'match_disputed', 'Match result in admin review', 'Both clubs submitted dispute evidence. An admin will resolve it.', 'admin_review').catch(() => {});
    await notifyMatchSide(fresh, 'away', 'match_disputed', 'Match result in admin review', 'Both clubs submitted dispute evidence. An admin will resolve it.', 'admin_review').catch(() => {});
  } else {
    await notifyDispute(fresh, other, 'dispute_evidence_required');
  }
  return {
    data: {
      status: nextState === RESULT_STATES.ADMIN_REVIEW ? 'disputed' : 'waiting_dispute_evidence',
      result_state: nextState,
    },
  };
}

async function submitDisputeEvidence(match, actor, args) {
  if (match.result_state !== RESULT_STATES.DISPUTED) {
    throw httpError('This match is not waiting for dispute evidence.', 409, 'NOT_DISPUTED');
  }
  if (!args.proof_url) {
    throw httpError('Screenshot proof is required.', 400, 'PROOF_REQUIRED');
  }
  const scores = declaredFromArgs(args, actor.side);
  const sheet = disputeSheet(args, actor.side, scores);
  const column = actor.side === 'home' ? 'home_dispute_submission' : 'away_dispute_submission';
  const other = oppositeSide(actor.side);
  const otherColumn = other === 'home' ? 'home_dispute_submission' : 'away_dispute_submission';
  const otherAlready = parseSubmission(match[otherColumn]);
  const nextState = otherAlready ? RESULT_STATES.ADMIN_REVIEW : RESULT_STATES.DISPUTED;
  await patchMatch(match.id, {
    [column]: stringify(sheet),
    result_state: nextState,
    status: nextState === RESULT_STATES.ADMIN_REVIEW ? 'disputed' : match.status,
    result_history: appendHistory(match, { event: 'dispute_evidence', side: actor.side }),
  });
  const fresh = await loadMatch(match.id);
  if (nextState === RESULT_STATES.ADMIN_REVIEW) {
    await notifyMatchSide(fresh, 'home', 'match_disputed', 'Match result in admin review', 'Both clubs submitted dispute evidence. An admin will resolve it.', 'admin_review').catch(() => {});
    await notifyMatchSide(fresh, 'away', 'match_disputed', 'Match result in admin review', 'Both clubs submitted dispute evidence. An admin will resolve it.', 'admin_review').catch(() => {});
  }
  return {
    data: {
      status: nextState === RESULT_STATES.ADMIN_REVIEW ? 'disputed' : 'waiting_dispute_evidence',
      result_state: nextState,
    },
  };
}

async function handleSubmitResult(match, actor, args, proofOcr) {
  let state = String(match.result_state || '');
  if (!state && Number(match.result_home_submitted)) {
    state = RESULT_STATES.AWAITING_AWAY_CONFIRMATION;
  }
  if (!state) state = RESULT_STATES.AWAITING_RESULT;

  if (state === RESULT_STATES.AWAITING_RESULT) {
    return submitInitialResult(match, actor, args, proofOcr);
  }
  if (state === RESULT_STATES.AWAITING_AWAY_CONFIRMATION) {
    const submitSide = currentSubmitSide(match);
    if (actor.side === submitSide) {
      throw httpError('Waiting for the other side to confirm the result.', 409, 'AWAITING_CONFIRMATION');
    }
    const homeSub = parseSubmission(match.home_submission);
    const awaySub = parseSubmission(match.away_submission);
    const submitted = submitSide === 'home' ? homeSub : awaySub;
    const claimed = declaredFromArgs(args, actor.side);
    if (submitted && scoresAgree(submitted, claimed)) {
      return confirmResult(match, actor, args);
    }
    return proposeCorrection(match, actor, args);
  }
  if (state === RESULT_STATES.AWAITING_HOME_REVIEW) {
    const submitSide = currentSubmitSide(match);
    if (actor.side === submitSide) {
      return acceptCorrection(match, actor);
    }
    throw httpError('Waiting for the original submitting side to review the correction.', 409, 'AWAITING_HOME_REVIEW');
  }
  throw httpError('This match is not accepting a result submission.', 409, 'RESULT_LOCKED');
}

module.exports = {
  settleMatchDeadlines,
  settleClubMatches,
  handleSubmitResult,
  submitInitialResult,
  confirmResult,
  proposeCorrection,
  acceptCorrection,
  counterResult,
  disputeResult,
  submitDisputeEvidence,
  acceptedForMatch,
  parseSubmission,
};
