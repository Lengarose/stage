'use strict';
const {RegionalProgressModel}=require('./regionalProgressModel');
class RegionalCycleRecoveryModel extends RegionalProgressModel {
  constructor(){super('cycle');}
  async candidates(now,q) {
    return q("SELECT e.id FROM league_entities e LEFT JOIN league_entities j ON j.entity_type='regional_cycle_progress' AND JSON_UNQUOTE(JSON_EXTRACT(j.data_json,'$.source_id'))=e.id WHERE e.entity_type='regional_cycle' AND (e.status IN ('running','review') OR (e.status='ready' AND JSON_UNQUOTE(JSON_EXTRACT(e.data_json,'$.automatic_allocation_policy_version'))='regional_auto_allocation_v1') OR (e.status IN ('ready','allocated') AND j.status='running')) AND COALESCE(JSON_UNQUOTE(JSON_EXTRACT(e.data_json,'$.edition_invalidated')),'false') NOT IN ('true','1') AND COALESCE(JSON_UNQUOTE(JSON_EXTRACT(j.data_json,'$.next_attempt_at')),'')<=JSON_UNQUOTE(?) ORDER BY COALESCE(JSON_UNQUOTE(JSON_EXTRACT(j.data_json,'$.last_checked_at')),''),e.id LIMIT 50",[JSON.stringify(now)]);
  }
}
module.exports={RegionalCycleRecoveryModel};
