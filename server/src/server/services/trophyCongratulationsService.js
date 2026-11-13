'use strict';

const {
  stableId
} = require('../models/clubBoardModel');
const VERSION = 'trophy_congratulations_v1';
const parse = v => typeof v === 'string' ? JSON.parse(v) : v;
async function deliver(award, q) {
  const [stored]=await q('SELECT * FROM trophy_awards WHERE id=? FOR UPDATE',[award.id]);
  if(!stored)return {skipped:true};
  award=stored;
  const details = parse(award.metadata_json || '{}');
  if (award.status !== 'earned' || details.congratulations_policy_version !== VERSION) return {
    skipped: true
  };
  const deliveryId = stableId([VERSION, award.id]);
  if ((await q("SELECT id FROM league_entities WHERE entity_type='trophy_congratulations_delivery' AND id=? FOR UPDATE", [deliveryId])).length) return {
    already_delivered: true
  };
  let recipient, cabinet;
  if (award.owner_type === 'club') {
    const [club] = await q('SELECT * FROM clubs WHERE id=?', [award.owner_id]);
    if (!club) return {
      skipped: true
    };
    const [user] = await q('SELECT email FROM users WHERE id=?', [club.president_user_id || club.user_id]);
    recipient = user?.email || club.owner_email;
    cabinet = `/clubs/${club.id}?tab=trophies`;
  } else {
    const [player] = await q('SELECT email FROM players WHERE id=?', [award.owner_id]);
    recipient = player?.email;
    cabinet = `/players/${award.owner_id}?tab=trophies`;
  }
  if (!recipient) return {
    skipped: true
  };
  const id = stableId([VERSION, award.id, recipient]);
  const subject = `Champions — ${details.competition_name || 'your competition'}`;
  const body = `Congratulations!\n\n${details.winning_name || 'Your team'} has won ${details.competition_name || 'the competition'}${details.edition_label ? ` — ${details.edition_label}` : ''}. Every result, every contribution and all the work behind the scenes helped make this achievement possible. Take a moment to celebrate with your teammates and Manager.\n\n${award.owner_type === 'club' ? 'The club’s championship honour' : 'Your personal championship honour'} has been recorded.${award.trophy_item_id ? ' Your earned trophy copy is now available in the trophy collection. Open the cabinet in Edit mode to choose its place on the shelf.' : ' A display design has not yet been assigned; the honour is recorded, but no displayable trophy copy is promised.'}\n\nTrophy cabinet: ${cabinet}\n${details.archive_path ? `Results: ${details.archive_path}\n` : ''}\nHere’s to filling that cabinet, one earned victory at a time. Thank you for being part of STAGE.\n\nThe Club Board`;
  await q("INSERT INTO inbox_messages (id,recipient_email,sender_email,sender_gamertag,subject,body,message_type,action_type,related_entity_id,related_entity_type,metadata,idempotency_key,is_system) VALUES (?,?,?,'Club Board',?,?,'general','none',?,'trophy_award',?,?,1) ON DUPLICATE KEY UPDATE id=id", [id, recipient, 'system@stage.com', subject, body, award.id, JSON.stringify({
    award_id: award.id,
    cabinet_link: cabinet,
    results_link: details.archive_path || null
  }), `${VERSION}:${award.id}:${recipient}`]);
  await q("INSERT INTO league_entities (id,entity_type,status,data_json) VALUES (?,'trophy_congratulations_delivery','sent',?) ON DUPLICATE KEY UPDATE id=id", [deliveryId, JSON.stringify({
    award_id: award.id,
    message_id: id,
    recipient_email: recipient,
    status: 'sent'
  })]);
  return {
    delivered: true,
    id
  };
}
module.exports = {
  VERSION,
  deliver
};
