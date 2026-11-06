'use strict';
const {RegionalProgressModel}=require('./regionalProgressModel');
class RegionalSeasonProgressModel extends RegionalProgressModel {
  constructor(){super('season');}
  async candidates(now,q) {
    return q(`SELECT w.id FROM league_entities w
      LEFT JOIN league_entities j ON j.entity_type='regional_season_progress' AND JSON_UNQUOTE(JSON_EXTRACT(j.data_json,'$.source_id'))=w.id
      WHERE w.entity_type='regional_registration_window' AND w.status='published'
      AND JSON_UNQUOTE(JSON_EXTRACT(w.data_json,'$.season_orchestration_policy_version'))='regional_season_orchestration_v1'
      AND JSON_UNQUOTE(JSON_EXTRACT(w.data_json,'$.confirmation_closes_at'))<=?
      AND COALESCE(JSON_UNQUOTE(JSON_EXTRACT(w.data_json,'$.edition_invalidated')),'false') NOT IN ('true','1')
      AND COALESCE(j.status,'')<>'completed'
      AND COALESCE(JSON_UNQUOTE(JSON_EXTRACT(j.data_json,'$.next_attempt_at')),'')<=?
      ORDER BY COALESCE(JSON_UNQUOTE(JSON_EXTRACT(j.data_json,'$.last_checked_at')),''),w.id LIMIT 50`,[now,now]);
  }
}
module.exports={RegionalSeasonProgressModel};
