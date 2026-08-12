const { EXECUTESQL } = require('../db/database');

const COMPLETE_STATUSES = new Set(['completed', 'confirmed', 'played', 'forfeit']);

function number(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function isCompleted(match) {
  return COMPLETE_STATUSES.has(String(match.status || '').trim().toLowerCase());
}

function isRankedArrangedGame(match) {
  const source = String(match.source_fixture_type || match.type || '').trim().toLowerCase();
  return source === 'game_day' || source === 'gameday' || source === 'arranged_game';
}

function isSoloPlayerMatch(match) {
  return ['solo', 'player'].includes(String(match.mode || '').trim().toLowerCase());
}

function classifyMatchSource(match) {
  const source = String(match.source_fixture_type || '').trim().toLowerCase();
  if (source === 'competition_engine') {
    const productType = String(match.competition_product_type || '').trim().toLowerCase();
    if (productType === 'regional_league') return 'Regional League';
    if (productType === 'official_competition') return 'Competition';
  }
  if (source === 'regional_league' || source === 'regional-league') return 'Regional League';
  if (source === 'competition' || source === 'competition_fixture' || source === 'competition-fixture') return 'Competition';
  if (match.tournament_id) return number(match.tournament_is_official) ? 'STAGE Tournament' : 'Community Tournament';
  return 'Arranged Game';
}

function resolveResult(goalsFor, goalsAgainst) {
  if (goalsFor > goalsAgainst) return 'W';
  if (goalsFor < goalsAgainst) return 'L';
  return 'D';
}

function trophyCount(trophies) {
  return trophies.reduce((total, trophy) => {
    const wins = trophy.win_count === undefined || trophy.win_count === null ? 1 : number(trophy.win_count);
    return total + Math.max(0, wins);
  }, 0);
}

function summarizeClubCareer({ player, stats, matches, trophies }) {
  const matchById = new Map(matches.map((match) => [String(match.id || match.match_id), match]));
  const summary = {
    games: 0,
    goals: 0,
    assists: 0,
    avg_rating: 0,
    wins: 0,
    draws: 0,
    losses: 0,
    motm: 0,
    trophies_won: trophyCount(trophies),
    ranking_points: number(player?.ranking_points),
    history: [],
  };
  let ratingTotal = 0;

  for (const stat of stats) {
    const match = matchById.get(String(stat.match_id));
    if (!match || !isCompleted(match)) continue;
    if (String(match.type || '').toLowerCase() === 'friendly' && !isRankedArrangedGame(match)) continue;

    const clubId = stat.club_id || player?.club_id;
    const isHome = clubId && String(clubId) === String(match.home_club_id);
    const isAway = clubId && String(clubId) === String(match.away_club_id);
    if (!isHome && !isAway) continue;

    const goalsFor = number(isHome ? match.home_score : match.away_score);
    const goalsAgainst = number(isHome ? match.away_score : match.home_score);
    const result = resolveResult(goalsFor, goalsAgainst);
    const goals = number(stat.goals);
    const assists = number(stat.assists);
    const rating = number(stat.rating);
    const isMotm = Boolean(number(stat.is_motm));

    summary.games += 1;
    summary.goals += goals;
    summary.assists += assists;
    summary.motm += isMotm ? 1 : 0;
    ratingTotal += rating;
    if (result === 'W') summary.wins += 1;
    else if (result === 'D') summary.draws += 1;
    else summary.losses += 1;
    summary.history.push({
      match_id: match.id || stat.match_id,
      source_label: classifyMatchSource(match),
      result,
      goals,
      assists,
      rating,
      is_motm: isMotm,
      score: `${goalsFor}-${goalsAgainst}`,
      played_at: match.scheduled_date || match.updated_date || match.created_date || null,
    });
  }

  summary.avg_rating = summary.games ? Math.round((ratingTotal / summary.games) * 100) / 100 : 0;
  summary.history.sort((a, b) => String(b.played_at || '').localeCompare(String(a.played_at || '')));
  return summary;
}

function summarizePlayerCareer({ player, matches, trophies }) {
  const summary = {
    games: 0,
    goals_for: 0,
    goals_against: 0,
    wins: 0,
    draws: 0,
    losses: 0,
    trophies_won: trophyCount(trophies),
    history: [],
  };

  for (const match of matches) {
    if (!isCompleted(match) || !isSoloPlayerMatch(match)) continue;
    const isHome = String(match.home_player_id) === String(player?.id);
    const isAway = String(match.away_player_id) === String(player?.id);
    if (!isHome && !isAway) continue;

    const goalsFor = number(isHome ? match.home_score : match.away_score);
    const goalsAgainst = number(isHome ? match.away_score : match.home_score);
    const result = resolveResult(goalsFor, goalsAgainst);
    summary.games += 1;
    summary.goals_for += goalsFor;
    summary.goals_against += goalsAgainst;
    if (result === 'W') summary.wins += 1;
    else if (result === 'D') summary.draws += 1;
    else summary.losses += 1;
    summary.history.push({
      match_id: match.id,
      source_label: classifyMatchSource(match),
      result,
      opponent_id: isHome ? match.away_player_id : match.home_player_id,
      opponent_name: isHome ? match.away_player_name : match.home_player_name,
      goals_for: goalsFor,
      goals_against: goalsAgainst,
      score: `${goalsFor}-${goalsAgainst}`,
      played_at: match.scheduled_date || match.updated_date || match.created_date || null,
    });
  }

  summary.history.sort((a, b) => String(b.played_at || '').localeCompare(String(a.played_at || '')));
  return summary;
}

async function getPlayerCareerSummary(playerId) {
  const playerRows = await EXECUTESQL(
    'SELECT p.id, p.email, p.club_id, p.ranking_points FROM players p WHERE p.id = ? LIMIT 1',
    [playerId]
  );
  const player = playerRows[0] || { id: playerId, ranking_points: 0 };
  const [stats, soloMatches, trophies] = await Promise.all([
    EXECUTESQL(
      `SELECT mps.*, m.id AS match_id, m.home_club_id, m.away_club_id,
              m.home_score, m.away_score, m.status, m.type, m.mode,
              m.tournament_id, m.source_fixture_type, m.competition_context,
              m.scheduled_date, m.updated_date, m.created_date,
              ci.product_type AS competition_product_type,
              CASE WHEN creator_user.role_id IN (0, 2) OR organizer_user.role_id IN (0, 2)
                THEN 1 ELSE 0 END AS tournament_is_official
         FROM match_player_stats mps
         JOIN matches m ON m.id = mps.match_id
         LEFT JOIN tournaments t ON t.id = m.tournament_id
         LEFT JOIN competition_instances ci ON ci.id = m.competition_context
         LEFT JOIN users creator_user ON LOWER(creator_user.email) = LOWER(t.creator_email)
         LEFT JOIN users organizer_user ON LOWER(organizer_user.email) = LOWER(t.organizer_email)
        WHERE mps.player_id = ? OR (mps.player_email IS NOT NULL AND LOWER(mps.player_email) = LOWER(?))`,
      [playerId, player.email || '']
    ),
    EXECUTESQL(
      `SELECT m.*, ci.product_type AS competition_product_type,
              CASE WHEN creator_user.role_id IN (0, 2) OR organizer_user.role_id IN (0, 2)
                THEN 1 ELSE 0 END AS tournament_is_official
         FROM matches m
         LEFT JOIN tournaments t ON t.id = m.tournament_id
         LEFT JOIN competition_instances ci ON ci.id = m.competition_context
         LEFT JOIN users creator_user ON LOWER(creator_user.email) = LOWER(t.creator_email)
         LEFT JOIN users organizer_user ON LOWER(organizer_user.email) = LOWER(t.organizer_email)
        WHERE (home_player_id = ? OR away_player_id = ?) AND m.mode IN ('solo','player')`,
      [playerId, playerId]
    ),
    EXECUTESQL('SELECT * FROM trophy_placements WHERE owner_id = ?', [playerId]),
  ]);
  const matches = stats.map((stat) => ({ ...stat, id: stat.match_id }));

  return {
    player_id: playerId,
    club_career: summarizeClubCareer({ player, stats, matches, trophies }),
    player_career: summarizePlayerCareer({ player, matches: soloMatches, trophies }),
  };
}

module.exports = {
  getPlayerCareerSummary,
  classifyMatchSource,
  summarizeClubCareer,
  summarizePlayerCareer,
};
