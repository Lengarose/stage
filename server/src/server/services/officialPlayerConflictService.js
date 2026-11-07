'use strict';
const { fail } = require('../lib/regionalEditionIdentity');
const { matchWindows } = require('../lib/officialMatchWindows');
const { VERSION } = require('./officialPlayerTransferService');

function duration(match, engine = null) {
  const phase = engine?.phase || match.fixture_phase || match.type;
  return ['league', 'league_phase', 'regional_league'].includes(phase) && !Number(match.allow_penalties) ? 40 : 60;
}
async function assertSelection(ctx, selection, query) {
  if (ctx.root?.participation_window_snapshot?.player_transfer_policy_version !== VERSION || !selection.ids.length) return;
  const ids = [...selection.ids].sort();
  const placeholders = ids.map(() => '?').join(',');
  // All selections of the same player serialize, including different clubs or
  // tournament matches. Draft lineups do not reserve playing time.
  await query(`SELECT id FROM players WHERE id IN (${placeholders}) ORDER BY id FOR UPDATE`, ids);
  const rows = await query(`SELECT DISTINCT m.*, e.phase AS fixture_phase FROM matches m
    LEFT JOIN competition_fixtures e ON e.match_id=m.id
    LEFT JOIN club_fixture_lineups l ON l.status='published'
      AND l.fixture_id IN (m.id,m.source_fixture_id,e.id,e.legacy_fixture_id)
    WHERE m.id<>? AND m.status NOT IN ('cancelled','canceled','voided','deleted','reset','superseded','abandoned')
      AND (m.confirmed_date IS NOT NULL OR m.scheduled_date IS NOT NULL)
      AND (m.home_player_id IN (${placeholders}) OR m.away_player_id IN (${placeholders})
        OR JSON_OVERLAPS(COALESCE(l.starting_players,JSON_ARRAY()),CAST(? AS JSON))
        OR JSON_OVERLAPS(COALESCE(l.bench_players,JSON_ARRAY()),CAST(? AS JSON)))
    ORDER BY m.id FOR UPDATE`, [ctx.match.id, ...ids, ...ids, JSON.stringify(ids), JSON.stringify(ids)]);
  const start = Date.parse(matchWindows(ctx.match).kickoff_at);
  const end = start + duration(ctx.match, ctx.engine) * 60000;
  for (const other of rows) {
    const otherStart = Date.parse(matchWindows(other).kickoff_at);
    if (start < otherStart + duration(other) * 60000 && otherStart < end) fail('A selected player has an overlapping published selection or individual tournament match. Resolve the schedule or selection before continuing.', 422);
  }
}
module.exports = { duration, assertSelection };
