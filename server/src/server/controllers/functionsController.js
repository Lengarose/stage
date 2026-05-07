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

function parseSubmission(raw) {
  if (!raw) return null;
  try { return typeof raw === 'string' ? JSON.parse(raw) : raw; } catch { return null; }
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

    if (m.home_club_id) {
      await EXECUTESQL(
        'UPDATE clubs SET wins=wins+?, draws=draws+?, losses=losses+?, goals_scored=goals_scored+?, goals_conceded=goals_conceded+?, updated_date=NOW() WHERE id=?',
        [homeWon ? 1 : 0, isDraw ? 1 : 0, awayWon ? 1 : 0, finalHomeScore, finalAwayScore, m.home_club_id]
      ).catch(() => {});
    }
    if (m.away_club_id) {
      await EXECUTESQL(
        'UPDATE clubs SET wins=wins+?, draws=draws+?, losses=losses+?, goals_scored=goals_scored+?, goals_conceded=goals_conceded+?, updated_date=NOW() WHERE id=?',
        [awayWon ? 1 : 0, isDraw ? 1 : 0, homeWon ? 1 : 0, finalAwayScore, finalHomeScore, m.away_club_id]
      ).catch(() => {});
    }
  }

  // Settle club wager if applicable
  if (m.mode === 'club' && Number(m.wager_stc || 0) > 0 && m.wager_status === 'active') {
    const wagerEach = Number(m.wager_stc);
    const pot       = wagerEach * 2;
    const label     = `${m.home_club_name || 'Home'} vs ${m.away_club_name || 'Away'}`;
    if (isDraw) {
      if (m.home_club_id) await createClubTx({ clubId: m.home_club_id, amount: wagerEach, type: 'wager_refund', category: 'wager_refund', description: `Wager refunded (draw) — ${label}`, referenceId: m.id }).catch(() => {});
      if (m.away_club_id) await createClubTx({ clubId: m.away_club_id, amount: wagerEach, type: 'wager_refund', category: 'wager_refund', description: `Wager refunded (draw) — ${label}`, referenceId: m.id }).catch(() => {});
      await EXECUTESQL("UPDATE matches SET wager_status = 'refunded', updated_date = NOW() WHERE id = ?", [m.id]).catch(() => {});
    } else {
      const winnerClubId = homeWon ? m.home_club_id : m.away_club_id;
      const winnerName   = homeWon ? (m.home_club_name || 'Home') : (m.away_club_name || 'Away');
      const loserName    = homeWon ? (m.away_club_name || 'Away') : (m.home_club_name || 'Home');
      if (winnerClubId) await createClubTx({ clubId: winnerClubId, amount: pot, type: 'wager_win', category: 'wager_win', description: `Wager won vs ${loserName} — +${pot.toLocaleString()} STC`, referenceId: m.id }).catch(() => {});
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
            const [hp] = await EXECUTESQL('SELECT stc FROM players WHERE id = ? LIMIT 1', [m.home_player_id]);
            if (!hp || Number(hp.stc || 0) < wagerEach) throw new Error('Home player has insufficient STC for this wager');
            await EXECUTESQL('UPDATE players SET stc = stc - ?, updated_date = NOW() WHERE id = ?', [wagerEach, m.home_player_id]);
          }
          if (m.away_player_id) {
            const [ap] = await EXECUTESQL('SELECT stc FROM players WHERE id = ? LIMIT 1', [m.away_player_id]);
            if (!ap || Number(ap.stc || 0) < wagerEach) throw new Error('You have insufficient STC for this wager');
            await EXECUTESQL('UPDATE players SET stc = stc - ?, updated_date = NOW() WHERE id = ?', [wagerEach, m.away_player_id]);
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
        if (isClub) {
          if (m.home_club_id) await createClubTx({ clubId: m.home_club_id, amount: wagerEach, type: 'wager_refund', category: 'wager_refund', description: `Wager refunded — match cancelled`, referenceId: m.id });
          if (m.away_club_id) await createClubTx({ clubId: m.away_club_id, amount: wagerEach, type: 'wager_refund', category: 'wager_refund', description: `Wager refunded — match cancelled`, referenceId: m.id });
        } else {
          if (m.home_player_id) await EXECUTESQL('UPDATE players SET stc = stc + ?, updated_date = NOW() WHERE id = ?', [wagerEach, m.home_player_id]);
          if (m.away_player_id) await EXECUTESQL('UPDATE players SET stc = stc + ?, updated_date = NOW() WHERE id = ?', [wagerEach, m.away_player_id]);
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
    // Guard: already settled
    const existing = await EXECUTESQL(
      "SELECT id FROM inbox_messages WHERE related_entity_id = ? AND related_entity_type = 'solo_wager' LIMIT 1",
      [match_id]
    ).catch(() => []);
    if (existing.length) return { success: true, data: { skipped: true } };

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

  async backfillPlayerStc({ _auth_user_id }) {
    if (!_auth_user_id) throw new Error('not authenticated');
    const result = await EXECUTESQL(
      "UPDATE players SET stc = 50000, updated_date = NOW() WHERE stc IS NULL OR stc = 0"
    );
    return { success: true, data: { updated: result.affectedRows || 0 } };
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
