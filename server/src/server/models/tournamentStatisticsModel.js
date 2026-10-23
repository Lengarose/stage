'use strict';
const { withTransaction } = require('../db/database');
const { aggregateTournamentStatistics } = require('../lib/tournamentStatistics');
const { parse } = require('../lib/tournamentProgression');
class TournamentStatisticsModel {
  async selectByTournament(tournamentId) {
    return withTransaction(async query => {
      const [tournament] = await query('SELECT * FROM tournaments WHERE id=? LIMIT 1', [tournamentId]);
      if (!tournament) return null;
      const matches = await query('SELECT * FROM matches WHERE tournament_id=?', [tournamentId]);
      const stats = await query('SELECT s.* FROM match_player_stats s JOIN matches m ON m.id=s.match_id WHERE m.tournament_id=? ORDER BY s.created_date DESC, s.id DESC', [tournamentId]);
      const player = tournament.participant_type === 'player';
      const ids = [...new Set([...parse(tournament[player ? 'registered_players' : 'registered_clubs']), ...matches.flatMap(m => [m[`home_${player ? 'player' : 'club'}_id`], m[`away_${player ? 'player' : 'club'}_id`]])].filter(Boolean))];
      const participants = ids.length ? await query(`SELECT id, ${player ? 'gamertag, avatar_url' : 'name, logo_url'} FROM ${player ? 'players' : 'clubs'} WHERE id IN (${ids.map(() => '?').join(',')})`, ids) : [];
      const playerIds = [...new Set(stats.map(s => s.player_id).filter(Boolean))];
      const profiles = playerIds.length ? await query(`SELECT id, gamertag, avatar_url FROM players WHERE id IN (${playerIds.map(() => '?').join(',')})`, playerIds) : [];
      return aggregateTournamentStatistics(tournament, matches, stats, participants, profiles);
    });
  }
}
module.exports = TournamentStatisticsModel;
