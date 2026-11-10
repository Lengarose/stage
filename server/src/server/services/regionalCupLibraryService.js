'use strict';
const { withTransaction } = require('../db/database');
const TrophyItem = require('../models/trophyItemModel');
const { RegionalCupModel } = require('../models/regionalCupModel');
const artwork = require('./gostOverviewService');
const { ensureTrophySource } = require('./regionalCupSources');
const { audit } = require('./rewardConfigurationService');
const fail = (message, status) => Object.assign(new Error(message), { status });

// Library metadata and the Cup default are one action. Edition snapshots and
// earned awards are deliberately outside this transaction's mutation scope.
async function save(id, patch, actor) {
  return withTransaction(async query => {
    const model = new RegionalCupModel();
    const user = await model.actor(actor?.id, query);
    if (!user || user.role_id == null || ![0, 2].includes(Number(user.role_id))) throw fail('Admin trophy access required.', 403);
    await model.lock(query);
    const before = id ? await TrophyItem.getById(id, query, true) : null;
    if (id && !before) throw fail('Trophy not found.', 404);
    const next = { ...before, ...patch };
    const target = next.linked_source_type === 'regional_cup' ? next.linked_source_id : null;
    if (next.linked_source_type === 'regional_cup' && !target) throw fail('Select a Regional Cup.', 400);
    if (target) {
      await ensureTrophySource(target, model, query, user);
      const assignment = await artwork.assignment(target, query, true, 'regional_cup');
      next.linked_source_name = assignment.source.name;
      next.is_official = 1;
      if (next.tournament_id) throw fail('A tournament trophy cannot also be linked to a Regional Cup.', 409);
      if (!next.image_url) throw fail('Upload a trophy image before linking a Regional Cup.', 400);
    }
    const oldType = before?.linked_source_type;
    const oldSource = ['regional_cup', 'regional_league', 'competition'].includes(oldType) ? before.linked_source_id : null;
    const reason = 'Trophy Library: save the selected Regional Cup default';
    if (oldSource && (oldType !== next.linked_source_type || oldSource !== next.linked_source_id)) {
      await TrophyItem.update(id, { linked_source_type: null, linked_source_id: null, linked_source_name: null }, query);
      const old = await artwork.assignment(oldSource, query, true, oldType);
      if (old.settings.trophy_item_id === id || old.source.trophy_item_id === id) {
        await artwork.assign(oldSource, { trophy_item_id: null, revision: old.revision, reason }, user, fn => fn(query), oldType);
      }
    }
    const displaced = target ? await query("SELECT * FROM trophy_items WHERE linked_source_type='regional_cup' AND linked_source_id=? AND id<>? ORDER BY id FOR UPDATE", [target, id || '']) : [];
    for (const item of displaced) await TrophyItem.update(item.id, { linked_source_type: null, linked_source_id: null, linked_source_name: null }, query);
    const saved = id ? await TrophyItem.update(id, next, query) : await TrophyItem.create(next, query);
    if (target) {
      const assignment = await artwork.assignment(target, query, true, 'regional_cup');
      await artwork.assign(target, { trophy_item_id: saved.id, revision: assignment.revision, reason }, user, fn => fn(query), 'regional_cup');
    }
    await audit(query, user, id ? 'update_regional_cup_library_trophy' : 'create_regional_cup_library_trophy', 'trophy_item', saved.id,
      { item: before, displaced }, { item: saved, displaced: displaced.map(item => ({ id: item.id, linked_source_id: null })), edition_snapshots_unchanged: true }, reason);
    return saved;
  });
}
module.exports = { save };
