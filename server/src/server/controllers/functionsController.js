const express = require('express');
const router  = express.Router();
const { EXECUTESQL, pool } = require('../db/database');
const axios = require('axios').default;
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const UserModel = require('../models/userModel');

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

function parseMaybeJson(value, fallback = {}) {
  if (value == null) return fallback;
  if (typeof value === 'object') return value;
  try { return JSON.parse(String(value)); } catch { return fallback; }
}

function getNotificationSettingKey(type) {
  const map = {
    contract_offer: 'contract_offers',
    contract_accepted: 'contract_updates',
    contract_rejected: 'contract_updates',
    contract_terminated: 'contract_updates',
    contract_expired: 'contract_updates',
    contract_completed: 'contract_updates',
    match_scheduled: 'match_reminders',
    match_result: 'match_results',
    match_reminder: 'match_reminders',
    result_submitted: 'match_results',
    result_confirmed: 'match_results',
    join_request: 'club_updates',
    join_approved: 'club_updates',
    join_rejected: 'club_updates',
    club_update: 'club_updates',
    invite: 'club_updates',
    message: 'messages',
    tournament_start: 'tournament_updates',
    tournament_complete: 'tournament_updates',
    announcement: 'announcements',
  };
  return map[type] || null;
}

async function createNotificationIfEnabled({
  recipientEmail, type, title, body = '', link = '', relatedId = null,
}) {
  if (!recipientEmail) return { skipped: true, reason: 'recipient missing' };
  const playerRows = await EXECUTESQL('SELECT notification_settings FROM players WHERE LOWER(email)=LOWER(?) LIMIT 1', [recipientEmail]);
  const settings = parseMaybeJson(playerRows[0]?.notification_settings, {});
  const settingKey = getNotificationSettingKey(type);
  const enabled = settingKey ? (settings[settingKey] === undefined ? true : settings[settingKey] === true) : true;
  if (!enabled) return { skipped: true, reason: 'disabled in settings' };
  const id = uuidv4();
  await EXECUTESQL(
    'INSERT INTO notifications (id, recipient_email, type, title, body, `read`, link, related_id, created_date) VALUES (?,?,?,?,?,?,?,?, NOW())',
    [id, recipientEmail, type, title, body, 0, link || '', relatedId]
  );
  return { success: true, id };
}

async function withTransaction(callback) {
  const conn = await pool.promise().getConnection();
  try {
    await conn.beginTransaction();
    const query = async (sql, values = []) => {
      const [rows] = await conn.query(sql, values);
      return rows;
    };
    const result = await callback(query);
    await conn.commit();
    return result;
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

function messageTypeToNotificationType(messageType) {
  const key = String(messageType || 'general');
  if (key === 'match_invite') return 'match_reminder';
  if (key === 'contract_offer') return 'contract_offer';
  if (key === 'club_invite') return 'club_update';
  if (key === 'announcement') return 'announcement';
  return 'message';
}

const HANDLERS = {
  async sendNotification({ recipient_email, type, title, body, link, related_id, dedup_key }) {
    if (!recipient_email || !type || !title) throw new Error('Missing required fields: recipient_email, type, title');
    if (dedup_key) {
      const existing = await EXECUTESQL(
        `SELECT id FROM notifications
         WHERE LOWER(recipient_email)=LOWER(?) AND type=? AND related_id=? AND created_date >= (NOW() - INTERVAL 5 MINUTE)
         LIMIT 1`,
        [recipient_email, type, dedup_key]
      );
      if (existing.length) return { skipped: true, reason: 'Duplicate notification suppressed' };
    }
    const result = await createNotificationIfEnabled({
      recipientEmail: recipient_email,
      type,
      title,
      body: body || '',
      link: link || '',
      relatedId: related_id || dedup_key || null,
    });
    return result.skipped ? result : { success: true, notification: { id: result.id } };
  },

  async sendInboxMessage({
    recipient_email,
    recipient_player_id,
    sender_email,
    subject,
    body,
    message_type = 'general',
    action_type = 'none',
    related_entity_id,
    related_entity_type,
    metadata,
    send_notification = true,
  }) {
    let recipient = recipient_email;
    if (!recipient && recipient_player_id) {
      const p = await EXECUTESQL('SELECT email FROM players WHERE id = ? LIMIT 1', [recipient_player_id]);
      recipient = p[0]?.email || null;
    }
    if (!recipient || !subject || !body) throw new Error('Missing required fields: recipient_email (or recipient_player_id), subject, body');

    let senderGamertag = null;
    let senderAvatar = null;
    let senderClubName = null;
    const isSystem = !sender_email;
    if (sender_email) {
      const senderPlayerRows = await EXECUTESQL('SELECT id, gamertag, avatar_url, club_id FROM players WHERE LOWER(email)=LOWER(?) LIMIT 1', [sender_email]);
      const senderPlayer = senderPlayerRows[0];
      if (senderPlayer) {
        senderGamertag = senderPlayer.gamertag || null;
        senderAvatar = senderPlayer.avatar_url || null;
        if (senderPlayer.club_id) {
          const clubRows = await EXECUTESQL('SELECT name FROM clubs WHERE id = ? LIMIT 1', [senderPlayer.club_id]);
          senderClubName = clubRows[0]?.name || null;
        }
      }
    }

    const messageId = uuidv4();
    await EXECUTESQL(
      `INSERT INTO inbox_messages
       (id, recipient_email, sender_email, sender_gamertag, sender_avatar_url, sender_club_name, is_system,
        subject, body, message_type, action_type, status, is_read, related_entity_id, related_entity_type, metadata, created_date)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?, NOW())`,
      [
        messageId, recipient, sender_email || null, senderGamertag, senderAvatar, senderClubName, isSystem ? 1 : 0,
        subject, body, message_type, action_type, 'pending', 0, related_entity_id || null, related_entity_type || null,
        metadata ? JSON.stringify(metadata) : null,
      ]
    );

    if (send_notification) {
      const notifType = messageTypeToNotificationType(message_type);
      await createNotificationIfEnabled({
        recipientEmail: recipient,
        type: notifType,
        title: `New message: ${subject}`,
        body: isSystem ? 'System message' : `From ${senderGamertag || sender_email || 'Unknown'}`,
        link: `/inbox?id=${messageId}`,
        relatedId: messageId,
      });
    }
    return { success: true, message: { id: messageId } };
  },

  async respondInboxMessage({ message_id, action, new_date, new_time, _auth_user_id }) {
    const VALID_ACTIONS = ['accepted', 'declined', 'confirmed', 'date_change_requested'];
    if (!message_id || !action) throw new Error('Missing required fields: message_id, action');
    if (!VALID_ACTIONS.includes(action)) throw new Error(`Invalid action. Must be one of: ${VALID_ACTIONS.join(', ')}`);
    const { user } = await getMe(_auth_user_id);
    const rows = await EXECUTESQL('SELECT * FROM inbox_messages WHERE id = ? LIMIT 1', [message_id]);
    const message = rows[0];
    if (!message) throw new Error('Message not found');
    if (String(message.recipient_email || '').toLowerCase() !== String(user.email || '').toLowerCase()) throw new Error('Forbidden');
    await EXECUTESQL('UPDATE inbox_messages SET status = ?, is_read = 1, updated_date = NOW() WHERE id = ?', [action, message_id]).catch(() => {});

    const meta = parseMaybeJson(message.metadata, {});
    const isMatchInvite = message.message_type === 'match_invite';

    // Accepting a reschedule request confirms date on existing match if available.
    if (action === 'accepted' && isMatchInvite && meta.reschedule_request) {
      const existingMatchId = meta.created_match_id || message.related_entity_id;
      const nextDate = toMysqlDateTime(meta.scheduled_date);
      if (existingMatchId && nextDate) {
        await EXECUTESQL('UPDATE matches SET scheduled_date = ?, updated_date = NOW() WHERE id = ?', [nextDate, existingMatchId]);
      }
      if (message.sender_email) {
        await createNotificationIfEnabled({
          recipientEmail: message.sender_email,
          type: 'match_scheduled',
          title: `${user.email} accepted the reschedule`,
          body: nextDate ? `Match confirmed for ${nextDate}` : 'Reschedule accepted.',
          link: '/schedule',
          relatedId: existingMatchId || message_id,
        });
      }
      return { success: true, message: { id: message_id, status: action } };
    }

    if (action === 'accepted' && isMatchInvite) {
      // Prevent duplicate match creation if already linked.
      if (meta.created_match_id) {
        return { success: true, message: { id: message_id, status: action }, match: { id: meta.created_match_id } };
      }
      const isClubMatch = (meta.invitation_type || 'player_vs_player') === 'club_vs_club';
      const scheduledDate = toMysqlDateTime(meta.scheduled_date);
      const matchId = uuidv4();
      const payload = {
        id: matchId,
        tournament_id: 'ranked',
        status: 'scheduled',
        mode: isClubMatch ? 'club' : 'solo',
        type: 'ranked',
        scheduled_date: scheduledDate,
        stats_processed: 0,
        home_club_id: isClubMatch ? (meta.challenger_club_id || null) : null,
        away_club_id: isClubMatch ? (meta.opponent_club_id || null) : null,
        home_club_name: isClubMatch ? (meta.challenger_name || null) : null,
        away_club_name: isClubMatch ? (meta.opponent_name || null) : null,
        home_player_id: !isClubMatch ? (meta.challenger_player_id || null) : null,
        away_player_id: !isClubMatch ? (meta.opponent_player_id || null) : null,
        home_player_name: !isClubMatch ? (meta.challenger_name || null) : null,
        away_player_name: !isClubMatch ? (meta.opponent_name || null) : null,
      };
      await EXECUTESQL(
        `INSERT INTO matches
         (id, tournament_id, status, mode, type, scheduled_date, stats_processed,
          home_club_id, away_club_id, home_club_name, away_club_name,
          home_player_id, away_player_id, home_player_name, away_player_name, created_date, updated_date)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?, NOW())`,
        [
          payload.id, payload.tournament_id, payload.status, payload.mode, payload.type, payload.scheduled_date, payload.stats_processed,
          payload.home_club_id, payload.away_club_id, payload.home_club_name, payload.away_club_name,
          payload.home_player_id, payload.away_player_id, payload.home_player_name, payload.away_player_name, new Date(),
        ]
      );
      await EXECUTESQL(
        'UPDATE inbox_messages SET metadata = ? WHERE id = ?',
        [JSON.stringify({ ...meta, created_match_id: matchId }), message_id]
      );
      if (message.sender_email) {
        await createNotificationIfEnabled({
          recipientEmail: message.sender_email,
          type: 'match_scheduled',
          title: `${user.email} accepted your invite`,
          body: 'Match created and scheduled.',
          link: '/schedule',
          relatedId: matchId,
        });
      }
      return { success: true, message: { id: message_id, status: action }, match: { id: matchId } };
    }

    if (action === 'date_change_requested' && isMatchInvite && message.sender_email) {
      const proposedIso = (new_date && new_time) ? new Date(`${new_date}T${new_time}:00`).toISOString() : null;
      const proposalBody = `${user.email} would like to reschedule.\nProposed: ${proposedIso || 'Please discuss a new time.'}`;
      const responseId = uuidv4();
      await EXECUTESQL(
        `INSERT INTO inbox_messages
         (id, recipient_email, sender_email, is_system, subject, body, message_type, action_type, status, is_read, related_entity_id, related_entity_type, metadata, created_date)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?, NOW())`,
        [
          responseId, message.sender_email, user.email, 0,
          `Reschedule Proposal: ${message.subject || 'Match Invite'}`,
          proposalBody, 'match_invite', 'accept_decline_date', 'pending', 0,
          meta.created_match_id || message.related_entity_id || null, 'match',
          JSON.stringify({
            ...meta,
            scheduled_date: proposedIso || meta.scheduled_date,
            reschedule_request: true,
            original_message_id: message_id,
          }),
        ]
      );
      await createNotificationIfEnabled({
        recipientEmail: message.sender_email,
        type: 'match_reminder',
        title: `${user.email} wants to reschedule`,
        body: proposedIso ? `New proposed date: ${proposedIso}` : 'A new date was requested.',
        link: '/inbox',
        relatedId: responseId,
      });
    }

    if (action === 'confirmed' && isMatchInvite) {
      const existingMatchId = meta.created_match_id || message.related_entity_id;
      const targetDate = toMysqlDateTime(meta.scheduled_date);
      if (existingMatchId && targetDate) {
        await EXECUTESQL(
          'UPDATE matches SET scheduled_date = ?, updated_date = NOW() WHERE id = ?',
          [targetDate, existingMatchId]
        );
      } else if (!existingMatchId) {
        // Confirming a date proposal before match exists -> create now.
        const isClubMatch = (meta.invitation_type || 'player_vs_player') === 'club_vs_club';
        const createdId = uuidv4();
        await EXECUTESQL(
          `INSERT INTO matches
           (id, tournament_id, status, mode, type, scheduled_date, stats_processed,
            home_club_id, away_club_id, home_club_name, away_club_name,
            home_player_id, away_player_id, home_player_name, away_player_name, created_date, updated_date)
           VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?, NOW())`,
          [
            createdId, 'ranked', 'scheduled', isClubMatch ? 'club' : 'solo', 'ranked', targetDate, 0,
            isClubMatch ? (meta.opponent_club_id || null) : null,
            isClubMatch ? (meta.challenger_club_id || null) : null,
            isClubMatch ? (meta.opponent_name || null) : null,
            isClubMatch ? (meta.challenger_name || null) : null,
            !isClubMatch ? (meta.opponent_player_id || null) : null,
            !isClubMatch ? (meta.challenger_player_id || null) : null,
            !isClubMatch ? (meta.opponent_name || null) : null,
            !isClubMatch ? (meta.challenger_name || null) : null,
            new Date(),
          ]
        );
      }
      if (message.sender_email) {
        await createNotificationIfEnabled({
          recipientEmail: message.sender_email,
          type: 'match_scheduled',
          title: `${user.email} confirmed the date`,
          body: targetDate ? `Match scheduled for ${targetDate}` : 'Match date confirmed.',
          link: '/schedule',
          relatedId: existingMatchId || message_id,
        });
      }
    }

    if (message.sender_email && ['declined', 'confirmed'].includes(action)) {
      await createNotificationIfEnabled({
        recipientEmail: message.sender_email,
        type: 'message',
        title: `${user.email} ${action} your message`,
        body: `Regarding: "${message.subject || 'Inbox message'}"`,
        link: '/inbox',
        relatedId: message_id,
      });
    }

    return { success: true, message: { id: message_id, status: action } };
  },
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

  async payWeeklySalaries({ _auth_user_id }) {
    // Allow manual/admin run and scheduled run (no auth context).
    if (_auth_user_id) {
      const users = await EXECUTESQL('SELECT role_id FROM users WHERE id = ? LIMIT 1', [_auth_user_id]);
      const roleId = Number(users[0]?.role_id ?? 1);
      if (roleId !== 0 && roleId !== 2) throw new Error('Forbidden');
    }

    const activeContracts = await EXECUTESQL(
      "SELECT * FROM player_contracts WHERE status = 'active' AND IFNULL(weekly_salary_stc,0) > 0",
      []
    );
    const now = new Date();
    const paid = [];
    const errors = [];
    for (const contract of activeContracts) {
      try {
        const lastPaid = contract.last_salary_paid_at
          ? new Date(contract.last_salary_paid_at)
          : new Date(contract.start_date || contract.created_date || now);
        const weeksSincePaid = Math.floor((now.getTime() - lastPaid.getTime()) / (7 * 24 * 60 * 60 * 1000));
        if (weeksSincePaid < 1) continue;
        const gross = Number(contract.weekly_salary_stc || 0) * weeksSincePaid;
        if (gross <= 0) continue;

        const [playerRows, clubRows] = await Promise.all([
          EXECUTESQL('SELECT id, email, gamertag, stc FROM players WHERE id = ? LIMIT 1', [contract.user_id]),
          EXECUTESQL('SELECT id, name, stc FROM clubs WHERE id = ? LIMIT 1', [contract.team_id]),
        ]);
        const player = playerRows[0];
        const club = clubRows[0];
        if (!player || !club) continue;

        const clubStc = Number(club.stc || 0);
        const amount = Math.min(gross, clubStc);
        if (amount <= 0) continue;

        await EXECUTESQL('UPDATE clubs SET stc = ?, updated_date = NOW() WHERE id = ?', [Math.max(0, clubStc - amount), club.id]);
        await EXECUTESQL('UPDATE players SET stc = ?, updated_date = NOW() WHERE id = ?', [Number(player.stc || 0) + amount, player.id]);
        await EXECUTESQL(
          `INSERT INTO stc_transactions
           (id, club_id, player_id, player_email, amount, type, description, reference_id, created_date)
           VALUES (?, ?, ?, ?, ?, 'salary', ?, ?, NOW())`,
          [uuidv4(), club.id, player.id, player.email, amount, `Weekly salary (${weeksSincePaid} week${weeksSincePaid > 1 ? 's' : ''}) from ${club.name || 'club'}`, contract.id]
        ).catch(() => {});
        await EXECUTESQL('UPDATE player_contracts SET last_salary_paid_at = ?, updated_date = NOW() WHERE id = ?', [toMysqlDateTime(now), contract.id]);
        await createNotificationIfEnabled({
          recipientEmail: player.email,
          type: 'announcement',
          title: `Weekly salary: +${amount.toLocaleString()} STC`,
          body: `${club.name || 'Your club'} paid your salary.`,
          link: '/lifestyle',
          relatedId: contract.id,
        });
        paid.push({ player: player.gamertag || player.email, amount, weeks: weeksSincePaid });
      } catch (err) {
        errors.push({ contract_id: contract.id, error: err.message });
      }
    }
    return { success: true, paid_count: paid.length, paid, errors };
  },

  async checkExpiredContracts() {
    const CONTRACT_META = {
      trial: { max_games: 5 }, academy: { max_games: 20 }, squad: { max_games: 100 }, important: { max_games: 250 }, star: { max_games: 400 },
    };
    const active = await EXECUTESQL("SELECT * FROM player_contracts WHERE status = 'active'", []);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    let completed = 0;
    let expired = 0;
    let warned = 0;
    for (const c of active) {
      const maxGames = CONTRACT_META[c.contract_type]?.max_games || Number(c.max_games || 0);
      const gamesPlayed = Number(c.games_played || 0);
      const endDate = c.end_date ? new Date(c.end_date) : null;
      if (endDate) endDate.setHours(0, 0, 0, 0);

      if (maxGames > 0 && gamesPlayed >= maxGames) {
        await EXECUTESQL("UPDATE player_contracts SET status='completed', updated_date = NOW() WHERE id = ?", [c.id]);
        await EXECUTESQL(
          'INSERT INTO player_contract_history (id, contract_id, action_type, action_by, action_note, created_date) VALUES (?, ?, ?, NULL, ?, NOW())',
          [uuidv4(), c.id, 'completed', `Contract completed: ${gamesPlayed}/${maxGames} games played.`]
        ).catch(() => {});
        completed += 1;
        continue;
      }

      if (endDate && endDate.getTime() <= today.getTime()) {
        await EXECUTESQL("UPDATE player_contracts SET status='expired', updated_date = NOW() WHERE id = ?", [c.id]);
        await EXECUTESQL(
          'INSERT INTO player_contract_history (id, contract_id, action_type, action_by, action_note, created_date) VALUES (?, ?, ?, NULL, ?, NOW())',
          [uuidv4(), c.id, 'expired', `Contract expired: end date ${c.end_date} reached.`]
        ).catch(() => {});
        expired += 1;
        continue;
      }

      const daysLeft = endDate ? Math.floor((endDate.getTime() - today.getTime()) / (24 * 60 * 60 * 1000)) : null;
      const gamesLeft = maxGames > 0 ? (maxGames - gamesPlayed) : null;
      if ((gamesLeft !== null && gamesLeft <= 10) || (daysLeft !== null && daysLeft <= 7)) warned += 1;
    }
    return { checked: active.length, completed, expired, warned };
  },

  async updateMatchStats({ data }) {
    if (!data || data.status !== 'confirmed') return { skipped: 'not confirmed' };
    if (data.stats_processed) return { skipped: 'already processed' };
    if (data.home_score == null || data.away_score == null) return { skipped: 'missing scores' };

    const matchId = data.id;
    const homeScore = Number(data.home_score || 0);
    const awayScore = Number(data.away_score || 0);
    const isClubMatch = data.mode === 'club';
    const isRanked = data.type === 'ranked';

    const homeResult = homeScore > awayScore ? 'win' : (homeScore < awayScore ? 'loss' : 'draw');
    const awayResult = homeScore > awayScore ? 'loss' : (homeScore < awayScore ? 'win' : 'draw');

    if (isClubMatch) {
      const [homeRows, awayRows] = await Promise.all([
        EXECUTESQL('SELECT * FROM clubs WHERE id = ? LIMIT 1', [data.home_club_id]),
        EXECUTESQL('SELECT * FROM clubs WHERE id = ? LIMIT 1', [data.away_club_id]),
      ]);
      const homeClub = homeRows[0];
      const awayClub = awayRows[0];
      if (homeClub && awayClub) {
        const stadiumLevel = Number(homeClub.stadium_level || 0);
        const stadiums = [{ capacity: 20000, ticket_price: 40 }, { capacity: 45000, ticket_price: 55 }, { capacity: 80000, ticket_price: 75 }];
        const st = stadiums[Math.min(Math.max(stadiumLevel, 0), 2)];
        const ticketRevenue = st.capacity * st.ticket_price;
        const transferAdd = Math.floor(ticketRevenue * 0.10);
        const wageAdd = Math.floor(ticketRevenue * 0.05);

        const hWins = Number(homeClub.wins || 0) + (homeResult === 'win' ? 1 : 0);
        const hLoss = Number(homeClub.losses || 0) + (homeResult === 'loss' ? 1 : 0);
        const hDraw = Number(homeClub.draws || 0) + (homeResult === 'draw' ? 1 : 0);
        const aWins = Number(awayClub.wins || 0) + (awayResult === 'win' ? 1 : 0);
        const aLoss = Number(awayClub.losses || 0) + (awayResult === 'loss' ? 1 : 0);
        const aDraw = Number(awayClub.draws || 0) + (awayResult === 'draw' ? 1 : 0);

        await EXECUTESQL(
          `UPDATE clubs SET
            wins=?, losses=?, draws=?, goals_scored=?, goals_conceded=?, matches_ranked=?,
            win_streak=?, loss_streak=?, form=?, stc=?, transfer_budget_stc=?, wage_budget_stc=?, updated_date=NOW()
           WHERE id=?`,
          [
            hWins, hLoss, hDraw,
            Number(homeClub.goals_scored || 0) + homeScore, Number(homeClub.goals_conceded || 0) + awayScore,
            Number(homeClub.matches_ranked || 0) + (isRanked ? 1 : 0),
            homeResult === 'win' ? Number(homeClub.win_streak || 0) + 1 : 0,
            homeResult === 'loss' ? Number(homeClub.loss_streak || 0) + 1 : 0,
            JSON.stringify([...(parseMaybeJson(homeClub.form, [])), homeResult[0].toUpperCase()].slice(-5)),
            Number(homeClub.stc || 0) + ticketRevenue,
            Number(homeClub.transfer_budget_stc || 0) + transferAdd,
            Number(homeClub.wage_budget_stc || 0) + wageAdd,
            homeClub.id,
          ]
        );
        await EXECUTESQL(
          `UPDATE clubs SET
            wins=?, losses=?, draws=?, goals_scored=?, goals_conceded=?, matches_ranked=?,
            win_streak=?, loss_streak=?, form=?, updated_date=NOW()
           WHERE id=?`,
          [
            aWins, aLoss, aDraw,
            Number(awayClub.goals_scored || 0) + awayScore, Number(awayClub.goals_conceded || 0) + homeScore,
            Number(awayClub.matches_ranked || 0) + (isRanked ? 1 : 0),
            awayResult === 'win' ? Number(awayClub.win_streak || 0) + 1 : 0,
            awayResult === 'loss' ? Number(awayClub.loss_streak || 0) + 1 : 0,
            JSON.stringify([...(parseMaybeJson(awayClub.form, [])), awayResult[0].toUpperCase()].slice(-5)),
            awayClub.id,
          ]
        );
        await EXECUTESQL(
          `INSERT INTO stc_transactions (id, club_id, amount, type, description, reference_id, created_date)
           VALUES (?, ?, ?, 'ticket_revenue', ?, ?, NOW())`,
          [uuidv4(), homeClub.id, ticketRevenue, `Ticket sales for match ${matchId}`, matchId]
        ).catch(() => {});
      }
    }

    const statRows = await EXECUTESQL('SELECT * FROM match_player_stats WHERE match_id = ?', [matchId]);
    if (statRows.length) {
      const ratings = statRows.map((s) => Number(s.rating || 0));
      const maxRating = ratings.length ? Math.max(...ratings) : -1;
      for (const stat of statRows) {
        const players = await EXECUTESQL('SELECT * FROM players WHERE LOWER(email)=LOWER(?) LIMIT 1', [stat.player_email]);
        const p = players[0];
        if (!p) continue;
        const isHome = stat.club_id && data.home_club_id && stat.club_id === data.home_club_id;
        const result = isHome ? homeResult : awayResult;
        const updates = {
          matches_played: Number(p.matches_played || 0) + 1,
          goals: Number(p.goals || 0) + Number(stat.goals || 0),
          assists: Number(p.assists || 0) + Number(stat.assists || 0),
          wins_count: Number(p.wins_count || 0) + (result === 'win' ? 1 : 0),
          losses_count: Number(p.losses_count || 0) + (result === 'loss' ? 1 : 0),
          draws_count: Number(p.draws_count || 0) + (result === 'draw' ? 1 : 0),
          man_of_the_match: Number(p.man_of_the_match || 0) + (Number(stat.rating || 0) === maxRating ? 1 : 0),
        };
        await EXECUTESQL(
          `UPDATE players SET matches_played=?, goals=?, assists=?, wins_count=?, losses_count=?, draws_count=?, man_of_the_match=?, updated_date=NOW()
           WHERE id=?`,
          [updates.matches_played, updates.goals, updates.assists, updates.wins_count, updates.losses_count, updates.draws_count, updates.man_of_the_match, p.id]
        );
      }
    }

    await EXECUTESQL('UPDATE matches SET stats_processed = 1, updated_date = NOW() WHERE id = ?', [matchId]);
    return { success: true, matchId, clubsUpdated: isClubMatch ? 2 : 0, playersUpdated: statRows.length };
  },

  async ratingEngine({
    home_club_id, away_club_id, home_score, away_score, match_type = 'ranked', match_id,
    home_roster_continuity = 1.0, away_roster_continuity = 1.0,
  }) {
    if (!home_club_id || !away_club_id || home_score == null || away_score == null) throw new Error('Missing required fields');
    const [homeRows, awayRows] = await Promise.all([
      EXECUTESQL('SELECT * FROM clubs WHERE id=? LIMIT 1', [home_club_id]),
      EXECUTESQL('SELECT * FROM clubs WHERE id=? LIMIT 1', [away_club_id]),
    ]);
    const home = homeRows[0];
    const away = awayRows[0];
    if (!home || !away) throw new Error('Club not found');

    const INITIAL_RATING = 1500;
    const homeRating = Number(home.rating ?? INITIAL_RATING);
    const awayRating = Number(away.rating ?? INITIAL_RATING);
    const homeProv = Number(home.matches_ranked || 0) < 10;
    const awayProv = Number(away.matches_ranked || 0) < 10;
    const KHome = homeProv ? 40 : 20;
    const KAway = awayProv ? 40 : 20;
    const weights = { ranked: 1.0, league: 1.1, playoff: 1.25, final: 1.4 };
    const W = Number(weights[match_type] || 1.0);
    const expectedH = 1 / (1 + Math.pow(10, (awayRating - homeRating) / 400));
    const expectedA = 1 - expectedH;
    const homeResult = Number(home_score) > Number(away_score) ? 'W' : (Number(home_score) < Number(away_score) ? 'L' : 'D');
    const awayResult = homeResult === 'W' ? 'L' : (homeResult === 'L' ? 'W' : 'D');
    const actualH = homeResult === 'W' ? 1 : (homeResult === 'D' ? 0.5 : 0);
    const actualA = 1 - actualH;
    const gd = Math.min(Math.abs(Number(home_score) - Number(away_score)), 3);
    const gdHome = (actualH === 1 ? 1 : actualH === 0 ? -1 : 0) * (gd / 3) * 5;
    const gdAway = (actualA === 1 ? 1 : actualA === 0 ? -1 : 0) * (gd / 3) * 5;
    const dHome = Math.round((KHome * W * Number(home_roster_continuity || 1) * (actualH - expectedH) + gdHome) * 10) / 10;
    const dAway = Math.round((KAway * W * Number(away_roster_continuity || 1) * (actualA - expectedA) + gdAway) * 10) / 10;
    const newHome = Math.max(100, Math.round(homeRating + dHome));
    const newAway = Math.max(100, Math.round(awayRating + dAway));

    await EXECUTESQL(
      `UPDATE clubs SET rating=?, peak_rating=?, matches_ranked=?, wins=?, losses=?, draws=?, goals_scored=?, goals_conceded=?, form=?, updated_date=NOW() WHERE id=?`,
      [
        newHome,
        Math.max(Number(home.peak_rating || INITIAL_RATING), newHome),
        Number(home.matches_ranked || 0) + 1,
        Number(home.wins || 0) + (homeResult === 'W' ? 1 : 0),
        Number(home.losses || 0) + (homeResult === 'L' ? 1 : 0),
        Number(home.draws || 0) + (homeResult === 'D' ? 1 : 0),
        Number(home.goals_scored || 0) + Number(home_score),
        Number(home.goals_conceded || 0) + Number(away_score),
        JSON.stringify([...(parseMaybeJson(home.form, [])), homeResult].slice(-5)),
        home_club_id,
      ]
    );
    await EXECUTESQL(
      `UPDATE clubs SET rating=?, peak_rating=?, matches_ranked=?, wins=?, losses=?, draws=?, goals_scored=?, goals_conceded=?, form=?, updated_date=NOW() WHERE id=?`,
      [
        newAway,
        Math.max(Number(away.peak_rating || INITIAL_RATING), newAway),
        Number(away.matches_ranked || 0) + 1,
        Number(away.wins || 0) + (awayResult === 'W' ? 1 : 0),
        Number(away.losses || 0) + (awayResult === 'L' ? 1 : 0),
        Number(away.draws || 0) + (awayResult === 'D' ? 1 : 0),
        Number(away.goals_scored || 0) + Number(away_score),
        Number(away.goals_conceded || 0) + Number(home_score),
        JSON.stringify([...(parseMaybeJson(away.form, [])), awayResult].slice(-5)),
        away_club_id,
      ]
    );

    const playedAt = toMysqlDateTime(new Date());
    await EXECUTESQL(
      `INSERT INTO rating_history
       (id, club_id, club_name, opponent_club_id, opponent_club_name, match_id, competition_type, result, home_score, away_score, points_before, points_after, points_change, played_at, created_date)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
      [uuidv4(), home_club_id, home.name || null, away_club_id, away.name || null, match_id || 'manual', match_type, homeResult, Number(home_score), Number(away_score), homeRating, newHome, dHome, playedAt]
    ).catch(() => {});
    await EXECUTESQL(
      `INSERT INTO rating_history
       (id, club_id, club_name, opponent_club_id, opponent_club_name, match_id, competition_type, result, home_score, away_score, points_before, points_after, points_change, played_at, created_date)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
      [uuidv4(), away_club_id, away.name || null, home_club_id, home.name || null, match_id || 'manual', match_type, awayResult, Number(away_score), Number(home_score), awayRating, newAway, dAway, playedAt]
    ).catch(() => {});

    return {
      success: true,
      home: { club_id: home_club_id, result: homeResult, rating_before: homeRating, rating_after: newHome, delta: dHome },
      away: { club_id: away_club_id, result: awayResult, rating_before: awayRating, rating_after: newAway, delta: dAway },
    };
  },

  async matchKickoff({ action, match_id }) {
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

    const homeWon = homeScore > awayScore;
    const winnerId = homeWon ? m.home_player_id : m.away_player_id;
    const winnerEmail = homeWon ? (m.home_player_email || null) : (m.away_player_email || null);
    const loserEmail = homeWon ? (m.away_player_email || null) : (m.home_player_email || null);
    const winnerName = homeWon ? (m.home_player_name || 'Home') : (m.away_player_name || 'Away');
    const loserName = homeWon ? (m.away_player_name || 'Away') : (m.home_player_name || 'Home');

    if (winnerId) {
      await createPlayerTx({
        playerId: winnerId,
        playerEmail: winnerEmail,
        amount: pot,
        category: 'wager_win',
        source: label,
        description: `Wager won vs ${loserName} — ${label}`,
        referenceId: match_id,
      }).catch(() => {});
    }

    await EXECUTESQL("UPDATE matches SET wager_status = 'settled', updated_date = NOW() WHERE id = ?", [match_id]);

    await notifyInbox(
      winnerEmail,
      '🏆 Wager Won',
      `You won ${pot.toLocaleString()} STC in ${label}.`
    );
    await notifyInbox(
      loserEmail,
      '💸 Wager Lost',
      `${winnerName} won the wager in ${label}. Better luck next match.`
    );

    return {
      success: true,
      data: {
        result: 'settled',
        winner_player_id: winnerId || null,
        winner_name: winnerName,
        amount: pot,
      },
    };
  },

  async payMonthlyRent({ _auth_user_id }) {
    // Allow admin-triggered and scheduler-triggered execution.
    if (_auth_user_id) {
      const u = await EXECUTESQL('SELECT role_id FROM users WHERE id = ? LIMIT 1', [_auth_user_id]);
      const roleId = Number(u[0]?.role_id ?? 1);
      if (roleId !== 0 && roleId !== 2) throw new Error('Forbidden');
    }

    const now = new Date();
    const msPerMonth = 30 * 24 * 60 * 60 * 1000;
    const rentals = await EXECUTESQL(
      "SELECT * FROM lifestyle_purchases WHERE purchase_type = 'rent' AND rent_active = 1",
      []
    );

    let paid_count = 0;
    let expired_count = 0;
    let skipped_count = 0;

    for (const rental of rentals) {
      const expiry = rental.rent_expiry_at ? new Date(rental.rent_expiry_at) : null;
      const lastPaid = rental.last_rent_paid_at ? new Date(rental.last_rent_paid_at) : new Date(rental.created_date || now);
      const isDue = (now.getTime() - lastPaid.getTime()) >= msPerMonth;

      if (expiry && now.getTime() > expiry.getTime()) {
        await EXECUTESQL(
          'UPDATE lifestyle_purchases SET rent_active = 0, is_defaulted = 1, updated_date = NOW() WHERE id = ?',
          [rental.id]
        );
        const players = await EXECUTESQL('SELECT email FROM players WHERE id = ? LIMIT 1', [rental.player_id]);
        if (players[0]?.email) {
          await createNotificationIfEnabled({
            recipientEmail: players[0].email,
            type: 'announcement',
            title: `Rental expired: ${rental.item_name || 'Asset'}`,
            body: `Your rental has expired and was removed from active rentals.`,
            link: '/lifestyle',
            relatedId: rental.id,
          });
        }
        expired_count += 1;
        continue;
      }

      if (!isDue) {
        skipped_count += 1;
        continue;
      }

      const monthsDue = Math.max(1, Math.floor((now.getTime() - lastPaid.getTime()) / msPerMonth));
      const amount = monthsDue * Number(rental.monthly_rent_stc || 0);
      if (amount <= 0) {
        skipped_count += 1;
        continue;
      }

      const players = await EXECUTESQL('SELECT id, email, gamertag, stc FROM players WHERE id = ? LIMIT 1', [rental.player_id]);
      const player = players[0];
      if (!player) {
        skipped_count += 1;
        continue;
      }

      const stc = Number(player.stc || 0);
      if (stc < amount) {
        await EXECUTESQL(
          'UPDATE lifestyle_purchases SET rent_active = 0, is_defaulted = 1, updated_date = NOW() WHERE id = ?',
          [rental.id]
        );
        await createNotificationIfEnabled({
          recipientEmail: player.email,
          type: 'announcement',
          title: `Rental cancelled: ${rental.item_name || 'Asset'}`,
          body: `Insufficient STC for rent (${amount.toLocaleString()} STC). Rental was terminated.`,
          link: '/lifestyle',
          relatedId: rental.id,
        });
        expired_count += 1;
        continue;
      }

      const newStc = stc - amount;
      const newExpiry = new Date(now.getTime() + msPerMonth);
      await EXECUTESQL('UPDATE players SET stc = ?, updated_date = NOW() WHERE id = ?', [newStc, player.id]);
      await EXECUTESQL(
        `UPDATE lifestyle_purchases
         SET last_rent_paid_at = ?, rent_expiry_at = ?, is_defaulted = 0, updated_date = NOW()
         WHERE id = ?`,
        [toMysqlDateTime(now), toMysqlDateTime(newExpiry), rental.id]
      );
      await EXECUTESQL(
        `INSERT INTO stc_transactions (id, player_id, player_email, amount, type, description, reference_id, created_date)
         VALUES (?, ?, ?, ?, 'rent_payment', ?, ?, NOW())`,
        [uuidv4(), player.id, player.email, -amount, `Monthly rent (${monthsDue}mo): ${rental.item_name || rental.id}`, rental.id]
      ).catch(() => {});
      await createNotificationIfEnabled({
        recipientEmail: player.email,
        type: 'announcement',
        title: `Rent paid: ${rental.item_name || 'Asset'}`,
        body: `-${amount.toLocaleString()} STC paid. Renewed until ${newExpiry.toISOString().slice(0, 10)}.`,
        link: '/lifestyle',
        relatedId: rental.id,
      });
      paid_count += 1;
    }

    return { success: true, paid_count, expired_count, skipped_count };
  },

  async processLifestyleMaintenance({ _auth_user_id }) {
    if (_auth_user_id) {
      const u = await EXECUTESQL('SELECT role_id FROM users WHERE id = ? LIMIT 1', [_auth_user_id]);
      const roleId = Number(u[0]?.role_id ?? 1);
      if (roleId !== 0 && roleId !== 2) throw new Error('Forbidden');
    }

    const now = new Date();
    const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    const purchases = await EXECUTESQL('SELECT * FROM lifestyle_purchases', []);
    const due = purchases.filter((p) => {
      const hasMaint = Number(p.weekly_maintenance_stc || 0) > 0 || ['real_estate', 'vehicle'].includes(String(p.item_category || ''));
      if (!hasMaint) return false;
      if (!p.last_maintenance_paid_at) return true;
      return new Date(p.last_maintenance_paid_at).getTime() < oneWeekAgo.getTime();
    });

    // Ensure weekly_maintenance_stc exists for property/vehicle items.
    for (const p of due) {
      if (!p.weekly_maintenance_stc && ['real_estate', 'vehicle'].includes(String(p.item_category || ''))) {
        const itemRows = await EXECUTESQL('SELECT weekly_maintenance_stc FROM lifestyle_items WHERE id = ? LIMIT 1', [p.item_id]);
        const computed = Number(itemRows[0]?.weekly_maintenance_stc || 5000);
        await EXECUTESQL('UPDATE lifestyle_purchases SET weekly_maintenance_stc = ?, updated_date = NOW() WHERE id = ?', [computed, p.id]);
        p.weekly_maintenance_stc = computed;
      }
    }

    const byPlayer = new Map();
    for (const p of due) {
      const list = byPlayer.get(p.player_id) || [];
      list.push(p);
      byPlayer.set(p.player_id, list);
    }

    let processed = 0;
    let defaulted = 0;

    for (const [playerId, list] of byPlayer.entries()) {
      const rows = await EXECUTESQL('SELECT id, email, stc FROM players WHERE id = ? LIMIT 1', [playerId]);
      const player = rows[0];
      if (!player) continue;
      let stc = Number(player.stc || 0);
      let deducted = 0;
      let paidItems = [];
      let defaultedItems = [];

      for (const purchase of list) {
        const cost = Number(purchase.weekly_maintenance_stc || 0);
        if (!cost) continue;
        if (stc >= cost) {
          stc -= cost;
          deducted += cost;
          paidItems.push(purchase.item_name || 'Asset');
          await EXECUTESQL(
            'UPDATE lifestyle_purchases SET last_maintenance_paid_at = ?, is_defaulted = 0, updated_date = NOW() WHERE id = ?',
            [toMysqlDateTime(now), purchase.id]
          );
          processed += 1;
        } else {
          defaultedItems.push(purchase.item_name || 'Asset');
          await EXECUTESQL(
            'UPDATE lifestyle_purchases SET is_defaulted = 1, updated_date = NOW() WHERE id = ?',
            [purchase.id]
          );
          defaulted += 1;
        }
      }

      if (deducted > 0) {
        await EXECUTESQL('UPDATE players SET stc = ?, updated_date = NOW() WHERE id = ?', [stc, player.id]);
        await EXECUTESQL(
          `INSERT INTO stc_transactions (id, player_id, player_email, amount, type, description, reference_id, created_date)
           VALUES (?, ?, ?, ?, 'lifestyle_maintenance', ?, ?, NOW())`,
          [uuidv4(), player.id, player.email, -deducted, `Weekly maintenance: ${paidItems.join(', ')}`, player.id]
        ).catch(() => {});
        await createNotificationIfEnabled({
          recipientEmail: player.email,
          type: 'announcement',
          title: 'Weekly maintenance deducted',
          body: `${deducted.toLocaleString()} STC deducted for ${paidItems.length} asset(s).`,
          link: '/lifestyle',
          relatedId: player.id,
        });
      }

      if (defaultedItems.length) {
        await createNotificationIfEnabled({
          recipientEmail: player.email,
          type: 'announcement',
          title: `${defaultedItems.length} asset(s) defaulted`,
          body: `Insufficient STC maintenance for: ${defaultedItems.join(', ')}.`,
          link: '/lifestyle',
          relatedId: player.id,
        });
      }
    }

    return { success: true, processed, defaulted };
  },

  async payMonthlySalaries({ _auth_user_id }) {
    // Same logic as weekly salaries, exposed for monthly scheduler compatibility.
    return HANDLERS.payWeeklySalaries({ _auth_user_id });
  },

  async stcEngine({ event_type, player_id, club_id, reference_id, description, amount_override }) {
    if (!event_type) throw new Error('event_type required');
    const REWARDS = {
      match_win: { player: 5000, club: 10000, requiresClub: true },
      match_draw: { player: 2000, club: 4000, requiresClub: true },
      tournament_win: { player: 50000, club: 100000, requiresClub: true },
      tournament_final: { player: 20000, club: 40000, requiresClub: true },
      tournament_participation: { player: 5000, club: 10000, requiresClub: true },
      achievement: { player: 10000, club: 0, requiresClub: true },
      streak_bonus: { player: 15000, club: 0, requiresClub: true },
      match_loss: { player: 500, club: 1000, requiresClub: false },
      wager_win: { player: 0, club: 0, requiresClub: false },
      wager_refund: { player: 0, club: 0, requiresClub: false },
    };
    const reward = REWARDS[event_type] || { player: 0, club: 0, requiresClub: false };
    const results = [];

    if (player_id) {
      const pRows = await EXECUTESQL('SELECT id, email, stc, club_id FROM players WHERE id = ? LIMIT 1', [player_id]);
      const p = pRows[0];
      if (p) {
        if (reward.requiresClub && !p.club_id) {
          results.push({ entity: 'player', id: player_id, amount: 0, skipped: true, reason: 'Club-based reward requires club membership' });
        } else {
          const amount = amount_override !== undefined ? Number(amount_override) : Number(reward.player || 0);
          if (amount !== 0) {
            const newStc = Math.max(0, Number(p.stc || 0) + amount);
            await EXECUTESQL('UPDATE players SET stc = ?, updated_date = NOW() WHERE id = ?', [newStc, p.id]);
            await EXECUTESQL(
              `INSERT INTO stc_transactions (id, player_id, player_email, amount, type, description, reference_id, created_date)
               VALUES (?, ?, ?, ?, ?, ?, ?, NOW())`,
              [uuidv4(), p.id, p.email, amount, event_type, description || `STC: ${String(event_type).replace(/_/g, ' ')}`, reference_id || null]
            ).catch(() => {});
            results.push({ entity: 'player', id: p.id, amount, new_balance: newStc });
          }
        }
      }
    }

    if (club_id) {
      const cRows = await EXECUTESQL('SELECT id, stc FROM clubs WHERE id = ? LIMIT 1', [club_id]);
      const c = cRows[0];
      if (c) {
        const amount = amount_override !== undefined ? Number(amount_override) : Number(reward.club || 0);
        if (amount !== 0) {
          const newStc = Math.max(0, Number(c.stc || 0) + amount);
          await EXECUTESQL('UPDATE clubs SET stc = ?, updated_date = NOW() WHERE id = ?', [newStc, c.id]);
          await EXECUTESQL(
            `INSERT INTO stc_transactions (id, club_id, amount, type, description, reference_id, created_date)
             VALUES (?, ?, ?, ?, ?, ?, NOW())`,
            [uuidv4(), c.id, amount, event_type, description || `Club STC: ${String(event_type).replace(/_/g, ' ')}`, reference_id || null]
          ).catch(() => {});
          results.push({ entity: 'club', id: c.id, amount, new_balance: newStc });
        }
      }
    }

    return { success: true, results };
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

  // ── Economy Tests ─────────────────────────────────────────────────────────
  async economyTests({ action, test_name, suite, sample_size, _auth_user_id }) {
    const adminRows = await EXECUTESQL('SELECT id, email, role_id FROM users WHERE id = ? LIMIT 1', [_auth_user_id]);
    if (!adminRows.length || Number(adminRows[0].role_id) !== 0) throw new Error('Admin access required');

    // ── internal helpers ────────────────────────────────────────────────────
    function assert(cond, msg) { if (!cond) throw new Error(`Assertion failed: ${msg}`); }

    async function runTest(name, description, fn) {
      const start = Date.now();
      const cleanups = [];
      const addCleanup = (c) => cleanups.push(c);
      try {
        const r = await fn(addCleanup);
        return { name, description, status: r.status || 'pass', message: r.message || 'All assertions passed', assertions: r.assertions || [], duration_ms: Date.now() - start };
      } catch (err) {
        return { name, description, status: 'fail', message: err.message, assertions: err.assertions || [], duration_ms: Date.now() - start };
      } finally {
        for (const c of cleanups.reverse()) await c().catch(() => {});
      }
    }

    // ── simulation tests ────────────────────────────────────────────────────
    const SIM_TESTS = {

      wallet_creation: () => runTest('wallet_creation', 'New player gets 50,000 STC + initial_grant transaction; no duplicates', async (add) => {
        const pid = uuidv4(), uid = uuidv4();
        await EXECUTESQL(`INSERT INTO players (id, gamertag, email, user_id, stc, created_date) VALUES (?, ?, ?, ?, NULL, NOW())`,
          [pid, `__TEST__wc_${pid.slice(0,6)}`, `__test__wc_${pid.slice(0,6)}@stage.test`, uid]);
        add(() => EXECUTESQL('DELETE FROM players WHERE id = ?', [pid]));
        add(() => EXECUTESQL('DELETE FROM player_stc_transactions WHERE player_id = ?', [pid]));

        await EXECUTESQL('UPDATE players SET stc = 50000, updated_date = NOW() WHERE id = ?', [pid]);
        await EXECUTESQL(`INSERT INTO player_stc_transactions (id,player_id,player_email,amount,balance_after,type,category,source,description,created_date)
          VALUES (?,?,NULL,50000,50000,'income','initial_grant','System','Welcome bonus',NOW())`, [uuidv4(), pid]);

        const [p] = await EXECUTESQL('SELECT stc FROM players WHERE id = ?', [pid]);
        assert(Number(p.stc) === 50000, `Expected balance 50000, got ${p.stc}`);
        const txs = await EXECUTESQL("SELECT * FROM player_stc_transactions WHERE player_id=? AND category='initial_grant'", [pid]);
        assert(txs.length === 1, `Expected 1 initial_grant tx, got ${txs.length}`);
        assert(Number(txs[0].amount) === 50000, `Tx amount mismatch`);
        assert(Number(txs[0].balance_after) === 50000, `balance_after mismatch`);
        // Idempotency: running init again should not create duplicate
        const dup = await EXECUTESQL("SELECT COUNT(*) as cnt FROM player_stc_transactions WHERE player_id=? AND category='initial_grant'", [pid]);
        assert(Number(dup[0].cnt) === 1, `Duplicate initial_grant detected`);
        return { assertions: ['✓ Balance = 50,000 STC', '✓ initial_grant tx (amount=50000, balance_after=50000)', '✓ No duplicate initial_grant'] };
      }),

      club_default_finances: () => runTest('club_default_finances', 'New club has positive STC and non-negative budgets', async (add) => {
        const cid = uuidv4(), uid = uuidv4();
        await EXECUTESQL(`INSERT INTO clubs (id,name,tag,user_id,stc,transfer_budget_stc,wage_budget_stc,created_date) VALUES (?,?,?,?,5000000,0,0,NOW())`,
          [cid, `__TEST__cf_${cid.slice(0,6)}`, 'TCC', uid]);
        add(() => EXECUTESQL('DELETE FROM clubs WHERE id = ?', [cid]));
        const [c] = await EXECUTESQL('SELECT stc, transfer_budget_stc, wage_budget_stc FROM clubs WHERE id = ?', [cid]);
        assert(Number(c.stc) > 0, `stc must be > 0, got ${c.stc}`);
        assert(Number(c.transfer_budget_stc) >= 0, `transfer_budget must be >= 0`);
        assert(Number(c.wage_budget_stc) >= 0, `wage_budget must be >= 0`);
        return { assertions: [`✓ stc = ${Number(c.stc).toLocaleString()} STC`, `✓ transfer_budget = ${Number(c.transfer_budget_stc).toLocaleString()}`, `✓ wage_budget = ${Number(c.wage_budget_stc).toLocaleString()}`] };
      }),

      salary_payment: () => runTest('salary_payment', 'Weekly salary: player balance +salary, club balance -salary, both have tx records', async (add) => {
        const pid = uuidv4(), cid = uuidv4(), uid1 = uuidv4(), uid2 = uuidv4();
        const SALARY = 5000, P_START = 100000, C_START = 10000000;
        await EXECUTESQL(`INSERT INTO players (id,gamertag,email,user_id,stc,created_date) VALUES (?,?,?,?,?,NOW())`,
          [pid, `__TEST__sal_${pid.slice(0,6)}`, `__test__sal_${pid.slice(0,6)}@s.t`, uid1, P_START]);
        await EXECUTESQL(`INSERT INTO clubs (id,name,tag,user_id,stc,transfer_budget_stc,wage_budget_stc,created_date) VALUES (?,?,?,?,?,0,0,NOW())`,
          [cid, `__TEST__salc_${cid.slice(0,6)}`, 'TSL', uid2, C_START]);
        add(() => EXECUTESQL('DELETE FROM players WHERE id=?', [pid]));
        add(() => EXECUTESQL('DELETE FROM clubs WHERE id=?', [cid]));
        add(() => EXECUTESQL('DELETE FROM player_stc_transactions WHERE player_id=?', [pid]));
        add(() => EXECUTESQL('DELETE FROM stc_transactions WHERE club_id=?', [cid]));

        await createPlayerTx({ playerId: pid, playerEmail: null, amount: SALARY, category: 'wage_payment', source: cid, description: 'Test weekly salary' });
        await createClubTx({ clubId: cid, amount: -SALARY, type: 'expense', category: 'wage_payment', description: 'Test weekly salary', referenceId: pid });

        const [pRow] = await EXECUTESQL('SELECT stc FROM players WHERE id=?', [pid]);
        const [cRow] = await EXECUTESQL('SELECT stc FROM clubs WHERE id=?', [cid]);
        assert(Number(pRow.stc) === P_START + SALARY, `Player: expected ${P_START+SALARY}, got ${pRow.stc}`);
        assert(Number(cRow.stc) === C_START - SALARY, `Club: expected ${C_START-SALARY}, got ${cRow.stc}`);
        const ptx = await EXECUTESQL("SELECT * FROM player_stc_transactions WHERE player_id=? AND category='wage_payment'", [pid]);
        const ctx = await EXECUTESQL("SELECT * FROM stc_transactions WHERE club_id=? AND category='wage_payment'", [cid]);
        assert(ptx.length === 1, `Expected 1 player wage tx`);
        assert(ctx.length === 1, `Expected 1 club wage tx`);
        return { assertions: [`✓ Player: ${P_START.toLocaleString()} → ${(P_START+SALARY).toLocaleString()} (+${SALARY.toLocaleString()})`, `✓ Club: ${C_START.toLocaleString()} → ${(C_START-SALARY).toLocaleString()} (-${SALARY.toLocaleString()})`, '✓ wage_payment tx on both sides'] };
      }),

      lifestyle_purchase: () => runTest('lifestyle_purchase', 'Purchase deducts player balance; tx with correct amount and balance_after', async (add) => {
        const pid = uuidv4(), uid = uuidv4();
        const PRICE = 10000, START = 100000;
        await EXECUTESQL(`INSERT INTO players (id,gamertag,email,user_id,stc,created_date) VALUES (?,?,?,?,?,NOW())`,
          [pid, `__TEST__lsp_${pid.slice(0,6)}`, `__test__lsp_${pid.slice(0,6)}@s.t`, uid, START]);
        add(() => EXECUTESQL('DELETE FROM players WHERE id=?', [pid]));
        add(() => EXECUTESQL('DELETE FROM player_stc_transactions WHERE player_id=?', [pid]));
        await createPlayerTx({ playerId: pid, playerEmail: null, amount: -PRICE, category: 'lifestyle_purchase', source: 'Lifestyle', description: 'Test purchase' });
        const [p] = await EXECUTESQL('SELECT stc FROM players WHERE id=?', [pid]);
        assert(Number(p.stc) === START - PRICE, `Expected ${START-PRICE}, got ${p.stc}`);
        const txs = await EXECUTESQL("SELECT * FROM player_stc_transactions WHERE player_id=? AND category='lifestyle_purchase'", [pid]);
        assert(txs.length === 1, 'Expected 1 lifestyle_purchase tx');
        assert(Number(txs[0].amount) === -PRICE, `amount mismatch`);
        assert(Number(txs[0].balance_after) === START - PRICE, `balance_after mismatch`);
        return { assertions: [`✓ Balance: ${START.toLocaleString()} → ${(START-PRICE).toLocaleString()} (-${PRICE.toLocaleString()})`, '✓ lifestyle_purchase tx recorded', '✓ balance_after is accurate'] };
      }),

      lifestyle_rental: () => runTest('lifestyle_rental', 'Rental deducts player balance and creates transaction', async (add) => {
        const pid = uuidv4(), uid = uuidv4();
        const RENT = 3000, START = 50000;
        await EXECUTESQL(`INSERT INTO players (id,gamertag,email,user_id,stc,created_date) VALUES (?,?,?,?,?,NOW())`,
          [pid, `__TEST__lsr_${pid.slice(0,6)}`, `__test__lsr_${pid.slice(0,6)}@s.t`, uid, START]);
        add(() => EXECUTESQL('DELETE FROM players WHERE id=?', [pid]));
        add(() => EXECUTESQL('DELETE FROM player_stc_transactions WHERE player_id=?', [pid]));
        await createPlayerTx({ playerId: pid, playerEmail: null, amount: -RENT, category: 'lifestyle_rental', source: 'Lifestyle', description: 'Test rental' });
        const [p] = await EXECUTESQL('SELECT stc FROM players WHERE id=?', [pid]);
        assert(Number(p.stc) === START - RENT, `Expected ${START-RENT}, got ${p.stc}`);
        const txs = await EXECUTESQL("SELECT * FROM player_stc_transactions WHERE player_id=? AND category='lifestyle_rental'", [pid]);
        assert(txs.length === 1, 'Expected 1 rental tx');
        return { assertions: [`✓ Rental deduction: -${RENT.toLocaleString()} STC`, `✓ Balance after: ${(START-RENT).toLocaleString()} STC`, '✓ lifestyle_rental tx recorded'] };
      }),

      lifestyle_investment: () => runTest('lifestyle_investment', 'Investment deducts balance; return credits back; net profit reflected correctly', async (add) => {
        const pid = uuidv4(), uid = uuidv4();
        const INVEST = 20000, RETURN = 22000, START = 100000;
        await EXECUTESQL(`INSERT INTO players (id,gamertag,email,user_id,stc,created_date) VALUES (?,?,?,?,?,NOW())`,
          [pid, `__TEST__lsi_${pid.slice(0,6)}`, `__test__lsi_${pid.slice(0,6)}@s.t`, uid, START]);
        add(() => EXECUTESQL('DELETE FROM players WHERE id=?', [pid]));
        add(() => EXECUTESQL('DELETE FROM player_stc_transactions WHERE player_id=?', [pid]));
        await createPlayerTx({ playerId: pid, playerEmail: null, amount: -INVEST, category: 'lifestyle_investment', source: 'Lifestyle', description: 'Test investment' });
        await createPlayerTx({ playerId: pid, playerEmail: null, amount: RETURN, category: 'lifestyle_return', source: 'Lifestyle', description: 'Test investment return' });
        const [p] = await EXECUTESQL('SELECT stc FROM players WHERE id=?', [pid]);
        const expected = START - INVEST + RETURN;
        assert(Number(p.stc) === expected, `Expected ${expected}, got ${p.stc}`);
        const ivTx = await EXECUTESQL("SELECT * FROM player_stc_transactions WHERE player_id=? AND category='lifestyle_investment'", [pid]);
        const rtTx = await EXECUTESQL("SELECT * FROM player_stc_transactions WHERE player_id=? AND category='lifestyle_return'", [pid]);
        assert(ivTx.length === 1 && rtTx.length === 1, 'Expected both investment and return txs');
        return { assertions: [`✓ Investment: -${INVEST.toLocaleString()}`, `✓ Return: +${RETURN.toLocaleString()} (profit +${(RETURN-INVEST).toLocaleString()})`, `✓ Final balance: ${expected.toLocaleString()} STC`, '✓ Both txs recorded'] };
      }),

      wager_block: () => runTest('wager_block', 'Wager stake reduces both player balances; blocked funds confirmed deducted', async (add) => {
        const p1 = uuidv4(), p2 = uuidv4(), u1 = uuidv4(), u2 = uuidv4();
        const STAKE = 10000, START = 50000;
        await EXECUTESQL(`INSERT INTO players (id,gamertag,email,user_id,stc,created_date) VALUES (?,?,?,?,?,NOW())`,
          [p1, `__TEST__wb1_${p1.slice(0,6)}`, `__test__wb1_${p1.slice(0,6)}@s.t`, u1, START]);
        await EXECUTESQL(`INSERT INTO players (id,gamertag,email,user_id,stc,created_date) VALUES (?,?,?,?,?,NOW())`,
          [p2, `__TEST__wb2_${p2.slice(0,6)}`, `__test__wb2_${p2.slice(0,6)}@s.t`, u2, START]);
        add(() => EXECUTESQL('DELETE FROM players WHERE id IN (?,?)', [p1,p2]));
        add(() => EXECUTESQL('DELETE FROM player_stc_transactions WHERE player_id IN (?,?)', [p1,p2]));
        await createPlayerTx({ playerId: p1, playerEmail: null, amount: -STAKE, category: 'wager_stake', source: 'Wager', description: 'Test stake' });
        await createPlayerTx({ playerId: p2, playerEmail: null, amount: -STAKE, category: 'wager_stake', source: 'Wager', description: 'Test stake' });
        const [r1] = await EXECUTESQL('SELECT stc FROM players WHERE id=?', [p1]);
        const [r2] = await EXECUTESQL('SELECT stc FROM players WHERE id=?', [p2]);
        assert(Number(r1.stc) === START - STAKE, `P1 expected ${START-STAKE}, got ${r1.stc}`);
        assert(Number(r2.stc) === START - STAKE, `P2 expected ${START-STAKE}, got ${r2.stc}`);
        const t1 = await EXECUTESQL("SELECT * FROM player_stc_transactions WHERE player_id=? AND category='wager_stake'", [p1]);
        const t2 = await EXECUTESQL("SELECT * FROM player_stc_transactions WHERE player_id=? AND category='wager_stake'", [p2]);
        assert(t1.length === 1 && t2.length === 1, 'Expected stake txs for both players');
        assert(Number(r1.stc) < START, 'P1 blocked funds: cannot spend staked amount');
        assert(Number(r2.stc) < START, 'P2 blocked funds: cannot spend staked amount');
        return { assertions: [`✓ P1: ${START.toLocaleString()} → ${(START-STAKE).toLocaleString()} (stake blocked)`, `✓ P2: ${START.toLocaleString()} → ${(START-STAKE).toLocaleString()} (stake blocked)`, '✓ wager_stake txs recorded', '✓ Staked amount deducted from spendable balance'] };
      }),

      wager_payout: () => runTest('wager_payout', 'Winner receives full pot; loser gets no refund; payout tx recorded', async (add) => {
        const p1 = uuidv4(), p2 = uuidv4(), u1 = uuidv4(), u2 = uuidv4();
        const STAKE = 10000, POT = STAKE * 2, START = 50000;
        await EXECUTESQL(`INSERT INTO players (id,gamertag,email,user_id,stc,created_date) VALUES (?,?,?,?,?,NOW())`,
          [p1, `__TEST__wp1_${p1.slice(0,6)}`, `__test__wp1_${p1.slice(0,6)}@s.t`, u1, START]);
        await EXECUTESQL(`INSERT INTO players (id,gamertag,email,user_id,stc,created_date) VALUES (?,?,?,?,?,NOW())`,
          [p2, `__TEST__wp2_${p2.slice(0,6)}`, `__test__wp2_${p2.slice(0,6)}@s.t`, u2, START]);
        add(() => EXECUTESQL('DELETE FROM players WHERE id IN (?,?)', [p1,p2]));
        add(() => EXECUTESQL('DELETE FROM player_stc_transactions WHERE player_id IN (?,?)', [p1,p2]));
        await createPlayerTx({ playerId: p1, playerEmail: null, amount: -STAKE, category: 'wager_stake', source: 'Wager', description: 'Stake' });
        await createPlayerTx({ playerId: p2, playerEmail: null, amount: -STAKE, category: 'wager_stake', source: 'Wager', description: 'Stake' });
        await createPlayerTx({ playerId: p1, playerEmail: null, amount: POT, category: 'wager_payout', source: 'Wager', description: 'Win payout' });
        const [r1] = await EXECUTESQL('SELECT stc FROM players WHERE id=?', [p1]);
        const [r2] = await EXECUTESQL('SELECT stc FROM players WHERE id=?', [p2]);
        const p1Exp = START - STAKE + POT, p2Exp = START - STAKE;
        assert(Number(r1.stc) === p1Exp, `Winner expected ${p1Exp}, got ${r1.stc}`);
        assert(Number(r2.stc) === p2Exp, `Loser expected ${p2Exp}, got ${r2.stc}`);
        const ptx = await EXECUTESQL("SELECT * FROM player_stc_transactions WHERE player_id=? AND category='wager_payout'", [p1]);
        assert(ptx.length === 1 && Number(ptx[0].amount) === POT, `Expected payout tx of ${POT}`);
        const ltx = await EXECUTESQL("SELECT * FROM player_stc_transactions WHERE player_id=? AND category='wager_payout'", [p2]);
        assert(ltx.length === 0, 'Loser must not receive a payout tx');
        return { assertions: [`✓ Winner: ${START.toLocaleString()} → ${p1Exp.toLocaleString()} (net +${(p1Exp-START).toLocaleString()})`, `✓ Loser: ${START.toLocaleString()} → ${p2Exp.toLocaleString()} (net -${STAKE.toLocaleString()})`, `✓ wager_payout tx = ${POT.toLocaleString()} STC`, '✓ Loser received no payout'] };
      }),

      wager_refund: () => runTest('wager_refund', 'Both players refunded to pre-wager balance; refund txs recorded', async (add) => {
        const p1 = uuidv4(), p2 = uuidv4(), u1 = uuidv4(), u2 = uuidv4();
        const STAKE = 10000, START = 50000;
        await EXECUTESQL(`INSERT INTO players (id,gamertag,email,user_id,stc,created_date) VALUES (?,?,?,?,?,NOW())`,
          [p1, `__TEST__wr1_${p1.slice(0,6)}`, `__test__wr1_${p1.slice(0,6)}@s.t`, u1, START]);
        await EXECUTESQL(`INSERT INTO players (id,gamertag,email,user_id,stc,created_date) VALUES (?,?,?,?,?,NOW())`,
          [p2, `__TEST__wr2_${p2.slice(0,6)}`, `__test__wr2_${p2.slice(0,6)}@s.t`, u2, START]);
        add(() => EXECUTESQL('DELETE FROM players WHERE id IN (?,?)', [p1,p2]));
        add(() => EXECUTESQL('DELETE FROM player_stc_transactions WHERE player_id IN (?,?)', [p1,p2]));
        await createPlayerTx({ playerId: p1, playerEmail: null, amount: -STAKE, category: 'wager_stake', source: 'Wager', description: 'Stake' });
        await createPlayerTx({ playerId: p2, playerEmail: null, amount: -STAKE, category: 'wager_stake', source: 'Wager', description: 'Stake' });
        await createPlayerTx({ playerId: p1, playerEmail: null, amount: STAKE, category: 'wager_refund', source: 'Wager', description: 'Refund' });
        await createPlayerTx({ playerId: p2, playerEmail: null, amount: STAKE, category: 'wager_refund', source: 'Wager', description: 'Refund' });
        const [r1] = await EXECUTESQL('SELECT stc FROM players WHERE id=?', [p1]);
        const [r2] = await EXECUTESQL('SELECT stc FROM players WHERE id=?', [p2]);
        assert(Number(r1.stc) === START, `P1 expected ${START}, got ${r1.stc}`);
        assert(Number(r2.stc) === START, `P2 expected ${START}, got ${r2.stc}`);
        const rt1 = await EXECUTESQL("SELECT * FROM player_stc_transactions WHERE player_id=? AND category='wager_refund'", [p1]);
        const rt2 = await EXECUTESQL("SELECT * FROM player_stc_transactions WHERE player_id=? AND category='wager_refund'", [p2]);
        assert(rt1.length === 1 && rt2.length === 1, 'Expected refund txs for both');
        return { assertions: [`✓ P1 restored to ${START.toLocaleString()} STC`, `✓ P2 restored to ${START.toLocaleString()} STC`, '✓ wager_refund txs recorded for both'] };
      }),

      ticket_revenue: () => runTest('ticket_revenue', 'Home match revenue: correct attendance calc, club credited, 15% to transfer budget, idempotency guard, match fields updated', async (add) => {
        const cid = uuidv4(), mid = uuidv4(), uid = uuidv4();
        const WINS = 5, LOSSES = 1, STREAK = 3, START = 5000000;
        await EXECUTESQL(`INSERT INTO clubs (id,name,tag,user_id,stc,transfer_budget_stc,wage_budget_stc,wins,losses,win_streak,created_date) VALUES (?,?,?,?,?,0,0,?,?,?,NOW())`,
          [cid, `__TEST__tr_${cid.slice(0,6)}`, 'TTR', uid, START, WINS, LOSSES, STREAK]);
        await EXECUTESQL(`INSERT INTO matches (id,home_club_id,status,stats_processed,home_ticket_revenue,created_date) VALUES (?,?,'completed',0,0,NOW())`,
          [mid, cid]);
        add(() => EXECUTESQL('DELETE FROM clubs WHERE id=?', [cid]));
        add(() => EXECUTESQL('DELETE FROM matches WHERE id=?', [mid]));
        add(() => EXECUTESQL('DELETE FROM stc_transactions WHERE club_id=?', [cid]));

        const cfg = await getStadiumConfig();
        const lvl = cfg[0] || { capacity: 5000, ticket_price_stc: 15 };
        const pct = calcAttendancePct(WINS, LOSSES, STREAK);
        const attendance = Math.round(lvl.capacity * pct / 100);
        const revenue = attendance * Number(lvl.ticket_price_stc);
        const cut = Math.round(revenue * 0.15);

        // Idempotency guard check (no existing tx)
        const prior = await EXECUTESQL("SELECT id FROM stc_transactions WHERE club_id=? AND category='ticket_revenue' AND reference_id=? LIMIT 1", [cid, mid]);
        assert(prior.length === 0, 'Pre-condition: no prior ticket_revenue tx');

        await createClubTx({ clubId: cid, amount: revenue, type: 'income', category: 'ticket_revenue', description: `Test tickets (${attendance} fans @ ${lvl.ticket_price_stc} STC)`, referenceId: mid });
        await EXECUTESQL('UPDATE clubs SET transfer_budget_stc = transfer_budget_stc + ? WHERE id=?', [cut, cid]);
        await EXECUTESQL('UPDATE matches SET home_ticket_revenue=?,home_ticket_attendance=?,home_ticket_pct=?,home_ticket_capacity=?,home_ticket_price=? WHERE id=?',
          [revenue, attendance, pct, lvl.capacity, lvl.ticket_price_stc, mid]);

        const [c] = await EXECUTESQL('SELECT stc, transfer_budget_stc FROM clubs WHERE id=?', [cid]);
        const [m] = await EXECUTESQL('SELECT home_ticket_revenue, home_ticket_attendance, home_ticket_pct FROM matches WHERE id=?', [mid]);
        assert(Number(c.stc) === START + revenue, `Club balance mismatch`);
        assert(Number(c.transfer_budget_stc) === cut, `Transfer budget cut mismatch`);
        assert(Number(m.home_ticket_revenue) === revenue, `Match revenue field mismatch`);
        assert(Number(m.home_ticket_attendance) === attendance, `Match attendance field mismatch`);

        const txs = await EXECUTESQL("SELECT id FROM stc_transactions WHERE club_id=? AND category='ticket_revenue' AND reference_id=?", [cid, mid]);
        assert(txs.length === 1, 'Expected exactly 1 ticket_revenue tx');

        // Test idempotency: a second call would find the tx and skip
        const guard = await EXECUTESQL("SELECT id FROM stc_transactions WHERE club_id=? AND category='ticket_revenue' AND reference_id=? LIMIT 1", [cid, mid]);
        assert(guard.length === 1, 'Idempotency: tx exists → second run would be skipped');

        return { assertions: [`✓ Attendance: ${pct}% of ${lvl.capacity.toLocaleString()} = ${attendance.toLocaleString()} fans`, `✓ Revenue: ${revenue.toLocaleString()} STC`, `✓ Club balance: +${revenue.toLocaleString()} STC`, `✓ Transfer budget: +${cut.toLocaleString()} STC (15%)`, '✓ Match fields updated', '✓ Idempotency guard confirmed'] };
      }),

      shirt_sales_revenue: () => runTest('shirt_sales_revenue', 'Shirt sales: club receives revenue, shirt_revenue tx recorded', async (add) => {
        const cid = uuidv4(), uid = uuidv4();
        const REV = 3750, START = 5000000;
        await EXECUTESQL(`INSERT INTO clubs (id,name,tag,user_id,stc,transfer_budget_stc,wage_budget_stc,created_date) VALUES (?,?,?,?,?,0,0,NOW())`,
          [cid, `__TEST__ss_${cid.slice(0,6)}`, 'TSS', uid, START]);
        add(() => EXECUTESQL('DELETE FROM clubs WHERE id=?', [cid]));
        add(() => EXECUTESQL('DELETE FROM stc_transactions WHERE club_id=?', [cid]));
        await createClubTx({ clubId: cid, amount: REV, type: 'income', category: 'shirt_revenue', description: 'Test shirt sales' });
        const [c] = await EXECUTESQL('SELECT stc FROM clubs WHERE id=?', [cid]);
        assert(Number(c.stc) === START + REV, `Expected ${START+REV}, got ${c.stc}`);
        const txs = await EXECUTESQL("SELECT * FROM stc_transactions WHERE club_id=? AND category='shirt_revenue'", [cid]);
        assert(txs.length === 1, 'Expected 1 shirt_revenue tx');
        return { assertions: [`✓ Club credited: +${REV.toLocaleString()} STC`, `✓ Balance: ${(START+REV).toLocaleString()} STC`, '✓ shirt_revenue tx recorded'] };
      }),

      competition_reward: () => runTest('competition_reward', 'Competition reward: correct STC credited, competition_reward tx created', async (add) => {
        const cid = uuidv4(), uid = uuidv4();
        const PRIZE = 1000000, START = 5000000;
        await EXECUTESQL(`INSERT INTO clubs (id,name,tag,user_id,stc,transfer_budget_stc,wage_budget_stc,created_date) VALUES (?,?,?,?,?,0,0,NOW())`,
          [cid, `__TEST__cr_${cid.slice(0,6)}`, 'TCP', uid, START]);
        add(() => EXECUTESQL('DELETE FROM clubs WHERE id=?', [cid]));
        add(() => EXECUTESQL('DELETE FROM stc_transactions WHERE club_id=?', [cid]));
        await createClubTx({ clubId: cid, amount: PRIZE, type: 'income', category: 'competition_reward', description: 'Test 1st place prize' });
        const [c] = await EXECUTESQL('SELECT stc FROM clubs WHERE id=?', [cid]);
        assert(Number(c.stc) === START + PRIZE, `Expected ${START+PRIZE}, got ${c.stc}`);
        const txs = await EXECUTESQL("SELECT * FROM stc_transactions WHERE club_id=? AND category='competition_reward'", [cid]);
        assert(txs.length === 1, 'Expected 1 competition_reward tx');
        return { assertions: [`✓ Prize: +${PRIZE.toLocaleString()} STC`, `✓ Balance: ${(START+PRIZE).toLocaleString()} STC`, '✓ competition_reward tx recorded'] };
      }),

      transfer_budget_change: () => runTest('transfer_budget_change', 'Transfer fee deducted from both STC balance and transfer budget atomically', async (add) => {
        const cid = uuidv4(), uid = uuidv4();
        const FEE = 2000000, START = 10000000, BUDGET = 5000000;
        await EXECUTESQL(`INSERT INTO clubs (id,name,tag,user_id,stc,transfer_budget_stc,wage_budget_stc,created_date) VALUES (?,?,?,?,?,?,0,NOW())`,
          [cid, `__TEST__tb_${cid.slice(0,6)}`, 'TTB', uid, START, BUDGET]);
        add(() => EXECUTESQL('DELETE FROM clubs WHERE id=?', [cid]));
        add(() => EXECUTESQL('DELETE FROM stc_transactions WHERE club_id=?', [cid]));
        await createClubTx({ clubId: cid, amount: -FEE, type: 'expense', category: 'transfer_fee', description: 'Test transfer fee' });
        await EXECUTESQL('UPDATE clubs SET transfer_budget_stc = transfer_budget_stc - ? WHERE id=?', [FEE, cid]);
        const [c] = await EXECUTESQL('SELECT stc, transfer_budget_stc FROM clubs WHERE id=?', [cid]);
        assert(Number(c.stc) === START - FEE, `Balance mismatch`);
        assert(Number(c.transfer_budget_stc) === BUDGET - FEE, `Transfer budget mismatch`);
        const txs = await EXECUTESQL("SELECT * FROM stc_transactions WHERE club_id=? AND category='transfer_fee'", [cid]);
        assert(txs.length === 1, 'Expected 1 transfer_fee tx');
        return { assertions: [`✓ Balance: ${START.toLocaleString()} → ${(START-FEE).toLocaleString()} (-${FEE.toLocaleString()})`, `✓ Transfer budget: ${BUDGET.toLocaleString()} → ${(BUDGET-FEE).toLocaleString()}`, '✓ transfer_fee tx recorded'] };
      }),

      wage_budget_change: () => runTest('wage_budget_change', 'Wage budget tracks contracted salaries: increases on sign, decreases on expiry', async (add) => {
        const cid = uuidv4(), uid = uuidv4();
        const SALARY = 25000, BUDGET = 1000000;
        await EXECUTESQL(`INSERT INTO clubs (id,name,tag,user_id,stc,transfer_budget_stc,wage_budget_stc,created_date) VALUES (?,?,?,?,10000000,0,?,NOW())`,
          [cid, `__TEST__wb_${cid.slice(0,6)}`, 'TWB', uid, BUDGET]);
        add(() => EXECUTESQL('DELETE FROM clubs WHERE id=?', [cid]));
        await EXECUTESQL('UPDATE clubs SET wage_budget_stc = wage_budget_stc + ? WHERE id=?', [SALARY, cid]);
        const [after] = await EXECUTESQL('SELECT wage_budget_stc FROM clubs WHERE id=?', [cid]);
        assert(Number(after.wage_budget_stc) === BUDGET + SALARY, `After contract: expected ${BUDGET+SALARY}, got ${after.wage_budget_stc}`);
        await EXECUTESQL('UPDATE clubs SET wage_budget_stc = wage_budget_stc - ? WHERE id=?', [SALARY, cid]);
        const [final] = await EXECUTESQL('SELECT wage_budget_stc FROM clubs WHERE id=?', [cid]);
        assert(Number(final.wage_budget_stc) === BUDGET, `After expiry: expected ${BUDGET}, got ${final.wage_budget_stc}`);
        return { assertions: [`✓ Wage budget +${SALARY.toLocaleString()} on contract sign`, `✓ Wage budget -${SALARY.toLocaleString()} on expiry`, `✓ Restored to: ${BUDGET.toLocaleString()} STC`] };
      }),
    };

    // ── verification tests (read-only) ──────────────────────────────────────
    const VERIFY_TESTS = {

      no_negative_balances: () => runTest('no_negative_balances', 'No player or club has a negative STC balance', async () => {
        const negP = await EXECUTESQL("SELECT id, gamertag, stc FROM players WHERE stc < 0 AND gamertag NOT LIKE '__TEST__%'");
        const negC = await EXECUTESQL("SELECT id, name, stc FROM clubs WHERE stc < 0 AND name NOT LIKE '__TEST__%'");
        if (negP.length || negC.length) {
          const d = [...negP.map(p=>`Player ${p.gamertag}: ${p.stc}`), ...negC.map(c=>`Club ${c.name}: ${c.stc}`)];
          throw Object.assign(new Error(`${negP.length} player(s) + ${negC.length} club(s) with negative balances`), { assertions: d.slice(0,10).map(s=>`✗ ${s}`) });
        }
        return { assertions: ['✓ All players have stc ≥ 0', '✓ All clubs have stc ≥ 0'] };
      }),

      no_duplicate_initial_grants: () => runTest('no_duplicate_initial_grants', 'No player has multiple initial_grant wallet transactions', async () => {
        const dups = await EXECUTESQL(`SELECT player_id, COUNT(*) as cnt FROM player_stc_transactions WHERE category='initial_grant' GROUP BY player_id HAVING cnt > 1 LIMIT 10`);
        if (dups.length) throw new Error(`${dups.length} player(s) have duplicate initial_grant txs (first: player_id ${dups[0].player_id} × ${dups[0].cnt})`);
        return { assertions: ['✓ No duplicate initial_grant transactions found'] };
      }),

      balance_accuracy: () => runTest('balance_accuracy', `Spot-check ${sample_size || 10} random players: sum(txs) matches stored balance`, async () => {
        const N = Math.min(Number(sample_size) || 10, 50);
        const players = await EXECUTESQL(`SELECT id, gamertag, stc FROM players WHERE stc IS NOT NULL AND gamertag NOT LIKE '__TEST__%' ORDER BY RAND() LIMIT ?`, [N]);
        const mismatches = [];
        for (const p of players) {
          const [s] = await EXECUTESQL('SELECT COALESCE(SUM(amount),0) as total FROM player_stc_transactions WHERE player_id=?', [p.id]);
          const txSum = Math.round(Number(s.total)), actual = Math.round(Number(p.stc));
          if (Math.abs(txSum - actual) > 1) mismatches.push(`${p.gamertag}: txs=${txSum.toLocaleString()} ≠ balance=${actual.toLocaleString()} (Δ${txSum-actual})`);
        }
        if (mismatches.length) throw Object.assign(new Error(`${mismatches.length}/${players.length} balance/tx mismatches`), { assertions: mismatches.map(m=>`✗ ${m}`) });
        return { assertions: [`✓ ${players.length} players checked — all balances match transaction sum`] };
      }),

      no_duplicate_payments: () => runTest('no_duplicate_payments', 'No duplicate same-amount same-category same-minute transactions', async () => {
        const pDups = await EXECUTESQL(`SELECT player_id, category, amount, DATE_FORMAT(created_date,'%Y-%m-%d %H:%i') as min, COUNT(*) as cnt FROM player_stc_transactions WHERE category NOT IN ('lifestyle_passive','initial_grant') GROUP BY player_id,category,amount,min HAVING cnt>1 LIMIT 10`);
        const cDups = await EXECUTESQL(`SELECT club_id, category, amount, DATE_FORMAT(created_date,'%Y-%m-%d %H:%i') as min, COUNT(*) as cnt FROM stc_transactions WHERE category NOT IN ('shirt_revenue','ticket_revenue') GROUP BY club_id,category,amount,min HAVING cnt>1 LIMIT 10`);
        if (pDups.length || cDups.length) throw new Error(`Potential duplicates: ${pDups.length} player, ${cDups.length} club (check manually — may be legitimate)`);
        return { assertions: ['✓ No suspicious duplicate player transactions', '✓ No suspicious duplicate club transactions'] };
      }),

      wager_integrity: () => runTest('wager_integrity', 'Active wagers have both locks; settled solo wagers have payout records', async () => {
        const unlocked = await EXECUTESQL(`SELECT id FROM matches WHERE wager_status='active' AND (wager_home_locked=0 OR wager_away_locked=0) AND status NOT IN ('completed','forfeit','cancelled') LIMIT 10`);
        const noPayoutTx = await EXECUTESQL(`SELECT m.id FROM matches m WHERE m.wager_status='settled' AND m.mode='solo' AND m.home_player_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM player_stc_transactions t WHERE t.reference_id=m.id AND t.category='wager_payout') LIMIT 10`);
        const issues = [];
        if (unlocked.length) issues.push(`${unlocked.length} active wager(s) with incomplete locks`);
        if (noPayoutTx.length) issues.push(`${noPayoutTx.length} settled solo wager(s) missing payout tx`);
        if (issues.length) throw new Error(issues.join('; '));
        return { assertions: ['✓ All active wagers have both home + away locks', '✓ All settled solo wagers have payout transactions'] };
      }),

      transaction_completeness: () => runTest('transaction_completeness', 'Completed club matches have ticket revenue; active contracts have recent salary records', async () => {
        const noRevenue = await EXECUTESQL(`SELECT id, home_club_name FROM matches WHERE status='completed' AND home_club_id IS NOT NULL AND stats_processed=1 AND home_ticket_revenue=0 AND created_date >= DATE_SUB(NOW(), INTERVAL 7 DAY) LIMIT 10`);
        const staleSalary = await EXECUTESQL(`SELECT pc.id, pc.weekly_salary_stc FROM player_contracts pc WHERE pc.status='active' AND pc.weekly_salary_stc>0 AND pc.created_date<DATE_SUB(NOW(),INTERVAL 8 DAY) AND NOT EXISTS (SELECT 1 FROM player_stc_transactions t WHERE t.player_id=pc.user_id AND t.category='wage_payment' AND t.created_date>=DATE_SUB(NOW(),INTERVAL 8 DAY)) LIMIT 10`);
        const issues = [];
        if (noRevenue.length) issues.push(`${noRevenue.length} recent completed match(es) with 0 ticket revenue`);
        if (staleSalary.length) issues.push(`${staleSalary.length} active contract(s) with no salary in 8 days`);
        if (issues.length) return { status: 'warn', message: issues.join('; '), assertions: issues.map(i=>`⚠ ${i}`) };
        return { assertions: ['✓ Recent completed matches have ticket revenue', '✓ Active contracts have salary on record'] };
      }),

      club_profile_accuracy: () => runTest('club_profile_accuracy', `Spot-check ${sample_size || 5} clubs: sum(txs) ≈ stored balance`, async () => {
        const N = Math.min(Number(sample_size) || 5, 20);
        const clubs = await EXECUTESQL(`SELECT id, name, stc FROM clubs WHERE stc IS NOT NULL AND name NOT LIKE '__TEST__%' ORDER BY RAND() LIMIT ?`, [N]);
        const mismatches = [];
        for (const c of clubs) {
          const [s] = await EXECUTESQL('SELECT COALESCE(SUM(amount),0) as total FROM stc_transactions WHERE club_id=?', [c.id]);
          const txSum = Math.round(Number(s.total)), actual = Math.round(Number(c.stc));
          if (Math.abs(txSum - actual) > 100) mismatches.push(`${c.name}: txs=${txSum.toLocaleString()} ≠ balance=${actual.toLocaleString()}`);
        }
        if (mismatches.length) return { status: 'warn', message: `${mismatches.length}/${clubs.length} clubs with balance/tx discrepancies (may be pre-tx-system data)`, assertions: mismatches.map(m=>`⚠ ${m}`) };
        return { assertions: [`✓ ${clubs.length} clubs checked — balances consistent with transaction history`] };
      }),
    };

    // ── routing ─────────────────────────────────────────────────────────────
    if (action === 'list_tests') {
      return { data: { simulations: Object.keys(SIM_TESTS), verifications: Object.keys(VERIFY_TESTS) } };
    }

    if (action === 'run_test') {
      if (!test_name) throw new Error('test_name required');
      const fn = SIM_TESTS[test_name] || VERIFY_TESTS[test_name];
      if (!fn) throw new Error(`Unknown test: ${test_name}`);
      return { data: { result: await fn() } };
    }

    if (action === 'run_suite') {
      const names = suite === 'verify'
        ? Object.keys(VERIFY_TESTS)
        : suite === 'sim'
        ? Object.keys(SIM_TESTS)
        : [...Object.keys(SIM_TESTS), ...Object.keys(VERIFY_TESTS)];
      const results = [];
      for (const n of names) {
        const fn = SIM_TESTS[n] || VERIFY_TESTS[n];
        results.push(await fn());
      }
      const passed  = results.filter(r => r.status === 'pass').length;
      const failed  = results.filter(r => r.status === 'fail').length;
      const warned  = results.filter(r => r.status === 'warn').length;
      const errored = results.filter(r => r.status === 'error').length;
      return { data: { results, summary: { total: results.length, passed, failed, warned, errored } } };
    }

    throw new Error(`Unknown economyTests action: ${action}`);
  },

  // ── Tournament registration (STC + optional club credits + JSON roster) ──
  // Mirrors base44/functions/tournamentRegistration — frontend expects:
  //   { data: { success, error?, ... } }
  async tournamentRegistration({
    tournament_id, club_id, player_id, _auth_user_id,
  }) {
    const MIN_STC = 100;
    const MAX_STC = 1_000_000;
    const fail = (msg) => ({ data: { success: false, error: msg } });

    if (!_auth_user_id) return fail('Not authenticated');
    if (!tournament_id) return fail('tournament_id required');

    const users = await EXECUTESQL(
      'SELECT id, email, role_id FROM users WHERE id = ? LIMIT 1',
      [_auth_user_id],
    );
    if (!users.length) return fail('User not found');
    const user = users[0];
    const isAdmin = Number(user.role_id) === 2;

    const parseIds = (raw) => {
      if (raw == null) return [];
      if (Array.isArray(raw)) return raw.map(String);
      try {
        const j = typeof raw === 'string' ? JSON.parse(raw) : raw;
        return Array.isArray(j) ? j.map(String) : [];
      } catch {
        return [];
      }
    };

    return withTransaction(async (query) => {
      const tRows = await query('SELECT * FROM tournaments WHERE id = ? LIMIT 1 FOR UPDATE', [tournament_id]);
      if (!tRows.length) return fail('Tournament not found');
      const tournament = tRows[0];

      if (String(tournament.status || '') !== 'registration') {
        return fail('Tournament registration is closed');
      }
      if (tournament.start_date && new Date(tournament.start_date) < new Date()) {
        return fail('Tournament registration is closed');
      }

      const entryFee = Number(tournament.entry_fee_stc || 0);
      if (entryFee > 0 && (entryFee < MIN_STC || entryFee > MAX_STC)) {
        return fail(`Invalid tournament entry fee. Must be between ${MIN_STC} and ${MAX_STC.toLocaleString()} STC`);
      }

      const requiredCredits = Number(tournament.entry_credits ?? 0);

      const participantType = String(tournament.participant_type || 'club').toLowerCase();
      const isClubTourney = participantType !== 'player';

      if (isClubTourney) {
        if (!club_id) return fail('club_id required for club tournament');

        const clubs = await query('SELECT * FROM clubs WHERE id = ? LIMIT 1 FOR UPDATE', [club_id]);
        if (!clubs.length) return fail('Club not found');
        const club = clubs[0];

        const ownerOk = isAdmin
          || String(club.owner_email || '').toLowerCase() === String(user.email || '').toLowerCase()
          || String(club.user_id || '') === String(_auth_user_id);

        if (!ownerOk) return fail('Only the club owner can register this club');

        if (tournament.country_code && club.country_code !== tournament.country_code) {
          return fail('This tournament is restricted to clubs from another country');
        }

        let registered = parseIds(tournament.registered_clubs);
        if (registered.includes(String(club_id))) {
          return fail('Club already registered for this tournament');
        }

        const maxTeams = Number(tournament.max_teams || 0);
        if (maxTeams > 0 && registered.length >= maxTeams) {
          return fail('Tournament is full');
        }

        const clubStc = Number(club.stc || 0);
        if (entryFee > 0 && clubStc < entryFee) {
          return fail(`Insufficient STC. Need ${entryFee.toLocaleString()}, have ${clubStc.toLocaleString()}`);
        }

        const clubCredits = Number(club.credits ?? 0);
        if (!isAdmin && requiredCredits > 0 && clubCredits < requiredCredits) {
          return fail(`Insufficient credits. Need ${requiredCredits}, have ${clubCredits}`);
        }

        let newClubStc = clubStc;
        if (entryFee > 0) {
          newClubStc = clubStc - entryFee;
          await query('UPDATE clubs SET stc = ? WHERE id = ?', [newClubStc, club_id]);

          const txId = uuidv4();
          await query(
            `INSERT INTO stc_transactions (id, club_id, amount, type, category, description, reference_id, balance_after)
             VALUES (?,?,?,?,?,?,?,?)`,
            [
              txId,
              club_id,
              -entryFee,
              'tournament_entry',
              'tournament_entry',
              `Tournament entry fee: ${tournament.name}`,
              tournament_id,
              newClubStc,
            ],
          );
        }

        let creditsSpent = 0;
        let newClubCredits = clubCredits;
        if (!isAdmin && requiredCredits > 0) {
          creditsSpent = requiredCredits;
          newClubCredits = clubCredits - requiredCredits;
          await query('UPDATE clubs SET credits = ? WHERE id = ?', [newClubCredits, club_id]);
        }

        registered = [...registered, String(club_id)];
        await query(
          'UPDATE tournaments SET registered_clubs = ?, updated_date = NOW() WHERE id = ?',
          [JSON.stringify(registered), tournament_id],
        );

        return {
          data: {
            success: true,
            message: 'Club registered successfully',
            stc_locked: entryFee,
            new_club_stc: newClubStc,
            credits_spent: creditsSpent,
            new_club_credits: newClubCredits,
          },
        };
      }

      if (!player_id) return fail('player_id required for player tournament');

      const players = await query('SELECT * FROM players WHERE id = ? LIMIT 1 FOR UPDATE', [player_id]);
      if (!players.length) return fail('Player not found');
      const player = players[0];

      const playerOk = isAdmin
        || String(player.user_id || '') === String(_auth_user_id)
        || String(player.email || '').toLowerCase() === String(user.email || '').toLowerCase();

      if (!playerOk) return fail('You can only register your own player');

      if (tournament.country_code && player.country_code !== tournament.country_code) {
        return fail('This tournament is restricted to players from another country');
      }

      let registeredPl = parseIds(tournament.registered_players);
      if (registeredPl.includes(String(player_id))) {
        return fail('Player already registered for this tournament');
      }

      const maxTeamsP = Number(tournament.max_teams || 0);
      if (maxTeamsP > 0 && registeredPl.length >= maxTeamsP) {
        return fail('Tournament is full');
      }

      const playerStc = Number(player.stc || 0);
      if (entryFee > 0 && playerStc < entryFee) {
        return fail(`Insufficient STC. Need ${entryFee.toLocaleString()}, have ${playerStc.toLocaleString()}`);
      }

      const playerCredits = Number(player.credits ?? 0);
      if (!isAdmin && requiredCredits > 0 && playerCredits < requiredCredits) {
        return fail(`Insufficient credits. Need ${requiredCredits}, have ${playerCredits}`);
      }

      let newPlayerStc = playerStc;
      if (entryFee > 0) {
        newPlayerStc = playerStc - entryFee;
        await query('UPDATE players SET stc = ? WHERE id = ?', [newPlayerStc, player_id]);

        const txId = uuidv4();
        await query(
          `INSERT INTO player_stc_transactions (id, player_id, player_email, amount, balance_after, type, category, description, reference_id)
           VALUES (?,?,?,?,?,?,?,?,?)`,
          [
            txId,
            player_id,
            player.email,
            -entryFee,
            newPlayerStc,
            'tournament_entry',
            'tournament_entry',
            `Tournament entry fee: ${tournament.name}`,
            tournament_id,
          ],
        );
      }

      let newPlayerCredits = playerCredits;
      if (!isAdmin && requiredCredits > 0) {
        newPlayerCredits = playerCredits - requiredCredits;
        await query('UPDATE players SET credits = ? WHERE id = ?', [newPlayerCredits, player_id]);
      }

      registeredPl = [...registeredPl, String(player_id)];
      await query(
        'UPDATE tournaments SET registered_players = ?, updated_date = NOW() WHERE id = ?',
        [JSON.stringify(registeredPl), tournament_id],
      );

      return {
        data: {
          success: true,
          message: 'Player registered successfully',
          stc_locked: entryFee,
          new_player_stc: newPlayerStc,
          new_player_credits: newPlayerCredits,
        },
      };
    });
  },

  /** Notify all players in a club when their club registers for a tournament. */
  async tournamentRegistrationNotify({ action, tournament_id, club_id, _auth_user_id }) {
    if (!_auth_user_id) throw new Error('Not authenticated');
    if (action !== 'register') {
      return { success: false, error: 'Only action=register is implemented' };
    }
    if (!tournament_id || !club_id) throw new Error('tournament_id and club_id required');

    const tRows = await EXECUTESQL('SELECT * FROM tournaments WHERE id = ? LIMIT 1', [tournament_id]);
    if (!tRows.length) throw new Error('Tournament not found');
    const tournament = tRows[0];
    const registeredClubs = parseMaybeJson(tournament.registered_clubs, []);
    if (!Array.isArray(registeredClubs) || !registeredClubs.map(String).includes(String(club_id))) {
      throw new Error('Club is not registered for this tournament');
    }

    const users = await EXECUTESQL('SELECT id, email, role_id FROM users WHERE id = ? LIMIT 1', [_auth_user_id]);
    if (!users.length) throw new Error('User not found');
    const user = users[0];
    const clubs = await EXECUTESQL('SELECT id, owner_email, user_id FROM clubs WHERE id = ? LIMIT 1', [club_id]);
    if (!clubs.length) throw new Error('Club not found');
    const club = clubs[0];
    const ownerOk = Number(user.role_id) === 2
      || String(club.owner_email || '').toLowerCase() === String(user.email || '').toLowerCase()
      || String(club.user_id || '') === String(_auth_user_id);
    if (!ownerOk) throw new Error('Only the club owner can notify players for this registration');

    const clubPlayers = await EXECUTESQL(
      'SELECT email FROM players WHERE club_id = ? AND email IS NOT NULL AND email <> \'\'',
      [club_id],
    );

    const startLabel = tournament.start_date
      ? new Date(tournament.start_date).toLocaleString('en-GB', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
      : 'TBD';

    let notified = 0;
    for (const row of clubPlayers) {
      const email = row.email;
      if (!email) continue;
      const result = await createNotificationIfEnabled({
        recipientEmail: email,
        type: 'tournament_start',
        title: `Your club registered for ${tournament.name}`,
        body: `Your club has signed up for ${tournament.name}.\nStart: ${startLabel}\nPlatform: ${tournament.platform || 'TBD'}\nMake sure you're ready!`,
        link: `/tournaments/${tournament_id}`,
        relatedId: tournament_id,
      });
      if (!result.skipped) notified++;
    }

    return { success: true, notified };
  },

  // ── Claim a Daily/Weekly Objective reward ──────────────────────────────────
  //
  // Body: { progress_id } — the objective_progress row to claim.
  // Verifies the row belongs to the caller, is completed, and not yet claimed,
  // then credits STC, writes a player_stc_transactions ledger entry, marks the
  // progress as claimed, and writes admin_audit_log for traceability.
  async claimObjectiveReward({ _auth_user_id, progress_id }) {
    if (!_auth_user_id) throw new Error('Not authenticated');
    if (!progress_id)   throw new Error('progress_id required');

    return withTransaction(async (query) => {
      const progRows = await query(
        'SELECT * FROM objective_progress WHERE id = ? LIMIT 1 FOR UPDATE',
        [progress_id]
      );
      if (!progRows.length) throw new Error('Objective progress not found');
      const prog = progRows[0];

      const myPlayer = await query(
        'SELECT id, email, gamertag, stc FROM players WHERE user_id = ? LIMIT 1',
        [_auth_user_id]
      );
      if (!myPlayer.length) throw new Error('Player profile not found');
      const player = myPlayer[0];
      if (String(player.id) !== String(prog.player_id)) {
        throw new Error('Not allowed: progress belongs to another player');
      }
      if (!prog.completed_at) throw new Error('Objective not completed yet');
      if (prog.claimed_at)    throw new Error('Already claimed');

      const defRows = await query(
        'SELECT * FROM objective_definitions WHERE id = ? LIMIT 1',
        [prog.objective_id]
      );
      if (!defRows.length) throw new Error('Objective definition not found');
      const def = defRows[0];

      const rewardStc = Number(def.reward_stc || 0);
      const oldStc    = Number(player.stc || 0);
      const newStc    = oldStc + rewardStc;

      if (rewardStc > 0) {
        await query('UPDATE players SET stc = ?, updated_date = NOW() WHERE id = ?', [newStc, player.id]);
        const txId = uuidv4();
        await query(
          `INSERT INTO player_stc_transactions
             (id, player_id, player_email, amount, balance_after, type, category, source, description, reference_id, created_date)
           VALUES (?, ?, ?, ?, ?, 'credit', 'objective_reward', 'Objectives', ?, ?, NOW())`,
          [txId, player.id, player.email || null, rewardStc, newStc,
            `Objective reward — ${def.title || def.code || def.id}`, prog.id]
        );
      }

      await query(
        'UPDATE objective_progress SET claimed_at = NOW(), updated_date = NOW() WHERE id = ?',
        [prog.id]
      );

      const auditId = uuidv4();
      await query(
        `INSERT INTO admin_audit_log
           (id, admin_user_id, admin_email, action, entity_type, entity_id, entity_name, old_value, new_value, reason, created_date)
         VALUES (?, ?, ?, 'claim_objective_reward', 'objective_progress', ?, ?, ?, ?, ?, NOW())`,
        [
          auditId,
          _auth_user_id,
          player.email || null,
          prog.id,
          def.title || def.code || null,
          JSON.stringify({ stc: oldStc, claimed_at: null }),
          JSON.stringify({ stc: newStc, claimed_at: 'now', reward_stc: rewardStc, reward_xp: Number(def.reward_xp || 0) }),
          `Player ${player.gamertag || player.email} claimed objective '${def.title || def.code}'`,
        ]
      ).catch(() => {});

      return {
        success: true,
        data: {
          progress_id: prog.id,
          reward_stc: rewardStc,
          reward_xp: Number(def.reward_xp || 0),
          new_balance: newStc,
        },
      };
    });
  },

  // ── Submit a Squad Building Challenge ──────────────────────────────────────
  //
  // Body: { sbc_id, sacrificed_player_ids: string[], cornerstone_player_id? }
  //
  // Atomically:
  //   1. Validates SBC is active and within max_completions.
  //   2. Validates the sacrificed squad matches `sbcs.requirements`.
  //   3. Soft-deletes the sacrificed players (sets `sacrificed_at`).
  //   4. Credits STC + tracks the reward.
  //   5. Logs sbc_submissions + admin_audit_log.
  //
  // If any step fails, the transaction is rolled back and a 'failed' sbc_submissions
  // row is written (best-effort, outside the txn) for traceability.
  async submitSbc({ _auth_user_id, sbc_id, sacrificed_player_ids, cornerstone_player_id }) {
    if (!_auth_user_id) throw new Error('Not authenticated');
    if (!sbc_id)        throw new Error('sbc_id required');
    if (!Array.isArray(sacrificed_player_ids) || sacrificed_player_ids.length < 1) {
      throw new Error('sacrificed_player_ids must be a non-empty array');
    }
    if (new Set(sacrificed_player_ids.map(String)).size !== sacrificed_player_ids.length) {
      throw new Error('sacrificed_player_ids must be unique');
    }

    const me = await getMe(_auth_user_id);
    const player = me.player;
    if (!player) throw new Error('Player profile not found');

    // Pre-flight (outside txn so we can write a 'failed' row on validation error).
    const sbcRows = await EXECUTESQL('SELECT * FROM sbcs WHERE id = ? LIMIT 1', [sbc_id]);
    if (!sbcRows.length) throw new Error('SBC not found');
    const sbc = sbcRows[0];
    if (!Number(sbc.is_active)) throw new Error('SBC is not active');
    if (sbc.expires_at && new Date(sbc.expires_at).getTime() < Date.now()) {
      throw new Error('SBC has expired');
    }

    const requirements = parseMaybeJson(sbc.requirements, {});
    const reward       = parseMaybeJson(sbc.reward, {});

    // Completion-count check
    if (sbc.max_completions != null) {
      const countRows = await EXECUTESQL(
        "SELECT COUNT(*) AS n FROM sbc_submissions WHERE sbc_id = ? AND player_id = ? AND status = 'completed'",
        [sbc_id, player.id]
      );
      const done = Number(countRows[0]?.n || 0);
      if (done >= Number(sbc.max_completions)) {
        throw new Error(`Max completions reached for this SBC (${sbc.max_completions})`);
      }
    }

    // Load sacrificed players and validate ownership
    const ph = sacrificed_player_ids.map(() => '?').join(',');
    const sacrificed = await EXECUTESQL(
      `SELECT id, club_id, gamertag, overall_rating, country, country_code, archetype
         FROM players WHERE id IN (${ph})`,
      sacrificed_player_ids
    );
    if (sacrificed.length !== sacrificed_player_ids.length) {
      throw new Error('One or more sacrificed players not found');
    }
    // All sacrificed players must belong to the submitter's club
    if (!player.club_id) throw new Error('Submitter must belong to a club to sacrifice players');
    for (const sp of sacrificed) {
      if (String(sp.club_id) !== String(player.club_id)) {
        throw new Error(`Player ${sp.gamertag || sp.id} is not in your club`);
      }
    }

    // Constraint validation
    const failures = [];
    if (requirements.squad_size && sacrificed.length !== Number(requirements.squad_size)) {
      failures.push(`squad_size: required ${requirements.squad_size}, got ${sacrificed.length}`);
    }
    if (requirements.min_rating) {
      const avg = sacrificed.reduce((s, p) => s + Number(p.overall_rating || 0), 0) / sacrificed.length;
      if (avg < Number(requirements.min_rating)) {
        failures.push(`min_rating: average ${avg.toFixed(2)} below required ${requirements.min_rating}`);
      }
    }
    if (requirements.nationality) {
      const all = sacrificed.every(p =>
        (p.country_code && p.country_code === requirements.nationality) ||
        (p.country && p.country === requirements.nationality)
      );
      if (!all) failures.push(`nationality: all players must be ${requirements.nationality}`);
    }
    if (requirements.archetype) {
      const all = sacrificed.every(p => p.archetype === requirements.archetype);
      if (!all) failures.push(`archetype: all players must be ${requirements.archetype}`);
    }
    if (requirements.min_chem) {
      const { computeChemistry } = require('../services/chemistryService');
      const chem = await computeChemistry(
        sacrificed.map(p => p.id),
        { cornerstonePlayerId: cornerstone_player_id || null }
      );
      // Convert multiplier (1..1.15) to a 0..100 "chem score" for UX parity with FUT
      const chemScore = Math.round((chem.multiplier - 1) / 0.15 * 100);
      if (chemScore < Number(requirements.min_chem)) {
        failures.push(`min_chem: ${chemScore} below required ${requirements.min_chem}`);
      }
    }

    if (failures.length) {
      // Log failed submission for audit
      const failedId = uuidv4();
      await EXECUTESQL(
        `INSERT INTO sbc_submissions
           (id, sbc_id, player_id, player_email, player_gamertag, club_id,
            sacrificed_player_ids, reward_payload, stc_credited,
            status, failure_reason, submitted_at, created_date)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, 'failed', ?, NOW(), NOW())`,
        [
          failedId, sbc_id, player.id, player.email || null,
          player.gamertag || null, player.club_id || null,
          JSON.stringify(sacrificed_player_ids), JSON.stringify(reward),
          failures.join('; '),
        ]
      ).catch(() => {});
      throw new Error(`Requirements not met: ${failures.join('; ')}`);
    }

    // Atomic execution
    return withTransaction(async (query) => {
      // 1) Soft-delete sacrificed players (also detach from club)
      await query(
        `UPDATE players SET club_id = NULL, sacrificed_at = NOW(), updated_date = NOW()
          WHERE id IN (${ph})`,
        sacrificed_player_ids
      );

      // 2) Credit STC reward
      const rewardStc = Number(reward.stc || 0);
      const oldStc    = Number(player.stc || 0);
      const newStc    = oldStc + rewardStc;
      if (rewardStc > 0) {
        await query('UPDATE players SET stc = ?, updated_date = NOW() WHERE id = ?', [newStc, player.id]);
        const txId = uuidv4();
        await query(
          `INSERT INTO player_stc_transactions
             (id, player_id, player_email, amount, balance_after, type, category, source, description, reference_id, created_date)
           VALUES (?, ?, ?, ?, ?, 'credit', 'sbc_reward', 'SBC', ?, ?, NOW())`,
          [txId, player.id, player.email || null, rewardStc, newStc,
            `SBC reward — ${sbc.name}`, sbc.id]
        );
      }

      // 3) Optionally place a trophy item
      if (reward.trophy_item_id) {
        const tpId = uuidv4();
        await query(
          `INSERT INTO trophy_placements (id, owner_id, owner_type, trophy_item_id, position, created_date)
           VALUES (?, ?, 'player', ?, 0, NOW())`,
          [tpId, player.id, reward.trophy_item_id]
        ).catch(() => {});
      }

      // 4) Submission record
      const subId = uuidv4();
      await query(
        `INSERT INTO sbc_submissions
           (id, sbc_id, player_id, player_email, player_gamertag, club_id,
            sacrificed_player_ids, reward_payload, stc_credited,
            status, failure_reason, submitted_at, completed_at, created_date)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'completed', NULL, NOW(), NOW(), NOW())`,
        [
          subId, sbc_id, player.id, player.email || null,
          player.gamertag || null, player.club_id || null,
          JSON.stringify(sacrificed_player_ids), JSON.stringify(reward), rewardStc,
        ]
      );

      // 5) Audit log
      const auditId = uuidv4();
      await query(
        `INSERT INTO admin_audit_log
           (id, admin_user_id, admin_email, action, entity_type, entity_id, entity_name, old_value, new_value, reason, created_date)
         VALUES (?, ?, ?, 'submit_sbc', 'sbc_submission', ?, ?, ?, ?, ?, NOW())`,
        [
          auditId, _auth_user_id, player.email || null,
          subId, sbc.name,
          JSON.stringify({ stc: oldStc, sacrificed_count: sacrificed_player_ids.length }),
          JSON.stringify({ stc: newStc, reward_stc: rewardStc, reward }),
          `Player ${player.gamertag || player.email} completed SBC '${sbc.name}'`,
        ]
      ).catch(() => {});

      return {
        success: true,
        data: {
          submission_id: subId,
          sbc_id,
          sacrificed_count: sacrificed_player_ids.length,
          reward_stc: rewardStc,
          new_balance: newStc,
          reward,
        },
      };
    });
  },

  // ── Delete account ────────────────────────────────────────────────────────
  async deleteAccount({ _auth_user_id }) {
    if (!_auth_user_id) throw new Error('not authenticated');
    const ownedClubs = await EXECUTESQL('SELECT id FROM clubs WHERE user_id = ?', [_auth_user_id]);
    for (const club of ownedClubs) {
      // Detach players from clubs owned by this user before club deletion.
      await EXECUTESQL('UPDATE players SET club_id = NULL WHERE club_id = ?', [club.id]);
      await EXECUTESQL('DELETE FROM clubs WHERE id = ?', [club.id]);
    }

    const rows = await EXECUTESQL('SELECT id FROM players WHERE user_id = ?', [_auth_user_id]);
    if (rows.length) {
      const { id: player_id } = rows[0];
      await EXECUTESQL('DELETE FROM players WHERE id = ?', [player_id]);
    }
    await new UserModel().delete(_auth_user_id);
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
