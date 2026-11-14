const parse = (value, fallback) => { try { return typeof value === 'string' ? JSON.parse(value) : value || fallback; } catch { return fallback; } };
export function tournamentStartState(tournament, matches = []) {
  const player = tournament?.participant_type === 'player', kind = player ? 'player' : 'club';
  const proofs = parse(tournament?.registration_proofs, {})[kind] || {};
  const ids = [...new Set(parse(tournament?.[player ? 'registered_players' : 'registered_clubs'], []).map(String))].filter(id => !['withdrawn', 'pending', 'declined', 'rejected'].includes(proofs[id]?.status));
  const capacity = Number(tournament?.max_teams), full = Number.isInteger(capacity) && capacity >= 2 && ids.length === capacity;
  const current = matches.filter(m => !['cancelled', 'canceled', 'voided', 'reset', 'superseded'].includes(m.status));
  const drawn = new Set(current.flatMap(m => [m[`home_${kind}_id`], m[`away_${kind}_id`]]).filter(Boolean).map(String));
  const review = Object.values(proofs).some(p => p.withdrawal_resolution_required);
  const matchesField = current.length > 0 && drawn.size === ids.length && ids.every(id => drawn.has(id));
  return { confirmed: ids.length, capacity, full, hasDraw: current.length > 0, canDraw: full && !review && !current.length, canStart: full && !review && matchesField, reason: review ? 'Resolve the approved withdrawal and its fixture places first.' : !full ? `Waiting for the full field: ${ids.length} / ${Number.isFinite(capacity) ? capacity : '—'} confirmed.` : !current.length ? 'Draw fixtures first. Start unlocks after the draw is saved.' : !matchesField ? 'The saved draw does not match the confirmed field. Resolve the changed places before starting.' : 'Fixtures drawn. The tournament is ready to start.' };
}
