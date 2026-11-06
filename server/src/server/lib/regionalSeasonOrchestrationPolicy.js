'use strict';
const VERSION='regional_season_orchestration_v1';
function enabled(window) {
  return window?.status==='published' && !window.edition_invalidated && !window.invalidated_at && window.season_orchestration_policy_version===VERSION && window.policy_version==='regional_registration_v1' && window.result_policy_version==='regional_result_review_v2';
}
module.exports={VERSION,enabled,RECURRING_VERSION:'regional_recurring_schedule_v1'};
