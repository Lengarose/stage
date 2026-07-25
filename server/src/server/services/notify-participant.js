/**
 * Resolve a competition_participants row into a recipient + tournament name and
 * fire the assigned / unassigned email. Kept in its own module so server.js can
 * lazy-require it and the mailer stays fire-and-forget.
 */
const { EXECUTESQL } = require('../db/database');
const { notifyTournamentAssigned, notifyTournamentUnassigned } = require('./notifications');

async function resolveRecipientAndTournament(row) {
  let email = null;
  let name = null;
  if (row.player_id) {
    const p = await EXECUTESQL('SELECT gamertag, email FROM players WHERE id = ? LIMIT 1', [row.player_id]);
    email = p[0]?.email || null;
    name = p[0]?.gamertag || null;
  }
  if (!email && row.club_id) {
    const c = await EXECUTESQL('SELECT name, owner_email FROM clubs WHERE id = ? LIMIT 1', [row.club_id]);
    email = c[0]?.owner_email || null;
    name = name || c[0]?.name || null;
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
  if (email) notifyTournamentAssigned({ to: email, name, tournament });
}

async function participantUnassigned(row) {
  const { email, name, tournament } = await resolveRecipientAndTournament(row);
  if (email) notifyTournamentUnassigned({ to: email, name, tournament });
}

module.exports = { participantAssigned, participantUnassigned };
