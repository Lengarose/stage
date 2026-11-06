'use strict';
class RegionalOperationsModel {
  async actor(id,q) {return (await q('SELECT id,role_id FROM users WHERE id=?',[id]))[0];}
  async records(q) {
    return q("SELECT id,entity_type,status,data_json FROM league_entities WHERE entity_type IN ('regional_league','regional_registration_window','season_registration','regional_confirmation_notice_progress','regional_cycle','regional_cycle_progress','regional_cup_edition','regional_cup_progress','regional_calendar','competition_settlement') ORDER BY id");
  }
  async fixtures(q) {
    const pathways=await q("SELECT cf.id AS fixture_id,cf.match_id,cf.competition_instance_id,m.id,m.status,m.result_state,m.home_club_id,m.away_club_id,m.home_score,m.away_score,m.decided_on_penalties,m.penalty_winner_side,m.winner_club_id,m.confirmed_date,m.scheduled_date,m.timezone FROM competition_fixtures cf INNER JOIN competition_instances ci ON ci.id=cf.competition_instance_id LEFT JOIN matches m ON m.id=cf.match_id WHERE ci.product_type='regional_cup' OR (ci.product_type='regional_league' AND ci.legacy_source_type='regional_cycle') ORDER BY cf.id");
    const leagues=await q(`SELECT DISTINCT lf.id AS fixture_id,e.id AS competition_instance_id,m.id,m.status,m.result_state
      FROM league_entities lf INNER JOIN league_entities e ON e.entity_type='regional_league' AND e.id=lf.league_id
      LEFT JOIN competition_fixtures cf ON cf.legacy_fixture_type='regional_league' AND cf.legacy_fixture_id=lf.id
      INNER JOIN matches m ON (m.source_fixture_type IN ('regional_league','regional_league_fixture') AND m.source_fixture_id=lf.id)
        OR (m.source_fixture_type='competition_engine' AND m.source_fixture_id=cf.id AND m.id=cf.match_id)
      WHERE lf.entity_type='regional_league_fixture' AND (m.status='disputed' OR m.result_state IN ('ADMIN_REVIEW','DISPUTED'))
      ORDER BY e.id,m.id,lf.id`);
    return [...pathways,...leagues];
  }
}
module.exports={RegionalOperationsModel};
