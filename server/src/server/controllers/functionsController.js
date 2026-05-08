const express = require('express');
const router  = express.Router();
const { EXECUTESQL } = require('../db/database');
const axios = require('axios').default;
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');

const EA_BASE = 'https://proclubs.ea.com/api/fc/';

const EA_ENDPOINTS = {
  searchClub:       (p) => `clubs/search?platform=${p.platform}&clubName=${encodeURIComponent(p.clubName)}`,
  clubInfo:         (p) => `clubs/info?platform=${p.platform}&clubIds=${p.clubId}`,
  overallStats:     (p) => `clubs/overallStats?platform=${p.platform}&clubIds=${p.clubId}`,
  memberStats:      (p) => `clubs/memberStats?platform=${p.platform}&clubId=${p.clubId}`,
  memberCareerStats:(p) => `clubs/memberCareerStats?platform=${p.platform}&clubId=${p.clubId}`,
  leagueMatches:    (p) => `clubs/matches?platform=${p.platform}&clubIds=${p.clubId}&matchType=leagueMatch`,
  playoffMatches:   (p) => `clubs/matches?platform=${p.platform}&clubIds=${p.clubId}&matchType=playoffMatch`,
};

const MYSQL_DATETIME_RE = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/;

function toMysqlDateTime(value) {
  if (!value) return null;
  if (MYSQL_DATETIME_RE.test(String(value))) return String(value);
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 19).replace('T', ' ');
}

async function getMe(_auth_user_id) {
  if (!_auth_user_id) throw new Error('not authenticated');
  const users = await EXECUTESQL('SELECT id, email FROM users WHERE id = ? LIMIT 1', [_auth_user_id]);
  if (!users.length) throw new Error('User not found');
  const me = users[0];
  const players = await EXECUTESQL('SELECT * FROM players WHERE user_id = ? LIMIT 1', [_auth_user_id]);
  const clubs = await EXECUTESQL('SELECT * FROM clubs WHERE user_id = ? LIMIT 1', [_auth_user_id]);
  return { user: me, player: players[0] || null, club: clubs[0] || null };
}

async function getCurrentTransferWindow() {
  await EXECUTESQL(`
    CREATE TABLE IF NOT EXISTS transfer_windows (
      id VARCHAR(36) PRIMARY KEY,
      label VARCHAR(255),
      status VARCHAR(50) DEFAULT 'open',
      start_date DATETIME,
      end_date DATETIME,
      notes TEXT,
      transfers_executed INT DEFAULT 0,
      created_date DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_date DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )
  `);
  const rows = await EXECUTESQL(
    "SELECT * FROM transfer_windows WHERE status = 'open' ORDER BY created_date DESC LIMIT 1",
    []
  );
  return rows[0] || null;
}

async function createClubTx({ clubId, amount, type, category, description, referenceId }) {
  const rows = await EXECUTESQL('SELECT stc FROM clubs WHERE id = ? LIMIT 1', [clubId]);
  const newBalance = Number(rows[0]?.stc || 0) + Number(amount);
  await EXECUTESQL('UPDATE clubs SET stc = ?, updated_date = NOW() WHERE id = ?', [newBalance, clubId]);
  const txId = uuidv4();
  await EXECUTESQL(
    `INSERT INTO stc_transactions (id, club_id, amount, balance_after, type, category, description, reference_id, created_date)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
    [txId, clubId, Number(amount), newBalance, type || null, category || null, description || null, referenceId || null]
  );
  return { new_balance: newBalance, transaction_id: txId };
}

async function createPlayerTx({ playerId, playerEmail, amount, category, source, description, referenceId }) {
  const rows = await EXECUTESQL('SELECT stc FROM players WHERE id = ? LIMIT 1', [playerId]);
  const newBalance = Number(rows[0]?.stc || 0) + Number(amount);
  await EXECUTESQL('UPDATE players SET stc = ?, updated_date = NOW() WHERE id = ?', [newBalance, playerId]);
  const txId = uuidv4();
  await EXECUTESQL(
    `INSERT INTO player_stc_transactions
       (id, player_id, player_email, amount, balance_after, type, category, source, description, reference_id, created_date)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
    [txId, playerId, playerEmail || null, Number(amount), newBalance,
     Number(amount) >= 0 ? 'income' : 'expense',
     category || null, source || null, description || null, referenceId || null]
  );
  return { new_balance: newBalance, transaction_id: txId };
}

// ── Stadium Economy ────────────────────────────────────────────────────────

const DEFAULT_STADIUM_CONFIG = [
  { level: 0, name: 'Local Ground',  capacity: 5000,  ticket_price_stc: 15,  upgrade_cost_stc: 0 },
  { level: 1, name: 'Pro Stadium',   capacity: 20000, ticket_price_stc: 50,  upgrade_cost_stc: 50_000_000 },
  { level: 2, name: 'Elite Ground',  capacity: 45000, ticket_price_stc: 130, upgrade_cost_stc: 120_000_000 },
  { level: 3, name: 'Iconic Arena',  capacity: 80000, ticket_price_stc: 180, upgrade_cost_stc: 250_000_000 },
];
let _stadiumConfigCache = null;
let _stadiumConfigCachedAt = 0;
async function getStadiumConfig() {
  if (_stadiumConfigCache && Date.now() - _stadiumConfigCachedAt < 60_000) return _stadiumConfigCache;
  try {
    const rows = await EXECUTESQL('SELECT * FROM stadium_config ORDER BY level ASC');
    _stadiumConfigCache = rows.length >= 4 ? rows : DEFAULT_STADIUM_CONFIG;
  } catch {
    _stadiumConfigCache = DEFAULT_STADIUM_CONFIG;
  }
  _stadiumConfigCachedAt = Date.now();
  return _stadiumConfigCache;
}

function calcAttendancePct(wins, losses, winStreak) {
  const base         = 15;
  const winBonus     = Math.min(wins      * 2.5, 55);
  const lossDeduct   = Math.min(losses    * 0.8, 10);
  const streakBonus  = Math.min(winStreak * 3,   15);
  const pct = base + winBonus - lossDeduct + streakBonus;
  return Math.min(95, Math.max(5, Math.round(pct)));
}

function parseSubmission(raw) {
  if (!raw) return null;
  try { return typeof raw === 'string' ? JSON.parse(raw) : raw; } catch { return null; }
}

async function createAuditLog({ adminUserId, adminEmail, action, entityType, entityId, entityName, oldValue, newValue, reason }) {
  await EXECUTESQL(
    `INSERT INTO admin_audit_log
       (id, admin_user_id, admin_email, action, entity_type, entity_id, entity_name, old_value, new_value, reason, created_date)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
    [uuidv4(), adminUserId || null, adminEmail || null, action || null,
     entityType || null, entityId || null, entityName || null,
     oldValue != null ? String(oldValue) : null,
     newValue != null ? String(newValue) : null,
     reason || null]
  ).catch(() => {}); // non-blocking — audit failures must never break the operation
}

// ── Market Value Engine ────────────────────────────────────────────────────

const DEFAULT_MV_WEIGHTS = {
  base_per_match:           60_000,
  max_base:              8_000_000,
  goal_rate_bonus:       2_000_000,
  assist_rate_bonus:     1_000_000,
  clean_sheet_rate_bonus:2_500_000,
  motm_bonus:              300_000,
  consistency_boost:          0.15,
  form_boost:                 0.20,
  form_penalty:               0.12,
  win_rate_boost:             0.10,
  ovr_weight:                 0.08,
  spike_cap_up:               0.50,
  spike_cap_down:             0.35,
};

let _mvConfigCache = null;
let _mvConfigCachedAt = 0;
async function getMvConfig() {
  if (_mvConfigCache && Date.now() - _mvConfigCachedAt < 60_000) return _mvConfigCache;
  try {
    const rows = await EXECUTESQL("SELECT weights FROM market_value_config WHERE is_active = 1 ORDER BY updated_date DESC LIMIT 1", []);
    const cfg = rows[0]?.weights ? JSON.parse(typeof rows[0].weights === 'string' ? rows[0].weights : JSON.stringify(rows[0].weights)) : {};
    _mvConfigCache = { ...DEFAULT_MV_WEIGHTS, ...cfg };
    _mvConfigCachedAt = Date.now();
  } catch {
    _mvConfigCache = { ...DEFAULT_MV_WEIGHTS };
  }
  return _mvConfigCache;
}

function computeValueFromStats(p, W, storedValue = null) {
  const matches     = Number(p.matches_played  || 0);
  const goals       = Number(p.goals           || 0);
  const assists     = Number(p.assists          || 0);
  const avgRating   = Number(p.avg_match_rating || 0);
  const motm        = Number(p.man_of_the_match || 0);
  const cleanSheets = Number(p.clean_sheets     || 0);
  const wins        = Number(p.wins_count       || 0);
  const ovr         = Number(p.overall_rating   || 65);

  if (matches === 0) return 250_000;

  // 1. Experience base
  const base = Math.min(matches * W.base_per_match, W.max_base);

  // 2. Rating multiplier (4.5 → 0.30, 6.5 → 1.18, 7.5 → 1.62, 9.0+ → 2.5)
  const ratingMult = avgRating >= 5
    ? Math.max(0.3, Math.min(2.5, 0.3 + ((avgRating - 4.5) / 5.0) * 2.2))
    : 0.3;

  // 3. Output rate bonuses
  const goalRateBonus = Math.min((goals / matches) * W.goal_rate_bonus, 6_000_000);
  const asstRateBonus = Math.min((assists / matches) * W.assist_rate_bonus, 3_000_000);
  const csRateBonus   = Math.min((cleanSheets / matches) * W.clean_sheet_rate_bonus, 5_000_000);
  const outputBonus   = goalRateBonus + asstRateBonus + csRateBonus;

  // 4. Achievement bonus
  const achieveBonus = Math.min(motm * W.motm_bonus, 5_000_000);

  // 5. Consistency & recent form (from form_last10)
  let formArr = [];
  try { formArr = JSON.parse(p.form_last10 || '[]'); } catch {}
  formArr = formArr.filter(r => typeof r === 'number');

  let consistencyMult = 1.0;
  let formMult = 1.0;
  if (formArr.length >= 5) {
    const mean    = formArr.reduce((s, v) => s + v, 0) / formArr.length;
    const stdDev  = Math.sqrt(formArr.reduce((s, v) => s + Math.pow(v - mean, 2), 0) / formArr.length);
    if (stdDev < 0.5)      consistencyMult = 1 + W.consistency_boost;
    else if (stdDev > 1.5) consistencyMult = 0.90;

    if (avgRating > 0) {
      const recent5Avg = formArr.slice(-5).reduce((s, v) => s + v, 0) / 5;
      if (recent5Avg > avgRating + 0.3)      formMult = 1 + W.form_boost;
      else if (recent5Avg < avgRating - 0.5) formMult = 1 - W.form_penalty;
    }
  }

  // 6. Win rate
  const winRate = wins / matches;
  const winMult = winRate > 0.7 ? 1 + W.win_rate_boost
                : winRate > 0.5 ? 1 + W.win_rate_boost * 0.5
                : 1.0;

  // 7. OVR minor contribution (max ~800K for 90-rated player)
  const ovrBonus = Math.max(ovr - 60, 0) * 8_000 * W.ovr_weight;

  // Assemble raw
  const raw = Math.round(
    (base + outputBonus + achieveBonus + ovrBonus) * ratingMult * consistencyMult * formMult * winMult
  );

  // 8. Anti-spike: cap change at ±(spike_cap)% vs stored value
  let final = raw;
  if (storedValue != null && storedValue > 0) {
    final = Math.min(
      Math.round(storedValue * (1 + W.spike_cap_up)),
      Math.max(Math.round(storedValue * (1 - W.spike_cap_down)), raw)
    );
  }

  // Round to nearest 100K, minimum 250K
  return Math.max(250_000, Math.round(final / 100_000) * 100_000);
}

async function computeMarketValue(playerId, storedValue = null) {
  const pRows = await EXECUTESQL('SELECT * FROM players WHERE id = ? LIMIT 1', [playerId]);
  if (!pRows.length) return storedValue || 250_000;
  const W = await getMvConfig();
  return computeValueFromStats(pRows[0], W, storedValue);
}

// ── Shirt Sales Engine ──────────────────────────────────────────────────────

const DEFAULT_SHIRT_WEIGHTS = {
  base_per_mv_1m: 0.5,         // shirts per 1M market value
  goal_demand: 4,               // extra shirts per goal
  assist_demand: 2,             // extra shirts per assist
  rating_demand_per_point: 1.5, // extra shirts per rating point above 6.0
  motm_demand: 6,               // bonus if MOTM
  clean_sheet_demand: 2,        // bonus per clean sheet
  form_influence: 0.12,         // form effect (capped ±20%)
  contract_boost: 0.10,         // 10% boost if has active contract
  max_per_match: 12,            // anti-spike cap per player per match
  price_base: 3000,             // base shirt price in STC
  price_per_ovr_above_70: 800,  // STC per OVR point above 70
  price_per_goal: 300,          // STC per career goal
  price_per_assist: 200,        // STC per career assist
  price_per_rating_point: 1500, // STC per avg_rating point above 6.0
};

let _shirtConfigCache = null;
let _shirtConfigCachedAt = 0;
async function getShirtConfig() {
  if (_shirtConfigCache && Date.now() - _shirtConfigCachedAt < 60_000) return _shirtConfigCache;
  try {
    const rows = await EXECUTESQL("SELECT weights FROM shirt_sales_config WHERE is_active = 1 LIMIT 1");
    const parsed = rows[0]?.weights
      ? (typeof rows[0].weights === 'string' ? JSON.parse(rows[0].weights) : rows[0].weights)
      : {};
    _shirtConfigCache = { ...DEFAULT_SHIRT_WEIGHTS, ...parsed };
    _shirtConfigCachedAt = Date.now();
  } catch {
    _shirtConfigCache = { ...DEFAULT_SHIRT_WEIGHTS };
  }
  return _shirtConfigCache;
}

async function generateShirtSalesForMatch(m, allStats) {
  if (!m.home_club_id) return;

  // Idempotency: skip if already generated for this match
  const existing = await EXECUTESQL('SELECT id FROM shirt_sales WHERE match_id = ? LIMIT 1', [m.id]).catch(() => []);
  if (existing.length) return;

  const W = await getShirtConfig();

  const playerIds = [...new Set(allStats.map(s => s.player_id).filter(Boolean))];
  if (!playerIds.length) return;

  const playerRows = await EXECUTESQL(
    `SELECT id, gamertag, shirt_number, club_id, market_value_stc, overall_rating,
            goals, assists, avg_match_rating, form_last10
     FROM players WHERE id IN (${playerIds.map(() => '?').join(',')})`,
    playerIds
  );
  const playerMap = {};
  playerRows.forEach(p => { playerMap[p.id] = p; });

  const contractRows = await EXECUTESQL(
    `SELECT user_id FROM player_contracts WHERE user_id IN (${playerIds.map(() => '?').join(',')}) AND status = 'active'`,
    playerIds
  );
  const contractSet = new Set(contractRows.map(r => r.user_id));

  let motmPlayerId = null, topRating = -1;
  for (const s of allStats) {
    if (s.player_id && Number(s.rating || 0) > topRating) {
      topRating = Number(s.rating || 0);
      motmPlayerId = s.player_id;
    }
  }
  const motmQualifies = topRating >= 7.0;

  const clubRevenue = {};

  for (const stat of allStats) {
    const player = playerMap[stat.player_id];
    if (!player?.club_id) continue;

    const goals   = Number(stat.goals   || 0);
    const assists = Number(stat.assists  || 0);
    const rating  = Number(stat.rating   || 6.0);
    const mv      = Number(player.market_value_stc || 250_000);
    const ovr     = Number(player.overall_rating   || 70);
    const hasContract = contractSet.has(player.id);
    const isMotm      = stat.player_id === motmPlayerId && motmQualifies;

    const isHomeSide   = stat.club_id ? stat.club_id === m.home_club_id : stat.player_id === m.home_player_id;
    const teamConceded = isHomeSide ? Number(m.away_score ?? 1) : Number(m.home_score ?? 1);
    const isCleanSheet = teamConceded === 0;

    // Demand calculation
    const popularityScore = Math.min(mv / 1_000_000, 20) * W.base_per_mv_1m;
    const matchPerfScore  = goals * W.goal_demand
      + assists * W.assist_demand
      + Math.max(0, (rating - 6.0) * W.rating_demand_per_point)
      + (isMotm ? W.motm_demand : 0)
      + (isCleanSheet ? W.clean_sheet_demand : 0);

    // Form modifier — capped to ±20%, uses career avg vs recent 5
    let formMod = 1.0;
    try {
      const form = JSON.parse(player.form_last10 || '[]');
      if (form.length >= 3) {
        const recent5    = form.slice(-5);
        const recentAvg  = recent5.reduce((a, b) => a + b, 0) / recent5.length;
        const careerAvg  = Number(player.avg_match_rating || 6.0);
        formMod = Math.max(0.8, Math.min(1.2, 1 + (recentAvg - careerAvg) * W.form_influence));
      }
    } catch {}

    const contractBoost = hasContract ? 1 + W.contract_boost : 1.0;
    const rawCount = (popularityScore + matchPerfScore) * formMod * contractBoost;
    const count    = Math.max(0, Math.min(Math.round(rawCount), W.max_per_match));
    if (count === 0) continue;

    // Shirt price (career-based, stable — not per-match)
    const price = Math.max(2500, Math.round(
      (W.price_base
        + Math.max(0, ovr - 70) * W.price_per_ovr_above_70
        + Number(player.goals   || 0) * W.price_per_goal
        + Number(player.assists || 0) * W.price_per_assist
        + Math.max(0, Number(player.avg_match_rating || 6.0) - 6.0) * W.price_per_rating_point
      ) / 500
    ) * 500);

    const revenue = price * count;
    clubRevenue[player.club_id] = (clubRevenue[player.club_id] || 0) + revenue;

    await EXECUTESQL(
      `INSERT INTO shirt_sales
         (id, player_id, player_gamertag, shirt_number, club_id, buyer_email, match_id, quantity, price_stc, created_date)
       VALUES (?, ?, ?, ?, ?, 'virtual_fan', ?, ?, ?, NOW())`,
      [uuidv4(), player.id, player.gamertag || '', player.shirt_number, player.club_id, m.id, count, revenue]
    ).catch(() => {});
  }

  // Credit clubs via createClubTx for proper financial tracking
  for (const [clubId, revenue] of Object.entries(clubRevenue)) {
    if (revenue <= 0) continue;
    await createClubTx({
      clubId, amount: revenue, type: 'shirt_revenue', category: 'merchandise',
      description: `Virtual shirt sales — ${m.home_club_name || 'Home'} vs ${m.away_club_name || 'Away'}`,
      referenceId: m.id,
    }).catch(() => {});
  }
}

async function processMatchCompletion(m, homeSub, awaySub) {
  const finalHomeScore = Number(homeSub.home_score ?? 0);
  const finalAwayScore = Number(homeSub.away_score ?? 0);
  const homeWon = finalHomeScore > finalAwayScore;
  const awayWon = finalAwayScore > finalHomeScore;
  const isDraw  = finalHomeScore === finalAwayScore;

  const setClauses = ["status = 'completed'", 'home_score = ?', 'away_score = ?', 'stats_processed = 1', 'updated_date = NOW()'];
  const setVals    = [finalHomeScore, finalAwayScore];
  const homeGoalEvts = (homeSub.goal_events || []).length > 0 ? JSON.stringify(homeSub.goal_events) : null;
  const awayGoalEvts = (awaySub.goal_events || []).length > 0 ? JSON.stringify(awaySub.goal_events) : null;
  if (homeGoalEvts) { setClauses.push('home_goal_events = ?'); setVals.push(homeGoalEvts); }
  if (awayGoalEvts) { setClauses.push('away_goal_events = ?'); setVals.push(awayGoalEvts); }
  setVals.push(m.id);
  await EXECUTESQL(`UPDATE matches SET ${setClauses.join(', ')} WHERE id = ?`, setVals);

  if (!m.stats_processed) {
    const allStats = [
      ...(homeSub.player_stats || []),
      ...(awaySub.player_stats || []),
    ];

    for (const stat of allStats) {
      if (!stat.player_id && !stat.player_email) continue;
      await EXECUTESQL(
        `INSERT INTO match_player_stats
           (id, match_id, club_id, player_id, player_email, player_gamertag, goals, assists, rating, tournament_id, created_date)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
        [uuidv4(), m.id, stat.club_id || null, stat.player_id || null, stat.player_email || null,
         stat.player_gamertag || null, Number(stat.goals || 0), Number(stat.assists || 0),
         Number(stat.rating || 6), m.tournament_id || null]
      ).catch(() => {});

        if (stat.player_id) {
        await EXECUTESQL(
          'UPDATE players SET goals = goals + ?, assists = assists + ?, updated_date = NOW() WHERE id = ?',
          [Number(stat.goals || 0), Number(stat.assists || 0), stat.player_id]
        ).catch(() => {});
      }
    }

    // ── Per-player match performance tracking + market value recalc ──────
    // Determine MOTM (highest rated player in this match)
    let motmPlayerId = null;
    let motmPeak = -1;
    for (const stat of allStats) {
      if (stat.player_id && Number(stat.rating || 0) > motmPeak) {
        motmPeak = Number(stat.rating || 0);
        motmPlayerId = stat.player_id;
      }
    }

    const W = await getMvConfig().catch(() => ({ ...DEFAULT_MV_WEIGHTS }));

    for (const stat of allStats) {
      if (!stat.player_id) continue;
      try {
        const pRows = await EXECUTESQL(
          'SELECT matches_played, avg_match_rating, form_last10, market_value_stc, wins_count FROM players WHERE id = ? LIMIT 1',
          [stat.player_id]
        );
        if (!pRows.length) continue;
        const p = pRows[0];

        const prevMatches   = Number(p.matches_played || 0);
        const prevAvgRating = Number(p.avg_match_rating || 0);
        const matchRating   = Number(stat.rating || 6);
        const newMatches    = prevMatches + 1;
        const newAvgRating  = Number(
          ((prevAvgRating * prevMatches + matchRating) / newMatches).toFixed(2)
        );

        let formArr = [];
        try { formArr = JSON.parse(p.form_last10 || '[]'); } catch {}
        const newForm = JSON.stringify([...formArr, matchRating].slice(-10));

        // Determine which side this player is on for win/clean-sheet logic
        const isHomeSide = stat.club_id
          ? stat.club_id === m.home_club_id
          : stat.player_id === m.home_player_id;
        const teamWon      = isHomeSide ? homeWon : awayWon;
        const teamConceded = isHomeSide ? finalAwayScore : finalHomeScore;

        const isMotm       = stat.player_id === motmPlayerId;
        const isCleanSheet = teamConceded === 0;

        await EXECUTESQL(
          `UPDATE players SET
            matches_played   = ?,
            avg_match_rating = ?,
            wins_count       = wins_count + ?,
            man_of_the_match = man_of_the_match + ?,
            clean_sheets     = clean_sheets + ?,
            form_last10      = ?,
            updated_date     = NOW()
           WHERE id = ?`,
          [newMatches, newAvgRating, teamWon ? 1 : 0, isMotm ? 1 : 0, isCleanSheet ? 1 : 0, newForm, stat.player_id]
        );

        // Build a synthetic player record with fresh stats for value calculation
        const freshStats = {
          ...p,
          matches_played:  newMatches,
          avg_match_rating: newAvgRating,
          form_last10:     newForm,
          wins_count:      Number(p.wins_count || 0) + (teamWon ? 1 : 0),
          man_of_the_match: Number(p.man_of_the_match || 0) + (isMotm ? 1 : 0),
          clean_sheets:    Number(p.clean_sheets || 0) + (isCleanSheet ? 1 : 0),
        };
        const newValue = computeValueFromStats(freshStats, W, Number(p.market_value_stc || 0));
        await EXECUTESQL(
          'UPDATE players SET market_value_stc = ?, value_updated_at = NOW() WHERE id = ?',
          [newValue, stat.player_id]
        );
      } catch (err) {
        console.error('[market-value] update failed for', stat.player_id, err.message);
      }
    }

    // ── Club records + streaks ───────────────────────────────────────────────
    if (m.home_club_id) {
      const [homeClubPre] = await EXECUTESQL(
        'SELECT wins, losses, win_streak, loss_streak, stadium_level, owner_email FROM clubs WHERE id = ? LIMIT 1',
        [m.home_club_id]
      ).catch(() => [null]);

      const newHomeWinStreak  = homeWon ? Number(homeClubPre?.win_streak  || 0) + 1 : 0;
      const newHomeLossStreak = awayWon ? Number(homeClubPre?.loss_streak || 0) + 1 : 0;

      await EXECUTESQL(
        `UPDATE clubs SET wins=wins+?, draws=draws+?, losses=losses+?,
          goals_scored=goals_scored+?, goals_conceded=goals_conceded+?,
          win_streak=?, loss_streak=?, updated_date=NOW() WHERE id=?`,
        [homeWon ? 1 : 0, isDraw ? 1 : 0, awayWon ? 1 : 0,
         finalHomeScore, finalAwayScore,
         newHomeWinStreak, newHomeLossStreak, m.home_club_id]
      ).catch(() => {});

      // ── Ticket revenue (home club, club matches only) ────────────────────
      try {
        const existingTicketTx = await EXECUTESQL(
          "SELECT id FROM stc_transactions WHERE reference_id = ? AND type = 'ticket_revenue' LIMIT 1",
          [m.id]
        ).catch(() => []);
        if (!existingTicketTx.length && homeClubPre) {
          const stadiumCfg = await getStadiumConfig();
          const levelIdx  = Math.min(Math.max(Number(homeClubPre.stadium_level || 0), 0), stadiumCfg.length - 1);
          const lvl       = stadiumCfg[levelIdx];
          const postWins  = Number(homeClubPre.wins   || 0) + (homeWon ? 1 : 0);
          const postLoss  = Number(homeClubPre.losses || 0) + (awayWon ? 1 : 0);
          const pct       = calcAttendancePct(postWins, postLoss, newHomeWinStreak);
          const attendance = Math.round(Number(lvl.capacity) * pct / 100);
          const revenue    = attendance * Number(lvl.ticket_price_stc);
          const transferShare = Math.round(revenue * 0.15);
          const matchLabel = `${m.home_club_name || 'Home'} vs ${m.away_club_name || 'Away'}`;
          const matchType  = m.tournament_id && m.tournament_id !== 'ranked'
            ? '🏆 Tournament' : m.tournament_id === 'ranked' ? '⚡ Ranked' : '⚽ League';

          await createClubTx({
            clubId: m.home_club_id,
            amount: revenue,
            type: 'ticket_revenue',
            category: 'ticket_revenue',
            description: `Gate receipts: ${attendance.toLocaleString()} fans @ ${Number(lvl.ticket_price_stc)} STC — ${matchLabel}`,
            referenceId: m.id,
          }).catch(err => console.error('[ticket-revenue] tx failed:', err.message));

          if (transferShare > 0) {
            await EXECUTESQL(
              'UPDATE clubs SET transfer_budget_stc = transfer_budget_stc + ?, updated_date = NOW() WHERE id = ?',
              [transferShare, m.home_club_id]
            ).catch(() => {});
          }

          await EXECUTESQL(
            'UPDATE matches SET home_ticket_revenue=?, home_ticket_attendance=?, home_ticket_capacity=?, home_ticket_price=?, home_ticket_pct=?, updated_date=NOW() WHERE id=?',
            [revenue, attendance, Number(lvl.capacity), Number(lvl.ticket_price_stc), pct, m.id]
          ).catch(() => {});

          // Inbox to home club owner
          if (homeClubPre.owner_email) {
            const scoreLabel = `${finalHomeScore} – ${finalAwayScore}`;
            const lines = [
              `📅 Match: ${matchLabel}`,
              `📊 Result: ${scoreLabel}  |  ${matchType}`,
              ``,
              `🏟️  Stadium: ${lvl.name} (capacity ${Number(lvl.capacity).toLocaleString()})`,
              `👥 Attendance: ${attendance.toLocaleString()} fans (${pct}% full)`,
              `🎟️  Tickets: ${attendance.toLocaleString()} × ${Number(lvl.ticket_price_stc)} STC = +${revenue.toLocaleString()} STC`,
              transferShare > 0 ? `🏦 Transfer Fund: +${transferShare.toLocaleString()} STC (15% to signing budget)` : ``,
              ``,
              pct < 40 ? `💡 Win more games to fill your stadium and boost gate receipts.`
                       : pct >= 80 ? `🔥 Near-capacity crowd — your club is on fire!`
                       : `📈 Attendance growing. Keep the wins coming!`,
            ].filter(l => l !== undefined);
            await EXECUTESQL(
              `INSERT INTO inbox_messages (id, recipient_email, sender_email, subject, body, message_type, related_entity_id, related_entity_type, is_read, created_date)
               VALUES (?, ?, 'system@stage.com', ?, ?, 'match_revenue', ?, 'match_revenue', 0, NOW())`,
              [uuidv4(), homeClubPre.owner_email,
               `🎟️ Match Revenue — ${matchLabel}`,
               lines.join('\n'), m.id]
            ).catch(() => {});
          }
        }
      } catch (ticketErr) {
        console.error('[ticket-revenue] processing failed for match', m.id, ticketErr.message);
      }
    }

    if (m.away_club_id) {
      const [awayClubPre] = await EXECUTESQL(
        'SELECT win_streak, loss_streak FROM clubs WHERE id = ? LIMIT 1',
        [m.away_club_id]
      ).catch(() => [null]);
      const newAwayWinStreak  = awayWon ? Number(awayClubPre?.win_streak  || 0) + 1 : 0;
      const newAwayLossStreak = homeWon ? Number(awayClubPre?.loss_streak || 0) + 1 : 0;
      await EXECUTESQL(
        `UPDATE clubs SET wins=wins+?, draws=draws+?, losses=losses+?,
          goals_scored=goals_scored+?, goals_conceded=goals_conceded+?,
          win_streak=?, loss_streak=?, updated_date=NOW() WHERE id=?`,
        [awayWon ? 1 : 0, isDraw ? 1 : 0, homeWon ? 1 : 0,
         finalAwayScore, finalHomeScore,
         newAwayWinStreak, newAwayLossStreak, m.away_club_id]
      ).catch(() => {});
    }

    // Generate virtual shirt sales with final scores
    const enrichedM = { ...m, home_score: finalHomeScore, away_score: finalAwayScore };
    await generateShirtSalesForMatch(enrichedM, allStats).catch(() => {});
  }

  // Settle club wager if applicable (both sides must have locked funds)
  if (m.mode === 'club' && Number(m.wager_stc || 0) > 0 && m.wager_status === 'active' && m.wager_home_locked && m.wager_away_locked) {
    const wagerEach = Number(m.wager_stc);
    const pot       = wagerEach * 2;
    const label     = `${m.home_club_name || 'Home'} vs ${m.away_club_name || 'Away'}`;
    if (isDraw) {
      if (m.home_club_id) await createClubTx({ clubId: m.home_club_id, amount: wagerEach, type: 'wager_refund', category: 'wager_refund', description: `Wager refunded (draw) — ${label}`, referenceId: m.id }).catch(() => {});
      if (m.away_club_id) await createClubTx({ clubId: m.away_club_id, amount: wagerEach, type: 'wager_refund', category: 'wager_refund', description: `Wager refunded (draw) — ${label}`, referenceId: m.id }).catch(() => {});
      await EXECUTESQL("UPDATE matches SET wager_status = 'refunded', updated_date = NOW() WHERE id = ?", [m.id]).catch(() => {});
    } else {
      const winnerClubId = homeWon ? m.home_club_id : m.away_club_id;
      const loserClubId  = homeWon ? m.away_club_id : m.home_club_id;
      const winnerName   = homeWon ? (m.home_club_name || 'Home') : (m.away_club_name || 'Away');
      const loserName    = homeWon ? (m.away_club_name || 'Away') : (m.home_club_name || 'Home');
      if (winnerClubId) await createClubTx({ clubId: winnerClubId, amount: pot, type: 'wager_win',  category: 'wager_win',  description: `Wager won vs ${loserName} — +${pot.toLocaleString()} STC`, referenceId: m.id }).catch(() => {});
      if (loserClubId)  await createClubTx({ clubId: loserClubId,  amount: 0,   type: 'wager_loss', category: 'wager_loss', description: `Wager lost vs ${winnerName} — ${wagerEach.toLocaleString()} STC forfeited`, referenceId: m.id }).catch(() => {});
      await EXECUTESQL("UPDATE matches SET wager_status = 'settled', updated_date = NOW() WHERE id = ?", [m.id]).catch(() => {});
    }
  }

  return { data: { status: 'completed', home_score: finalHomeScore, away_score: finalAwayScore } };
}

const HANDLERS = {
  // ── EA Pro Clubs API proxy ────────────────────────────────────────────────
  async eafcApi({ endpoint, params }) {
    const builder = EA_ENDPOINTS[endpoint];
    if (!builder) throw new Error(`Unknown EA endpoint: ${endpoint}`);
    const url = `${EA_BASE}${builder(params)}`;
    const res = await axios.get(url, {
      headers: { 'User-Agent': 'Mozilla/5.0', 'Accept': 'application/json' },
      timeout: 10000,
    });
    return { data: res.data };
  },

  // ── Credits ───────────────────────────────────────────────────────────────
  async spendCredits({ amount, _auth_user_id }) {
    if (!_auth_user_id || !amount) throw new Error('amount required');
    const rows = await EXECUTESQL('SELECT id, credits FROM players WHERE user_id = ?', [_auth_user_id]);
    if (!rows.length) throw new Error('Player not found');
    if (rows[0].credits < amount) throw new Error('Insufficient credits');
    await EXECUTESQL('UPDATE players SET credits = credits - ? WHERE id = ?', [amount, rows[0].id]);
    return { success: true };
  },

  // ── Tournament prize distribution ─────────────────────────────────────────
  async distributeTournamentPrizes({ tournament_id }) {
    if (!tournament_id) throw new Error('tournament_id required');
    const [t] = await EXECUTESQL('SELECT * FROM tournaments WHERE id = ?', [tournament_id]);
    if (!t) throw new Error('Tournament not found');

    const prizes = t.prize_pool
      ? (typeof t.prize_pool === 'string' ? JSON.parse(t.prize_pool) : t.prize_pool)
      : { first: 5000, second: 2500, third: 1000 };

    if (t.winner_club_id) {
      await EXECUTESQL('UPDATE clubs SET stc = stc + ? WHERE id = ?', [prizes.first || 0, t.winner_club_id]);
    }
    await EXECUTESQL("UPDATE tournaments SET status = 'prizes_distributed' WHERE id = ?", [tournament_id]);
    return { success: true };
  },

  async getTransferMarket() {
    const currentWindow = await getCurrentTransferWindow();
    const activeContracts = await EXECUTESQL(
      "SELECT DISTINCT user_id FROM player_contracts WHERE status IN ('active','pending','pending_window')",
      []
    );
    const activeIds = new Set(activeContracts.map((r) => r.user_id));

    const players = await EXECUTESQL('SELECT * FROM players', []);
    const free_agents = players.filter((p) => !activeIds.has(p.id));

    const expiringContracts = await EXECUTESQL(
      "SELECT * FROM player_contracts WHERE status = 'active' AND end_date IS NOT NULL ORDER BY end_date ASC",
      []
    );
    const expiring_players = [];
    const now = Date.now();
    for (const c of expiringContracts) {
      const endMs = new Date(c.end_date).getTime();
      if (Number.isNaN(endMs)) continue;
      const days_left = Math.ceil((endMs - now) / (24 * 60 * 60 * 1000));
      if (days_left < 0 || days_left > 30) continue;
      const playerRows = await EXECUTESQL('SELECT * FROM players WHERE id = ? LIMIT 1', [c.user_id]);
      if (!playerRows.length) continue;
      expiring_players.push({ player: playerRows[0], contract: c, days_left });
    }

    return {
      data: {
        free_agents,
        expiring_players,
        current_window: currentWindow,
      },
    };
  },

  async contractActions({
    action, _auth_user_id, team_id, user_id, contract_type, offer_note,
    weekly_salary_stc, signing_bonus_stc, transfer_fee_stc, performance_targets, captaincy_offered,
  }) {
    if (action !== 'offer') throw new Error(`Unsupported contract action: ${action}`);
    const { user, player } = await getMe(_auth_user_id);
    if (!player) throw new Error('Player profile not found');
    if (!team_id || !user_id) throw new Error('team_id and user_id required');

    const window = await getCurrentTransferWindow();
    const status = window ? 'pending' : 'pending_window';
    const id = uuidv4();
    await EXECUTESQL(
      `INSERT INTO player_contracts (
        id, team_id, user_id, contract_type, status, offered_by,
        weekly_salary_stc, signing_bonus_stc, transfer_fee_stc, offer_note,
        captaincy_offered, negotiation_round, performance_targets, created_date, updated_date
      ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?, NOW(), NOW())`,
      [
        id,
        team_id,
        user_id,
        contract_type || 'standard',
        status,
        user.email,
        Number(weekly_salary_stc || 0),
        Number(signing_bonus_stc || 0),
        Number(transfer_fee_stc || 0),
        offer_note || '',
        captaincy_offered ? 1 : 0,
        0,
        performance_targets ? JSON.stringify(performance_targets) : null,
      ]
    );
    return { success: true, data: { contract_id: id, status } };
  },

  async contractManagement({
    action, _auth_user_id,
    contract_id, weekly_salary_stc, signing_bonus_stc, transfer_fee_stc,
    contract_type, start_date, end_date, max_days, max_games,
    status, offer_note, performance_targets, note, amount,
  }) {
    // ── accept ──────────────────────────────────────────────────────────────
    if (action === 'accept') {
      if (!contract_id) throw new Error('contract_id required');
      const contracts = await EXECUTESQL('SELECT * FROM player_contracts WHERE id = ? LIMIT 1', [contract_id]);
      if (!contracts.length) throw new Error('Contract not found');
      const contract = contracts[0];
      if (!['pending', 'pending_window', 'negotiating'].includes(contract.status)) {
        throw new Error(`Cannot accept contract with status: ${contract.status}`);
      }

      const salary = Number(contract.weekly_salary_stc || 0);
      if (salary > 0) {
        const clubs = await EXECUTESQL('SELECT * FROM clubs WHERE id = ? LIMIT 1', [contract.team_id]);
        if (!clubs.length) throw new Error('Club not found');
        const clubData = clubs[0];
        const wageBudget = Number(clubData.wage_budget_stc || 0);
        const committedRows = await EXECUTESQL(
          "SELECT COALESCE(SUM(weekly_salary_stc),0) as total FROM player_contracts WHERE team_id = ? AND status = 'active' AND id != ?",
          [contract.team_id, contract_id]
        );
        const committed = Number(committedRows[0]?.total || 0);
        if (committed + salary > wageBudget) {
          throw new Error(`Insufficient wage budget. Available: ${(wageBudget - committed).toLocaleString()} STC/wk, Required: ${salary.toLocaleString()} STC/wk`);
        }
      }

      const today   = new Date().toISOString().split('T')[0];
      const endDate = new Date(Date.now() + (Number(contract.max_days) || 180) * 86400000).toISOString().split('T')[0];
      await EXECUTESQL(
        "UPDATE player_contracts SET status = 'active', start_date = ?, end_date = ?, updated_date = NOW() WHERE id = ?",
        [today, endDate, contract_id]
      );

      const bonus = Number(contract.signing_bonus_stc || 0);
      if (bonus > 0) {
        const players = await EXECUTESQL('SELECT * FROM players WHERE id = ? LIMIT 1', [contract.user_id]);
        const player  = players[0];
        const clubRows = await EXECUTESQL('SELECT name FROM clubs WHERE id = ? LIMIT 1', [contract.team_id]);
        await createClubTx({
          clubId: contract.team_id, amount: -bonus, type: 'signing_bonus', category: 'signing_bonus',
          description: `Signing bonus — ${player?.gamertag || player?.full_name || 'Player'} (${contract.contract_type})`,
          referenceId: contract_id,
        });
        if (player) {
          await createPlayerTx({
            playerId: player.id, playerEmail: player.email, amount: bonus,
            category: 'signing_bonus', source: clubRows[0]?.name || 'Club',
            description: `Signing bonus — ${clubRows[0]?.name || 'Club'} (${contract.contract_type})`,
            referenceId: contract_id,
          });
        }
      }
      return { success: true, data: { status: 'active', start_date: today, end_date: endDate } };
    }

    // ── terminate ────────────────────────────────────────────────────────────
    if (action === 'terminate') {
      if (!contract_id) throw new Error('contract_id required');
      const contracts = await EXECUTESQL('SELECT * FROM player_contracts WHERE id = ? LIMIT 1', [contract_id]);
      if (!contracts.length) throw new Error('Contract not found');
      if (contracts[0].status !== 'active') throw new Error('Can only terminate active contracts');
      await EXECUTESQL("UPDATE player_contracts SET status = 'terminated', updated_date = NOW() WHERE id = ?", [contract_id]);
      return { success: true, data: { status: 'terminated' } };
    }

    // ── expire_overdue ───────────────────────────────────────────────────────
    if (action === 'expire_overdue') {
      const result = await EXECUTESQL(
        "UPDATE player_contracts SET status = 'expired', updated_date = NOW() WHERE status = 'active' AND end_date IS NOT NULL AND end_date < CURDATE()",
        []
      );
      return { success: true, data: { expired_count: result.affectedRows || 0 } };
    }

    // ── auto_pay_salaries ────────────────────────────────────────────────────
    if (action === 'auto_pay_salaries') {
      const overdue = await EXECUTESQL(
        `SELECT pc.*, p.gamertag, p.full_name, p.email AS player_email,
                c.stc AS club_stc, c.name AS club_name
         FROM player_contracts pc
         JOIN players p ON p.id = pc.user_id
         JOIN clubs c ON c.id = pc.team_id
         WHERE pc.status = 'active' AND pc.weekly_salary_stc > 0
           AND (pc.last_salary_paid_at IS NULL OR pc.last_salary_paid_at < DATE_SUB(NOW(), INTERVAL 7 DAY))`,
        []
      );
      let paid = 0; let failed = 0;
      for (const contract of overdue) {
        try {
          const salary    = Number(contract.weekly_salary_stc);
          const lastPaid  = contract.last_salary_paid_at || contract.start_date || contract.created_date;
          const weeksMult = lastPaid
            ? Math.max(1, Math.floor((Date.now() - new Date(lastPaid).getTime()) / (7 * 24 * 60 * 60 * 1000)))
            : 1;
          const gross = Math.min(salary * weeksMult, Number(contract.club_stc || 0));
          if (gross <= 0) { failed++; continue; }
          await createClubTx({
            clubId: contract.team_id, amount: -gross, type: 'salary_payment', category: 'salary',
            description: `Salary: ${contract.gamertag || contract.full_name || 'Player'}${weeksMult > 1 ? ` (${weeksMult}wk)` : ''}`,
            referenceId: contract.id,
          });
          await createPlayerTx({
            playerId: contract.user_id, playerEmail: contract.player_email, amount: gross,
            category: 'salary', source: contract.club_name || 'Club',
            description: `Weekly salary${weeksMult > 1 ? ` (${weeksMult} weeks)` : ''} — ${contract.club_name}`,
            referenceId: contract.id,
          });
          await EXECUTESQL('UPDATE player_contracts SET last_salary_paid_at = NOW(), updated_date = NOW() WHERE id = ?', [contract.id]);
          paid++;
        } catch (_) { failed++; }
      }
      return { success: true, data: { paid, failed, total: overdue.length } };
    }

    // ── get_all (admin) ──────────────────────────────────────────────────────
    if (action === 'get_all') {
      const adminCheck = await EXECUTESQL('SELECT role_id FROM users WHERE id = ? LIMIT 1', [_auth_user_id]);
      if (!adminCheck.length || Number(adminCheck[0].role_id) !== 0) throw new Error('Admin access required');
      const rows = await EXECUTESQL(
        `SELECT pc.*, p.gamertag, p.full_name, p.avatar_url,
                c.name AS club_name, c.logo_url AS club_logo_url
         FROM player_contracts pc
         LEFT JOIN players p ON p.id = pc.user_id
         LEFT JOIN clubs c ON c.id = pc.team_id
         ORDER BY pc.created_date DESC LIMIT 300`,
        []
      );
      return { data: { contracts: rows } };
    }

    // ── admin_edit ───────────────────────────────────────────────────────────
    if (action === 'admin_edit') {
      const adminCheck = await EXECUTESQL('SELECT role_id FROM users WHERE id = ? LIMIT 1', [_auth_user_id]);
      if (!adminCheck.length || Number(adminCheck[0].role_id) !== 0) throw new Error('Admin access required');
      if (!contract_id) throw new Error('contract_id required');
      const updates = {};
      if (weekly_salary_stc != null)   updates.weekly_salary_stc = Number(weekly_salary_stc);
      if (signing_bonus_stc != null)   updates.signing_bonus_stc = Number(signing_bonus_stc);
      if (transfer_fee_stc  != null)   updates.transfer_fee_stc  = Number(transfer_fee_stc);
      if (contract_type)               updates.contract_type     = contract_type;
      if (start_date)                  updates.start_date        = start_date;
      if (end_date)                    updates.end_date          = end_date;
      if (max_days  != null)           updates.max_days          = Number(max_days);
      if (max_games != null)           updates.max_games         = Number(max_games);
      if (offer_note != null)          updates.offer_note        = offer_note;
      if (status)                      updates.status            = status;
      if (performance_targets != null) updates.performance_targets = JSON.stringify(performance_targets);
      if (!Object.keys(updates).length) throw new Error('No fields to update');
      const setClauses = Object.keys(updates).map(k => `${k} = ?`).join(', ');
      await EXECUTESQL(
        `UPDATE player_contracts SET ${setClauses}, updated_date = NOW() WHERE id = ?`,
        [...Object.values(updates), contract_id]
      );
      return { success: true };
    }

    // ── admin_cancel ─────────────────────────────────────────────────────────
    if (action === 'admin_cancel') {
      const adminCheck = await EXECUTESQL('SELECT role_id FROM users WHERE id = ? LIMIT 1', [_auth_user_id]);
      if (!adminCheck.length || Number(adminCheck[0].role_id) !== 0) throw new Error('Admin access required');
      if (!contract_id) throw new Error('contract_id required');
      await EXECUTESQL("UPDATE player_contracts SET status = 'terminated', updated_date = NOW() WHERE id = ?", [contract_id]);
      return { success: true };
    }

    // ── admin_correct_salary ─────────────────────────────────────────────────
    if (action === 'admin_correct_salary') {
      const adminCheck = await EXECUTESQL('SELECT role_id FROM users WHERE id = ? LIMIT 1', [_auth_user_id]);
      if (!adminCheck.length || Number(adminCheck[0].role_id) !== 0) throw new Error('Admin access required');
      if (!contract_id || amount == null) throw new Error('contract_id and amount required');
      const contracts = await EXECUTESQL('SELECT * FROM player_contracts WHERE id = ? LIMIT 1', [contract_id]);
      if (!contracts.length) throw new Error('Contract not found');
      const contract  = contracts[0];
      const players   = await EXECUTESQL('SELECT * FROM players WHERE id = ? LIMIT 1', [contract.user_id]);
      if (!players.length) throw new Error('Player not found');
      const player    = players[0];
      const clubRows  = await EXECUTESQL('SELECT * FROM clubs WHERE id = ? LIMIT 1', [contract.team_id]);
      if (!clubRows.length) throw new Error('Club not found');
      const club      = clubRows[0];
      const corrAmt   = Number(amount);
      await createClubTx({
        clubId: contract.team_id, amount: -corrAmt, type: 'salary_correction', category: 'salary',
        description: note || `Admin salary correction — ${player.gamertag || 'Player'}`,
        referenceId: contract_id,
      });
      await createPlayerTx({
        playerId: player.id, playerEmail: player.email, amount: corrAmt,
        category: 'salary', source: club.name || 'Club',
        description: note || `Admin salary correction — ${club.name}`,
        referenceId: contract_id,
      });
      return { success: true };
    }

    throw new Error(`Unknown contractManagement action: ${action}`);
  },

  async transferWindowActions({ action, label, start_date, end_date, notes, window_id }) {
    const current = await getCurrentTransferWindow();

    if (action === 'get_current') {
      return { data: { window: current } };
    }

    if (action === 'open_window') {
      if (current) throw new Error('A transfer window is already open');
      const id = uuidv4();
      await EXECUTESQL(
        `INSERT INTO transfer_windows (id, label, status, start_date, end_date, notes, transfers_executed, created_date, updated_date)
         VALUES (?, ?, 'open', ?, ?, ?, 0, NOW(), NOW())`,
        [id, label || 'Transfer Window', toMysqlDateTime(start_date) || toMysqlDateTime(new Date()), toMysqlDateTime(end_date), notes || '']
      );
      const created = await EXECUTESQL('SELECT * FROM transfer_windows WHERE id = ? LIMIT 1', [id]);
      return { success: true, data: { window: created[0] || null } };
    }

    if (action === 'close_window') {
      const id = window_id || current?.id;
      if (!id) throw new Error('No open transfer window');
      await EXECUTESQL("UPDATE transfer_windows SET status = 'closed', updated_date = NOW() WHERE id = ?", [id]);
      return { success: true, data: { closed: true } };
    }

    if (action === 'execute_pending') {
      const pendings = await EXECUTESQL(
        "SELECT * FROM player_contracts WHERE status = 'pending_window' ORDER BY created_date ASC",
        []
      );
      for (const c of pendings) {
        await EXECUTESQL("UPDATE player_contracts SET status = 'pending', updated_date = NOW() WHERE id = ?", [c.id]);
      }
      if (current?.id) {
        await EXECUTESQL(
          'UPDATE transfer_windows SET transfers_executed = transfers_executed + ?, updated_date = NOW() WHERE id = ?',
          [pendings.length, current.id]
        );
      }
      return { success: true, data: { transfers_executed: pendings.length } };
    }

    throw new Error(`Unknown transferWindowActions action: ${action}`);
  },

  async matchKickoff({ action, match_id, is_home_team, home_score, away_score, player_stats, goal_events, proof_url, admin_resolve_winner, admin_home_score, admin_away_score }) {
    if (!match_id) throw new Error('match_id required');

    if (action === 'kickoff') {
      await EXECUTESQL("UPDATE matches SET status = 'in_progress', updated_date = NOW() WHERE id = ?", [match_id]);
      return { data: { success: true } };
    }

    if (action === 'submit_result') {
      const rows = await EXECUTESQL('SELECT * FROM matches WHERE id = ? LIMIT 1', [match_id]);
      if (!rows.length) throw new Error('Match not found');
      const m = rows[0];

      const submission = JSON.stringify({
        home_score:   Number(home_score  ?? 0),
        away_score:   Number(away_score  ?? 0),
        player_stats: player_stats  || [],
        goal_events:  goal_events   || [],
        proof_url:    proof_url     || null,
        submitted_at: new Date().toISOString(),
      });

      if (is_home_team) {
        await EXECUTESQL(
          'UPDATE matches SET home_submission = ?, result_home_submitted = 1, updated_date = NOW() WHERE id = ?',
          [submission, match_id]
        );
      } else {
        await EXECUTESQL(
          'UPDATE matches SET away_submission = ?, result_away_submitted = 1, updated_date = NOW() WHERE id = ?',
          [submission, match_id]
        );
      }

      const [updated] = await EXECUTESQL('SELECT * FROM matches WHERE id = ? LIMIT 1', [match_id]);
      const homeSub = parseSubmission(updated.home_submission);
      const awaySub = parseSubmission(updated.away_submission);

      if (!homeSub || !awaySub) {
        return { data: { status: 'waiting' } };
      }

      if (Number(homeSub.home_score) !== Number(awaySub.home_score) ||
          Number(homeSub.away_score) !== Number(awaySub.away_score)) {
        await EXECUTESQL("UPDATE matches SET status = 'disputed', updated_date = NOW() WHERE id = ?", [match_id]);
        return { data: { status: 'disputed' } };
      }

      return processMatchCompletion(updated, homeSub, awaySub);
    }

    if (action === 'admin_resolve') {
      const rows = await EXECUTESQL('SELECT * FROM matches WHERE id = ? LIMIT 1', [match_id]);
      if (!rows.length) throw new Error('Match not found');
      const m = rows[0];

      const homeSub = parseSubmission(m.home_submission) || { home_score: 0, away_score: 0, player_stats: [], goal_events: [] };
      const awaySub = parseSubmission(m.away_submission) || { home_score: 0, away_score: 0, player_stats: [], goal_events: [] };
      const accepted = admin_resolve_winner === 'home' ? { ...homeSub } : { ...awaySub };

      if (admin_home_score != null) accepted.home_score = Number(admin_home_score);
      if (admin_away_score != null) accepted.away_score = Number(admin_away_score);

      return processMatchCompletion(m, accepted, accepted);
    }

    throw new Error(`Unsupported matchKickoff action: ${action}`);
  },

  async wagerMatchActions({ action, match_id }) {
    if (!match_id) throw new Error('match_id required');
    const rows = await EXECUTESQL('SELECT * FROM matches WHERE id = ? LIMIT 1', [match_id]);
    if (!rows.length) throw new Error('Match not found');
    const m = rows[0];
    const isClub = m.mode === 'club';

    if (action === 'accept_wager') {
      const wagerEach = Number(m.wager_stc || 0);
      if (wagerEach > 0) {
        if (isClub) {
          if (m.home_club_id) {
            const [hc] = await EXECUTESQL('SELECT stc FROM clubs WHERE id = ? LIMIT 1', [m.home_club_id]);
            if (!hc || Number(hc.stc || 0) < wagerEach) throw new Error('Home club has insufficient STC for this wager');
            await createClubTx({ clubId: m.home_club_id, amount: -wagerEach, type: 'wager_stake', category: 'wager_loss', description: `Wager stake locked — match vs ${m.away_club_name || 'Away'}`, referenceId: m.id });
          }
          if (m.away_club_id) {
            const [ac] = await EXECUTESQL('SELECT stc FROM clubs WHERE id = ? LIMIT 1', [m.away_club_id]);
            if (!ac || Number(ac.stc || 0) < wagerEach) throw new Error('Your club has insufficient STC for this wager');
            await createClubTx({ clubId: m.away_club_id, amount: -wagerEach, type: 'wager_stake', category: 'wager_loss', description: `Wager stake locked — match vs ${m.home_club_name || 'Home'}`, referenceId: m.id });
          }
        } else {
          if (m.home_player_id) {
            const [hp] = await EXECUTESQL('SELECT stc, email FROM players WHERE id = ? LIMIT 1', [m.home_player_id]);
            if (!hp || Number(hp.stc || 0) < wagerEach) throw new Error('Home player has insufficient STC for this wager');
            await createPlayerTx({ playerId: m.home_player_id, playerEmail: hp.email || null, amount: -wagerEach, category: 'wager_stake', source: `vs ${m.away_player_name || 'Away'}`, description: `Wager stake locked — vs ${m.away_player_name || 'Away'}`, referenceId: m.id });
          }
          if (m.away_player_id) {
            const [ap] = await EXECUTESQL('SELECT stc, email FROM players WHERE id = ? LIMIT 1', [m.away_player_id]);
            if (!ap || Number(ap.stc || 0) < wagerEach) throw new Error('You have insufficient STC for this wager');
            await createPlayerTx({ playerId: m.away_player_id, playerEmail: ap.email || null, amount: -wagerEach, category: 'wager_stake', source: `vs ${m.home_player_name || 'Home'}`, description: `Wager stake locked — vs ${m.home_player_name || 'Home'}`, referenceId: m.id });
          }
        }
      }
      await EXECUTESQL(
        "UPDATE matches SET wager_away_locked = 1, wager_home_locked = 1, wager_status = 'active', updated_date = NOW() WHERE id = ?",
        [match_id]
      );
      return { success: true, data: { _match_patch: { wager_away_locked: 1, wager_home_locked: 1, wager_status: 'active' } } };
    }

    if (action === 'decline_wager') {
      await EXECUTESQL(
        "UPDATE matches SET wager_status = 'declined', wager_stc = 0, wager_home_locked = 0, wager_away_locked = 0, updated_date = NOW() WHERE id = ?",
        [match_id]
      );
      return { success: true, data: { _match_patch: { wager_status: 'declined', wager_stc: 0, wager_home_locked: 0, wager_away_locked: 0 } } };
    }

    if (action === 'cancel_wager') {
      // Refund both sides only if wager was already active (funds were deducted)
      const wagerEach = Number(m.wager_stc || 0);
      if (wagerEach > 0 && m.wager_status === 'active') {
        const matchLabel = isClub
          ? `${m.home_club_name || 'Home'} vs ${m.away_club_name || 'Away'}`
          : `${m.home_player_name || 'Home'} vs ${m.away_player_name || 'Away'}`;
        if (isClub) {
          if (m.home_club_id) await createClubTx({ clubId: m.home_club_id, amount: wagerEach, type: 'wager_refund', category: 'wager_refund', description: `Wager refunded — match cancelled — ${matchLabel}`, referenceId: m.id });
          if (m.away_club_id) await createClubTx({ clubId: m.away_club_id, amount: wagerEach, type: 'wager_refund', category: 'wager_refund', description: `Wager refunded — match cancelled — ${matchLabel}`, referenceId: m.id });
        } else {
          const [hp] = await EXECUTESQL('SELECT email FROM players WHERE id = ? LIMIT 1', [m.home_player_id]).catch(() => [null]);
          const [ap] = await EXECUTESQL('SELECT email FROM players WHERE id = ? LIMIT 1', [m.away_player_id]).catch(() => [null]);
          if (m.home_player_id) await createPlayerTx({ playerId: m.home_player_id, playerEmail: hp?.email || null, amount: wagerEach, category: 'wager_refund', source: matchLabel, description: `Wager stake refunded — match cancelled`, referenceId: m.id }).catch(() => {});
          if (m.away_player_id) await createPlayerTx({ playerId: m.away_player_id, playerEmail: ap?.email || null, amount: wagerEach, category: 'wager_refund', source: matchLabel, description: `Wager stake refunded — match cancelled`, referenceId: m.id }).catch(() => {});
        }
      }
      const nextStatus = m.status === 'completed' ? m.wager_status : 'cancelled';
      await EXECUTESQL(
        "UPDATE matches SET wager_status = ?, wager_stc = 0, wager_home_locked = 0, wager_away_locked = 0, updated_date = NOW() WHERE id = ?",
        [nextStatus, match_id]
      );
      return { success: true, data: { _match_patch: { wager_status: nextStatus, wager_stc: 0, wager_home_locked: 0, wager_away_locked: 0 } } };
    }
    throw new Error(`Unknown wager action: ${action}`);
  },

  // Settle wager for solo (player-vs-player) matches on completion
  async processSoloWager({ match_id }) {
    if (!match_id) throw new Error('match_id required');
    const rows = await EXECUTESQL('SELECT * FROM matches WHERE id = ? LIMIT 1', [match_id]);
    if (!rows.length) throw new Error('Match not found');
    const m = rows[0];
    if (m.mode === 'club') return { success: true, data: { skipped: true } };
    const wagerEach = Number(m.wager_stc || 0);
    if (!wagerEach || m.wager_status !== 'active' || !m.wager_home_locked || !m.wager_away_locked) {
      return { success: true, data: { skipped: true } };
    }
    // Atomic guard: claim settlement slot by flipping status; if already claimed, skip
    const claim = await EXECUTESQL(
      "UPDATE matches SET wager_status = 'settling', updated_date = NOW() WHERE id = ? AND wager_status = 'active'",
      [match_id]
    ).catch(() => ({ affectedRows: 0 }));
    if (!claim.affectedRows) return { success: true, data: { skipped: true } };

    const pot = wagerEach * 2;
    const homeScore = Number(m.home_score ?? 0);
    const awayScore = Number(m.away_score ?? 0);
    const isDraw = homeScore === awayScore;
    const label = `${m.home_player_name || 'Home'} vs ${m.away_player_name || 'Away'}`;

    const notifyInbox = async (email, subj, body) => email && EXECUTESQL(
      `INSERT INTO inbox_messages (id, recipient_email, sender_email, subject, body, message_type, related_entity_id, related_entity_type, is_read, created_date)
       VALUES (?, ?, 'system@stage.com', ?, ?, 'wager', ?, 'solo_wager', 0, NOW())`,
      [uuidv4(), email, subj, body, match_id]
    ).catch(() => {});

    if (isDraw) {
      await EXECUTESQL("UPDATE matches SET wager_status = 'refunded', updated_date = NOW() WHERE id = ?", [match_id]);
      if (m.home_player_id) await createPlayerTx({ playerId: m.home_player_id, playerEmail: m.home_player_email || null, amount: wagerEach, category: 'wager_refund', source: label, description: `Wager refunded (draw) — ${label}`, referenceId: match_id }).catch(() => {});
      if (m.away_player_id) await createPlayerTx({ playerId: m.away_player_id, playerEmail: m.away_player_email || null, amount: wagerEach, category: 'wager_refund', source: label, description: `Wager refunded (draw) — ${label}`, referenceId: match_id }).catch(() => {});
      await notifyInbox(m.home_player_email, '🤝 Wager Refunded', `Draw in ${label}. Your ${wagerEach.toLocaleString()} STC wager was refunded.`);
      await notifyInbox(m.away_player_email, '🤝 Wager Refunded', `Draw in ${label}. Your ${wagerEach.toLocaleString()} STC wager was refunded.`);
      return { success: true, data: { result: 'refunded', wagerEach } };
    }

    const homeWins  = homeScore > awayScore;
    const winnerId  = homeWins ? m.home_player_id  : m.away_player_id;
    const loserId   = homeWins ? m.away_player_id  : m.home_player_id;
    const winnerName  = homeWins ? (m.home_player_name || 'Home') : (m.away_player_name || 'Away');
    const loserName   = homeWins ? (m.away_player_name || 'Away') : (m.home_player_name || 'Home');
    const winnerEmail = homeWins ? (m.home_player_email || null) : (m.away_player_email || null);
    const loserEmail  = homeWins ? (m.away_player_email || null) : (m.home_player_email || null);

    await EXECUTESQL("UPDATE matches SET wager_status = 'settled', updated_date = NOW() WHERE id = ?", [match_id]);
    if (winnerId) await createPlayerTx({ playerId: winnerId, playerEmail: winnerEmail, amount: pot, category: 'wager_win', source: label, description: `Wager won vs ${loserName} — ${label}`, referenceId: match_id }).catch(() => {});
    if (loserId)  await createPlayerTx({ playerId: loserId,  playerEmail: loserEmail,  amount: 0,   category: 'wager_loss', source: label, description: `Wager lost vs ${winnerName} — ${label}`, referenceId: match_id }).catch(() => {});
    await notifyInbox(winnerEmail, `🏆 Wager Won — ${label}`, `You won! +${pot.toLocaleString()} STC added to your wallet.`);
    await notifyInbox(loserEmail,  `❌ Wager Lost — ${label}`, `You lost the wager vs ${winnerName}. ${wagerEach.toLocaleString()} STC forfeited.`);

    return { success: true, data: { result: 'settled', pot, winner: winnerName, loser: loserName } };
  },

  async wagerManagement({ _auth_user_id, action, match_id, winner, note }) {
    if (!_auth_user_id) throw new Error('not authenticated');
    const admins = await EXECUTESQL('SELECT id FROM users WHERE id = ? AND role_id = 0 LIMIT 1', [_auth_user_id]);
    if (!admins.length) throw new Error('Admin access required');

    if (action === 'get_all') {
      const rows = await EXECUTESQL(
        `SELECT id, mode, status, wager_stc, wager_status, wager_home_locked, wager_away_locked,
                home_score, away_score, scheduled_date,
                home_club_id, away_club_id, home_player_id, away_player_id,
                home_club_name, away_club_name, home_player_name, away_player_name
         FROM matches WHERE wager_stc > 0 ORDER BY scheduled_date DESC LIMIT 200`
      );
      return { success: true, data: { wagers: rows } };
    }

    if (!match_id) throw new Error('match_id required');
    const rows = await EXECUTESQL('SELECT * FROM matches WHERE id = ? LIMIT 1', [match_id]);
    if (!rows.length) throw new Error('Match not found');
    const m = rows[0];
    const isClub = m.mode === 'club';
    const wagerEach = Number(m.wager_stc || 0);
    const pot = wagerEach * 2;
    const matchLabel = isClub
      ? `${m.home_club_name || 'Home'} vs ${m.away_club_name || 'Away'}`
      : `${m.home_player_name || 'Home'} vs ${m.away_player_name || 'Away'}`;

    if (action === 'cancel_and_refund') {
      if (wagerEach > 0 && m.wager_status === 'active') {
        if (isClub) {
          if (m.home_club_id) await createClubTx({ clubId: m.home_club_id, amount: wagerEach, type: 'wager_refund', category: 'wager_refund', description: `Admin cancelled wager — ${matchLabel}`, referenceId: m.id }).catch(() => {});
          if (m.away_club_id) await createClubTx({ clubId: m.away_club_id, amount: wagerEach, type: 'wager_refund', category: 'wager_refund', description: `Admin cancelled wager — ${matchLabel}`, referenceId: m.id }).catch(() => {});
        } else {
          const [hp] = await EXECUTESQL('SELECT email FROM players WHERE id = ? LIMIT 1', [m.home_player_id]).catch(() => [null]);
          const [ap] = await EXECUTESQL('SELECT email FROM players WHERE id = ? LIMIT 1', [m.away_player_id]).catch(() => [null]);
          if (m.home_player_id) await createPlayerTx({ playerId: m.home_player_id, playerEmail: hp?.email || null, amount: wagerEach, category: 'wager_refund', source: matchLabel, description: `Admin cancelled wager — ${matchLabel}`, referenceId: m.id }).catch(() => {});
          if (m.away_player_id) await createPlayerTx({ playerId: m.away_player_id, playerEmail: ap?.email || null, amount: wagerEach, category: 'wager_refund', source: matchLabel, description: `Admin cancelled wager — ${matchLabel}`, referenceId: m.id }).catch(() => {});
        }
      }
      await EXECUTESQL(
        "UPDATE matches SET wager_status = 'cancelled', wager_home_locked = 0, wager_away_locked = 0, updated_date = NOW() WHERE id = ?",
        [match_id]
      );
      return { success: true };
    }

    if (action === 'force_settle') {
      if (!winner || !['home', 'away', 'draw'].includes(winner)) throw new Error('winner must be home, away, or draw');
      if (!['active', 'settling', 'disputed'].includes(m.wager_status) && wagerEach > 0) throw new Error(`Cannot force-settle — wager status is '${m.wager_status}'`);
      if (!wagerEach) throw new Error('No wager amount on this match');
      if (winner === 'draw') {
        if (isClub) {
          if (m.home_club_id) await createClubTx({ clubId: m.home_club_id, amount: wagerEach, type: 'wager_refund', category: 'wager_refund', description: `Admin settled wager as draw — ${matchLabel}`, referenceId: m.id }).catch(() => {});
          if (m.away_club_id) await createClubTx({ clubId: m.away_club_id, amount: wagerEach, type: 'wager_refund', category: 'wager_refund', description: `Admin settled wager as draw — ${matchLabel}`, referenceId: m.id }).catch(() => {});
        } else {
          const [hp] = await EXECUTESQL('SELECT email FROM players WHERE id = ? LIMIT 1', [m.home_player_id]).catch(() => [null]);
          const [ap] = await EXECUTESQL('SELECT email FROM players WHERE id = ? LIMIT 1', [m.away_player_id]).catch(() => [null]);
          if (m.home_player_id) await createPlayerTx({ playerId: m.home_player_id, playerEmail: hp?.email || null, amount: wagerEach, category: 'wager_refund', source: matchLabel, description: `Admin settled wager as draw — ${matchLabel}`, referenceId: m.id }).catch(() => {});
          if (m.away_player_id) await createPlayerTx({ playerId: m.away_player_id, playerEmail: ap?.email || null, amount: wagerEach, category: 'wager_refund', source: matchLabel, description: `Admin settled wager as draw — ${matchLabel}`, referenceId: m.id }).catch(() => {});
        }
        await EXECUTESQL("UPDATE matches SET wager_status = 'refunded', updated_date = NOW() WHERE id = ?", [match_id]);
      } else {
        if (isClub) {
          const winnerClubId = winner === 'home' ? m.home_club_id : m.away_club_id;
          const loserClubId  = winner === 'home' ? m.away_club_id : m.home_club_id;
          const winnerName   = winner === 'home' ? (m.home_club_name || 'Home') : (m.away_club_name || 'Away');
          const loserName    = winner === 'home' ? (m.away_club_name || 'Away') : (m.home_club_name || 'Home');
          if (winnerClubId) await createClubTx({ clubId: winnerClubId, amount: pot, type: 'wager_win',  category: 'wager_win',  description: `Admin settled — wager won vs ${loserName}${note ? ` (${note})` : ''}`, referenceId: m.id }).catch(() => {});
          if (loserClubId)  await createClubTx({ clubId: loserClubId,  amount: 0,   type: 'wager_loss', category: 'wager_loss', description: `Admin settled — wager lost vs ${winnerName}${note ? ` (${note})` : ''}`, referenceId: m.id }).catch(() => {});
        } else {
          const winnerId    = winner === 'home' ? m.home_player_id  : m.away_player_id;
          const loserId     = winner === 'home' ? m.away_player_id  : m.home_player_id;
          const winnerEmail = winner === 'home' ? (m.home_player_email || null) : (m.away_player_email || null);
          const loserEmail  = winner === 'home' ? (m.away_player_email || null) : (m.home_player_email || null);
          const winnerName  = winner === 'home' ? (m.home_player_name || 'Home') : (m.away_player_name || 'Away');
          const loserName   = winner === 'home' ? (m.away_player_name || 'Away') : (m.home_player_name || 'Home');
          if (winnerId) await createPlayerTx({ playerId: winnerId, playerEmail: winnerEmail, amount: pot, category: 'wager_win',  source: matchLabel, description: `Admin settled — wager won vs ${loserName}${note ? ` (${note})` : ''}`, referenceId: m.id }).catch(() => {});
          if (loserId)  await createPlayerTx({ playerId: loserId,  playerEmail: loserEmail,  amount: 0,   category: 'wager_loss', source: matchLabel, description: `Admin settled — wager lost vs ${winnerName}${note ? ` (${note})` : ''}`, referenceId: m.id }).catch(() => {});
        }
        await EXECUTESQL("UPDATE matches SET wager_status = 'settled', updated_date = NOW() WHERE id = ?", [match_id]);
      }
      return { success: true };
    }

    throw new Error(`Unknown wagerManagement action: ${action}`);
  },

  async stadiumManagement({ _auth_user_id, action, level, capacity, ticket_price_stc, upgrade_cost_stc, description, club_id, stadium_level, stadium_name, amount, note }) {
    if (!_auth_user_id) throw new Error('not authenticated');
    const admins = await EXECUTESQL('SELECT id FROM users WHERE id = ? AND role_id = 0 LIMIT 1', [_auth_user_id]);
    if (!admins.length) throw new Error('Admin access required');

    if (action === 'get_config') {
      const rows = await EXECUTESQL('SELECT * FROM stadium_config ORDER BY level ASC');
      return { success: true, data: { levels: rows } };
    }

    if (action === 'set_level_config') {
      if (level == null) throw new Error('level required');
      const updates = [];
      const vals = [];
      if (capacity        != null) { updates.push('capacity = ?');         vals.push(Number(capacity)); }
      if (ticket_price_stc!= null) { updates.push('ticket_price_stc = ?'); vals.push(Number(ticket_price_stc)); }
      if (upgrade_cost_stc!= null) { updates.push('upgrade_cost_stc = ?'); vals.push(Number(upgrade_cost_stc)); }
      if (description     != null) { updates.push('description = ?');      vals.push(String(description)); }
      if (!updates.length) throw new Error('Nothing to update');
      vals.push(Number(level));
      await EXECUTESQL(`UPDATE stadium_config SET ${updates.join(', ')}, updated_date = NOW() WHERE level = ?`, vals);
      _stadiumConfigCache = null; // bust cache
      return { success: true };
    }

    if (action === 'edit_club_stadium') {
      if (!club_id) throw new Error('club_id required');
      const sets = [];
      const vals = [];
      if (stadium_level != null) { sets.push('stadium_level = ?');    vals.push(Number(stadium_level)); }
      if (stadium_name  != null) { sets.push('stadium_name = ?');     vals.push(String(stadium_name)); }
      if (capacity      != null) { sets.push('stadium_capacity = ?'); vals.push(Number(capacity)); }
      if (!sets.length) throw new Error('Nothing to update');
      vals.push(club_id);
      await EXECUTESQL(`UPDATE clubs SET ${sets.join(', ')}, updated_date = NOW() WHERE id = ?`, vals);
      return { success: true };
    }

    if (action === 'correct_revenue') {
      if (!club_id || amount == null) throw new Error('club_id and amount required');
      const corrAmt = Number(amount);
      await createClubTx({
        clubId: club_id, amount: corrAmt,
        type: corrAmt >= 0 ? 'ticket_revenue' : 'adjustment',
        category: 'ticket_revenue',
        description: note ? `Admin revenue correction: ${note}` : 'Admin ticket revenue correction',
        referenceId: club_id,
      });
      return { success: true };
    }

    if (action === 'upgrade_club_stadium') {
      if (!club_id) throw new Error('club_id required');
      const [club] = await EXECUTESQL('SELECT id, stc, stadium_level, name FROM clubs WHERE id = ? LIMIT 1', [club_id]);
      if (!club) throw new Error('Club not found');
      const cfg = await getStadiumConfig();
      const currentLevel = Math.min(Math.max(Number(club.stadium_level || 0), 0), cfg.length - 1);
      const next = cfg[currentLevel + 1];
      if (!next) throw new Error('Already at maximum stadium level');
      const cost = Number(next.upgrade_cost_stc || 0);
      if (Number(club.stc || 0) < cost) throw new Error(`Insufficient STC — need ${cost.toLocaleString()}, have ${Number(club.stc || 0).toLocaleString()}`);
      await createClubTx({
        clubId: club_id, amount: -cost,
        type: 'stadium_upgrade', category: 'stadium_upgrade',
        description: `Stadium upgraded to ${next.name}`,
        referenceId: club_id,
      });
      await EXECUTESQL(
        'UPDATE clubs SET stadium_level = ?, stadium_capacity = ?, updated_date = NOW() WHERE id = ?',
        [currentLevel + 1, Number(next.capacity), club_id]
      );
      _stadiumConfigCache = null;
      return { success: true, data: { new_level: currentLevel + 1, new_capacity: next.capacity, name: next.name } };
    }

    throw new Error(`Unknown stadiumManagement action: ${action}`);
  },

  async backfillPlayerStc({ _auth_user_id, dry_run = false }) {
    if (!_auth_user_id) throw new Error('not authenticated');
    const admins = await EXECUTESQL('SELECT id FROM users WHERE id = ? AND role_id = 0 LIMIT 1', [_auth_user_id]);
    if (!admins.length) throw new Error('Admin access required');

    const needsStc = await EXECUTESQL(
      'SELECT id, email, stc, created_date FROM players WHERE stc IS NULL OR stc < 50000'
    );
    const missingTxOnly = await EXECUTESQL(
      `SELECT p.id, p.email, p.stc, p.created_date FROM players p
       WHERE (p.stc IS NOT NULL AND p.stc >= 50000)
         AND NOT EXISTS (
           SELECT 1 FROM player_stc_transactions t
           WHERE t.player_id = p.id AND t.category = 'initial_grant'
         )`
    );

    const stats = {
      needs_stc: needsStc.length,
      needs_tx_only: missingTxOnly.length,
      total_to_repair: needsStc.length + missingTxOnly.length,
      repaired_stc: 0,
      repaired_tx: 0,
      errors: 0,
    };

    if (dry_run) return { success: true, data: stats };

    for (const p of needsStc) {
      try {
        await EXECUTESQL(
          'UPDATE players SET stc = 50000, updated_date = NOW() WHERE id = ? AND (stc IS NULL OR stc < 50000)',
          [p.id]
        );
        const existing = await EXECUTESQL(
          "SELECT id FROM player_stc_transactions WHERE player_id = ? AND category = 'initial_grant' LIMIT 1",
          [p.id]
        );
        if (!existing.length) {
          await EXECUTESQL(
            `INSERT INTO player_stc_transactions
               (id, player_id, player_email, amount, balance_after, type, category, source, description, created_date)
             VALUES (?, ?, ?, 50000, 50000, 'income', 'initial_grant', 'STAGE',
                     'Welcome to STAGE — 50,000 STC starting balance', ?)`,
            [uuidv4(), p.id, p.email || null, p.created_date || new Date()]
          );
        }
        stats.repaired_stc++;
      } catch { stats.errors++; }
    }

    for (const p of missingTxOnly) {
      try {
        await EXECUTESQL(
          `INSERT INTO player_stc_transactions
             (id, player_id, player_email, amount, balance_after, type, category, source, description, created_date)
           VALUES (?, ?, ?, 50000, ?, 'income', 'initial_grant', 'STAGE',
                   'Welcome to STAGE — 50,000 STC starting balance', ?)`,
          [uuidv4(), p.id, p.email || null, Number(p.stc || 50000), p.created_date || new Date()]
        );
        stats.repaired_tx++;
      } catch { stats.errors++; }
    }

    return { success: true, data: stats };
  },

  async buyLifestyleItem({ _auth_user_id, item_id }) {
    if (!_auth_user_id) throw new Error('not authenticated');
    if (!item_id) throw new Error('item_id required');
    const { user, player } = await getMe(_auth_user_id);
    if (!player) throw new Error('Player not found');
    const items = await EXECUTESQL('SELECT * FROM lifestyle_items WHERE id = ? LIMIT 1', [item_id]);
    if (!items.length) throw new Error('Item not found');
    const item = items[0];
    if (item.can_buy === 0) throw new Error('This asset is not available for purchase');
    const price = Number(item.price_stc || 0);
    if (!price) throw new Error('No buy price set for this asset');
    if (price > Number(player.stc || 0)) throw new Error('Insufficient STC');
    const purchaseId = uuidv4();
    await EXECUTESQL(
      `INSERT INTO lifestyle_purchases
         (id, player_id, player_email, item_id, item_type, item_tier, rent_active, is_residence,
          purchase_type, price_paid_stc, current_value_stc, status, created_date)
       VALUES (?,?,?,?,?,?,0,?,  'buy',?,?,'active',NOW())`,
      [purchaseId, player.id, user.email, item_id,
       item.category || null, item.tier || null,
       (item.category === 'real_estate' || item.category === 'houses') ? 1 : 0,
       price, price]
    );
    const { new_balance: new_stc_balance } = await createPlayerTx({
      playerId: player.id, playerEmail: user.email, amount: -price,
      category: 'lifestyle_purchase', source: item.name || 'Lifestyle',
      description: `Bought: ${item.name}`, referenceId: purchaseId,
    });
    return { success: true, data: { new_stc_balance, purchase_id: purchaseId } };
  },

  async rentLifestyleItem({ _auth_user_id, item_id }) {
    if (!_auth_user_id) throw new Error('not authenticated');
    if (!item_id) throw new Error('item_id required');
    const { user, player } = await getMe(_auth_user_id);
    if (!player) throw new Error('Player not found');
    const items = await EXECUTESQL('SELECT * FROM lifestyle_items WHERE id = ? LIMIT 1', [item_id]);
    if (!items.length) throw new Error('Item not found');
    const item = items[0];
    if (!item.can_rent) throw new Error('This asset is not available for rent');
    const rent = Number(item.rent_price_stc || 0);
    if (!rent) throw new Error('No rent price set');
    if (rent > Number(player.stc || 0)) throw new Error('Insufficient STC');
    const durationDays = Number(item.rent_duration_days || 30);
    const rentEndDate = new Date();
    rentEndDate.setDate(rentEndDate.getDate() + durationDays);
    const purchaseId = uuidv4();
    await EXECUTESQL(
      `INSERT INTO lifestyle_purchases
         (id, player_id, player_email, item_id, item_type, item_tier, rent_active, is_residence,
          purchase_type, price_paid_stc, rent_end_date, status, created_date)
       VALUES (?,?,?,?,?,?,1,0,  'rent',?,?,'active',NOW())`,
      [purchaseId, player.id, user.email, item_id,
       item.category || null, item.tier || null,
       rent, rentEndDate.toISOString().slice(0, 19).replace('T', ' ')]
    );
    const { new_balance: new_stc_balance } = await createPlayerTx({
      playerId: player.id, playerEmail: user.email, amount: -rent,
      category: 'lifestyle_rent', source: item.name || 'Lifestyle',
      description: `Rented: ${item.name} for ${durationDays} days`,
      referenceId: purchaseId,
    });
    return { success: true, data: { new_stc_balance, purchase_id: purchaseId, rent_end_date: rentEndDate } };
  },

  async investInLifestyleItem({ _auth_user_id, item_id }) {
    if (!_auth_user_id) throw new Error('not authenticated');
    if (!item_id) throw new Error('item_id required');
    const { user, player } = await getMe(_auth_user_id);
    if (!player) throw new Error('Player not found');
    const items = await EXECUTESQL('SELECT * FROM lifestyle_items WHERE id = ? LIMIT 1', [item_id]);
    if (!items.length) throw new Error('Item not found');
    const item = items[0];
    if (!item.can_invest) throw new Error('This asset does not support investment');
    const price = Number(item.invest_price_stc || item.price_stc || 0);
    if (!price) throw new Error('No investment price set');
    if (price > Number(player.stc || 0)) throw new Error('Insufficient STC');
    const returnRate = Number(item.invest_return_rate || 0);
    const returnAmount = Math.floor(price * returnRate / 100);
    const durationDays = Number(item.invest_duration_days || 30);
    const investEndDate = new Date();
    investEndDate.setDate(investEndDate.getDate() + durationDays);
    const purchaseId = uuidv4();
    await EXECUTESQL(
      `INSERT INTO lifestyle_purchases
         (id, player_id, player_email, item_id, item_type, item_tier, rent_active, is_residence,
          purchase_type, price_paid_stc, invest_end_date, invest_return_amount, status, created_date)
       VALUES (?,?,?,?,?,?,0,0,  'invest',?,?,?,'active',NOW())`,
      [purchaseId, player.id, user.email, item_id,
       item.category || null, item.tier || null,
       price,
       investEndDate.toISOString().slice(0, 19).replace('T', ' '),
       returnAmount]
    );
    const { new_balance: new_stc_balance } = await createPlayerTx({
      playerId: player.id, playerEmail: user.email, amount: -price,
      category: 'lifestyle_invest', source: item.name || 'Investment',
      description: `Invested in: ${item.name} — ${returnRate}% return in ${durationDays}d`,
      referenceId: purchaseId,
    });
    return { success: true, data: { new_stc_balance, purchase_id: purchaseId, return_amount: returnAmount, due_date: investEndDate } };
  },

  async sellLifestyleAsset({ _auth_user_id, purchase_id }) {
    if (!_auth_user_id) throw new Error('not authenticated');
    if (!purchase_id) throw new Error('purchase_id required');
    const { user, player } = await getMe(_auth_user_id);
    if (!player) throw new Error('Player not found');
    const purchases = await EXECUTESQL(
      "SELECT * FROM lifestyle_purchases WHERE id = ? AND player_id = ? LIMIT 1", [purchase_id, player.id]
    );
    if (!purchases.length) throw new Error('Asset not found');
    const purchase = purchases[0];
    if (purchase.purchase_type !== 'buy') throw new Error('Only owned assets can be sold');
    const items = await EXECUTESQL('SELECT * FROM lifestyle_items WHERE id = ? LIMIT 1', [purchase.item_id]);
    if (!items.length) throw new Error('Item not found');
    const item = items[0];
    if (!item.can_sell) throw new Error('This asset cannot be sold');
    const sellPercent = Number(item.sell_value_percent || 60);
    const paidPrice = Number(purchase.price_paid_stc || item.price_stc || 0);
    const sellPrice = Math.floor(paidPrice * sellPercent / 100);
    await EXECUTESQL("UPDATE lifestyle_purchases SET status = 'sold' WHERE id = ?", [purchase_id]);
    const { new_balance: new_stc_balance } = await createPlayerTx({
      playerId: player.id, playerEmail: user.email, amount: sellPrice,
      category: 'lifestyle_sell', source: item.name || 'Asset Sale',
      description: `Sold: ${item.name} for ${sellPrice.toLocaleString()} STC (${sellPercent}% of buy price)`,
      referenceId: purchase_id,
    });
    return { success: true, data: { new_stc_balance, sell_price: sellPrice } };
  },

  async collectInvestmentReturn({ _auth_user_id, purchase_id }) {
    if (!_auth_user_id) throw new Error('not authenticated');
    if (!purchase_id) throw new Error('purchase_id required');
    const { user, player } = await getMe(_auth_user_id);
    if (!player) throw new Error('Player not found');
    const purchases = await EXECUTESQL(
      "SELECT * FROM lifestyle_purchases WHERE id = ? AND player_id = ? AND purchase_type = 'invest' AND status = 'active' LIMIT 1",
      [purchase_id, player.id]
    );
    if (!purchases.length) throw new Error('Investment not found');
    const inv = purchases[0];
    const endDate = inv.invest_end_date ? new Date(inv.invest_end_date) : null;
    if (endDate && new Date() < endDate) {
      throw new Error(`Investment matures on ${endDate.toLocaleDateString()}`);
    }
    const principal = Number(inv.price_paid_stc || 0);
    const returns = Number(inv.invest_return_amount || 0);
    const total = principal + returns;
    await EXECUTESQL("UPDATE lifestyle_purchases SET status = 'collected' WHERE id = ?", [purchase_id]);
    const { new_balance: new_stc_balance } = await createPlayerTx({
      playerId: player.id, playerEmail: user.email, amount: total,
      category: 'lifestyle_invest_return', source: 'Investment Return',
      description: `Investment matured: ${principal.toLocaleString()} principal + ${returns.toLocaleString()} return`,
      referenceId: purchase_id,
    });
    return { success: true, data: { new_stc_balance, principal, returns, total } };
  },

  async collectPassiveIncome({ _auth_user_id }) {
    if (!_auth_user_id) throw new Error('not authenticated');
    const { user, player } = await getMe(_auth_user_id);
    if (!player) throw new Error('Player not found');
    const purchases = await EXECUTESQL(
      "SELECT * FROM lifestyle_purchases WHERE player_id = ? AND purchase_type = 'buy' AND status = 'active'",
      [player.id]
    );
    if (!purchases.length) return { success: true, data: { collected: 0 } };
    let collected = 0;
    const now = new Date();
    for (const p of purchases) {
      const items = await EXECUTESQL('SELECT * FROM lifestyle_items WHERE id = ? LIMIT 1', [p.item_id]);
      if (!items.length) continue;
      const item = items[0];
      const inc = Number(item.passive_income_stc || 0);
      if (inc <= 0) continue;
      const intervalDays = Number(item.passive_income_interval_days || 7);
      const lastCollected = p.last_passive_collected ? new Date(p.last_passive_collected) : new Date(p.created_date || 0);
      const msSinceCollect = now - lastCollected;
      const msInterval = intervalDays * 24 * 60 * 60 * 1000;
      if (msSinceCollect < msInterval) continue;
      collected += inc;
      await EXECUTESQL('UPDATE lifestyle_purchases SET last_passive_collected = NOW() WHERE id = ?', [p.id]);
    }
    if (collected > 0) {
      await createPlayerTx({
        playerId: player.id, playerEmail: user.email, amount: collected,
        category: 'lifestyle_passive_income', source: 'Passive Income',
        description: `Passive income collected from owned assets`,
      });
    }
    return { success: true, data: { collected } };
  },

  async lifestyleAdmin({ _auth_user_id, action, asset_id,
    name, category, subcategory, description, image_url, tier, sort_order,
    price_stc, rent_price_stc, rent_duration_days, invest_price_stc,
    invest_return_rate, invest_duration_days, passive_income_stc,
    passive_income_interval_days, weekly_maintenance_stc,
    can_buy, can_rent, can_invest, can_sell, sell_value_percent,
    allows_multiple, is_active,
  }) {
    if (!_auth_user_id) throw new Error('not authenticated');
    const adminCheck = await EXECUTESQL('SELECT role_id FROM users WHERE id = ? LIMIT 1', [_auth_user_id]);
    if (!adminCheck.length || Number(adminCheck[0].role_id) !== 0) throw new Error('Admin only');

    const vals = [
      name, category || 'fashion', subcategory || null,
      description || null, image_url || null, tier || 'standard',
      Number(sort_order || 0),
      Number(price_stc || 0), Number(rent_price_stc || 0), Number(rent_duration_days || 30),
      Number(invest_price_stc || 0), Number(invest_return_rate || 0), Number(invest_duration_days || 30),
      Number(passive_income_stc || 0), Number(passive_income_interval_days || 7),
      Number(weekly_maintenance_stc || 0),
      can_buy    != null ? (can_buy    ? 1 : 0) : 1,
      can_rent   != null ? (can_rent   ? 1 : 0) : 0,
      can_invest != null ? (can_invest ? 1 : 0) : 0,
      can_sell   != null ? (can_sell   ? 1 : 0) : 1,
      Number(sell_value_percent || 60),
      allows_multiple != null ? (allows_multiple ? 1 : 0) : 1,
      is_active  != null ? (is_active  ? 1 : 0) : 1,
    ];

    if (action === 'add') {
      const id = uuidv4();
      await EXECUTESQL(
        `INSERT INTO lifestyle_items
           (id, name, category, subcategory, description, image_url, tier, sort_order,
            price_stc, rent_price_stc, rent_duration_days, invest_price_stc, invest_return_rate,
            invest_duration_days, passive_income_stc, passive_income_interval_days,
            weekly_maintenance_stc, can_buy, can_rent, can_invest, can_sell,
            sell_value_percent, allows_multiple, is_active)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
        [id, ...vals]
      );
      return { success: true, data: { id } };
    }

    if (action === 'edit') {
      if (!asset_id) throw new Error('asset_id required');
      await EXECUTESQL(
        `UPDATE lifestyle_items SET
           name=?, category=?, subcategory=?, description=?, image_url=?, tier=?, sort_order=?,
           price_stc=?, rent_price_stc=?, rent_duration_days=?, invest_price_stc=?, invest_return_rate=?,
           invest_duration_days=?, passive_income_stc=?, passive_income_interval_days=?,
           weekly_maintenance_stc=?, can_buy=?, can_rent=?, can_invest=?, can_sell=?,
           sell_value_percent=?, allows_multiple=?, is_active=?
         WHERE id=?`,
        [...vals, asset_id]
      );
      return { success: true };
    }

    if (action === 'delete') {
      if (!asset_id) throw new Error('asset_id required');
      await EXECUTESQL('DELETE FROM lifestyle_items WHERE id = ?', [asset_id]);
      return { success: true };
    }

    if (action === 'toggle') {
      if (!asset_id) throw new Error('asset_id required');
      await EXECUTESQL('UPDATE lifestyle_items SET is_active = NOT is_active WHERE id = ?', [asset_id]);
      return { success: true };
    }

    throw new Error('Invalid action');
  },

  async setPlayerResidence({ _auth_user_id, purchase_id }) {
    if (!_auth_user_id) throw new Error('not authenticated');
    if (!purchase_id) throw new Error('purchase_id required');
    const { player } = await getMe(_auth_user_id);
    await EXECUTESQL('UPDATE lifestyle_purchases SET is_residence = 0 WHERE player_id = ?', [player.id]);
    await EXECUTESQL(
      'UPDATE lifestyle_purchases SET is_residence = 1 WHERE id = ? AND player_id = ?',
      [purchase_id, player.id]
    );
    return { success: true, data: { residence_purchase_id: purchase_id } };
  },

  async changePassword({ _auth_user_id, current_password, new_password }) {
    if (!_auth_user_id) throw new Error('not authenticated');
    if (!current_password || !new_password) throw new Error('current_password and new_password required');
    if (String(new_password).length < 8) throw new Error('Password must be at least 8 characters');
    const rows = await EXECUTESQL('SELECT id, password_hash FROM users WHERE id = ? LIMIT 1', [_auth_user_id]);
    if (!rows.length) throw new Error('User not found');
    const ok = await bcrypt.compare(String(current_password), rows[0].password_hash || '');
    if (!ok) throw new Error('Current password is incorrect');
    const hash = await bcrypt.hash(String(new_password), 10);
    await EXECUTESQL('UPDATE users SET password_hash = ?, updated_date = NOW() WHERE id = ?', [hash, _auth_user_id]);
    return { success: true };
  },

  async seedLifestyleItems() {
    const seed = [
      // Houses & Apartments
      { name: 'Studio Apartment',  category: 'houses', tier: 'standard', sort_order: 1,  price_stc: 800000,    rent_price_stc: 35000,   rent_duration_days: 30, invest_price_stc: 800000,    invest_return_rate: 8,  invest_duration_days: 30, passive_income_stc: 10000, passive_income_interval_days: 7, weekly_maintenance_stc: 5000,  can_buy: 1, can_rent: 1, can_invest: 1, can_sell: 1, sell_value_percent: 70, allows_multiple: 1, description: 'A compact modern studio in the city centre. Good starter investment.' },
      { name: 'City Apartment',    category: 'houses', tier: 'premium',  sort_order: 2,  price_stc: 2500000,   rent_price_stc: 100000,  rent_duration_days: 30, invest_price_stc: 2500000,   invest_return_rate: 10, invest_duration_days: 30, passive_income_stc: 30000, passive_income_interval_days: 7, weekly_maintenance_stc: 15000, can_buy: 1, can_rent: 1, can_invest: 1, can_sell: 1, sell_value_percent: 75, allows_multiple: 1, description: 'Stylish apartment with city views. Strong rental yield.' },
      { name: 'Penthouse Suite',   category: 'houses', tier: 'elite',    sort_order: 3,  price_stc: 12000000,  rent_price_stc: 500000,  rent_duration_days: 30, invest_price_stc: 12000000,  invest_return_rate: 12, invest_duration_days: 30, passive_income_stc: 150000, passive_income_interval_days: 7, weekly_maintenance_stc: 80000, can_buy: 1, can_rent: 1, can_invest: 1, can_sell: 1, sell_value_percent: 80, allows_multiple: 1, description: 'Top-floor penthouse with panoramic views and private terrace.' },
      { name: 'Luxury Villa',      category: 'houses', tier: 'legendary',sort_order: 4,  price_stc: 50000000,  rent_price_stc: 2000000, rent_duration_days: 30, invest_price_stc: 50000000,  invest_return_rate: 15, invest_duration_days: 30, passive_income_stc: 600000, passive_income_interval_days: 7, weekly_maintenance_stc: 250000, can_buy: 1, can_rent: 1, can_invest: 1, can_sell: 1, sell_value_percent: 85, allows_multiple: 1, description: 'Stunning private villa with pool and landscaped grounds.' },
      // Cars
      { name: 'Hatchback',         category: 'cars',   tier: 'standard', sort_order: 10, price_stc: 250000,    rent_price_stc: 12000,   rent_duration_days: 30, invest_price_stc: 0,         invest_return_rate: 0,  invest_duration_days: 0,  passive_income_stc: 0, passive_income_interval_days: 0, weekly_maintenance_stc: 3000,  can_buy: 1, can_rent: 1, can_invest: 0, can_sell: 1, sell_value_percent: 55, allows_multiple: 0, description: 'A reliable daily driver. Gets you from A to B in style.' },
      { name: 'SUV',               category: 'cars',   tier: 'premium',  sort_order: 11, price_stc: 900000,    rent_price_stc: 40000,   rent_duration_days: 30, invest_price_stc: 0,         invest_return_rate: 0,  invest_duration_days: 0,  passive_income_stc: 0, passive_income_interval_days: 0, weekly_maintenance_stc: 8000,  can_buy: 1, can_rent: 1, can_invest: 0, can_sell: 1, sell_value_percent: 60, allows_multiple: 0, description: 'Premium large SUV with luxury interior and all-terrain capability.' },
      { name: 'Sports Car',        category: 'cars',   tier: 'elite',    sort_order: 12, price_stc: 3500000,   rent_price_stc: 140000,  rent_duration_days: 7,  invest_price_stc: 0,         invest_return_rate: 0,  invest_duration_days: 0,  passive_income_stc: 0, passive_income_interval_days: 0, weekly_maintenance_stc: 25000, can_buy: 1, can_rent: 1, can_invest: 0, can_sell: 1, sell_value_percent: 65, allows_multiple: 0, description: 'Sleek two-door performance machine. Turn heads everywhere.' },
      { name: 'Hypercar',          category: 'cars',   tier: 'legendary',sort_order: 13, price_stc: 15000000,  rent_price_stc: 600000,  rent_duration_days: 3,  invest_price_stc: 0,         invest_return_rate: 0,  invest_duration_days: 0,  passive_income_stc: 0, passive_income_interval_days: 0, weekly_maintenance_stc: 100000,can_buy: 1, can_rent: 1, can_invest: 0, can_sell: 1, sell_value_percent: 70, allows_multiple: 0, description: 'The pinnacle of automotive engineering. Pure performance and prestige.' },
      // Watches
      { name: 'Steel Sport Watch', category: 'watches',tier: 'standard', sort_order: 20, price_stc: 300000,    rent_price_stc: 0,       rent_duration_days: 0,  invest_price_stc: 300000,    invest_return_rate: 5,  invest_duration_days: 60, passive_income_stc: 0, passive_income_interval_days: 0, weekly_maintenance_stc: 0, can_buy: 1, can_rent: 0, can_invest: 1, can_sell: 1, sell_value_percent: 65, allows_multiple: 1, description: 'A precision-engineered sport timepiece. Quality and durability.' },
      { name: 'Luxury Watch',      category: 'watches',tier: 'premium',  sort_order: 21, price_stc: 1500000,   rent_price_stc: 0,       rent_duration_days: 0,  invest_price_stc: 1500000,   invest_return_rate: 8,  invest_duration_days: 60, passive_income_stc: 0, passive_income_interval_days: 0, weekly_maintenance_stc: 0, can_buy: 1, can_rent: 0, can_invest: 1, can_sell: 1, sell_value_percent: 75, allows_multiple: 1, description: 'Hand-crafted Swiss precision timepiece. A statement of status.' },
      { name: 'Diamond Watch',     category: 'watches',tier: 'legendary',sort_order: 22, price_stc: 8000000,   rent_price_stc: 0,       rent_duration_days: 0,  invest_price_stc: 8000000,   invest_return_rate: 12, invest_duration_days: 90, passive_income_stc: 0, passive_income_interval_days: 0, weekly_maintenance_stc: 0, can_buy: 1, can_rent: 0, can_invest: 1, can_sell: 1, sell_value_percent: 80, allows_multiple: 1, description: 'Diamond-encrusted masterpiece. The ultimate collector\'s statement.' },
      // Fashion
      { name: 'Designer Outfit',   category: 'fashion',tier: 'standard', sort_order: 30, price_stc: 150000,    rent_price_stc: 0,       rent_duration_days: 0,  invest_price_stc: 0,         invest_return_rate: 0,  invest_duration_days: 0,  passive_income_stc: 0, passive_income_interval_days: 0, weekly_maintenance_stc: 0, can_buy: 1, can_rent: 0, can_invest: 0, can_sell: 0, sell_value_percent: 0, allows_multiple: 1, description: 'Premium tailored fashion for match days and press conferences.' },
      { name: 'Luxury Collection', category: 'fashion',tier: 'elite',    sort_order: 31, price_stc: 2000000,   rent_price_stc: 0,       rent_duration_days: 0,  invest_price_stc: 0,         invest_return_rate: 0,  invest_duration_days: 0,  passive_income_stc: 0, passive_income_interval_days: 0, weekly_maintenance_stc: 0, can_buy: 1, can_rent: 0, can_invest: 0, can_sell: 0, sell_value_percent: 0, allows_multiple: 1, description: 'Full wardrobe from the most prestigious fashion houses.' },
      { name: 'Exclusive Drops',   category: 'fashion',tier: 'legendary',sort_order: 32, price_stc: 5000000,   rent_price_stc: 0,       rent_duration_days: 0,  invest_price_stc: 0,         invest_return_rate: 0,  invest_duration_days: 0,  passive_income_stc: 0, passive_income_interval_days: 0, weekly_maintenance_stc: 0, can_buy: 1, can_rent: 0, can_invest: 0, can_sell: 0, sell_value_percent: 0, allows_multiple: 1, description: 'Ultra-rare limited edition streetwear. Only for the elite.' },
      // VIP Experiences
      { name: 'VIP Match Day',     category: 'vip_experiences', tier: 'standard', sort_order: 40, price_stc: 500000,  rent_price_stc: 0, rent_duration_days: 0, invest_price_stc: 0, invest_return_rate: 0, invest_duration_days: 0, passive_income_stc: 0, passive_income_interval_days: 0, weekly_maintenance_stc: 0, can_buy: 1, can_rent: 0, can_invest: 0, can_sell: 0, sell_value_percent: 0, allows_multiple: 1, description: 'Executive box seat and VIP hospitality at any STAGE match.' },
      { name: 'Award Show Access', category: 'vip_experiences', tier: 'premium',  sort_order: 41, price_stc: 3000000, rent_price_stc: 0, rent_duration_days: 0, invest_price_stc: 0, invest_return_rate: 0, invest_duration_days: 0, passive_income_stc: 0, passive_income_interval_days: 0, weekly_maintenance_stc: 0, can_buy: 1, can_rent: 0, can_invest: 0, can_sell: 0, sell_value_percent: 0, allows_multiple: 1, description: 'Attend the prestigious STAGE annual awards ceremony.' },
      { name: 'Private Yacht Day', category: 'vip_experiences', tier: 'elite',    sort_order: 42, price_stc: 8000000, rent_price_stc: 0, rent_duration_days: 0, invest_price_stc: 0, invest_return_rate: 0, invest_duration_days: 0, passive_income_stc: 0, passive_income_interval_days: 0, weekly_maintenance_stc: 0, can_buy: 1, can_rent: 0, can_invest: 0, can_sell: 0, sell_value_percent: 0, allows_multiple: 1, description: 'Exclusive private yacht charter for a day on the water.' },
      // Personal Services
      { name: 'Personal Trainer',  category: 'personal_services', tier: 'standard', sort_order: 50, price_stc: 400000,    rent_price_stc: 0, rent_duration_days: 0, invest_price_stc: 0, invest_return_rate: 0, invest_duration_days: 0, passive_income_stc: 0, passive_income_interval_days: 0, weekly_maintenance_stc: 0, can_buy: 1, can_rent: 0, can_invest: 0, can_sell: 0, sell_value_percent: 0, allows_multiple: 0, description: 'Elite personal trainer dedicated to your fitness and performance.' },
      { name: 'Private Chef',      category: 'personal_services', tier: 'premium',  sort_order: 51, price_stc: 1200000,   rent_price_stc: 0, rent_duration_days: 0, invest_price_stc: 0, invest_return_rate: 0, invest_duration_days: 0, passive_income_stc: 0, passive_income_interval_days: 0, weekly_maintenance_stc: 0, can_buy: 1, can_rent: 0, can_invest: 0, can_sell: 0, sell_value_percent: 0, allows_multiple: 0, description: 'Michelin-star-trained private chef preparing all your meals.' },
      { name: 'Media Team',        category: 'personal_services', tier: 'elite',    sort_order: 52, price_stc: 5000000,   rent_price_stc: 0, rent_duration_days: 0, invest_price_stc: 0, invest_return_rate: 0, invest_duration_days: 0, passive_income_stc: 0, passive_income_interval_days: 0, weekly_maintenance_stc: 0, can_buy: 1, can_rent: 0, can_invest: 0, can_sell: 0, sell_value_percent: 0, allows_multiple: 0, description: 'Dedicated media and PR team managing your public image.' },
    ];
    let inserted = 0;
    let updated = 0;
    for (const item of seed) {
      const exists = await EXECUTESQL('SELECT id FROM lifestyle_items WHERE name = ? LIMIT 1', [item.name]);
      if (exists.length) {
        await EXECUTESQL(
          `UPDATE lifestyle_items SET
             category=?, tier=?, sort_order=?, description=?,
             price_stc=?, rent_price_stc=?, rent_duration_days=?,
             invest_price_stc=?, invest_return_rate=?, invest_duration_days=?,
             passive_income_stc=?, passive_income_interval_days=?, weekly_maintenance_stc=?,
             can_buy=?, can_rent=?, can_invest=?, can_sell=?,
             sell_value_percent=?, allows_multiple=?, is_active=1
           WHERE name=?`,
          [item.category, item.tier, item.sort_order, item.description,
           item.price_stc, item.rent_price_stc, item.rent_duration_days,
           item.invest_price_stc, item.invest_return_rate, item.invest_duration_days,
           item.passive_income_stc, item.passive_income_interval_days, item.weekly_maintenance_stc,
           item.can_buy, item.can_rent, item.can_invest, item.can_sell,
           item.sell_value_percent, item.allows_multiple, item.name]
        );
        updated += 1;
        continue;
      }
      await EXECUTESQL(
        `INSERT INTO lifestyle_items
           (id, name, category, description, tier, sort_order,
            price_stc, rent_price_stc, rent_duration_days, invest_price_stc,
            invest_return_rate, invest_duration_days, passive_income_stc,
            passive_income_interval_days, weekly_maintenance_stc,
            can_buy, can_rent, can_invest, can_sell,
            sell_value_percent, allows_multiple, is_active)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,1)`,
        [uuidv4(), item.name, item.category, item.description, item.tier, item.sort_order,
         item.price_stc, item.rent_price_stc, item.rent_duration_days,
         item.invest_price_stc, item.invest_return_rate, item.invest_duration_days,
         item.passive_income_stc, item.passive_income_interval_days, item.weekly_maintenance_stc,
         item.can_buy, item.can_rent, item.can_invest, item.can_sell,
         item.sell_value_percent, item.allows_multiple]
      );
      inserted += 1;
    }
    return { success: true, data: { inserted, updated } };
  },

  // ── Club Finance ──────────────────────────────────────────────────────────
  async clubFinance({ _auth_user_id, action, club_id, page, ...params }) {
    if (!_auth_user_id) throw new Error('not authenticated');

    if (action === 'get_overview') {
      const cid = club_id;
      if (!cid) throw new Error('club_id required');
      const clubs = await EXECUTESQL('SELECT * FROM clubs WHERE id = ? LIMIT 1', [cid]);
      if (!clubs.length) throw new Error('Club not found');
      const club = clubs[0];

      const pageNum = Number(page || 1);
      const limit = 25;
      const offset = (pageNum - 1) * limit;

      const [contracts, transactions, countRows, summaryRows] = await Promise.all([
        EXECUTESQL("SELECT * FROM player_contracts WHERE team_id = ? AND status = 'active' ORDER BY created_date DESC", [cid]),
        EXECUTESQL('SELECT * FROM stc_transactions WHERE club_id = ? ORDER BY created_date DESC LIMIT ? OFFSET ?', [cid, limit, offset]),
        EXECUTESQL('SELECT COUNT(*) as total FROM stc_transactions WHERE club_id = ?', [cid]),
        EXECUTESQL(
          `SELECT
             SUM(CASE WHEN amount > 0 THEN amount ELSE 0 END) as income,
             SUM(CASE WHEN amount < 0 THEN ABS(amount) ELSE 0 END) as expenses
           FROM stc_transactions WHERE club_id = ? AND created_date >= DATE_SUB(NOW(), INTERVAL 30 DAY)`,
          [cid]
        ),
      ]);

      const weeklyWages = contracts.reduce((s, c) => s + Number(c.weekly_salary_stc || 0), 0);
      return {
        success: true,
        data: {
          balance:         Number(club.stc || 0),
          transfer_budget: Number(club.transfer_budget_stc || 0),
          wage_budget:     Number(club.wage_budget_stc || 0),
          weekly_wages:    weeklyWages,
          contracts,
          transactions,
          total_transactions: Number(countRows[0]?.total || 0),
          income_30d:  Number(summaryRows[0]?.income   || 0),
          expenses_30d: Number(summaryRows[0]?.expenses || 0),
        },
      };
    }

    if (action === 'adjust_budgets') {
      const { user } = await getMe(_auth_user_id);
      const targetClubId = params.target_club_id || club_id;
      if (!targetClubId) throw new Error('club_id required');
      const clubs = await EXECUTESQL('SELECT * FROM clubs WHERE id = ? AND owner_email = ? LIMIT 1', [targetClubId, user.email]);
      if (!clubs.length) throw new Error('Club not found or not owner');
      const club = clubs[0];

      const newTransfer = Number(params.transfer_budget);
      const newWage     = Number(params.wage_budget);
      const currentTotal = Number(club.transfer_budget_stc || 0) + Number(club.wage_budget_stc || 0);

      if (Math.abs(newTransfer + newWage - currentTotal) > 100) throw new Error('Budget total must not change');
      if (newTransfer < 0 || newWage < 0) throw new Error('Budgets cannot be negative');

      const weeklyCheck = await EXECUTESQL(
        "SELECT SUM(weekly_salary_stc) as total FROM player_contracts WHERE team_id = ? AND status = 'active'", [targetClubId]
      );
      const committedWages = Number(weeklyCheck[0]?.total || 0);
      if (newWage < committedWages) throw new Error(`Wage budget cannot fall below committed weekly wages (${committedWages.toLocaleString()} STC/wk)`);

      await EXECUTESQL('UPDATE clubs SET transfer_budget_stc = ?, wage_budget_stc = ?, updated_date = NOW() WHERE id = ?',
        [newTransfer, newWage, targetClubId]);

      return { success: true, data: { transfer_budget: newTransfer, wage_budget: newWage } };
    }

    if (action === 'admin_adjust') {
      const adminCheck = await EXECUTESQL('SELECT role_id FROM users WHERE id = ? LIMIT 1', [_auth_user_id]);
      if (!adminCheck.length || Number(adminCheck[0].role_id) !== 0) throw new Error('Admin only');

      const { target_club_id, balance_delta, set_balance, set_transfer_budget, set_wage_budget, note } = params;
      const cid2 = target_club_id || club_id;
      if (!cid2) throw new Error('club_id required');

      const clubs = await EXECUTESQL('SELECT * FROM clubs WHERE id = ? LIMIT 1', [cid2]);
      if (!clubs.length) throw new Error('Club not found');
      const club = clubs[0];

      if (balance_delta != null && Number(balance_delta) !== 0) {
        await createClubTx({ clubId: cid2, amount: Number(balance_delta), type: 'admin_adjustment', category: 'adjustment', description: note || `Admin adjustment: ${Number(balance_delta) >= 0 ? '+' : ''}${Number(balance_delta).toLocaleString()} STC` });
      } else if (set_balance != null) {
        const delta = Number(set_balance) - Number(club.stc || 0);
        if (delta !== 0) {
          await createClubTx({ clubId: cid2, amount: delta, type: 'admin_adjustment', category: 'adjustment', description: note || `Admin set balance: ${Number(set_balance).toLocaleString()} STC` });
        }
      }

      const updates = [];
      const vals = [];
      if (set_transfer_budget != null) { updates.push('transfer_budget_stc = ?'); vals.push(Number(set_transfer_budget)); }
      if (set_wage_budget     != null) { updates.push('wage_budget_stc = ?');     vals.push(Number(set_wage_budget)); }
      if (updates.length) {
        vals.push(cid2);
        await EXECUTESQL(`UPDATE clubs SET ${updates.join(', ')}, updated_date = NOW() WHERE id = ?`, vals);
      }

      return { success: true };
    }

    if (action === 'delete_transaction') {
      const adminCheck = await EXECUTESQL('SELECT role_id FROM users WHERE id = ? LIMIT 1', [_auth_user_id]);
      if (!adminCheck.length || Number(adminCheck[0].role_id) !== 0) throw new Error('Admin only');
      const { transaction_id } = params;
      if (!transaction_id) throw new Error('transaction_id required');
      await EXECUTESQL('DELETE FROM stc_transactions WHERE id = ?', [transaction_id]);
      return { success: true };
    }

    throw new Error(`Unknown clubFinance action: ${action}`);
  },

  // ── Player Market Value ───────────────────────────────────────────────────
  async playerMarketValue({ _auth_user_id, action, player_id, ...params }) {
    if (!_auth_user_id) throw new Error('not authenticated');

    if (action === 'get_breakdown') {
      const pid = player_id;
      if (!pid) throw new Error('player_id required');
      const pRows = await EXECUTESQL('SELECT * FROM players WHERE id = ? LIMIT 1', [pid]);
      if (!pRows.length) throw new Error('Player not found');
      const p = pRows[0];
      const W = await getMvConfig();

      const matches     = Number(p.matches_played  || 0);
      const goals       = Number(p.goals           || 0);
      const assists     = Number(p.assists          || 0);
      const avgRating   = Number(p.avg_match_rating || 0);
      const motm        = Number(p.man_of_the_match || 0);
      const cleanSheets = Number(p.clean_sheets     || 0);
      const wins        = Number(p.wins_count       || 0);
      const stored      = Number(p.market_value_stc || 250_000);

      let formArr = [];
      try { formArr = JSON.parse(p.form_last10 || '[]'); } catch {}
      const recentForm = formArr.slice(-5);
      const recentAvg  = recentForm.length ? recentForm.reduce((s, v) => s + v, 0) / recentForm.length : 0;

      const base      = matches > 0 ? Math.min(matches * W.base_per_match, W.max_base) : 0;
      const ratingMult= matches > 0 && avgRating >= 5
        ? Math.max(0.3, Math.min(2.5, 0.3 + ((avgRating - 4.5) / 5.0) * 2.2)) : 0.3;
      const goalBon   = matches > 0 ? Math.min((goals / matches) * W.goal_rate_bonus, 6_000_000) : 0;
      const asstBon   = matches > 0 ? Math.min((assists / matches) * W.assist_rate_bonus, 3_000_000) : 0;
      const csBon     = matches > 0 ? Math.min((cleanSheets / matches) * W.clean_sheet_rate_bonus, 5_000_000) : 0;
      const achievBon = Math.min(motm * W.motm_bonus, 5_000_000);

      return {
        success: true,
        data: {
          market_value:     stored,
          value_tier:       stored >= 200_000_000 ? 'World Class'
                          : stored >= 50_000_000  ? 'Elite'
                          : stored >= 10_000_000  ? 'Pro'
                          : stored >= 2_000_000   ? 'Rising'
                          : 'Prospect',
          breakdown: {
            experience_base: Math.round(base),
            rating_multiplier: Math.round(ratingMult * 100) / 100,
            goal_rate_bonus:  Math.round(goalBon),
            assist_rate_bonus: Math.round(asstBon),
            clean_sheet_bonus: Math.round(csBon),
            achievement_bonus: Math.round(achievBon),
          },
          stats: {
            matches_played: matches, goals, assists, avg_match_rating: avgRating,
            wins_count: wins, man_of_the_match: motm, clean_sheets: cleanSheets,
            recent_avg: Math.round(recentAvg * 10) / 10,
            form: formArr.slice(-10),
          },
          updated_at: p.value_updated_at,
        },
      };
    }

    if (action === 'recalculate') {
      const pid = player_id || params.target_player_id;
      if (!pid) throw new Error('player_id required');
      const pRows = await EXECUTESQL('SELECT * FROM players WHERE id = ? LIMIT 1', [pid]);
      if (!pRows.length) throw new Error('Player not found');
      const p = pRows[0];
      const W = await getMvConfig();
      const newValue = computeValueFromStats(p, W, Number(p.market_value_stc || 0));
      await EXECUTESQL('UPDATE players SET market_value_stc = ?, value_updated_at = NOW() WHERE id = ?', [newValue, pid]);
      return { success: true, data: { market_value: newValue } };
    }

    if (action === 'recalculate_all') {
      const adminCheck = await EXECUTESQL('SELECT role_id FROM users WHERE id = ? LIMIT 1', [_auth_user_id]);
      if (!adminCheck.length || Number(adminCheck[0].role_id) !== 0) throw new Error('Admin only');
      const allPlayers = await EXECUTESQL('SELECT * FROM players WHERE matches_played > 0', []);
      const W = await getMvConfig();
      let updated = 0;
      for (const p of allPlayers) {
        try {
          const newValue = computeValueFromStats(p, W, Number(p.market_value_stc || 0));
          await EXECUTESQL('UPDATE players SET market_value_stc = ?, value_updated_at = NOW() WHERE id = ?', [newValue, p.id]);
          updated++;
        } catch {}
      }
      return { success: true, data: { updated } };
    }

    if (action === 'get_config') {
      const adminCheck = await EXECUTESQL('SELECT role_id FROM users WHERE id = ? LIMIT 1', [_auth_user_id]);
      if (!adminCheck.length || Number(adminCheck[0].role_id) !== 0) throw new Error('Admin only');
      _mvConfigCache = null; // bust cache
      const rows = await EXECUTESQL("SELECT * FROM market_value_config WHERE is_active = 1 ORDER BY updated_date DESC LIMIT 1", []);
      const cfg  = rows[0] || {};
      let weights = {};
      try { weights = JSON.parse(typeof cfg.weights === 'string' ? cfg.weights : JSON.stringify(cfg.weights || {})); } catch {}
      return { success: true, data: { ...DEFAULT_MV_WEIGHTS, ...weights, _id: cfg.id } };
    }

    if (action === 'set_config') {
      const adminCheck = await EXECUTESQL('SELECT role_id FROM users WHERE id = ? LIMIT 1', [_auth_user_id]);
      if (!adminCheck.length || Number(adminCheck[0].role_id) !== 0) throw new Error('Admin only');
      const newWeights = { ...DEFAULT_MV_WEIGHTS };
      const numericKeys = Object.keys(DEFAULT_MV_WEIGHTS);
      for (const k of numericKeys) {
        if (params[k] !== undefined && !isNaN(Number(params[k]))) newWeights[k] = Number(params[k]);
      }
      _mvConfigCache = null; // bust cache
      const existing = await EXECUTESQL("SELECT id FROM market_value_config WHERE is_active = 1 LIMIT 1", []);
      if (existing.length) {
        await EXECUTESQL("UPDATE market_value_config SET weights = ?, updated_date = NOW() WHERE id = ?",
          [JSON.stringify(newWeights), existing[0].id]);
      } else {
        await EXECUTESQL("INSERT INTO market_value_config (id, name, weights, is_active) VALUES (?, 'default', ?, 1)",
          [uuidv4(), JSON.stringify(newWeights)]);
      }
      return { success: true };
    }

    throw new Error(`Unknown playerMarketValue action: ${action}`);
  },

  async deleteClub({ _auth_user_id, club_id }) {
    if (!_auth_user_id) throw new Error('not authenticated');
    if (!club_id) throw new Error('club_id required');
    const { user } = await getMe(_auth_user_id);
    const clubs = await EXECUTESQL('SELECT id, owner_email FROM clubs WHERE id = ? LIMIT 1', [club_id]);
    if (!clubs.length) throw new Error('Club not found');
    const club = clubs[0];
    if (club.owner_email !== user.email) throw new Error('Only owner can delete this club');
    await EXECUTESQL('UPDATE players SET club_id = NULL WHERE club_id = ?', [club_id]);
    await EXECUTESQL('DELETE FROM clubs WHERE id = ?', [club_id]);
    return { success: true };
  },

  // ── Player Wallet ─────────────────────────────────────────────────────────
  async playerWallet({ action, _auth_user_id, player_id, amount, description, category, page, limit: limitParam }) {
    if (!_auth_user_id) throw new Error('not authenticated');

    if (action === 'get_balance') {
      const { player } = await getMe(_auth_user_id);
      if (!player) throw new Error('Player not found');

      const [contracts, summary, recent] = await Promise.all([
        EXECUTESQL("SELECT * FROM player_contracts WHERE user_id = ? AND status = 'active' LIMIT 1", [_auth_user_id]),
        EXECUTESQL(
          `SELECT type, category, SUM(amount) as total FROM player_stc_transactions
           WHERE player_id = ? AND created_date >= DATE_SUB(NOW(), INTERVAL 30 DAY)
           GROUP BY type, category`,
          [player.id]
        ).catch(() => []),
        EXECUTESQL(
          'SELECT * FROM player_stc_transactions WHERE player_id = ? ORDER BY created_date DESC LIMIT 20',
          [player.id]
        ).catch(() => []),
      ]);

      const activeContract = contracts[0] || null;
      let nextSalaryDays = null;
      if (activeContract?.weekly_salary_stc) {
        const lastPaid = activeContract.last_salary_paid_at || activeContract.start_date || activeContract.created_date;
        if (lastPaid) {
          const daysSince = (Date.now() - new Date(lastPaid).getTime()) / (1000 * 60 * 60 * 24);
          nextSalaryDays = Math.max(0, Math.ceil(7 - daysSince));
        }
      }

      return { data: { balance: Number(player.stc || 0), contract: activeContract, weekly_salary: activeContract?.weekly_salary_stc || 0, next_salary_days: nextSalaryDays, summary, recent_transactions: recent } };
    }

    if (action === 'get_history') {
      const { player } = await getMe(_auth_user_id);
      if (!player) throw new Error('Player not found');
      const pageNum  = Number(page  || 1);
      const pageSize = Number(limitParam || 30);
      const offset   = (pageNum - 1) * pageSize;
      const [rows, countRows] = await Promise.all([
        EXECUTESQL('SELECT * FROM player_stc_transactions WHERE player_id = ? ORDER BY created_date DESC LIMIT ? OFFSET ?', [player.id, pageSize, offset]),
        EXECUTESQL('SELECT COUNT(*) as total FROM player_stc_transactions WHERE player_id = ?', [player.id]),
      ]);
      return { data: { transactions: rows, total: Number(countRows[0]?.total || 0), page: pageNum, limit: pageSize } };
    }

    if (action === 'pay_salary') {
      const { user, player } = await getMe(_auth_user_id);
      if (!player) throw new Error('Player not found');

      const contracts = await EXECUTESQL("SELECT * FROM player_contracts WHERE user_id = ? AND status = 'active' LIMIT 1", [_auth_user_id]);
      if (!contracts.length || !contracts[0].weekly_salary_stc) throw new Error('No active salary contract');
      const contract = contracts[0];
      const salary = Number(contract.weekly_salary_stc);

      const lastPaid = contract.last_salary_paid_at || contract.start_date || contract.created_date;
      if (lastPaid) {
        const daysSince = (Date.now() - new Date(lastPaid).getTime()) / (1000 * 60 * 60 * 24);
        if (daysSince < 7) throw new Error(`Salary already paid. Next payment in ${Math.ceil(7 - daysSince)} day(s).`);
      }

      const clubs = await EXECUTESQL('SELECT name, stc FROM clubs WHERE id = ? LIMIT 1', [contract.team_id]);
      const club = clubs[0];
      if (!club) throw new Error('Club not found');
      const weeksMultiplier = lastPaid ? Math.floor((Date.now() - new Date(lastPaid).getTime()) / (7 * 24 * 60 * 60 * 1000)) : 1;
      const grossAmount = Math.min(salary * weeksMultiplier, Number(club.stc || 0));
      if (grossAmount <= 0) throw new Error('Club has insufficient funds to pay salary');

      await createClubTx({
        clubId: contract.team_id, amount: -grossAmount, type: 'salary_payment', category: 'salary',
        description: `Salary paid: ${player.gamertag || player.full_name || 'Player'}${weeksMultiplier > 1 ? ` (${weeksMultiplier}wk)` : ''}`,
        referenceId: contract.id,
      });
      await EXECUTESQL('UPDATE player_contracts SET last_salary_paid_at = NOW(), updated_date = NOW() WHERE id = ?', [contract.id]);

      const result = await createPlayerTx({
        playerId: player.id, playerEmail: user.email, amount: grossAmount,
        category: 'salary', source: club.name || 'Club',
        description: `Weekly salary${weeksMultiplier > 1 ? ` (${weeksMultiplier} weeks)` : ''} — ${club.name}`,
        referenceId: contract.id,
      });
      return { success: true, data: result };
    }

    if (action === 'admin_adjust') {
      const { user } = await getMe(_auth_user_id);
      const adminCheck = await EXECUTESQL('SELECT role_id FROM users WHERE id = ? LIMIT 1', [_auth_user_id]);
      if (!adminCheck.length || Number(adminCheck[0].role_id) !== 0) throw new Error('Admin access required');
      if (!player_id || amount == null) throw new Error('player_id and amount required');

      const players = await EXECUTESQL('SELECT * FROM players WHERE id = ? LIMIT 1', [player_id]);
      if (!players.length) throw new Error('Player not found');
      const target = players[0];

      const result = await createPlayerTx({
        playerId: player_id, playerEmail: target.email,
        amount: Number(amount),
        category: Number(amount) >= 0 ? 'admin_credit' : 'admin_debit',
        source: 'Admin', description: description || (Number(amount) >= 0 ? 'Admin credit' : 'Admin debit'),
      });
      return { success: true, data: result };
    }

    throw new Error(`Unknown playerWallet action: ${action}`);
  },

  // ── Shirt Sales ───────────────────────────────────────────────────────────
  async shirtSales({ action, _auth_user_id, club_id, period, limit, amount, note, match_id, weights }) {
    // ── get_leaderboard ───────────────────────────────────────────────────
    if (action === 'get_leaderboard') {
      const periodSql = period === '7d'  ? 'AND ss.created_date >= DATE_SUB(NOW(), INTERVAL 7 DAY)'
                      : period === '30d' ? 'AND ss.created_date >= DATE_SUB(NOW(), INTERVAL 30 DAY)'
                      : '';
      const params = [];
      let clubSql = '';
      if (club_id) { clubSql = 'AND ss.club_id = ?'; params.push(club_id); }
      params.push(Number(limit) || 10);

      const rows = await EXECUTESQL(
        `SELECT ss.player_id,
                COALESCE(MAX(p.gamertag), MAX(ss.player_gamertag)) AS gamertag,
                MAX(p.shirt_number) AS shirt_number,
                MAX(p.avatar_url)   AS avatar_url,
                MAX(c.name)         AS club_name,
                MAX(c.logo_url)     AS club_logo_url,
                SUM(ss.quantity)    AS total_shirts,
                SUM(ss.price_stc)   AS total_revenue
         FROM shirt_sales ss
         LEFT JOIN players p ON p.id = ss.player_id
         LEFT JOIN clubs c ON c.id = ss.club_id
         WHERE 1=1 ${periodSql} ${clubSql}
         GROUP BY ss.player_id
         ORDER BY total_shirts DESC
         LIMIT ?`,
        params
      );
      return { data: { leaderboard: rows } };
    }

    // ── get_club_summary ──────────────────────────────────────────────────
    if (action === 'get_club_summary') {
      if (!club_id) throw new Error('club_id required');
      const periodSql = period === '7d'  ? 'AND created_date >= DATE_SUB(NOW(), INTERVAL 7 DAY)'
                      : period === '30d' ? 'AND created_date >= DATE_SUB(NOW(), INTERVAL 30 DAY)'
                      : '';
      const rows = await EXECUTESQL(
        `SELECT COALESCE(SUM(quantity), 0) AS total_shirts,
                COALESCE(SUM(price_stc), 0) AS total_revenue,
                COUNT(DISTINCT match_id) AS matches_with_sales
         FROM shirt_sales WHERE club_id = ? ${periodSql}`,
        [club_id]
      );
      return { data: rows[0] || { total_shirts: 0, total_revenue: 0, matches_with_sales: 0 } };
    }

    // ── generate_for_match (GameDay path) ─────────────────────────────────
    if (action === 'generate_for_match') {
      if (!match_id) throw new Error('match_id required');
      const matches = await EXECUTESQL('SELECT * FROM matches WHERE id = ? LIMIT 1', [match_id]);
      if (!matches.length) throw new Error('Match not found');
      const match = matches[0];
      if (!match.home_club_id) return { success: true, data: { skipped: true } };
      const stats = await EXECUTESQL('SELECT * FROM match_player_stats WHERE match_id = ?', [match_id]);
      if (!stats.length) return { success: true, data: { skipped: true, reason: 'no_stats' } };
      await generateShirtSalesForMatch(match, stats);
      return { success: true };
    }

    // ── get_config ────────────────────────────────────────────────────────
    if (action === 'get_config') {
      const rows = await EXECUTESQL('SELECT id, weights FROM shirt_sales_config WHERE is_active = 1 LIMIT 1');
      const w = rows.length
        ? (typeof rows[0].weights === 'string' ? JSON.parse(rows[0].weights) : rows[0].weights)
        : DEFAULT_SHIRT_WEIGHTS;
      return { data: { id: rows[0]?.id, weights: { ...DEFAULT_SHIRT_WEIGHTS, ...w } } };
    }

    // ── set_config (admin) ────────────────────────────────────────────────
    if (action === 'set_config') {
      const adminCheck = await EXECUTESQL('SELECT role_id FROM users WHERE id = ? LIMIT 1', [_auth_user_id]);
      if (!adminCheck.length || Number(adminCheck[0].role_id) !== 0) throw new Error('Admin access required');
      if (!weights) throw new Error('weights required');
      const existing = await EXECUTESQL('SELECT id FROM shirt_sales_config WHERE is_active = 1 LIMIT 1');
      if (existing.length) {
        await EXECUTESQL('UPDATE shirt_sales_config SET weights = ?, updated_date = NOW() WHERE id = ?',
          [JSON.stringify(weights), existing[0].id]);
      } else {
        await EXECUTESQL("INSERT INTO shirt_sales_config (name, weights, is_active) VALUES ('default', ?, 1)",
          [JSON.stringify(weights)]);
      }
      _shirtConfigCache = null;
      return { success: true };
    }

    // ── correct_revenue (admin) ───────────────────────────────────────────
    if (action === 'correct_revenue') {
      const adminCheck = await EXECUTESQL('SELECT role_id FROM users WHERE id = ? LIMIT 1', [_auth_user_id]);
      if (!adminCheck.length || Number(adminCheck[0].role_id) !== 0) throw new Error('Admin access required');
      if (!club_id || amount == null) throw new Error('club_id and amount required');
      const result = await createClubTx({
        clubId: club_id, amount: Number(amount), type: 'shirt_revenue', category: 'merchandise',
        description: note || 'Admin shirt revenue correction',
      });
      return { success: true, data: result };
    }

    throw new Error(`Unknown shirtSales action: ${action}`);
  },

  // ── Admin Economy Control ─────────────────────────────────────────────────
  async adminEconomyControl(params) {
    const { action, _auth_user_id,
      player_id, player_email, club_id,
      amount, balance, transfer_budget, wage_budget,
      category, description, reason, note,
      date_from, date_to, min_amount, max_amount,
      limit: qLimit, entity_type,
      new_level, dry_run,
      match_id, competition_id,
      purchase_id, purchase_status,
    } = params;

    const adminRows = await EXECUTESQL('SELECT id, email, role_id FROM users WHERE id = ? LIMIT 1', [_auth_user_id]);
    if (!adminRows.length || Number(adminRows[0].role_id) !== 0) throw new Error('Admin access required');
    const adminEmail = adminRows[0].email;
    const LIMIT = Math.min(Number(qLimit) || 50, 500);

    // ── get_player_wallet ──────────────────────────────────────────────────
    if (action === 'get_player_wallet') {
      let players;
      if (player_id) {
        players = await EXECUTESQL('SELECT * FROM players WHERE id = ? LIMIT 1', [player_id]);
      } else if (player_email) {
        players = await EXECUTESQL('SELECT * FROM players WHERE email = ? LIMIT 1', [player_email]);
      } else {
        throw new Error('player_id or player_email required');
      }
      if (!players.length) throw new Error('Player not found');
      const p = players[0];
      const [txs, contract, lifestyle] = await Promise.all([
        EXECUTESQL(
          'SELECT * FROM player_stc_transactions WHERE player_id = ? ORDER BY created_date DESC LIMIT 50',
          [p.id]
        ),
        EXECUTESQL(
          "SELECT * FROM player_contracts WHERE user_id = ? AND status IN ('active','pending') ORDER BY created_date DESC LIMIT 1",
          [p.id]
        ),
        EXECUTESQL(
          "SELECT lp.*, li.name as item_name, li.category FROM lifestyle_purchases lp LEFT JOIN lifestyle_items li ON li.id = lp.item_id WHERE lp.player_id = ? AND lp.status = 'active' ORDER BY lp.created_date DESC LIMIT 20",
          [p.id]
        ),
      ]);
      return { data: { player: p, transactions: txs, contract: contract[0] || null, lifestyle } };
    }

    // ── set_player_balance ─────────────────────────────────────────────────
    if (action === 'set_player_balance') {
      if (!player_id || balance == null) throw new Error('player_id and balance required');
      const rows = await EXECUTESQL('SELECT id, stc, gamertag FROM players WHERE id = ? LIMIT 1', [player_id]);
      if (!rows.length) throw new Error('Player not found');
      const old = Number(rows[0].stc || 0);
      const newBal = Number(balance);
      const diff = newBal - old;
      await EXECUTESQL('UPDATE players SET stc = ?, updated_date = NOW() WHERE id = ?', [newBal, player_id]);
      const txId = uuidv4();
      await EXECUTESQL(
        `INSERT INTO player_stc_transactions (id, player_id, player_email, amount, balance_after, type, category, source, description, created_date)
         VALUES (?, ?, ?, ?, ?, 'admin_correction', 'admin_correction', 'Admin', ?, NOW())`,
        [txId, player_id, player_email || null, diff, newBal, reason || 'Admin balance correction']
      );
      await createAuditLog({ adminUserId: _auth_user_id, adminEmail, action: 'set_player_balance', entityType: 'player', entityId: player_id, entityName: rows[0].gamertag, oldValue: old, newValue: newBal, reason });
      return { success: true, data: { old_balance: old, new_balance: newBal, diff } };
    }

    // ── add_player_tx ──────────────────────────────────────────────────────
    if (action === 'add_player_tx') {
      if (!player_id || amount == null) throw new Error('player_id and amount required');
      const rows = await EXECUTESQL('SELECT id, stc, gamertag FROM players WHERE id = ? LIMIT 1', [player_id]);
      if (!rows.length) throw new Error('Player not found');
      const result = await createPlayerTx({
        playerId: player_id, playerEmail: player_email || null,
        amount: Number(amount), category: category || 'admin_correction',
        source: 'Admin', description: description || reason || 'Admin manual transaction',
      });
      await createAuditLog({ adminUserId: _auth_user_id, adminEmail, action: 'add_player_tx', entityType: 'player', entityId: player_id, entityName: rows[0].gamertag, oldValue: Number(rows[0].stc || 0), newValue: result.new_balance, reason: description || reason });
      return { success: true, data: result };
    }

    // ── get_club_finance ───────────────────────────────────────────────────
    if (action === 'get_club_finance') {
      if (!club_id) throw new Error('club_id required');
      const clubs = await EXECUTESQL('SELECT * FROM clubs WHERE id = ? LIMIT 1', [club_id]);
      if (!clubs.length) throw new Error('Club not found');
      const c = clubs[0];
      const [txs, contracts, wagers] = await Promise.all([
        EXECUTESQL(
          'SELECT * FROM stc_transactions WHERE club_id = ? ORDER BY created_date DESC LIMIT 50',
          [club_id]
        ),
        EXECUTESQL(
          "SELECT pc.*, p.gamertag FROM player_contracts pc LEFT JOIN players p ON p.id = pc.user_id WHERE pc.club_id = ? AND pc.status = 'active' ORDER BY pc.weekly_salary_stc DESC LIMIT 20",
          [club_id]
        ),
        EXECUTESQL(
          "SELECT * FROM matches WHERE (home_club_id = ? OR away_club_id = ?) AND wager_stc > 0 ORDER BY updated_date DESC LIMIT 10",
          [club_id, club_id]
        ),
      ]);
      return { data: { club: c, transactions: txs, contracts, wagers } };
    }

    // ── set_club_finance ───────────────────────────────────────────────────
    if (action === 'set_club_finance') {
      if (!club_id) throw new Error('club_id required');
      const rows = await EXECUTESQL('SELECT id, name, stc, transfer_budget_stc, wage_budget_stc FROM clubs WHERE id = ? LIMIT 1', [club_id]);
      if (!rows.length) throw new Error('Club not found');
      const old = rows[0];
      const sets = [];
      const vals = [];
      const changes = {};
      if (balance != null) { sets.push('stc = ?'); vals.push(Number(balance)); changes.stc = { from: Number(old.stc || 0), to: Number(balance) }; }
      if (transfer_budget != null) { sets.push('transfer_budget_stc = ?'); vals.push(Number(transfer_budget)); changes.transfer_budget = { from: Number(old.transfer_budget_stc || 0), to: Number(transfer_budget) }; }
      if (wage_budget != null) { sets.push('wage_budget_stc = ?'); vals.push(Number(wage_budget)); changes.wage_budget = { from: Number(old.wage_budget_stc || 0), to: Number(wage_budget) }; }
      if (!sets.length) throw new Error('Nothing to update');
      sets.push('updated_date = NOW()');
      await EXECUTESQL(`UPDATE clubs SET ${sets.join(', ')} WHERE id = ?`, [...vals, club_id]);
      if (balance != null) {
        const diff = Number(balance) - Number(old.stc || 0);
        const txId = uuidv4();
        await EXECUTESQL(
          `INSERT INTO stc_transactions (id, club_id, amount, balance_after, type, category, description, created_date)
           VALUES (?, ?, ?, ?, 'admin_correction', 'admin_correction', ?, NOW())`,
          [txId, club_id, diff, Number(balance), reason || 'Admin balance correction']
        );
      }
      await createAuditLog({ adminUserId: _auth_user_id, adminEmail, action: 'set_club_finance', entityType: 'club', entityId: club_id, entityName: old.name, oldValue: JSON.stringify({ stc: old.stc, transfer_budget_stc: old.transfer_budget_stc, wage_budget_stc: old.wage_budget_stc }), newValue: JSON.stringify(changes), reason });
      return { success: true, data: { changes } };
    }

    // ── add_club_tx ────────────────────────────────────────────────────────
    if (action === 'add_club_tx') {
      if (!club_id || amount == null) throw new Error('club_id and amount required');
      const rows = await EXECUTESQL('SELECT id, name, stc FROM clubs WHERE id = ? LIMIT 1', [club_id]);
      if (!rows.length) throw new Error('Club not found');
      const result = await createClubTx({
        clubId: club_id, amount: Number(amount),
        type: 'admin_correction', category: category || 'admin_correction',
        description: description || reason || 'Admin manual transaction',
      });
      await createAuditLog({ adminUserId: _auth_user_id, adminEmail, action: 'add_club_tx', entityType: 'club', entityId: club_id, entityName: rows[0].name, oldValue: Number(rows[0].stc || 0), newValue: result.new_balance, reason: description || reason });
      return { success: true, data: result };
    }

    // ── search_player_txs ──────────────────────────────────────────────────
    if (action === 'search_player_txs') {
      const wheres = ['1=1'];
      const vals = [];
      if (player_id) { wheres.push('t.player_id = ?'); vals.push(player_id); }
      if (player_email) { wheres.push('t.player_email = ?'); vals.push(player_email); }
      if (category) { wheres.push('t.category = ?'); vals.push(category); }
      if (date_from) { wheres.push('t.created_date >= ?'); vals.push(date_from); }
      if (date_to) { wheres.push('t.created_date <= ?'); vals.push(date_to); }
      if (min_amount != null) { wheres.push('t.amount >= ?'); vals.push(Number(min_amount)); }
      if (max_amount != null) { wheres.push('t.amount <= ?'); vals.push(Number(max_amount)); }
      const rows = await EXECUTESQL(
        `SELECT t.*, p.gamertag FROM player_stc_transactions t
         LEFT JOIN players p ON p.id = t.player_id
         WHERE ${wheres.join(' AND ')}
         ORDER BY t.created_date DESC LIMIT ?`,
        [...vals, LIMIT]
      );
      return { data: { transactions: rows, count: rows.length } };
    }

    // ── search_club_txs ────────────────────────────────────────────────────
    if (action === 'search_club_txs') {
      const wheres = ['1=1'];
      const vals = [];
      if (club_id) { wheres.push('t.club_id = ?'); vals.push(club_id); }
      if (category) { wheres.push('t.category = ?'); vals.push(category); }
      if (date_from) { wheres.push('t.created_date >= ?'); vals.push(date_from); }
      if (date_to) { wheres.push('t.created_date <= ?'); vals.push(date_to); }
      if (min_amount != null) { wheres.push('t.amount >= ?'); vals.push(Number(min_amount)); }
      if (max_amount != null) { wheres.push('t.amount <= ?'); vals.push(Number(max_amount)); }
      const rows = await EXECUTESQL(
        `SELECT t.*, c.name as club_name FROM stc_transactions t
         LEFT JOIN clubs c ON c.id = t.club_id
         WHERE ${wheres.join(' AND ')}
         ORDER BY t.created_date DESC LIMIT ?`,
        [...vals, LIMIT]
      );
      return { data: { transactions: rows, count: rows.length } };
    }

    // ── health_check ───────────────────────────────────────────────────────
    if (action === 'health_check') {
      const [
        playersNeg, clubsNeg, playersNull, clubsNull,
        clubsMissingTransfer, clubsMissingWage,
        wagersStuck, contractsBroken,
      ] = await Promise.all([
        EXECUTESQL('SELECT id, gamertag, email, stc FROM players WHERE stc < 0'),
        EXECUTESQL('SELECT id, name, stc FROM clubs WHERE stc < 0'),
        EXECUTESQL('SELECT id, gamertag, email FROM players WHERE stc IS NULL'),
        EXECUTESQL('SELECT id, name FROM clubs WHERE stc IS NULL'),
        EXECUTESQL('SELECT id, name, transfer_budget_stc FROM clubs WHERE transfer_budget_stc IS NULL OR transfer_budget_stc < 0'),
        EXECUTESQL('SELECT id, name, wage_budget_stc FROM clubs WHERE wage_budget_stc IS NULL OR wage_budget_stc < 0'),
        EXECUTESQL(
          "SELECT m.id, m.home_club_name, m.away_club_name, m.wager_stc, m.wager_status FROM matches m WHERE m.wager_status = 'active' AND m.status IN ('completed','forfeit') LIMIT 50"
        ),
        EXECUTESQL(
          "SELECT pc.id, pc.user_id, pc.club_id, pc.weekly_salary_stc FROM player_contracts pc WHERE pc.status = 'active' AND (pc.weekly_salary_stc < 0 OR pc.weekly_salary_stc IS NULL) LIMIT 50"
        ),
      ]);
      return {
        data: {
          players_negative_balance: playersNeg,
          clubs_negative_balance:   clubsNeg,
          players_null_wallet:      playersNull,
          clubs_null_balance:       clubsNull,
          clubs_missing_transfer:   clubsMissingTransfer,
          clubs_missing_wage:       clubsMissingWage,
          wagers_stuck:             wagersStuck,
          contracts_broken:         contractsBroken,
          summary: {
            issues: playersNeg.length + clubsNeg.length + playersNull.length + clubsNull.length + clubsMissingTransfer.length + clubsMissingWage.length + wagersStuck.length + contractsBroken.length,
            checks_run: 8,
          },
        },
      };
    }

    // ── backfill_player_wallets ─────────────────────────────────────────────
    if (action === 'backfill_player_wallets') {
      const nullPlayers = await EXECUTESQL('SELECT id, gamertag, email FROM players WHERE stc IS NULL');
      if (dry_run) return { data: { dry_run: true, would_fix: nullPlayers.length, players: nullPlayers } };
      let fixed = 0;
      for (const p of nullPlayers) {
        const existingGrant = await EXECUTESQL(
          "SELECT id FROM player_stc_transactions WHERE player_id = ? AND category = 'initial_grant' LIMIT 1",
          [p.id]
        );
        await EXECUTESQL('UPDATE players SET stc = 50000, updated_date = NOW() WHERE id = ?', [p.id]);
        if (!existingGrant.length) {
          await EXECUTESQL(
            `INSERT INTO player_stc_transactions (id, player_id, player_email, amount, balance_after, type, category, source, description, created_date)
             VALUES (?, ?, ?, 50000, 50000, 'income', 'initial_grant', 'System', 'Welcome bonus — wallet initialised', NOW())`,
            [uuidv4(), p.id, p.email || null]
          );
        }
        fixed++;
      }
      await createAuditLog({ adminUserId: _auth_user_id, adminEmail, action: 'backfill_player_wallets', entityType: 'system', entityId: null, entityName: 'bulk', oldValue: 'null wallets', newValue: `fixed: ${fixed}`, reason: 'Admin backfill' });
      return { success: true, data: { fixed } };
    }

    // ── backfill_club_finances ──────────────────────────────────────────────
    if (action === 'backfill_club_finances') {
      const nullClubs = await EXECUTESQL('SELECT id, name FROM clubs WHERE stc IS NULL OR transfer_budget_stc IS NULL OR wage_budget_stc IS NULL');
      if (dry_run) return { data: { dry_run: true, would_fix: nullClubs.length, clubs: nullClubs } };
      let fixed = 0;
      for (const c of nullClubs) {
        await EXECUTESQL(
          `UPDATE clubs SET
             stc                 = COALESCE(stc, 5000000),
             transfer_budget_stc = COALESCE(transfer_budget_stc, 0),
             wage_budget_stc     = COALESCE(wage_budget_stc, 0),
             updated_date        = NOW()
           WHERE id = ?`,
          [c.id]
        );
        fixed++;
      }
      await createAuditLog({ adminUserId: _auth_user_id, adminEmail, action: 'backfill_club_finances', entityType: 'system', entityId: null, entityName: 'bulk', oldValue: 'null finances', newValue: `fixed: ${fixed}`, reason: 'Admin backfill' });
      return { success: true, data: { fixed } };
    }

    // ── distribute_competition_reward ───────────────────────────────────────
    if (action === 'distribute_competition_reward') {
      if (!club_id || amount == null) throw new Error('club_id and amount required');
      const rows = await EXECUTESQL('SELECT id, name, stc FROM clubs WHERE id = ? LIMIT 1', [club_id]);
      if (!rows.length) throw new Error('Club not found');
      const result = await createClubTx({
        clubId: club_id, amount: Number(amount),
        type: 'competition_prize', category: 'competition_reward',
        description: description || reason || `Competition reward`,
        referenceId: competition_id || null,
      });
      await createAuditLog({ adminUserId: _auth_user_id, adminEmail, action: 'distribute_competition_reward', entityType: 'club', entityId: club_id, entityName: rows[0].name, oldValue: Number(rows[0].stc || 0), newValue: result.new_balance, reason: description || reason });
      return { success: true, data: result };
    }

    // ── set_lifestyle_status ────────────────────────────────────────────────
    if (action === 'set_lifestyle_status') {
      if (!purchase_id || !purchase_status) throw new Error('purchase_id and purchase_status required');
      const rows = await EXECUTESQL('SELECT lp.id, lp.player_id, li.name FROM lifestyle_purchases lp LEFT JOIN lifestyle_items li ON li.id = lp.item_id WHERE lp.id = ? LIMIT 1', [purchase_id]);
      if (!rows.length) throw new Error('Purchase not found');
      await EXECUTESQL('UPDATE lifestyle_purchases SET status = ?, updated_date = NOW() WHERE id = ?', [purchase_status, purchase_id]);
      await createAuditLog({ adminUserId: _auth_user_id, adminEmail, action: 'set_lifestyle_status', entityType: 'lifestyle_purchase', entityId: purchase_id, entityName: rows[0].name, oldValue: 'unknown', newValue: purchase_status, reason });
      return { success: true };
    }

    // ── get_audit_log ───────────────────────────────────────────────────────
    if (action === 'get_audit_log') {
      const wheres = ['1=1'];
      const vals = [];
      if (entity_type) { wheres.push('entity_type = ?'); vals.push(entity_type); }
      if (player_id) { wheres.push("entity_type = 'player' AND entity_id = ?"); vals.push(player_id); }
      if (club_id) { wheres.push("entity_type = 'club' AND entity_id = ?"); vals.push(club_id); }
      const rows = await EXECUTESQL(
        `SELECT * FROM admin_audit_log WHERE ${wheres.join(' AND ')} ORDER BY created_date DESC LIMIT ?`,
        [...vals, LIMIT]
      );
      return { data: { log: rows, count: rows.length } };
    }

    throw new Error(`Unknown adminEconomyControl action: ${action}`);
  },

  // ── Delete account ────────────────────────────────────────────────────────
  async deleteAccount({ _auth_user_id }) {
    if (!_auth_user_id) throw new Error('not authenticated');
    const rows = await EXECUTESQL('SELECT id, email FROM players WHERE user_id = ?', [_auth_user_id]);
    if (rows.length) {
      const { id: player_id, email } = rows[0];
      if (email) await EXECUTESQL('DELETE FROM auth_tokens WHERE email = ?', [email]);
      await EXECUTESQL('DELETE FROM players WHERE id = ?', [player_id]);
    }
    await EXECUTESQL('DELETE FROM users WHERE id = ?', [_auth_user_id]);
    return { success: true };
  },
};

router.post('/:name', async (req, res) => {
  const { name } = req.params;
  const handler  = HANDLERS[name];
  if (!handler) return res.status(404).json({ error: `Function '${name}' not found` });

  try {
    const params = { ...req.body, _auth_user_id: req.user?.id };
    const result = await handler(params);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
