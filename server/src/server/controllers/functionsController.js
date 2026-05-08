const express = require('express');
const router  = express.Router();
const { EXECUTESQL } = require('../db/database');
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
    if (action !== 'kickoff') throw new Error(`Unsupported matchKickoff action: ${action}`);
    await EXECUTESQL("UPDATE matches SET status = 'in_progress', updated_date = NOW() WHERE id = ?", [match_id]);
    return { data: { success: true } };
  },

  async wagerMatchActions({ action, match_id }) {
    if (!match_id) throw new Error('match_id required');
    const rows = await EXECUTESQL('SELECT * FROM matches WHERE id = ? LIMIT 1', [match_id]);
    if (!rows.length) throw new Error('Match not found');
    const m = rows[0];
    if (action === 'accept_wager') {
      await EXECUTESQL(
        "UPDATE matches SET wager_away_locked = 1, wager_status = 'active', updated_date = NOW() WHERE id = ?",
        [match_id]
      );
      return { success: true, data: { _match_patch: { wager_away_locked: 1, wager_status: 'active' } } };
    }
    if (action === 'decline_wager') {
      await EXECUTESQL(
        "UPDATE matches SET wager_status = 'declined', wager_stc = 0, wager_home_locked = 0, wager_away_locked = 0, updated_date = NOW() WHERE id = ?",
        [match_id]
      );
      return { success: true, data: { _match_patch: { wager_status: 'declined', wager_stc: 0, wager_home_locked: 0, wager_away_locked: 0 } } };
    }
    if (action === 'cancel_wager') {
      const nextStatus = m.status === 'completed' ? m.wager_status : 'cancelled';
      await EXECUTESQL(
        "UPDATE matches SET wager_status = ?, wager_stc = 0, wager_home_locked = 0, wager_away_locked = 0, updated_date = NOW() WHERE id = ?",
        [nextStatus, match_id]
      );
      return { success: true, data: { _match_patch: { wager_status: nextStatus, wager_stc: 0, wager_home_locked: 0, wager_away_locked: 0 } } };
    }
    throw new Error(`Unknown wager action: ${action}`);
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
    const new_stc_balance = Math.max(0, currentStc - price);
    await EXECUTESQL('UPDATE players SET stc = ?, updated_date = NOW() WHERE id = ?', [new_stc_balance, player.id]);
    const purchaseId = uuidv4();
    await EXECUTESQL(
      `INSERT INTO lifestyle_purchases (
        id, player_id, item_id, item_type, item_tier, rent_active, is_residence,
        created_date
      ) VALUES (?, ?, ?, ?, ?, 0, ?, NOW())`,
      [
        purchaseId,
        player.id,
        item_id,
        item.category || item.item_type || null,
        item.tier || item.item_tier || null,
        item.category === 'real_estate' ? 1 : 0,
      ]
    );
    await EXECUTESQL(
      `INSERT INTO stc_transactions (id, club_id, amount, type, description, reference_id, created_date)
       VALUES (?, ?, ?, 'purchase', ?, ?, NOW())`,
      [uuidv4(), player.club_id || null, -price, `Lifestyle purchase: ${item.name || item_id}`, purchaseId]
    ).catch(() => {});
    await EXECUTESQL(
      `INSERT INTO user_purchases (id, buyer_email, item_type, item_id, created_date)
       VALUES (?, ?, ?, ?, NOW())`,
      [uuidv4(), user.email, item.category || item.item_type || null, purchaseId]
    ).catch(() => {});
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
    const new_stc_balance = Math.max(0, currentStc - rent);
    await EXECUTESQL('UPDATE players SET stc = ?, updated_date = NOW() WHERE id = ?', [new_stc_balance, player.id]);
    await EXECUTESQL(
      `INSERT INTO lifestyle_purchases (id, player_id, item_id, item_type, item_tier, rent_active, is_residence, created_date)
       VALUES (?, ?, ?, ?, ?, 1, 0, NOW())`,
      [uuidv4(), player.id, item_id, item.category || item.item_type || null, item.tier || item.item_tier || null]
    );
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
      const newBalance = Number(player.stc || 0) + collected;
      await EXECUTESQL('UPDATE players SET stc = ?, updated_date = NOW() WHERE id = ?', [newBalance, player.id]);
    }
    return { success: true, data: { collected } };
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
