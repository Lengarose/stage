'use strict';

const {
  EXECUTESQL,
  withTransaction
} = require('../db/database');
const {
  ClubBoardModel,
  stableId
} = require('../models/clubBoardModel');
const {
  progression,
  XP_VERSION,
  fail
} = require('../lib/clubBoardPolicy');
const parse = v => typeof v === 'string' ? JSON.parse(v) : v;
function createService({
  model = new ClubBoardModel(),
  query = EXECUTESQL,
  transaction = withTransaction
} = {}) {
  async function read(playerId, q = query) {
    const [sum] = await q("SELECT COALESCE(SUM(CAST(JSON_UNQUOTE(JSON_EXTRACT(data_json,'$.xp')) AS UNSIGNED)),0) AS xp FROM league_entities WHERE entity_type='card_xp_award' AND status='earned' AND JSON_UNQUOTE(JSON_EXTRACT(data_json,'$.player_id'))=?", [playerId]);
    return {
      ...progression(Number(sum?.xp || 0)),
      player_id: playerId,
      provenance: 'Confirmed club-reported participation in captured official matches; not independently EA-verified'
    };
  }
  async function reconcile(matchId) {
    return transaction(async q => {
      const [match] = await q('SELECT * FROM matches WHERE id=? FOR UPDATE', [matchId]);
      const [selectionRow] = await q("SELECT * FROM league_entities WHERE entity_type='official_match_selection' AND JSON_UNQUOTE(JSON_EXTRACT(data_json,'$.match_id'))=? FOR UPDATE", [matchId]);
      const selection = selectionRow ? parse(selectionRow.data_json) : null;
      const [rootRow] = selection ? await q('SELECT * FROM league_entities WHERE id=? FOR UPDATE', [selection.edition_id]) : [];
      const root = rootRow ? parse(rootRow.data_json) : null;
      // Only future captured official selections opt into XP. No inferred XP for
      // old records, user/Admin tournaments, placement, unconfirmed or admin scores.
      const allowed = rootRow && ['regional_league', 'regional_cup_edition', 'competition_season'].includes(rootRow.entity_type);
      const valid = Boolean(match) && allowed && selection?.card_xp_policy_version === XP_VERSION && !root.edition_invalidated && !root.retired && !root.retired_at && !['reset', 'superseded', 'cancelled', 'canceled', 'abandoned', 'retired','voided','deleted'].includes(root.status) && match.status === 'completed' && match.result_state === 'CONFIRMED' && Number(match.report_finalized) === 1 && !Number(match.administrative_result);
      const participants = new Map();
      if (valid) for (const side of ['home', 'away']) {
        const clubId = match[`${side}_club_id`],
          submission = parse(match[`${side}_submission`] || 'null');
        const captured = selection.selections?.[side];
        const roster = captured?.selection || captured;
        if (!roster || captured.club_id !== clubId) fail('The captured squad belongs to a different club', 409);
        const nominated = [...(roster?.starters || roster?.starting_players || []), ...(roster?.bench || roster?.bench_players || [])];
        for (const id of submission?.participating_player_ids || []) {
          if (typeof id !== 'string' || !nominated.includes(id) || participants.has(id)) fail('Confirmed participation disagrees with the frozen Match Squad', 409);
          participants.set(id, clubId);
        }
      }
      const previous = (await q("SELECT * FROM league_entities WHERE entity_type='card_xp_award' AND JSON_UNQUOTE(JSON_EXTRACT(data_json,'$.match_id'))=? ORDER BY id FOR UPDATE", [matchId])).map(r => ({
        ...parse(r.data_json),
        id: r.id
      }));
      const ids = [...new Set([...participants.keys(), ...previous.map(r => r.player_id)])].sort();
      for (const playerId of ids) {
        if (!(await model.player(playerId, q))) fail('Participation player is unavailable', 409);
        const id = stableId(['card_xp', matchId, playerId]),
          old = previous.find(r => r.id === id);
        const earned = participants.has(playerId);
        await model.save('card_xp_award', {
          id,
          policy_version: XP_VERSION,
          match_id: matchId,
          player_id: playerId,
          club_id: participants.get(playerId) || old?.club_id,
          status: earned ? 'earned' : 'revoked',
          xp: earned ? 100 : 0,
          source_edition_id: selection?.edition_id || old?.source_edition_id
        }, q);
      }
      return {
        match_id: matchId,
        awarded_player_ids: [...participants.keys()],
        revoked_player_ids: ids.filter(id => !participants.has(id))
      };
    });
  }
  return {
    read,
    reconcile
  };
}
module.exports = {
  createService,
  ...createService()
};
