'use strict';

const { stableId } = require('../models/clubBoardModel');
const parse = value => typeof value === 'string' ? JSON.parse(value) : value;

// Called inside the entry/review transaction; the worker retries older entries.
async function deliver(tournament, clubId, proof, q) {
  const status = proof?.status === 'declined' ? 'rejected' : proof?.status;
  if (!['pending', 'approved', 'rejected'].includes(status)) return { stored: 0 };
  const [club] = await q('SELECT name,president_user_id,user_id,owner_email FROM clubs WHERE id=?', [clubId]);
  if (!club) return { stored: 0 };
  const users = await q('SELECT id,email FROM users WHERE id IN (?,?)', [club.president_user_id || null, club.user_id || null]);
  const managerEmail = users.find(user => user.id === club.president_user_id)?.email || users.find(user => user.id === club.user_id)?.email || users[0]?.email || club.owner_email;
  const recipients = [managerEmail];
  if (status === 'approved') {
    const players = await q(`SELECT DISTINCT COALESCE(NULLIF(TRIM(u.email),''),NULLIF(TRIM(p.email),'')) AS email
      FROM players p LEFT JOIN users u ON u.id=p.user_id
      LEFT JOIN club_memberships cm ON cm.player_id=p.id AND cm.status='active'
      WHERE p.club_id=? OR cm.club_id=?`, [clubId, clubId]);
    recipients.push(...players.map(player => player.email));
  }
  let stored = 0;
  for (const email of [...new Set(recipients.filter(Boolean).map(value => String(value).trim().toLowerCase()))]) {
    const key = ['board_tournament_notice', tournament.id, clubId, proof.submitted_at, status];
    if (email !== String(managerEmail || '').trim().toLowerCase()) key.push(email);
    const id = stableId(key);
    if ((await q("SELECT id FROM league_entities WHERE entity_type='board_tournament_delivery' AND id=? FOR UPDATE", [id])).length) continue;
    const state = status === 'approved' ? 'confirmed' : status === 'pending' ? 'awaiting approval' : 'declined';
    const body = `Dear ${status === 'approved' ? 'Manager and players' : 'Manager'},\n\n${club.name}’s registration for ${tournament.name} is ${state}. ${status === 'approved' ? 'Your place is confirmed, and we are delighted to see your squad taking part.' : status === 'pending' ? 'Your application has been received. Please wait for the organizer’s decision before treating your place as confirmed.' : 'This entry has not been accepted. Review the organizer’s decision in the tournament.'}\n\nTournament: ${tournament.name}\nPlatform: ${tournament.platform || 'See tournament details'}\n${tournament.start_date ? `Published start: ${tournament.start_date}\n` : ''}Review the published schedule and rules, including your local match times, at /tournaments/${tournament.id}.\n\nTournament results do not affect management salary or Card XP, and this event has no Club Board performance objectives. ${status === 'approved' ? 'Before each kickoff, your Manager selects the participating players in GameDay → Match Squad. Players do not need to register availability separately.' : ''}\n\n${status === 'rejected' ? 'We hope to see your club in a future event.' : 'Good luck to the whole squad. Play with pride, enjoy the competition, and give your supporters something to cheer about.'}\n\nThe Club Board`;
    await q("INSERT INTO inbox_messages (id,recipient_email,sender_email,sender_gamertag,subject,body,message_type,action_type,related_entity_id,related_entity_type,idempotency_key,is_system) VALUES (?,?,?,'Club Board',?,?,'general','none',?,'tournament',?,1) ON DUPLICATE KEY UPDATE id=id", [id, email, 'system@stage.com', `Your tournament entry — ${tournament.name}`, body, tournament.id, `board_tournament:${id}`]);
    await q("INSERT INTO league_entities (id,entity_type,status,data_json) VALUES (?,'board_tournament_delivery','sent',?) ON DUPLICATE KEY UPDATE id=id", [id, JSON.stringify({ tournament_id: tournament.id, club_id: clubId, registration_status: status, recipient_email: email })]);
    stored++;
  }
  return { stored };
}

async function reconcile(q) {
  const tournaments = await q("SELECT t.* FROM tournaments t WHERE t.participant_type='club' AND t.status IN ('registration','in_progress') AND t.registration_proofs IS NOT NULL");
  let stored = 0;
  for (const tournament of tournaments) {
    const proofs = parse(tournament.registration_proofs || '{}').club || {};
    for (const [clubId, proof] of Object.entries(proofs)) {
      stored += (await deliver(tournament, clubId, proof, q)).stored;
    }
  }
  return { stored };
}
module.exports = { deliver, reconcile };
