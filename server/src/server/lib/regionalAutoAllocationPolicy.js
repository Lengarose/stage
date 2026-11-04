'use strict';

const VERSION = 'regional_auto_allocation_v1';
function capturesAutomaticAllocation(window) {
  return window?.policy_version === 'regional_registration_v1' && window.result_policy_version === 'regional_result_review_v2';
}
module.exports = { VERSION, capturesAutomaticAllocation };
