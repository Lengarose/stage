const { EXECUTESQL } = require('../db/database');
const { createNotificationIfEnabled } = require('./messageDeliveryService');

function normalizeEmail(value) {
  return String(value || '').trim().toLowerCase();
}

function uniqueEmails(values = []) {
  return [...new Set(values.map(normalizeEmail).filter(Boolean))];
}

function relatedIdForMatchEvent(matchId, eventKey) {
  if (!matchId) return eventKey || null;
  return eventKey ? `${matchId}:${eventKey}` : String(matchId);
}

function emailsFromMatchRow(match, side) {
  if (side === 'home') {
    return uniqueEmails([match?.home_player_email, match?.home_owner_email]);
  }
  return uniqueEmails([match?.away_player_email, match?.away_owner_email]);
}

function parseSeatedPlayerIds(value) {
  if (value == null || value === '') return [];
  let raw = value;
  if (typeof raw === 'string') {
    try { raw = JSON.parse(raw); } catch { return []; }
  }
  if (!Array.isArray(raw)) return [];
  return raw.map((entry) => {
    if (entry && typeof entry === 'object') return String(entry.id || entry.player_id || '').trim();
    return String(entry || '').trim();
  }).filter(Boolean);
}

function matchLabel(match) {
  const home = match?.home_club_name || match?.home_player_name || 'Home';
  const away = match?.away_club_name || match?.away_player_name || 'Away';
  return `${home} vs ${away}`;
}

async function lookupEmailsByPlayerIds(playerIds = []) {
  const ids = [...new Set(playerIds.filter(Boolean).map(String))];
  if (!ids.length) return [];
  const placeholders = ids.map(() => '?').join(',');
  const rows = await EXECUTESQL(
    `SELECT email FROM players
      WHERE id IN (${placeholders})
        AND email IS NOT NULL
        AND TRIM(email) != ''`,
    ids
  ).catch(() => []);
  return uniqueEmails((rows || []).map((row) => row.email));
}

async function resolveMatchSideEmails(match, side) {
  const emails = emailsFromMatchRow(match, side);
  const playerId = side === 'home' ? match?.home_player_id : match?.away_player_id;
  const clubId = side === 'home' ? match?.home_club_id : match?.away_club_id;

  if (playerId) {
    emails.push(...await lookupEmailsByPlayerIds([playerId]));
  }

  if (clubId) {
    const clubs = await EXECUTESQL(
      'SELECT owner_email FROM clubs WHERE id = ? LIMIT 1',
      [clubId]
    ).catch(() => []);
    if (clubs[0]?.owner_email) emails.push(clubs[0].owner_email);

    if (match?.id) {
      const rooms = await EXECUTESQL(
        'SELECT seated_players FROM dressing_rooms WHERE match_id = ? AND club_id = ? LIMIT 1',
        [match.id, clubId]
      ).catch(() => []);
      emails.push(...await lookupEmailsByPlayerIds(parseSeatedPlayerIds(rooms[0]?.seated_players)));
    }
  }

  return uniqueEmails(emails);
}

async function notifyMatchSide(match, side, type, title, body, eventKey) {
  if (!match?.id) return { skipped: true, reason: 'match missing', emails: [] };
  const emails = await resolveMatchSideEmails(match, side);
  if (!emails.length) return { skipped: true, reason: 'recipient missing', emails: [] };

  const relatedId = relatedIdForMatchEvent(match.id, eventKey);
  const results = [];
  for (const recipientEmail of emails) {
    const result = await createNotificationIfEnabled({
      recipientEmail,
      type,
      title,
      body,
      link: `/game-day?match=${match.id}`,
      relatedId,
    }).catch(() => ({ skipped: true }));
    results.push({ recipientEmail, ...result });
  }
  return { skipped: false, emails, results };
}

async function notifyMatchSides(match, type, title, body, eventKey) {
  const home = await notifyMatchSide(match, 'home', type, title, body, eventKey);
  const away = await notifyMatchSide(match, 'away', type, title, body, eventKey);
  return { home, away };
}

async function notifyMatchKickoff(match) {
  const label = matchLabel(match);
  return notifyMatchSides(
    match,
    'match_reminder',
    'Kickoff',
    `${label} is underway.`,
    'kickoff'
  );
}

async function notifyMatchScheduled(match) {
  const label = matchLabel(match);
  const when = match?.scheduled_date || 'TBD';
  return notifyMatchSides(
    match,
    'match_reminder',
    `Match scheduled: ${label}`,
    `Kick-off: ${when}`,
    'scheduled'
  );
}

module.exports = {
  emailsFromMatchRow,
  matchLabel,
  notifyMatchKickoff,
  notifyMatchScheduled,
  notifyMatchSide,
  notifyMatchSides,
  parseSeatedPlayerIds,
  relatedIdForMatchEvent,
  resolveMatchSideEmails,
};
