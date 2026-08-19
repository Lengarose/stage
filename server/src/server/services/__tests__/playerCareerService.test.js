const assert = require('node:assert/strict');
const path = require('node:path');
const test = require('node:test');

function loadPlayerCareerServiceWithDbMock(executesql) {
  const servicePath = path.resolve(__dirname, '../playerCareerService.js');
  const dbPath = path.resolve(__dirname, '../../db/database.js');

  delete require.cache[servicePath];
  require.cache[dbPath] = {
    id: dbPath,
    filename: dbPath,
    loaded: true,
    exports: { EXECUTESQL: executesql },
  };

  return require(servicePath);
}

test('club career includes match_player_stats and affects ranking fields', async () => {
  let clubStatsQuery = '';
  const executesql = async (sql, params = []) => {
    if (/SELECT p\.id, p\.email, p\.club_id, p\.ranking_points/.test(sql)) {
      assert.deepEqual(params, ['player-1']);
      return [{ id: 'player-1', email: 'player@example.test', ranking_points: 425 }];
    }
    if (/FROM match_player_stats mps/.test(sql)) {
      clubStatsQuery = sql;
      return [{
        match_id: 'club-match-1', club_id: 'club-1', goals: 2, assists: 1, rating: 8.4, is_motm: 1,
        home_club_id: 'club-1', away_club_id: 'club-2', home_score: 3, away_score: 1,
        home_club_name: 'Home Club', home_club_tag: 'HOM', home_club_logo_url: '/uploads/home.png',
        away_club_name: 'Away Club', away_club_tag: 'AWY', away_club_logo_url: '/uploads/away.png',
        status: 'completed', type: 'ranked', mode: 'club', scheduled_date: '2026-08-01 18:00:00',
      }];
    }
    if (/home_player_id = \? OR away_player_id = \?/.test(sql)) return [];
    if (/FROM trophy_placements/.test(sql)) return [{ id: 'trophy-1', owner_id: 'player-1', win_count: 2 }];
    throw new Error(`Unexpected SQL: ${sql}`);
  };
  const { getPlayerCareerSummary } = loadPlayerCareerServiceWithDbMock(executesql);

  const summary = await getPlayerCareerSummary('player-1');

  assert.match(clubStatsQuery, /COALESCE\(home_club\.name, m\.home_club_name\) AS home_club_name/);
  assert.match(clubStatsQuery, /COALESCE\(away_club\.name, m\.away_club_name\) AS away_club_name/);
  assert.deepEqual(summary.club_career, {
    games: 1, goals: 2, assists: 1, avg_rating: 8.4, wins: 1, draws: 0, losses: 0,
    motm: 1, trophies_won: 2, ranking_points: 425,
    history: [{
      match_id: 'club-match-1', source_label: 'Arranged Game', result: 'W', goals: 2,
      club_id: 'club-1', club_name: 'Home Club', club_tag: 'HOM', club_logo_url: '/uploads/home.png',
      opponent_club_id: 'club-2', opponent_club_name: 'Away Club', opponent_club_tag: 'AWY', opponent_club_logo_url: '/uploads/away.png',
      assists: 1, rating: 8.4, is_motm: true, score: '3-1', played_at: '2026-08-01 18:00:00',
    }],
  });
});

test('player career includes solo player-vs-player matches and does not change ranking fields', async () => {
  let soloQuery = '';
  const executesql = async (sql) => {
    if (/SELECT p\.id, p\.email, p\.club_id, p\.ranking_points/.test(sql)) return [{ id: 'player-1', email: 'player@example.test', ranking_points: 425 }];
    if (/FROM match_player_stats mps/.test(sql)) return [];
    if (/home_player_id = \? OR away_player_id = \?/.test(sql)) {
      soloQuery = sql;
      return [{
        id: 'solo-match-1', home_player_id: 'player-1', away_player_id: 'player-2',
        home_player_name: 'Home Player', away_player_name: 'Away Player', home_score: 4, away_score: 2,
        status: 'completed', type: 'ranked', mode: 'solo', scheduled_date: '2026-08-02 18:00:00',
      }];
    }
    if (/FROM trophy_placements/.test(sql)) return [];
    throw new Error(`Unexpected SQL: ${sql}`);
  };
  const { getPlayerCareerSummary } = loadPlayerCareerServiceWithDbMock(executesql);

  const summary = await getPlayerCareerSummary('player-1');

  assert.deepEqual(summary.player_career, {
    games: 1, goals_for: 4, goals_against: 2, wins: 1, draws: 0, losses: 0,
    trophies_won: 0,
    history: [{
      match_id: 'solo-match-1', source_label: 'Arranged Game', result: 'W', opponent_id: 'player-2',
      opponent_name: 'Away Player', goals_for: 4, goals_against: 2, score: '4-2',
      played_at: '2026-08-02 18:00:00',
    }],
  });
  assert.equal(Object.hasOwn(summary.player_career, 'ranking_points'), false);
  assert.equal(summary.club_career.ranking_points, 425);
  assert.match(soloQuery, /m\.mode IN \('solo','player'\)/);
});

test('career history labels arranged games, community tournaments, STAGE tournaments, regional leagues, and competitions', () => {
  const { classifyMatchSource } = loadPlayerCareerServiceWithDbMock(async () => []);

  assert.equal(classifyMatchSource({ type: 'ranked' }), 'Arranged Game');
  assert.equal(classifyMatchSource({ tournament_id: 'community-1' }), 'Community Tournament');
  assert.equal(classifyMatchSource({ tournament_id: 'stage-1', tournament_is_official: 1 }), 'STAGE Tournament');
  assert.equal(classifyMatchSource({ source_fixture_type: 'regional_league' }), 'Regional League');
  assert.equal(classifyMatchSource({ source_fixture_type: 'competition' }), 'Competition');
  assert.equal(classifyMatchSource({ source_fixture_type: 'competition_engine', competition_product_type: 'regional_league' }), 'Regional League');
  assert.equal(classifyMatchSource({ source_fixture_type: 'competition_engine', competition_product_type: 'official_competition' }), 'Competition');
});

test('engine matches resolve source labels from their persisted competition context', async () => {
  const executesql = async (sql) => {
    if (/SELECT p\.id, p\.email, p\.club_id, p\.ranking_points/.test(sql)) return [{ id: 'player-1', email: 'player@example.test' }];
    if (/FROM match_player_stats mps/.test(sql)) {
      assert.match(sql, /LEFT JOIN competition_instances ci ON ci\.id = m\.competition_context/);
      return [
        {
          match_id: 'regional-engine-match', club_id: 'club-1', goals: 1, assists: 0, rating: 7.1,
          home_club_id: 'club-1', away_club_id: 'club-2', home_score: 2, away_score: 0,
          status: 'completed', mode: 'club', source_fixture_type: 'competition_engine',
          competition_context: 'instance-regional', competition_product_type: 'regional_league',
        },
        {
          match_id: 'competition-engine-match', club_id: 'club-1', goals: 0, assists: 1, rating: 7.5,
          home_club_id: 'club-1', away_club_id: 'club-3', home_score: 1, away_score: 0,
          status: 'completed', mode: 'club', source_fixture_type: 'competition_engine',
          competition_context: 'instance-competition', competition_product_type: 'official_competition',
        },
      ];
    }
    if (/home_player_id = \? OR away_player_id = \?/.test(sql)) return [];
    if (/FROM trophy_placements/.test(sql)) return [];
    throw new Error(`Unexpected SQL: ${sql}`);
  };
  const { getPlayerCareerSummary } = loadPlayerCareerServiceWithDbMock(executesql);

  const summary = await getPlayerCareerSummary('player-1');

  assert.deepEqual(summary.club_career.history.map((entry) => entry.source_label), ['Regional League', 'Competition']);
});

test('player career excludes club-mode matches even when they carry player IDs', () => {
  const { summarizePlayerCareer } = loadPlayerCareerServiceWithDbMock(async () => []);

  const summary = summarizePlayerCareer({
    player: { id: 'player-1' },
    matches: [
      { id: 'club-match', mode: 'club', home_player_id: 'player-1', away_player_id: 'player-2', home_score: 3, away_score: 1, status: 'completed' },
      { id: 'solo-match', mode: 'solo', home_player_id: 'player-1', away_player_id: 'player-2', home_score: 2, away_score: 1, status: 'completed' },
    ],
    trophies: [],
  });

  assert.equal(summary.games, 1);
  assert.deepEqual(summary.history.map((entry) => entry.match_id), ['solo-match']);
});

test('explicit zero trophy win counts remain zero', () => {
  const { summarizeClubCareer, summarizePlayerCareer } = loadPlayerCareerServiceWithDbMock(async () => []);
  const input = { player: { id: 'player-1' }, matches: [], trophies: [{ id: 'trophy-1', win_count: 0 }] };

  assert.equal(summarizeClubCareer({ ...input, stats: [] }).trophies_won, 0);
  assert.equal(summarizePlayerCareer(input).trophies_won, 0);
});

test('missing rows return zeroed career sections', async () => {
  const executesql = async (sql) => {
    if (/SELECT p\.id, p\.email, p\.club_id, p\.ranking_points/.test(sql)) return [];
    if (/FROM match_player_stats mps/.test(sql)) return [];
    if (/home_player_id = \? OR away_player_id = \?/.test(sql)) return [];
    if (/FROM trophy_placements/.test(sql)) return [];
    throw new Error(`Unexpected SQL: ${sql}`);
  };
  const { getPlayerCareerSummary } = loadPlayerCareerServiceWithDbMock(executesql);

  assert.deepEqual(await getPlayerCareerSummary('missing-player'), {
    player_id: 'missing-player',
    club_career: {
      games: 0, goals: 0, assists: 0, avg_rating: 0, wins: 0, draws: 0, losses: 0,
      motm: 0, trophies_won: 0, ranking_points: 0, history: [],
    },
    player_career: {
      games: 0, goals_for: 0, goals_against: 0, wins: 0, draws: 0, losses: 0,
      trophies_won: 0, history: [],
    },
  });
});
