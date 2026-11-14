'use strict';
const parse = (value, fallback) => { try { return typeof value === 'string' ? JSON.parse(value) : value || fallback; } catch { return fallback; } };
const fail = message => { throw Object.assign(Error(message), { status: 409 }); };
function activeParticipants(tournament) {
  const player = tournament.participant_type === 'player';
  const proofs = parse(tournament.registration_proofs, {})[player ? 'player' : 'club'] || {};
  return [...new Set(parse(tournament[player ? 'registered_players' : 'registered_clubs'], []).map(String))].filter(id => !['withdrawn', 'pending', 'rejected', 'declined'].includes(proofs[id]?.status));
}
function assertFullField(tournament) {
  const participants = activeParticipants(tournament), capacity = Number(tournament.max_teams);
  if (!Number.isInteger(capacity) || capacity < 2 || participants.length !== capacity) fail(`Fill all ${Number.isInteger(capacity) && capacity >= 2 ? capacity : 'configured'} participant places before drawing or starting this tournament. Currently confirmed: ${participants.length}.`);
  const proofs = parse(tournament.registration_proofs, {}).club || {};
  if (Object.values(proofs).some(p => p.withdrawal_resolution_required)) fail('Resolve the approved withdrawal and affected fixture places before drawing or starting.');
  return participants;
}
function assertSavedDraw(tournament, matches) {
  const participants = assertFullField(tournament);
  const saved = matches.filter(m => !['cancelled', 'canceled', 'voided', 'reset', 'superseded'].includes(m.status));
  if (!saved.length) fail('Draw the fixtures first, then start the tournament.');
  const kind = tournament.participant_type === 'player' ? 'player' : 'club';
  const drawn = new Set(saved.flatMap(m => [m[`home_${kind}_id`], m[`away_${kind}_id`]]).filter(Boolean).map(String));
  if (drawn.size !== participants.length || participants.some(id => !drawn.has(id))) fail('The saved draw does not match the confirmed participants. Resolve the vacant or replacement places before starting.');
  return saved;
}
module.exports = { activeParticipants, assertFullField, assertSavedDraw };
