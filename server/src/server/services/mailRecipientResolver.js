const { EXECUTESQL } = require('../db/database');
const { listActiveClubPlayerEmails } = require('./clubPlayerService');
const { resolveClubPresidentContact } = require('./clubContactService');
const {
  lookupEmailsByPlayerIds,
  resolveMatchSideEmails,
  matchLabel,
} = require('./matchNotificationService');

function normalizeEmail(value) {
  const email = String(value || '').trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return '';
  if (email.endsWith('@stage.local') || email.endsWith('@stage.invalid')) return '';
  return email;
}

function uniqueEmails(values = []) {
  return [...new Set(values.map(normalizeEmail).filter(Boolean))];
}

function parseJsonIds(value) {
  if (value == null || value === '') return [];
  let raw = value;
  if (typeof raw === 'string') {
    try { raw = JSON.parse(raw); } catch { return []; }
  }
  if (!Array.isArray(raw)) return [];
  return raw.map(String).filter(Boolean);
}

function parseDataJson(row) {
  if (!row?.data_json) return {};
  if (typeof row.data_json === 'object') return row.data_json;
  try { return JSON.parse(row.data_json); } catch { return {}; }
}

async function listAudiences() {
  const [tournaments, leagues, matches, instances] = await Promise.all([
    EXECUTESQL(
      `SELECT id, name, status, participant_type, updated_date
         FROM tournaments
        WHERE status NOT IN ('cancelled', 'archived')
        ORDER BY updated_date DESC
        LIMIT 120`,
    ).catch(() => []),
    EXECUTESQL(
      `SELECT id, entity_type, data_json, updated_date
         FROM league_entities
        WHERE entity_type IN ('regional_league', 'competition', 'competition_season')
        ORDER BY updated_date DESC
        LIMIT 120`,
    ).catch(() => []),
    EXECUTESQL(
      `SELECT id, home_club_name, away_club_name, home_player_name, away_player_name,
              status, scheduled_date, tournament_id
         FROM matches
        WHERE status IN ('scheduled', 'live', 'disputed', 'completed')
        ORDER BY COALESCE(scheduled_date, created_date) DESC
        LIMIT 120`,
    ).catch(() => []),
    EXECUTESQL(
      `SELECT id, name, status, product_type, updated_date
         FROM competition_instances
        WHERE status NOT IN ('cancelled', 'archived')
        ORDER BY updated_date DESC
        LIMIT 120`,
    ).catch(() => []),
  ]);

  const audiences = [
    ...(tournaments || []).map((row) => ({
      type: 'tournament',
      id: row.id,
      label: row.name || `Tournament ${row.id}`,
      meta: `${row.participant_type || 'club'} · ${row.status || 'unknown'}`,
    })),
    ...(leagues || []).map((row) => {
      const data = parseDataJson(row);
      const type = row.entity_type === 'competition_season'
        ? 'competition_season'
        : row.entity_type === 'competition'
          ? 'competition'
          : 'regional_league';
      return {
        type,
        id: row.id,
        label: data.name || `${row.entity_type} ${row.id}`,
        meta: data.region || data.status || row.entity_type,
      };
    }),
    ...(instances || []).map((row) => ({
      type: 'competition_instance',
      id: row.id,
      label: row.name || `Competition ${row.id}`,
      meta: `${row.product_type || 'competition'} · ${row.status || 'unknown'}`,
    })),
    ...(matches || []).map((row) => ({
      type: 'match',
      id: row.id,
      label: matchLabel(row),
      meta: row.scheduled_date ? String(row.scheduled_date).slice(0, 16) : (row.status || 'match'),
    })),
  ];

  return { audiences };
}

async function resolveTournamentRecipients(tournamentId) {
  const rows = await EXECUTESQL('SELECT * FROM tournaments WHERE id = ? LIMIT 1', [tournamentId]);
  const tournament = rows[0];
  if (!tournament) {
    return { emails: [], recipients: [], warnings: ['Tournament not found'], label: '' };
  }

  let emails = uniqueEmails([tournament.organizer_email, tournament.creator_email]);
  const playerIds = parseJsonIds(tournament.registered_players);
  const clubIds = parseJsonIds(tournament.registered_clubs);

  if (playerIds.length) {
    emails.push(...await lookupEmailsByPlayerIds(playerIds));
  }
  if (clubIds.length) {
    emails.push(...await listActiveClubPlayerEmails(clubIds));
  }

  return {
    label: tournament.name || tournamentId,
    emails: uniqueEmails(emails),
    recipients: uniqueEmails(emails).map((email) => ({ email, label: email, source: 'tournament' })),
    warnings: uniqueEmails(emails).length ? [] : ['No reachable emails for this tournament'],
  };
}

async function resolveLeagueEntityRecipients(entityType, entityId) {
  const rows = await EXECUTESQL(
    'SELECT id, entity_type, data_json FROM league_entities WHERE id = ? AND entity_type = ? LIMIT 1',
    [entityId, entityType],
  );
  const row = rows[0];
  if (!row) {
    return { emails: [], recipients: [], warnings: ['League/competition not found'], label: '' };
  }
  const data = parseDataJson(row);
  const clubIds = parseJsonIds(data.registered_club_ids);
  let emails = uniqueEmails([data.organizer_email, data.creator_email, data.admin_email]);

  if (clubIds.length) {
    emails.push(...await listActiveClubPlayerEmails(clubIds));
  } else {
    const registrations = await EXECUTESQL(
      `SELECT data_json FROM league_entities
        WHERE entity_type = 'season_registration'
          AND JSON_UNQUOTE(JSON_EXTRACT(data_json, '$.season_id')) = ?
        LIMIT 500`,
      [entityId],
    ).catch(() => []);
    for (const reg of registrations) {
      const regData = parseDataJson(reg);
      if (regData.owner_email) emails.push(regData.owner_email);
      if (regData.club_id) {
        const contact = await resolveClubPresidentContact({ clubId: regData.club_id });
        if (contact?.email) emails.push(contact.email);
      }
    }
  }

  return {
    label: data.name || entityId,
    emails: uniqueEmails(emails),
    recipients: uniqueEmails(emails).map((email) => ({ email, label: email, source: entityType })),
    warnings: uniqueEmails(emails).length ? [] : ['No reachable emails for this league/competition'],
  };
}

async function resolveMatchRecipients(matchId) {
  const rows = await EXECUTESQL('SELECT * FROM matches WHERE id = ? LIMIT 1', [matchId]);
  const match = rows[0];
  if (!match) {
    return { emails: [], recipients: [], warnings: ['Match not found'], label: '' };
  }
  const home = await resolveMatchSideEmails(match, 'home');
  const away = await resolveMatchSideEmails(match, 'away');
  const emails = uniqueEmails([...home, ...away]);
  return {
    label: matchLabel(match),
    emails,
    recipients: emails.map((email) => ({ email, label: email, source: 'match' })),
    warnings: emails.length ? [] : ['No reachable emails for this match'],
  };
}

async function resolveCompetitionInstanceRecipients(instanceId) {
  const rows = await EXECUTESQL(
    'SELECT * FROM competition_instances WHERE id = ? LIMIT 1',
    [instanceId],
  );
  const instance = rows[0];
  if (!instance) {
    return { emails: [], recipients: [], warnings: ['Competition instance not found'], label: '' };
  }

  const participants = await EXECUTESQL(
    `SELECT participant_type, club_id, player_id, user_id, status
       FROM competition_participants
      WHERE competition_instance_id = ?
        AND status IN ('approved', 'active', 'registered', 'pending')`,
    [instanceId],
  ).catch(() => []);

  const emails = [];
  if (instance.created_by_user_id) {
    const users = await EXECUTESQL('SELECT email FROM users WHERE id = ? LIMIT 1', [instance.created_by_user_id]).catch(() => []);
    if (users[0]?.email) emails.push(users[0].email);
  }

  const clubIds = [];
  const playerIds = [];
  for (const row of participants) {
    if (row.club_id) clubIds.push(String(row.club_id));
    if (row.player_id) playerIds.push(String(row.player_id));
    if (row.user_id) {
      const users = await EXECUTESQL('SELECT email FROM users WHERE id = ? LIMIT 1', [row.user_id]).catch(() => []);
      if (users[0]?.email) emails.push(users[0].email);
    }
  }
  if (playerIds.length) emails.push(...await lookupEmailsByPlayerIds(playerIds));
  if (clubIds.length) emails.push(...await listActiveClubPlayerEmails(clubIds));

  if (!participants.length && instance.legacy_source_id) {
    if (instance.legacy_source_type === 'tournament') {
      return resolveTournamentRecipients(instance.legacy_source_id);
    }
    if (instance.legacy_source_type === 'regional_league' || instance.legacy_source_type === 'competition_season') {
      return resolveLeagueEntityRecipients(instance.legacy_source_type, instance.legacy_source_id);
    }
  }

  return {
    label: instance.name || instanceId,
    emails: uniqueEmails(emails),
    recipients: uniqueEmails(emails).map((email) => ({ email, label: email, source: 'competition_instance' })),
    warnings: uniqueEmails(emails).length ? [] : ['No reachable emails for this competition'],
  };
}

async function resolveMailAudience({ type, id }) {
  const key = String(type || '').trim();
  const entityId = String(id || '').trim();
  if (!key || !entityId) {
    return { emails: [], recipients: [], warnings: ['Missing audience type or id'], label: '' };
  }

  if (key === 'tournament') return resolveTournamentRecipients(entityId);
  if (key === 'regional_league' || key === 'competition_season' || key === 'competition') {
    return resolveLeagueEntityRecipients(key === 'competition' ? 'competition' : key, entityId);
  }
  if (key === 'match') return resolveMatchRecipients(entityId);
  if (key === 'competition_instance') return resolveCompetitionInstanceRecipients(entityId);

  return { emails: [], recipients: [], warnings: [`Unknown audience type: ${key}`], label: '' };
}

async function searchMailContacts(query, limit = 15) {
  const q = String(query || '').trim();
  if (q.length < 2) return { contacts: [] };

  const cap = Math.min(Math.max(Number(limit) || 15, 1), 30);
  const like = `%${q.toLowerCase()}%`;

  const rows = await EXECUTESQL(
    `SELECT email, label, avatar_url, player_id, user_id
       FROM (
         SELECT
           LOWER(TRIM(COALESCE(NULLIF(p.email, ''), u.email))) AS email,
           COALESCE(NULLIF(TRIM(p.gamertag), ''), NULLIF(TRIM(u.email), '')) AS label,
           p.avatar_url,
           p.id AS player_id,
           u.id AS user_id
         FROM players p
         LEFT JOIN users u ON u.id = p.user_id
         WHERE (
           LOWER(COALESCE(p.gamertag, '')) LIKE ?
           OR LOWER(COALESCE(p.email, '')) LIKE ?
           OR LOWER(COALESCE(u.email, '')) LIKE ?
         )
         UNION
         SELECT
           LOWER(TRIM(u.email)) AS email,
           COALESCE(NULLIF(TRIM(p.gamertag), ''), TRIM(u.email)) AS label,
           p.avatar_url,
           p.id AS player_id,
           u.id AS user_id
         FROM users u
         LEFT JOIN players p ON p.user_id = u.id
         WHERE LOWER(u.email) LIKE ?
       ) AS hits
      WHERE email IS NOT NULL
        AND email <> ''
        AND email NOT LIKE '%@stage.local'
        AND email NOT LIKE '%@stage.invalid'
      GROUP BY email, label, avatar_url, player_id, user_id
      ORDER BY label ASC
      LIMIT ?`,
    [like, like, like, like, cap],
  ).catch(() => []);

  const contacts = (rows || [])
    .map((row) => ({
      email: normalizeEmail(row.email),
      label: String(row.label || row.email || '').trim() || normalizeEmail(row.email),
      avatar_url: row.avatar_url || null,
      player_id: row.player_id || null,
      user_id: row.user_id || null,
    }))
    .filter((row) => row.email);

  return { contacts };
}

module.exports = {
  listAudiences,
  resolveMailAudience,
  searchMailContacts,
  normalizeEmail,
  uniqueEmails,
};
