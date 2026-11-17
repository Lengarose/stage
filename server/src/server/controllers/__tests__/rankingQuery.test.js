const fs = require('fs');
const path = require('path');
const test = require('node:test');
const assert = require('node:assert/strict');
const { buildBoard, locateIdentity, isRankingAdminRole, previewSummary } = require('../../lib/rankingQuery');

function club(id, points, region, extra = {}) {
  return {
    id,
    name: extra.name || `Club ${id}`,
    tag: extra.tag || id.slice(0, 3).toUpperCase(),
    region,
    country_code: extra.country_code || 'FR',
    platform: extra.platform || 'PS5',
    ranking_points: points,
    wins: extra.wins || 1,
    matches_ranked: 3,
    draws: 0,
    losses: 0,
    global_rank: extra.global_rank,
    logo_url: extra.logo_url || '',
  };
}

test('admin ranking roles include 0 and 2 and exclude ordinary users', () => {
  assert.equal(isRankingAdminRole(0), true);
  assert.equal(isRankingAdminRole(2), true);
  assert.equal(isRankingAdminRole('2'), true);
  assert.equal(isRankingAdminRole(1), false);
  assert.equal(isRankingAdminRole(null), false);
  const source = fs.readFileSync(path.resolve(__dirname, '../rankingController.js'), 'utf8');
  assert.match(source, /isRankingAdminRole\(user\?\.role_id\)/);
  assert.doesNotMatch(source, /role_id\) !== 0/);
});

test('regional filter runs before the page limit and keeps scope rank', () => {
  const clubs = [];
  for (let i = 1; i <= 120; i += 1) {
    clubs.push(club(`c${i}`, 1000 - i, i === 120 ? 'Africa' : 'Europe', { global_rank: i, name: i === 120 ? 'Outside Hundred' : `Europe ${i}` }));
  }
  const board = buildBoard({
    rows: clubs,
    kind: 'club',
    fullAccess: true,
    query: { region: 'Africa', limit: 25, page: 1 },
  });
  assert.equal(board.total_ranked, 120);
  assert.equal(board.matching, 1);
  assert.equal(board.displayed, 1);
  assert.equal(board.rows[0].id, 'c120');
  assert.equal(board.rows[0].global_rank, 120);
  assert.equal(board.rows[0].scope_rank, 1);
  assert.equal(board.facets.regions.includes('Africa'), true);
  assert.equal(board.facets.regions.includes('Europe'), true);
});

test('search does not renumber a global rank to 1', () => {
  const clubs = [
    club('a', 90, 'Europe', { global_rank: 1, name: 'Alpha' }),
    club('b', 80, 'Europe', { global_rank: 2, name: 'Bravo' }),
    club('c', 10, 'Europe', { global_rank: 3, name: 'Charlie' }),
  ];
  const board = buildBoard({
    rows: clubs,
    kind: 'club',
    fullAccess: true,
    query: { q: 'Charlie' },
  });
  assert.equal(board.matching, 1);
  assert.equal(board.rows[0].global_rank, 3);
  assert.equal(board.rows[0].scope_rank, 3);
  assert.notEqual(board.rows[0].scope_rank, 1);
});

test('free access is a labeled preview and does not apply hidden filters', () => {
  const clubs = [];
  for (let i = 1; i <= 30; i += 1) clubs.push(club(`c${i}`, 100 - i, i > 10 ? 'Africa' : 'Europe', { global_rank: i }));
  const board = buildBoard({
    rows: clubs,
    kind: 'club',
    fullAccess: false,
    query: { region: 'Africa', q: 'Club' },
  });
  assert.equal(board.result_kind, 'preview');
  assert.equal(board.access, 'limited');
  assert.equal(board.total_ranked, 30);
  assert.equal(board.displayed, 10);
  assert.equal(board.matching, null);
  assert.equal(board.rows[0].id, 'c1');
  assert.equal(board.rows.some((row) => row.region === 'Africa'), false);
  assert.equal(board.rows[0].ranking_points, undefined);
  assert.equal(board.facets, null);
});

test('find me reports preview, unranked and filtered states without inventing rank 1', () => {
  const clubs = [];
  for (let i = 1; i <= 15; i += 1) clubs.push(club(`c${i}`, 100 - i, 'Europe', { global_rank: i, name: `Club ${i}` }));
  const outside = locateIdentity({ rows: clubs, id: 'c15', kind: 'club', fullAccess: false, query: {} });
  assert.equal(outside.reason, 'outside_preview');
  assert.equal(outside.row, undefined);
  assert.equal(outside.global_rank, undefined);
  const missing = locateIdentity({ rows: clubs, id: 'nope', kind: 'club', fullAccess: true, query: {} });
  assert.equal(missing.reason, 'unranked');
  const searched = locateIdentity({ rows: clubs, id: 'c15', kind: 'club', fullAccess: true, query: { q: 'Club 15' } });
  assert.equal(searched.reason, 'ranked');
  assert.equal(searched.global_rank, 15);
  assert.equal(searched.scope_rank, 15);
  assert.equal(searched.page, 1);
});

test('summary counters stay authoritative when the returned preview is shorter', () => {
  const clubs = [club('a', 10, 'Europe', { global_rank: 1 }), club('b', 9, 'Europe', { global_rank: 2 })];
  const summary = previewSummary({
    clubs,
    players: [],
    positions: [],
    meta: { club_count: 2, ranked_player_count: 0 },
  }, false);
  assert.equal(summary.meta.club_count, 2);
  assert.equal(summary.meta.displayed_clubs, 2);
  assert.equal(summary.meta.result_kind, 'preview');
  assert.notEqual(summary.meta.club_count, undefined);
});
