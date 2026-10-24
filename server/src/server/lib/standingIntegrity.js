'use strict';
const { calculateStandings, normalizeId } = require('./standingsCore');
const fields = { played: 'P', won: 'W', drawn: 'D', lost: 'L', wins: 'W', draws: 'D', losses: 'L', goals_for: 'GF', goals_against: 'GA', goal_difference: 'GD', points: 'Pts' };
function reviewStandings(scope) {
  const conflicts = [];
  let roster = scope.root.registered_club_ids;
  if (typeof roster === 'string') { try { roster = JSON.parse(roster); } catch { roster = null; } }
  if (!Array.isArray(roster)) { conflicts.push('Authoritative registered_club_ids roster is unavailable'); roster = []; }
  if (roster.some(id => !normalizeId(id))) conflicts.push('Registration contains invalid club identifiers');
  const ids = [...new Set(roster.map(normalizeId).filter(Boolean))];
  const grouped = new Map();
  const invalid = [];
  for (const row of scope.standings) {
    const id = normalizeId(row.club_id);
    if (!id || !ids.includes(id)) { invalid.push(row.id); continue; }
    if (!grouped.has(id)) grouped.set(id, []);
    grouped.get(id).push(row);
  }
  const calculation = calculateStandings(scope.matches, { participants: ids.map(id => scope.participants.find(p => normalizeId(p.id) === id) || { id }), tournament_id: scope.root.id });
  conflicts.push(...calculation.issues.filter(i => i.code !== 'missing_profile').map(i => `${i.code}: ${i.match_id || i.detail}`));
  for (const issue of calculation.issues.filter(i => i.code === 'missing_profile')) conflicts.push(`Registered club profile ${issue.detail} is unavailable; restore or resolve it before repair`);
  // Unverified legacy completed results cannot safely be replaced with zeros.
  if (scope.matches.some(m => ['played','completed','forfeit','awaiting_confirmation'].includes(m.status) && !require('./standingsCore').confirmedStandingResult(m))) conflicts.push('Unconfirmed or unverifiable historical results require review');
  if (invalid.length) conflicts.push('Invalid or unregistered standing rows require explicit resolution');
  const expected = calculation.rows.map(r => ({ club_id: r.id, club_name: r.name, club_logo_url: r.avatar_url, ...Object.fromEntries(Object.entries(fields).map(([k,v]) => [k,r[v]])), position: r.rank }));
  const mismatch = (s,r) => ['played','goals_for','goals_against','goal_difference','points'].some(k => Number(s[k] || 0) !== r[k])
    || Number(s.wins ?? s.won ?? 0) !== r.wins || Number(s.draws ?? s.drawn ?? 0) !== r.draws || Number(s.losses ?? s.lost ?? 0) !== r.losses;
  const mismatches = expected.filter(r => (grouped.get(r.club_id) || []).some(s => mismatch(s,r))).map(r => r.club_id);
  const duplicates = [...grouped].filter(([,rows]) => rows.length > 1).map(([id]) => id);
  const totals = new Set([...Object.keys(fields), 'id', 'created_date', 'updated_date', 'position', 'final_position']);
  const metadata = s => Object.fromEntries(Object.entries(s).filter(([k]) => !totals.has(k)).sort(([a],[b]) => a.localeCompare(b)));
  for (const id of duplicates) {
    const rows = grouped.get(id);
    if (rows.some(r => JSON.stringify(metadata(r)) !== JSON.stringify(metadata(rows[0])))) conflicts.push(`Duplicate metadata differs for ${id}; preserve and resolve explicitly`);
  }
  const gaps = ids.some(id => !grouped.has(id)) || duplicates.length > 0 || mismatches.length > 0 || invalid.length > 0;
  if (gaps && scope.root.status === 'completed') conflicts.push('Completed edition: review champions, qualification, prizes and trophies explicitly before repair');
  if (gaps && scope.matches.some(m => !['league','ucl_league','swiss_ucl'].includes(m.type))) conflicts.push('Downstream stages exist; resolve qualification dependencies before repair');
  return { source_type: scope.source_type, competition_id: scope.root.id, edition_id: scope.edition_id, expected, existing: scope.standings,
    missing: ids.filter(id => !grouped.has(id)), duplicates, invalid, mismatches, conflicts, diagnostics: calculation.issues,
    repairable: conflicts.length === 0, requires_review: conflicts.length > 0 || ids.some(id => !grouped.has(id)) || duplicates.length > 0 || mismatches.length > 0 };
}
module.exports = { reviewStandings, fields };
