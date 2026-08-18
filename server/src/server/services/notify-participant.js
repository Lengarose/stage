/**
 * Resolve a competition_participants row into a recipient + tournament name and
 * fire the assigned / unassigned email. Kept in its own module so server.js can
 * lazy-require it and the mailer stays fire-and-forget.
 */
const { EXECUTESQL } = require('../db/database');
const { createNotificationIfEnabled } = require('./messageDeliveryService');
const { resolveClubPresidentContact } = require('./clubContactService');

async function resolveRecipientAndTournament(row) {
  let email = null;
  let name = null;
  if (row.player_id) {
    const p = await EXECUTESQL('SELECT gamertag, email FROM players WHERE id = ? LIMIT 1', [row.player_id]);
    email = p[0]?.email || null;
    name = p[0]?.gamertag || null;
  }
  if (!email && row.club_id) {
    const contact = await resolveClubPresidentContact({ clubId: row.club_id });
    email = contact.email;
    name = name || contact.club?.name || null;
  }
  if (!email && row.user_id) {
    const u = await EXECUTESQL('SELECT email FROM users WHERE id = ? LIMIT 1', [row.user_id]);
    email = u[0]?.email || null;
  }

  let tournament = null;
  if (row.competition_instance_id) {
    const ci = await EXECUTESQL('SELECT name FROM competition_instances WHERE id = ? LIMIT 1', [row.competition_instance_id]);
    tournament = ci[0]?.name || null;
  }
  return { email, name, tournament };
}

async function participantAssigned(row) {
  const { email, name, tournament } = await resolveRecipientAndTournament(row);
  if (!email) return;
  const comp = tournament || 'a competition';
  await createNotificationIfEnabled({
    recipientEmail: email,
    type: 'tournament_start',
    title: `You've been added to ${comp}`,
    body: `${name || 'You'} have been assigned to ${comp}. Check your fixtures and get ready to compete.`,
    link: '/competitions',
    relatedId: row.id || row.competition_instance_id || null,
  });
}

async function participantUnassigned(row) {
  const { email, name, tournament } = await resolveRecipientAndTournament(row);
  if (!email) return;
  const comp = tournament || 'a competition';
  await createNotificationIfEnabled({
    recipientEmail: email,
    type: 'tournament_complete',
    title: `You've been removed from ${comp}`,
    body: `${name || 'You'} are no longer assigned to ${comp}. If you think this is a mistake, contact an admin.`,
    link: '/competitions',
    relatedId: row.id || row.competition_instance_id || null,
  });
}

module.exports = { participantAssigned, participantUnassigned };
