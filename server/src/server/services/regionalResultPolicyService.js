'use strict';

const { EXECUTESQL } = require('../db/database');
const { RegionalRegistrationModel } = require('../models/regionalRegistrationModel');
const { VERSION, REVIEW_VERSION, RESPONSE_HOURS } = require('../lib/regionalResultPolicy');
const { httpError } = require('../lib/matchResultNegotiation');

function createService({ query = EXECUTESQL, context = id => require('./officialMatchEligibilityService').context(id), windows = new RegionalRegistrationModel() } = {}) {
  async function policyForContext(ctx, q = query) {
    if (!ctx.official) return null;
    let window = ctx.root.participation_window_snapshot;
    if (!window && ctx.root.regional_registration_window_id) {
      window = await windows.selectOne(ctx.root.regional_registration_window_id, q);
      if (!window) throw httpError('Published result conditions are unavailable; Admin review required.', 409, 'RESULT_POLICY_UNAVAILABLE');
    }
    const version = window?.result_policy_version;
    if (!version) return null; // Captured editions retain their published conditions.
    if (![VERSION, REVIEW_VERSION].includes(version)) throw httpError('Unsupported official result policy; Admin review required.', 409, 'RESULT_POLICY_UNAVAILABLE');
    return { version, responseHours: RESPONSE_HOURS, reviewOnTimeout: true, allowEitherInitial: version === VERSION };
  }
  async function policyForMatch(match) {
    if (!['competition_engine', 'regional_league', 'regional_league_fixture', 'regional_pathway'].includes(match.source_fixture_type)) return null;
    return policyForContext(await context(match.id));
  }
  return { policyForMatch, policyForContext };
}

module.exports = { createService, ...createService() };
