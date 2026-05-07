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
            await EXECUTESQL('UPDATE clubs SET stc = stc - ?, updated_date = NOW() WHERE id = ?', [wagerEach, m.home_club_id]);
          }
          if (m.away_club_id) {
            const [ac] = await EXECUTESQL('SELECT stc FROM clubs WHERE id = ? LIMIT 1', [m.away_club_id]);
            if (!ac || Number(ac.stc || 0) < wagerEach) throw new Error('Your club has insufficient STC for this wager');
            await EXECUTESQL('UPDATE clubs SET stc = stc - ?, updated_date = NOW() WHERE id = ?', [wagerEach, m.away_club_id]);
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
          if (m.home_club_id) await EXECUTESQL('UPDATE clubs SET stc = stc + ?, updated_date = NOW() WHERE id = ?', [wagerEach, m.home_club_id]);
          if (m.away_club_id) await EXECUTESQL('UPDATE clubs SET stc = stc + ?, updated_date = NOW() WHERE id = ?', [wagerEach, m.away_club_id]);
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

  async buyLifestyleItem({ _auth_user_id, item_id, location_city, location_country, location_emoji, purchase_intent }) {
    if (!_auth_user_id) throw new Error('not authenticated');
    if (!item_id) throw new Error('item_id required');
    const { user, player } = await getMe(_auth_user_id);
    if (!player) throw new Error('Player not found');
    const items = await EXECUTESQL('SELECT * FROM lifestyle_items WHERE id = ? LIMIT 1', [item_id]);
    if (!items.length) throw new Error('Item not found');
    const item = items[0];
    const price = Number(item.price_stc || 0);
    const currentStc = Number(player.stc || 0);
    if (price > currentStc) throw new Error('Insufficient STC');
    const purchaseId = uuidv4();
    await EXECUTESQL(
      `INSERT INTO lifestyle_purchases (
        id, player_id, item_id, item_type, item_tier, rent_active, is_residence, created_date
      ) VALUES (?, ?, ?, ?, ?, 0, ?, NOW())`,
      [purchaseId, player.id, item_id, item.category || item.item_type || null,
       item.tier || item.item_tier || null, item.category === 'real_estate' ? 1 : 0]
    );
    await EXECUTESQL(
      `INSERT INTO user_purchases (id, buyer_email, item_type, item_id, created_date) VALUES (?, ?, ?, ?, NOW())`,
      [uuidv4(), user.email, item.category || item.item_type || null, purchaseId]
    ).catch(() => {});
    const { new_balance: new_stc_balance } = await createPlayerTx({
      playerId: player.id, playerEmail: user.email, amount: -price,
      category: 'lifestyle_purchase', source: item.name || 'Lifestyle',
      description: `Bought: ${item.name || item_id}`, referenceId: purchaseId,
    });
    return { success: true, data: { new_stc_balance, purchase_id: purchaseId } };
  },

  async rentLifestyleItem({ _auth_user_id, item_id }) {
    if (!_auth_user_id) throw new Error('not authenticated');
    if (!item_id) throw new Error('item_id required');
    const { player } = await getMe(_auth_user_id);
    if (!player) throw new Error('Player not found');
    const items = await EXECUTESQL('SELECT * FROM lifestyle_items WHERE id = ? LIMIT 1', [item_id]);
    if (!items.length) throw new Error('Item not found');
    const item = items[0];
    const rent = Number(item.rent_price_stc || 0);
    const currentStc = Number(player.stc || 0);
    if (rent > currentStc) throw new Error('Insufficient STC');
    await EXECUTESQL(
      `INSERT INTO lifestyle_purchases (id, player_id, item_id, item_type, item_tier, rent_active, is_residence, created_date)
       VALUES (?, ?, ?, ?, ?, 1, 0, NOW())`,
      [uuidv4(), player.id, item_id, item.category || item.item_type || null, item.tier || item.item_tier || null]
    );
    const { new_balance: new_stc_balance } = await createPlayerTx({
      playerId: player.id, playerEmail: player.email || null, amount: -rent,
      category: 'lifestyle_rent', source: item.name || 'Lifestyle',
      description: `Rented: ${item.name || item_id}`,
    });
    return { success: true, data: { new_stc_balance } };
  },

  async collectPassiveIncome({ _auth_user_id }) {
    if (!_auth_user_id) throw new Error('not authenticated');
    const { player } = await getMe(_auth_user_id);
    if (!player) throw new Error('Player not found');
    const purchases = await EXECUTESQL('SELECT * FROM lifestyle_purchases WHERE player_id = ?', [player.id]);
    if (!purchases.length) return { success: true, data: { collected: 0 } };
    let collected = 0;
    for (const p of purchases) {
      const items = await EXECUTESQL('SELECT * FROM lifestyle_items WHERE id = ? LIMIT 1', [p.item_id]);
      if (!items.length) continue;
      const inc = Number(items[0].passive_income_stc || 0);
      collected += Math.max(0, inc);
    }
    if (collected > 0) {
      await createPlayerTx({
        playerId: player.id, playerEmail: player.email || null, amount: collected,
        category: 'lifestyle_passive_income', source: 'Investment Portfolio',
        description: `Passive income from ${purchases.length} asset(s)`,
      });
    }
    return { success: true, data: { collected } };
  },

  async upgradeLifestyleAsset({ _auth_user_id, purchase_id, upgrade_id }) {
    if (!_auth_user_id) throw new Error('not authenticated');
    if (!purchase_id) throw new Error('purchase_id required');
    const { player } = await getMe(_auth_user_id);
    const rows = await EXECUTESQL('SELECT * FROM lifestyle_purchases WHERE id = ? AND player_id = ? LIMIT 1', [purchase_id, player.id]);
    if (!rows.length) throw new Error('Purchase not found');
    const p = rows[0];
    const level = Number(p.upgrade_level || 0);
    const cost = Number((p.base_upgrade_cost_stc || 25000) * (level + 1));
    if (Number(player.stc || 0) < cost) throw new Error('Insufficient STC');
    const new_stc_balance = Number(player.stc || 0) - cost;
    const upgrade_level = level + 1;
    const new_value = Number(p.current_value_stc || p.price_paid_stc || 0) + cost;
    await EXECUTESQL('UPDATE players SET stc = ?, updated_date = NOW() WHERE id = ?', [new_stc_balance, player.id]);
    return { success: true, data: { purchase_id, upgrade_id: upgrade_id || null, upgrade_level, cost, new_value, new_stc_balance } };
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
      { name: 'Urban Loft', category: 'real_estate', tier: 'starter', sort_order: 1, price_stc: 120000, rent_price_stc: 12000, passive_income_stc: 3000 },
      { name: 'Sports Coupe', category: 'cars', tier: 'starter', sort_order: 2, price_stc: 90000, rent_price_stc: 9000, passive_income_stc: 0 },
      { name: 'Designer Watch', category: 'fashion', tier: 'starter', sort_order: 3, price_stc: 40000, rent_price_stc: 0, passive_income_stc: 0 },
    ];
    let inserted = 0;
    for (const item of seed) {
      const exists = await EXECUTESQL('SELECT id FROM lifestyle_items WHERE name = ? LIMIT 1', [item.name]);
      if (exists.length) continue;
      await EXECUTESQL(
        `INSERT INTO lifestyle_items (id, name, is_active, sort_order)
         VALUES (?, ?, 1, ?)`,
        [uuidv4(), item.name, item.sort_order]
      );
      inserted += 1;
    }
    return { success: true, data: { inserted } };
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

      await EXECUTESQL('UPDATE clubs SET stc = stc - ?, updated_date = NOW() WHERE id = ?', [grossAmount, contract.team_id]);
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
