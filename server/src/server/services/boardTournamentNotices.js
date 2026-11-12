'use strict';

const {
  stableId
} = require('../models/clubBoardModel');
const parse = v => typeof v === 'string' ? JSON.parse(v) : v;
async function reconcile(q) {
  const tournaments = await q("SELECT t.* FROM tournaments t WHERE t.participant_type='club' AND t.club_rules IS NOT NULL AND EXISTS (SELECT 1 FROM users u WHERE u.role_id IN (0,2) AND (u.id=t.creator_id OR u.email=t.creator_email OR u.email=t.organizer_email))");
  let stored = 0;
  for (const t of tournaments) for (const [clubId, proof] of Object.entries(parse(t.registration_proofs || '{}').club || {})) {
    if (!proof.club_rules_revision || !['pending', 'approved', 'rejected'].includes(proof.status)) continue;
    const id = stableId(['board_tournament_notice', t.id, clubId, proof.submitted_at, proof.status]);
    if ((await q("SELECT id FROM league_entities WHERE entity_type='board_tournament_delivery' AND id=? FOR UPDATE", [id])).length) continue;
    const [club] = await q('SELECT name,president_user_id,user_id,owner_email FROM clubs WHERE id=?', [clubId]);
    if (!club) continue;
    const [user] = await q('SELECT email FROM users WHERE id=?', [club.president_user_id || club.user_id]);
    const email = user?.email || club.owner_email;
    if (!email) continue;
    const status = proof.status === 'approved' ? 'confirmed' : proof.status === 'pending' ? 'awaiting approval' : 'declined';
    const body = `Dear Manager,\n\nYour club’s registration for ${t.name} is ${status}.${proof.status === 'approved' ? ' Your club is included in the event.' : proof.status === 'pending' ? ' Your application has been received; it is not yet a confirmed place.' : ' This entry has not been accepted.'}\n\nThis STAGE tournament is an opportunity to enjoy playing together. There are no Club Board performance objectives attached, and tournament results do not affect management salary or progression XP.\n\nRead the rules and published schedule at /tournaments/${t.id}. ${t.start_date ? `The published start is ${t.start_date}; check the event for your local time.` : ''} The Manager confirms the playing squad in GameDay before kickoff.\n\nGood luck to you and your squad. We look forward to seeing your club represent itself with pride.\n\nThe Club Board`;
    await q("INSERT INTO inbox_messages (id,recipient_email,sender_email,sender_gamertag,subject,body,message_type,action_type,related_entity_id,related_entity_type,idempotency_key,is_system) VALUES (?,?,?,'Club Board',?,?,'general','none',?,'tournament',?,1) ON DUPLICATE KEY UPDATE id=id", [id, email, 'system@stage.com', `Your STAGE tournament entry — ${t.name}`, body, t.id, `board_tournament:${id}`]);
    await q("INSERT INTO league_entities (id,entity_type,status,data_json) VALUES (?,'board_tournament_delivery','sent',?) ON DUPLICATE KEY UPDATE id=id", [id, JSON.stringify({
      tournament_id: t.id,
      club_id: clubId,
      registration_status: proof.status
    })]);
    stored++;
  }
  return {
    stored
  };
}
module.exports = {
  reconcile
};
