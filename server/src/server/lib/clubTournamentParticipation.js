'use strict';

const {
  fail
} = require('./clubBoardPolicy');
const VERSION = 'club_match_squad_v1';
function rules(value = {}) {
  const min = Number(value.minimum_human_players ?? 2);
  if (!Number.isInteger(min) || min < 2 || min > 11) fail('Minimum human players must be an integer from 2 to 11');
  function bool(v, fallback) {
    if (v == null) return fallback;
    if (v === true || v === 1 || v === '1') return true;
    if (v === false || v === 0 || v === '0') return false;
    fail('Goalkeeper and ANY rules must be boolean');
  }
  return {
    version: VERSION,
    minimum_human_players: min,
    goalkeeper_required: bool(value.goalkeeper_required, false),
    any_allowed: bool(value.any_allowed, true)
  };
}
function validateSelection(value, roster, settings, {
  publish = false
} = {}) {
  const ids = require('../services/officialMatchEligibilityService').playerIds(value);
  const eligible = new Set(roster.filter(p => p.selectable !== false && p.eligible !== false).map(p => p.id));
  if (ids.ids.some(id => !eligible.has(id))) fail('Every selected human must have eligible playing membership for this club', 422);
  if (publish && ids.starters.length < settings.minimum_human_players) fail(`Select at least ${settings.minimum_human_players} eligible human starters`, 422);
  if (value.goalkeeper_player_id && !ids.starters.includes(value.goalkeeper_player_id)) fail('The declared goalkeeper must be a selected starter', 422);
  if (publish && settings.goalkeeper_required && !value.goalkeeper_player_id) fail('A selected human goalkeeper is required', 422);
  if ([true, 1, '1'].includes(value.uses_any) && !settings.any_allowed) fail('ANY is prohibited by the published competition rules', 422);
  return ids;
}
function validateContributions(args, participants, score) {
  const contributions = goalEvents(args.goal_events || [], participants, score);
  for (const stat of args.player_stats || []) {
    const expected = contributions[stat.player_id] || {
      goals: 0,
      assists: 0
    };
    if (Number(stat.goals || 0) !== expected.goals || Number(stat.assists || 0) !== expected.assists) fail('Human goals and assists must match the declared goal events', 422);
  }
  return contributions;
}
// Explicit actor kinds prevent an AI label from accidentally becoming a player ID.
function goalEvents(events, participants, score) {
  if (!Array.isArray(events) || events.length !== Number(score)) fail('Record one goal event for each goal in the team score', 422);
  const ids = new Set(participants),
    stats = {};
  for (const event of events) {
    const kind = event.scorer_kind || (event.scorer_player_id ? 'human' : null);
    if (!['human', 'ai', 'own_goal'].includes(kind)) fail('Choose a human scorer, AI player or own goal');
    if (kind === 'human' && !ids.has(event.scorer_player_id)) fail('The scorer must be an actual participant');
    if (kind !== 'human' && event.scorer_player_id) fail('AI and own-goal entries cannot credit a human scorer');
    const assist = event.assist_kind || (event.assist_player_id ? 'human' : 'none');
    if (!['human', 'ai', 'none'].includes(assist)) fail('Choose a human assist, AI assist or no assist');
    if (kind === 'own_goal' && assist !== 'none') fail('Own goals have no credited assist');
    if (assist === 'human' && !ids.has(event.assist_player_id)) fail('The assister must be an actual participant');
    if (assist !== 'human' && event.assist_player_id) fail('Only human assist entries can credit a player');
    if (kind === 'human' && assist === 'human' && event.scorer_player_id === event.assist_player_id) fail('A player cannot assist their own goal');
    if (kind === 'human') {
      stats[event.scorer_player_id] ??= {
        goals: 0,
        assists: 0
      };
      stats[event.scorer_player_id].goals++;
    }
    if (assist === 'human') {
      stats[event.assist_player_id] ??= {
        goals: 0,
        assists: 0
      };
      stats[event.assist_player_id].assists++;
    }
  }
  return stats;
}
module.exports = {
  VERSION,
  rules,
  validateSelection,
  goalEvents,
  validateContributions
};
