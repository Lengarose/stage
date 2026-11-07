'use strict';
const {RegionalProgressModel,jobId:progressId}=require('./regionalProgressModel');
class RegionalCupRecoveryModel extends RegionalProgressModel {
  constructor(){super('cup');}
  async candidates(now,q) {
    return q("SELECT e.id FROM league_entities e LEFT JOIN league_entities j ON j.entity_type='regional_cup_progress' AND JSON_UNQUOTE(JSON_EXTRACT(j.data_json,'$.source_id'))=e.id WHERE e.entity_type='regional_cup_edition' AND (e.status='running' OR (e.status='completed' AND j.status='running')) AND JSON_UNQUOTE(JSON_EXTRACT(e.data_json,'$.play_enabled')) IN ('true','1') AND COALESCE(JSON_UNQUOTE(JSON_EXTRACT(e.data_json,'$.edition_invalidated')),'false') NOT IN ('true','1') AND COALESCE(JSON_UNQUOTE(JSON_EXTRACT(j.data_json,'$.next_attempt_at')),'')<=JSON_UNQUOTE(?) ORDER BY COALESCE(JSON_UNQUOTE(JSON_EXTRACT(j.data_json,'$.last_checked_at')),''),e.id LIMIT 50",[JSON.stringify(now)]);
  }
}
module.exports={RegionalCupRecoveryModel,jobId:id=>progressId('cup',id)};
