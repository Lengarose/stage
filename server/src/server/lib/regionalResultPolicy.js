'use strict';

const REVIEW_VERSION = 'regional_result_review_v1';
const VERSION = 'regional_result_review_v2';
const RESPONSE_HOURS = 24;
const RULES = 'Official regional results: the home club normally submits after full time, but the away club may submit immediately if no result proposal exists. The first valid proposal opens confirmation for the opponent. The opponent has 24 hours to respond to a result proposal or correction. No response sends the result to Admin review; silence does not confirm a result.';

module.exports = { VERSION, REVIEW_VERSION, RESPONSE_HOURS, RULES };
