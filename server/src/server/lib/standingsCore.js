// Keep this pure calculation identical in the frontend and server adapters.
// Cross-runtime parity is covered by tournamentStandings.test.mjs.
const normalizeId = value => value == null ? '' : String(value).trim();
const confirmedStates = new Set(['confirmed', 'auto_confirmed_timeout', 'admin_confirmed', 'admin_resolved']);
function confirmedStandingResult(m) {
  const state = String(m.result_state || '').toLowerCase();
  return ['completed', 'forfeit'].includes(String(m.status || '').toLowerCase())
    && (!state || confirmedStates.has(state))
    && (m.status === 'forfeit' || confirmedStates.has(state) || Number(m.stats_processed) === 1);
}
function compareSportingRows(a, b) {
  return b.Pts - a.Pts || b.GD - a.GD || b.GF - a.GF;
}
function calculateStandings(matches = [], options = {}) {
  const kind = options.participant_type === 'player' ? 'player' : 'club';
  const types = options.phase === 'ucl_league' ? ['ucl_league', 'swiss_ucl'] : options.phase === 'group' ? ['group', 'group_stage'] : ['league'];
  const issues = [], table = new Map(), seen = new Map();
  const issue = (code, match_id, detail) => issues.push({ code, match_id, detail });
  const roster = options.participants;
  const add = p => {
    const id = normalizeId(typeof p === 'object' ? p?.id : p);
    if (!id) { issue('invalid_registration', null, p); return; }
    if (table.has(id)) return;
    const name = p?.gamertag || p?.name;
    if (!name) issue('missing_profile', null, id);
    table.set(id, { id, name: name || `Unavailable ${kind} (${id})`, avatar_url: p?.avatar_url || p?.logo_url,
      P: 0, W: 0, D: 0, L: 0, GF: 0, GA: 0, GD: 0, Pts: 0, rank: 0 });
  };
  if (Array.isArray(roster)) roster.forEach(add);
  // Compatibility for older callers without a roster; explicit rosters are strict.
  else for (const m of matches.filter(m => types.includes(String(m.type || '').toLowerCase()))) for (const side of ['home', 'away']) {
    const id = normalizeId(m[`${side}_${kind}_id`]);
    if (id) add({ id, name: m[`${side}_${kind}_name`] });
  }
  const candidates = matches.filter(m => types.includes(String(m.type || '').toLowerCase())
    && (!options.tournament_id || normalizeId(m.tournament_id) === normalizeId(options.tournament_id))
    && (!options.edition_id || normalizeId(m.edition_id || m.tournament_id) === normalizeId(options.edition_id))
    && !m.placeholder && !m.is_preview && !m.obsolete && !m.voided_at && !m.superseded_by);
  // Conflicting duplicate representations must never be resolved by input order.
  const signature = m => JSON.stringify([m.status, m.result_state, m.home_score, m.away_score,
    normalizeId(m[`home_${kind}_id`]), normalizeId(m[`away_${kind}_id`]), normalizeId(m[`winner_${kind}_id`])]);
  const identity = m => normalizeId(m.match_id || m.id || m.source_fixture_id);
  const conflicting = new Set();
  for (const m of candidates) {
    const key = identity(m);
    if (key && seen.has(key) && seen.get(key) !== signature(m)) conflicting.add(key);
    if (key) seen.set(key, signature(m));
  }
  seen.clear();
  let counted = 0;
  for (const m of candidates) {
    const key = identity(m);
    if (conflicting.has(key)) { issue('conflicting_duplicate', m.id, key); continue; }
    if (key && seen.has(key)) continue;
    if (key) seen.set(key, true);
    if (!confirmedStandingResult(m)) continue;
    const hId = normalizeId(m[`home_${kind}_id`]), aId = normalizeId(m[`away_${kind}_id`]);
    if (!hId || !aId || hId === aId || !table.has(hId) || !table.has(aId)) {
      issue('invalid_participants', m.id, { home: hId, away: aId }); continue;
    }
    const validScore = s => ['number','string'].includes(typeof s) && String(s).trim() !== '' && Number.isInteger(Number(s)) && Number(s) >= 0;
    if (!validScore(m.home_score) || !validScore(m.away_score)) { issue('invalid_score', m.id); continue; }
    const hs = Number(m.home_score), as = Number(m.away_score);
    let winner = hs > as ? hId : as > hs ? aId : '';
    const explicit = normalizeId(m[`winner_${kind}_id`]);
    // Established forfeit decisions can award a winner on an equal score.
    if (m.status === 'forfeit' && hs === as && [hId, aId].includes(explicit)) winner = explicit;
    if (explicit && explicit !== winner) { issue('contradictory_winner', m.id, explicit); continue; }
    const h = table.get(hId), a = table.get(aId);
    h.P++; a.P++; h.GF += hs; h.GA += as; a.GF += as; a.GA += hs;
    h.GD = h.GF - h.GA; a.GD = a.GF - a.GA;
    if (winner) { const w = winner === hId ? h : a, l = winner === hId ? a : h; w.W++; l.L++; w.Pts += 3; }
    else { h.D++; a.D++; h.Pts++; a.Pts++; }
    counted++;
  }
  const rows = [...table.values()].sort((a, b) => compareSportingRows(a, b) || a.id.localeCompare(b.id));
  rows.forEach((r, i) => { r.rank = i && compareSportingRows(rows[i - 1], r) === 0 ? rows[i - 1].rank : i + 1; });
  if (counted && ['registration', 'open', 'draft'].includes(options.status)) issue('results_before_start', null, counted);
  return { rows, issues, counted, unresolved_ties: rows.filter((r, i) => i > 0 && compareSportingRows(rows[i - 1], r) === 0).map(r => r.id) };
}

module.exports = { calculateStandings, compareSportingRows, confirmedStandingResult, normalizeId };
