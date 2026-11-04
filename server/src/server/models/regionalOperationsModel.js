'use strict';
class RegionalOperationsModel {
  async actor(id,q) {return (await q('SELECT id,role_id FROM users WHERE id=?',[id]))[0];}
  async records(q) {
    return q("SELECT id,entity_type,status,data_json FROM league_entities WHERE entity_type IN ('regional_league','regional_registration_window','season_registration','regional_cycle','regional_cycle_progress','regional_cup_edition','regional_cup_progress','regional_calendar','competition_settlement') ORDER BY id");
  }
  async fixtures(q) {
    return q("SELECT cf.id AS fixture_id,cf.match_id,cf.competition_instance_id,m.id,m.status,m.result_state,m.home_club_id,m.away_club_id,m.home_score,m.away_score,m.decided_on_penalties,m.penalty_winner_side,m.winner_club_id,m.confirmed_date,m.scheduled_date,m.timezone FROM competition_fixtures cf INNER JOIN competition_instances ci ON ci.id=cf.competition_instance_id LEFT JOIN matches m ON m.id=cf.match_id WHERE ci.product_type='regional_cup' OR (ci.product_type='regional_league' AND ci.legacy_source_type='regional_cycle') ORDER BY cf.id");
  }
}
module.exports={RegionalOperationsModel};
