'use strict';
const { v4: uuid, v5 } = require('uuid');
const { EXECUTESQL, withTransaction } = require('../db/database');
const model = require('../models/tournamentWithdrawalModel');
const schedules = require('./tournamentScheduleService');
const { matchWindows } = require('../lib/officialMatchWindows');
const { isConfirmedResult } = require('../lib/tournamentStatistics');
const { addUserCredits, getUserCredits } = require('./userCreditsService');
const parse = (value, fallback) => { try { return typeof value === 'string' ? JSON.parse(value) : value || fallback; } catch { return fallback; } };
const fail = (message, status = 409) => { throw Object.assign(Error(message), { status }); };
const closed = t => ['completed', 'archived', 'cancelled', 'canceled'].includes(t.status);
function policy(t, matches, schedule, proof, now = Date.now()) {
  const instants = (schedule?.entries || []).map(e => Date.parse(e.starts_at));
  for (const match of matches) { if (!match.confirmed_date && !match.scheduled_date) continue; try { instants.push(Date.parse(matchWindows({ ...match, timezone: match.timezone || schedule?.timezone || t.timezone || 'Europe/Brussels' }).kickoff_at)); } catch { /* A drawn fixture still requires organizer review below. */ } }
  if (!instants.some(Number.isFinite) && t.start_date) instants.push(Date.parse(matchWindows({ scheduled_date: t.start_date, timezone: t.timezone || 'Europe/Brussels' }).kickoff_at));
  const first = Math.min(...instants.filter(Number.isFinite));
  const started = t.status === 'in_progress' || matches.some(m => ['in_progress', 'completed', 'played', 'forfeit', 'awaiting_confirmation', 'disputed'].includes(m.status) || m.home_submission || m.away_submission) || first <= now;
  const uncertainPayment = ((!proof || proof.credits_spent == null || !proof.submitted_by_user_id) && Number(t.entry_credits || 0) > 0) || ((!proof || proof.stc_locked == null) && Number(t.entry_fee_stc || 0) > 0);
  return { mode: closed(t) ? 'closed' : !started && !matches.length && !uncertainPayment ? 'immediate' : 'request', started, drawn: matches.length > 0, payment_review_required: uncertainPayment, first_kickoff_at: Number.isFinite(first) ? new Date(first).toISOString() : null };
}
async function load(id, q, lock = false) {
  const [t] = await q('SELECT * FROM tournaments WHERE id=?' + (lock ? ' FOR UPDATE' : ''), [id]);
  if (!t) fail('Tournament not found.', 404);
  return t;
}
async function notice(t, club, record, event, q) {
  const rows = await q('SELECT email FROM users WHERE id IN (?,?)', [club.president_user_id || null, club.user_id || null]);
  const emails = new Set([...rows.map(u => u.email), club.owner_email, t.creator_email, t.organizer_email].filter(Boolean).map(e => String(e).trim().toLowerCase()));
  const text = event === 'withdrawn' ? 'The club has withdrawn before the draw and first kickoff. Captured entry charges have been refunded to the original payer.' : event === 'requested' ? 'The Manager requested withdrawal. Participation and the published fixtures remain in force until the organizer decides.' : event === 'approved' ? 'The organizer approved the withdrawal. There is no automatic refund. Existing results remain intact; affected fixtures and qualification require an explicit sporting resolution before progression resumes.' : event === 'resolved' ? 'The organizer recorded the sporting resolution. Existing match and payment history have been retained.' : 'The organizer declined the withdrawal request. Participation and fixtures remain in force.';
  for (const email of emails) {
    const id = v5(`tournament_withdrawal:${record.id}:${event}:${email}`, v5.URL);
    await q("INSERT INTO inbox_messages (id,recipient_email,sender_email,sender_gamertag,subject,body,message_type,action_type,related_entity_id,related_entity_type,idempotency_key,is_system) VALUES (?,?, 'system@stage.com','STAGE Tournaments',?,?,'general','none',?,'tournament',?,1) ON DUPLICATE KEY UPDATE id=id", [id, email, `Tournament withdrawal — ${t.name}`, `Dear Manager and Organizer,\n\n${club.name}: ${text}\n\n${record.reason || ''}\n\nReview the tournament at /tournaments/${t.id}.\n\nSTAGE Tournaments`, t.id, `tournament_withdrawal:${id}`]);
  }
}
async function audit(user, action, t, before, after, reason, q) {
  if (user.role_id != null && [0, 2].includes(Number(user.role_id))) await require('./rewardConfigurationService').audit(q, user, action, 'tournament', t.id, before, after, reason);
}
async function read(id, context, actor) {
  const t = await load(id, EXECUTESQL);
  let organizer = false;
  try { await schedules.assertOrganizer(t, actor, EXECUTESQL); organizer = true; } catch (e) { if (e.status !== 403) throw e; }
  let who = null;
  if (context.club_id) try { who = await schedules.assertParticipant(t, context, actor, EXECUTESQL); } catch (e) { if (![403, 404].includes(e.status)) throw e; }
  const matches = await EXECUTESQL('SELECT * FROM matches WHERE tournament_id=?', [id]);
  const [plan] = await EXECUTESQL("SELECT * FROM league_entities WHERE entity_type='tournament_schedule' AND JSON_UNQUOTE(JSON_EXTRACT(data_json,'$.tournament_id'))=?", [id]);
  const proofs = parse(t.registration_proofs, { club: {} });
  const proof = proofs.club?.[who?.participant];
  const requests = organizer || who ? (await model.selectAll(id)).filter(r => organizer || r.club_id === who.participant) : [];
  return { organizer, can_act: Boolean(who), policy: policy(t, matches, plan ? parse(plan.data_json, {}) : null, proof), requests, withdrawn: proof?.status === 'withdrawn', pending_entry: proof?.status === 'pending', registered: who ? parse(t.registered_clubs, []).includes(who.participant) : false };
}
async function withdraw(id, body, actor) {
  return withTransaction(async q => {
    const t = await load(id, q, true);
    if (t.participant_type === 'player') fail('This action is for club tournaments.', 422);
    const who = await schedules.assertParticipant(t, body, actor, q);
    const [user] = await q('SELECT id,email,role_id FROM users WHERE id=?', [actor.id]);
    const [club] = await q('SELECT * FROM clubs WHERE id=? FOR UPDATE', [who.participant]);
    const registered = parse(t.registered_clubs, []), proofs = parse(t.registration_proofs, { club: {} });
    const proof = proofs.club?.[club.id];
    if (proof?.status === 'withdrawn') fail('The club has already withdrawn from this entry.');
    if (!registered.includes(club.id) && proof?.status !== 'pending') fail('The club has no active tournament entry.');
    const matches = await q('SELECT * FROM matches WHERE tournament_id=? FOR UPDATE', [id]);
    const [schedule] = await q("SELECT * FROM league_entities WHERE entity_type='tournament_schedule' AND JSON_UNQUOTE(JSON_EXTRACT(data_json,'$.tournament_id'))=?", [id]);
    const current = policy(t, matches, schedule ? parse(schedule.data_json, {}) : null, proof);
    if (current.mode === 'closed') fail('Withdrawals are closed for this tournament.');
    const existing = (await model.selectAll(id, q)).find(r => r.club_id === club.id && ['pending', 'approved'].includes(r.status));
    if (existing) return { success: true, mode: 'request', request: existing, registered_clubs: registered, already_applied: true };
    const record = { id: uuid(), tournament_id: id, club_id: club.id, club_name: club.name, requested_by: user.id, requested_at: new Date().toISOString(), status: current.mode === 'immediate' ? 'withdrawn' : 'pending', stage: current.mode === 'immediate' ? 'before_draw' : current.started ? 'during_play' : current.drawn ? 'after_draw' : 'payment_review', reason: String(body.reason || '').trim().slice(0, 2000), policy_version: 'tournament_withdrawal_v1' };
    if (current.mode === 'request') {
      if (!record.reason) fail('Explain why your club needs to withdraw.', 422);
      await model.create(record, q); await notice(t, club, record, 'requested', q); await audit(user, 'request_tournament_withdrawal', t, null, record, record.reason, q);
      return { success: true, mode: 'request', request: record, registered_clubs: registered };
    }
    const credits = Number(proof?.credits_spent || 0), stc = Number(proof?.stc_locked || 0), payer = proof?.submitted_by_user_id;
    if (![credits, stc].every(n => Number.isFinite(n) && n >= 0)) fail('Entry payment history requires organizer review.');
    if (credits > 0) await addUserCredits(payer, credits, q);
    let balance = Number(club.stc || 0);
    if (stc > 0) { balance += stc; await q('UPDATE clubs SET stc=?,updated_date=NOW() WHERE id=?', [balance, club.id]); await q('INSERT INTO stc_transactions (id,club_id,amount,type,category,description,reference_id,balance_after) VALUES (?,?,?,?,?,?,?,?)', [uuid(), club.id, stc, 'income', 'tournament_refund', `Tournament withdrawal refund: ${t.name}`, id, balance]); }
    const updated = registered.filter(cid => cid !== club.id);
    proofs.club ||= {}; proofs.club[club.id] = { ...proof, status: 'withdrawn', withdrawn_at: record.requested_at, withdrawal_id: record.id, refunded_credits: credits, refunded_stc: stc };
    await q('UPDATE tournaments SET registered_clubs=?,registration_proofs=?,updated_date=NOW() WHERE id=?', [JSON.stringify(updated), JSON.stringify(proofs), id]);
    record.refunded_credits = credits; record.refunded_stc = stc; record.refunded_to_user_id = payer || null;
    await model.create(record, q); await notice(t, club, record, 'withdrawn', q); await audit(user, 'withdraw_tournament_club', t, registered, record, record.reason || 'Manager withdrawal before draw and kickoff', q);
    await require('./tournamentReserveService').registrationChanged({ ...t, registered_clubs: updated, registration_proofs: proofs }, club.id, q);
    return { success: true, mode: 'immediate', registered_clubs: updated, registration_proofs: proofs, club_stc: balance, user_credits: await getUserCredits(user.id, q), refunded_stc: stc, refunded_credits: credits };
  });
}
async function respond(id, requestId, body, actor) {
  return withTransaction(async q => {
    const t = await load(id, q, true), user = await schedules.assertOrganizer(t, actor, q), record = await model.selectOne(requestId, q);
    if (!record || record.tournament_id !== id) fail('Withdrawal request not found.', 404);
    if (closed(t)) fail('This tournament is closed.');
    const action = body.action, reason = String(body.reason || '').trim().slice(0, 2000);
    if (!['approve', 'decline', 'resolve'].includes(action) || !reason) fail('Choose a decision and give its reason.', 422);
    if (record.status === ({ approve: 'approved', decline: 'declined', resolve: 'resolved' })[action]) return { success: true, request: record, already_applied: true };
    if (action === 'resolve' ? record.status !== 'approved' : record.status !== 'pending') fail('This withdrawal request has already changed. Reload it.');
    const before = { ...record }, proofs = parse(t.registration_proofs, { club: {} }); proofs.club ||= {};
    const [club] = await q('SELECT * FROM clubs WHERE id=?', [record.club_id]); if (!club) fail('Club not found.', 404);
    if (action === 'approve') {
      proofs.club[club.id] = { ...proofs.club[club.id], status: 'withdrawn', withdrawal_id: record.id, withdrawal_resolution_required: true };
      // Keep historical participation and results until an explicit sporting resolution.
      await q('UPDATE tournaments SET registration_proofs=?,updated_date=NOW() WHERE id=?', [JSON.stringify(proofs), id]);
    }
    if (action === 'resolve') {
      const matches = await q('SELECT * FROM matches WHERE tournament_id=? FOR UPDATE', [id]);
      const affected = matches.filter(m => [m.home_club_id, m.away_club_id].includes(club.id));
      if (affected.some(m => !isConfirmedResult(m) && !['cancelled', 'canceled', 'voided'].includes(m.status))) fail('Resolve every affected fixture through the existing match/Admin actions first. No results are created or deleted by withdrawal.');
      const candidate = { ...proofs.club[club.id], withdrawal_resolution_required: false };
      proofs.club[club.id] = candidate;
      const preview = require('../lib/tournamentProgression').planTournamentProgression({ ...t, registration_proofs: proofs }, matches, rows => rows);
      if (preview.fixtures.some(m => [m.home?.id, m.away?.id].includes(club.id)) || preview.winner?.id === club.id || preview.conflicts.length) fail('Qualification or final standings still require a sporting resolution. A withdrawn club cannot advance or win.');
      await q('UPDATE tournaments SET registration_proofs=?,updated_date=NOW() WHERE id=?', [JSON.stringify(proofs), id]);
    }
    record.status = { approve: 'approved', decline: 'declined', resolve: 'resolved' }[action]; record.decision_reason = reason; record.decided_by = user.id; record.decided_at = new Date().toISOString();
    await model.update(record, q); await notice(t, club, { ...record, reason }, action === 'decline' ? 'declined' : action === 'resolve' ? 'resolved' : 'approved', q); await audit(user, `tournament_withdrawal_${action}`, t, before, record, reason, q);
    if (action === 'approve') await require('./tournamentReserveService').reconcile({ ...t, registration_proofs: proofs }, q);
    return { success: true, request: record };
  });
}
module.exports = { policy, read, withdraw, respond };
