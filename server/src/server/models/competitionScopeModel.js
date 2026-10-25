'use strict';
const { EXECUTESQL } = require('../db/database');
const { parse } = require('../lib/tournamentProgression');
const { isConfirmedResult, aggregateTournamentStatistics } = require('../lib/tournamentStatistics');
const kinds = { tournament: null, regional_league: ['regional_league','regional_league_fixture','regional_league_standing','league_id'], competition_season: ['competition_season','competition_fixture','competition_standing','season_id'] };
const unpack = r => ({ ...parse(r.data_json, {}), ...Object.fromEntries(Object.entries(r).filter(([k,v]) => k !== 'data_json' && v != null)) });
class CompetitionScopeModel {
  async selectOne(kind, id, query = EXECUTESQL, lock = false) {
    if (!Object.hasOwn(kinds, kind)) { const e = new Error('Unsupported competition type'); e.status = 400; throw e; }
    const spec = kinds[kind];
    const [stored] = await query(spec ? `SELECT * FROM league_entities WHERE id=? AND entity_type=?${lock ? ' FOR UPDATE' : ''}` : `SELECT * FROM tournaments WHERE id=?${lock ? ' FOR UPDATE' : ''}`, spec ? [id, spec[0]] : [id]);
    if (!stored) { const e = new Error('Competition edition not found'); e.status = 404; throw e; }
    const root = spec ? unpack(stored) : stored;
    if (spec) root.participant_type = 'club';
    let fixtures, standingRows = [], matches;
    if (!spec) {
      matches = await query(`SELECT * FROM matches WHERE tournament_id=?${lock ? ' FOR UPDATE' : ''}`, [id]);
      fixtures = matches;
    } else {
      fixtures = (await query(`SELECT * FROM league_entities WHERE entity_type=? AND ${spec[3]}=?${lock ? ' FOR UPDATE' : ''}`, [spec[1], id])).map(unpack);
      standingRows = (await query(`SELECT * FROM league_entities WHERE entity_type=? AND ${spec[3]}=?${lock ? ' FOR UPDATE' : ''}`, [spec[2], id])).map(unpack);
      const ids = fixtures.map(f => f.id), explicitIds = fixtures.map(f => f.match_id).filter(Boolean);
      const related = ids.length ? await query(`SELECT m.*, cf.legacy_fixture_id AS mapped_fixture_id FROM matches m LEFT JOIN competition_fixtures cf ON cf.match_id=m.id WHERE m.source_fixture_id IN (${ids.map(() => '?').join(',')})${explicitIds.length ? ` OR m.id IN (${explicitIds.map(() => '?').join(',')})` : ''} OR cf.legacy_fixture_id IN (${ids.map(() => '?').join(',')}) ORDER BY m.updated_date DESC, m.id${lock ? ' FOR UPDATE' : ''}`, [...ids, ...explicitIds, ...ids]) : [];
      matches = fixtures.map(f => {
        const m = related.find(m => m.id === f.match_id || m.source_fixture_id === f.id || m.mapped_fixture_id === f.id);
        const legacyConfirmed = ['played','completed','forfeit'].includes(f.status) && (Number(f.stats_processed) === 1 || f.stats_processed === true) && !['DISPUTED','VOIDED','AWAITING_AWAY_CONFIRMATION','AWAITING_HOME_REVIEW'].includes(f.result_state);
        return { ...f, ...m, id: m?.id || f.id, fixture_id: f.id, match_id: m?.id || null, source_fixture_id: f.id, source_fixture_type: kind === 'regional_league' ? 'regional_league' : 'competition', tournament_id: id, type: f.phase || 'league', round: f.phase && f.phase !== 'league' ? f.leg || f.round || 1 : f.matchday || f.round || 1, leg: f.leg, tie_id: f.tie_id, group_number: f.bracket_position ?? f.group_number, status: m ? m.status : legacyConfirmed ? f.status === 'forfeit' ? 'forfeit' : 'completed' : f.status === 'completed' || f.status === 'played' ? 'awaiting_confirmation' : f.status || 'unscheduled', result_state: m ? m.result_state : legacyConfirmed ? 'CONFIRMED' : f.result_state, stats_processed: m ? m.stats_processed : legacyConfirmed ? 1 : 0 };
      });
    }
    if (spec && !root.name) root.name = root.competition_name || fixtures.find(f=>f.competition_name || f.league_name)?.competition_name || fixtures.find(f=>f.league_name)?.league_name;
    const kindName = root.participant_type === 'player' ? 'player' : 'club';
    const ids = [...new Set([...parse(root.registered_club_ids), ...parse(root[kindName === 'player' ? 'registered_players' : 'registered_clubs']), ...standingRows.map(s => s.club_id), ...matches.flatMap(m => [m[`home_${kindName}_id`],m[`away_${kindName}_id`]])].filter(Boolean))];
    const participants = ids.length ? await query(`SELECT id, ${kindName === 'player' ? 'gamertag, avatar_url' : 'name, logo_url'} FROM ${kindName === 'player' ? 'players' : 'clubs'} WHERE id IN (${ids.map(() => '?').join(',')})`, ids) : [];
    const edition = String(root.edition_id || (kind==='regional_league'?`${root.id}:${root.season_number||1}`:root.id));
    return { source_type: kind, root, edition_id: edition, fixtures, matches, participants, standings: standingRows, legacy_references: [id], config_source_id: kind === 'competition_season' ? root.competition_id : id };
  }
  async statistics(scope, query = EXECUTESQL) {
    const ids = scope.matches.map(m => m.id);
    const stats = ids.length ? await query(`SELECT * FROM match_player_stats WHERE match_id IN (${ids.map(() => '?').join(',')})`, ids) : [];
    const playerIds = [...new Set(stats.map(s => s.player_id).filter(Boolean))];
    const profiles = playerIds.length ? await query(`SELECT id, gamertag, avatar_url FROM players WHERE id IN (${playerIds.map(() => '?').join(',')})`, playerIds) : [];
    const t = { ...scope.root, participant_type: 'club', registered_clubs: scope.participants.map(p => p.id) };
    return { ...aggregateTournamentStatistics(t, scope.matches, stats, scope.participants, profiles), completeness: { individual_source: 'confirmed actual participation only', goalkeepers: 'verified full-match GK appearances only', confirmed_matches: scope.matches.filter(isConfirmedResult).length } };
  }
}
module.exports = { CompetitionScopeModel, unpack, kinds };
