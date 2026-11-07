'use strict';

const { withTransaction } = require('../db/database');
const { RegionalRegistrationModel } = require('../models/regionalRegistrationModel');
const { RegionalCycleModel } = require('../models/regionalCycleModel');
const editions = require('./regionalEditionService');
const { buildCatalogue } = require('../lib/regionalLeagueHierarchy');
const { identity, fail } = require('../lib/regionalEditionIdentity');
const { assessField } = require('../lib/regionalFieldAssessment');

function roster(group) {
  let ids = group.registered_club_ids;
  if (typeof ids === 'string') { try { ids = JSON.parse(ids); } catch { fail('A current group roster cannot be read; review source data.'); } }
  if (!Array.isArray(ids) || ids.some(id => typeof id !== 'string' || !id.trim()) || new Set(ids).size !== ids.length) fail('A current group needs a valid stored roster before field preparation.');
  return ids;
}

function createService({ transaction = withTransaction, windows = new RegionalRegistrationModel(), cycles = new RegionalCycleModel(), editionModel = editions.model, admin = editions.admin, clock = () => new Date() } = {}) {
  async function derive(id, actor, automatic=false) {
    if (typeof id !== 'string' || !id.trim()) fail('Choose a published registration window.', 400);
    return transaction(async q => {
      if(!automatic)await admin(actor, q);
      const window = await windows.selectOne(id, q, true);
      if (!window || window.status !== 'published' || window.edition_invalidated || window.invalidated_at) fail('Choose a current published registration window.');
      if(automatic && !require('../lib/regionalSeasonOrchestrationPolicy').enabled(window))fail('This registration window has no captured automatic season policy.');
      const catalogue = buildCatalogue(await editionModel.selectAll(q, true));
      const definition = catalogue.definitions.find(d => d.id === window.permanent_league_id);
      const anchor = catalogue.groups.find(g => g.permanent_league_id === definition?.id && g.group_code === 'A');
      if (!definition || !anchor || anchor.retired || definition.retired_at || anchor.edition_invalidated || anchor.identity_conflict || anchor.identity_unverified || !anchor.current_edition_id) fail('The registration window has no unambiguous active permanent league.');
      const scope = identity(anchor);
      if (scope.division !== 1 || scope.region_slug !== window.region_slug || scope.platform !== window.platform || Number(scope.reset_series || 0) !== Number(window.reset_series || 0)) fail('The registration window no longer matches its regional system or reset series.');
      const saved=(await cycles.selectAll(q)).filter(c => !c.edition_invalidated && !['reset','cancelled','superseded'].includes(c.status) && c.participation_window_snapshot?.id===id);
      if(saved.length) {
        if(!automatic || saved.length!==1)fail('This field already has a saved regional cycle. Open that cycle instead of drawing again.');
        const cycle=saved[0];
        if(!require('../lib/regionalSeasonOrchestrationPolicy').enabled({...cycle.participation_window_snapshot,status:'published'}) || require('../lib/regionalRegistrationPolicy').windowRevision(cycle.participation_window_snapshot)!==require('../lib/regionalRegistrationPolicy').windowRevision(window))fail('The saved cycle and published automatic participation conditions disagree.');
        if(cycle.region_slug!==window.region_slug || cycle.platform!==window.platform || Number(cycle.season_number)!==Number(window.season_number) || Number(cycle.reset_series || 0)!==Number(window.reset_series || 0))fail('The saved cycle belongs to a different regional scope.');
        return {existing_cycle_id:cycle.id};
      }
      const registrations = await windows.confirmedField(id, q);
      if(window.reserve_policy_version===require('../lib/regionalReservePolicy').VERSION && clock().getTime()<Date.parse(require('../lib/regionalReservePolicy').deadline(window)))fail('Wait until the common reserve deadline before preparing the final field.');
      const assessment = assessField(window, registrations, clock());
      if (assessment.status !== 'structure_supported') fail('The complete confirmation field is not ready for cycle preparation.', 409, assessment.blockers.length ? assessment.blockers : [{ code: 'confirmation_open', message: 'Wait until the common confirmation deadline.' }]);
      const groups = catalogue.groups.filter(g => {
        const i = identity(g);
        return i.region_slug === scope.region_slug && i.platform === scope.platform && Number(i.reset_series || 0) === Number(scope.reset_series || 0) && !g.retired;
      });
      if (groups.some(g => g.identity_conflict || g.identity_unverified || g.edition_invalidated || !g.current_edition_id)) fail('A current group identity requires review before selecting regional sources.');
      let source = groups.filter(g => roster(g).length || !['draft','registration'].includes(g.status));
      if (!source.length) source = [anchor];
      const targetSeason = Number(window.season_number);
      const placement = source.every(g => Number(g.season_number) === targetSeason && ['draft','registration'].includes(g.status));
      const transition = source.every(g => Number(g.season_number) === targetSeason - 1 && ['completed','archived','in_progress','active'].includes(g.status));
      if (!placement && !transition) fail('Current groups do not form one launch field or one preceding season. Review season identities and sporting rights.');
      const sourceClubs = source.flatMap(roster);
      if (new Set(sourceClubs).size !== sourceClubs.length) fail('A club appears in multiple current groups; review source rosters.');
      const confirmed = registrations.filter(r => r.status === 'approved' && r.participation_status === 'confirmed');
      if (sourceClubs.some(id => !confirmed.some(r => r.club_id === id)) && window.reserve_policy_version!==require('../lib/regionalReservePolicy').VERSION) fail('A club with existing sporting rights has not confirmed. Review vacancies or withdrawals; it cannot be silently dropped.');
      return {
        mode: placement ? 'placement' : 'transition',
        source_edition_ids: source.map(g => g.current_edition_id).sort(),
        registration_ids: confirmed.filter(r => !sourceClubs.includes(r.club_id)).map(r => r.id).sort(),
        target_count: assessment.confirmed_clubs,
      };
    });
  }
  return {inputForWindow:(id,actor)=>derive(id,actor),automaticInputForWindow:id=>derive(id,null,true)};
}

module.exports = { createService, ...createService() };
