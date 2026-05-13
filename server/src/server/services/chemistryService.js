/**
 * chemistryService — computes a chemistry multiplier for a squad based on the
 * stored `chemistry_links` plus a few derived links (same nationality, same
 * current club) computed on the fly from the players table.
 *
 * The result is a coefficient roughly in [1.00, 1.15] that the scheduleEngine
 * multiplies into the squad's aggregate "match strength" before the simulation.
 *
 * Conventions:
 *   - All players are looked up in batch (single SQL) to keep this cheap to
 *     call inside the match pipeline.
 *   - Bonus factors are *added* per link, but the total bonus is capped at
 *     MAX_TOTAL_BONUS to avoid pathological squad picks.
 *   - When `cornerstone_player_id` is provided, links touching that player
 *     are doubled (FUT 26 Cornerstone semantic).
 */
const { EXECUTESQL } = require('../db/database');
const ChemistryLinkModel = require('../models/chemistryLinkModel');

const MAX_TOTAL_BONUS    = 0.15;  // +15% absolute cap on the squad-wide multiplier
const NATIONALITY_BONUS  = 0.01;  // per shared-nationality pair
const SAME_CLUB_BONUS    = 0.015; // per same current-club pair
const CORNERSTONE_BOOST  = 2.0;   // multiplier applied to links touching the cornerstone

function canonicalPair(a, b) {
  return String(a) < String(b) ? [a, b] : [b, a];
}

async function loadPlayers(playerIds) {
  if (!playerIds.length) return [];
  const ph = playerIds.map(() => '?').join(',');
  return EXECUTESQL(
    `SELECT id, gamertag, country, country_code, club_id, overall_rating, archetype
       FROM players WHERE id IN (${ph})`,
    playerIds
  );
}

/**
 * @param {string[]} playerIds          The squad's player IDs (typically 11).
 * @param {object}   [opts]
 * @param {string}   [opts.cornerstonePlayerId]  Player to use as Cornerstone.
 * @returns {Promise<{
 *   multiplier: number,
 *   totalBonus: number,
 *   links: Array<{ a: string, b: string, link_type: string, bonus: number, source?: string }>,
 *   players: Array<object>
 * }>}
 */
async function computeChemistry(playerIds, opts = {}) {
  const ids = Array.from(new Set((playerIds || []).filter(Boolean)));
  if (ids.length < 2) {
    return { multiplier: 1, totalBonus: 0, links: [], players: [] };
  }

  const [players, storedLinks] = await Promise.all([
    loadPlayers(ids),
    new ChemistryLinkModel().selectBySquad(ids),
  ]);

  const links = [];

  // 1) Stored links (chemistry_links table)
  for (const l of storedLinks) {
    const factor = Number(l.bonus_factor) || 0;
    // bonus_factor is stored as a multiplier (e.g. 1.05 = +5%); convert to delta
    const delta = factor > 1 ? factor - 1 : factor;
    links.push({
      a: l.player_a_id,
      b: l.player_b_id,
      link_type: l.link_type,
      bonus: delta,
      source: l.source || null,
    });
  }

  // 2) Derived: shared nationality (country_code preferred, country fallback)
  for (let i = 0; i < players.length; i++) {
    for (let j = i + 1; j < players.length; j++) {
      const p1 = players[i], p2 = players[j];
      const code1 = p1.country_code || p1.country;
      const code2 = p2.country_code || p2.country;
      if (code1 && code2 && code1 === code2) {
        const [a, b] = canonicalPair(p1.id, p2.id);
        const already = links.find(l =>
          l.a === a && l.b === b && l.link_type === 'nationality'
        );
        if (!already) {
          links.push({ a, b, link_type: 'nationality', bonus: NATIONALITY_BONUS, source: code1 });
        }
      }
      if (p1.club_id && p2.club_id && p1.club_id === p2.club_id) {
        const [a, b] = canonicalPair(p1.id, p2.id);
        const already = links.find(l =>
          l.a === a && l.b === b && l.link_type === 'club_current'
        );
        if (!already) {
          links.push({ a, b, link_type: 'club_current', bonus: SAME_CLUB_BONUS, source: p1.club_id });
        }
      }
    }
  }

  // 3) Cornerstone amplification
  const corner = opts.cornerstonePlayerId;
  if (corner) {
    for (const l of links) {
      if (l.a === corner || l.b === corner) {
        l.bonus *= CORNERSTONE_BOOST;
        l.cornerstone = true;
      }
    }
  }

  // 4) Sum and cap
  let totalBonus = links.reduce((s, l) => s + (Number(l.bonus) || 0), 0);
  if (totalBonus > MAX_TOTAL_BONUS) totalBonus = MAX_TOTAL_BONUS;
  if (totalBonus < 0) totalBonus = 0;

  return {
    multiplier: 1 + totalBonus,
    totalBonus,
    links,
    players,
  };
}

module.exports = {
  computeChemistry,
  MAX_TOTAL_BONUS,
  NATIONALITY_BONUS,
  SAME_CLUB_BONUS,
  CORNERSTONE_BOOST,
};
