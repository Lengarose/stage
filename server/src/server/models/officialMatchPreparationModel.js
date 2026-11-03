'use strict';
const crypto=require('crypto');
const {unpack}=require('../lib/regionalEditionIdentity');
function preparationId(matchId) {const h=crypto.createHash('sha256').update(`official_match_preparation:${matchId}`).digest('hex');return `${h.slice(0,8)}-${h.slice(8,12)}-${h.slice(12,16)}-${h.slice(16,20)}-${h.slice(20,32)}`;}
// Internal transactional lifecycle evidence; deliberately has no generic CRUD route.
class OfficialMatchPreparationModel {
  async selectOne(matchId,q) {const [row]=await q("SELECT * FROM league_entities WHERE entity_type='official_match_preparation' AND id=? FOR UPDATE",[preparationId(matchId)]);return row?unpack(row):null;}
  async save(record,q) {await q("INSERT INTO league_entities (id,entity_type,data_json) VALUES (?,'official_match_preparation',?) ON DUPLICATE KEY UPDATE data_json=VALUES(data_json),updated_date=NOW()",[preparationId(record.match_id),JSON.stringify({...record,id:preparationId(record.match_id)})]);}
  async notifyOpponent(match,clubId,eventId,q) {
    const opponent=match.home_club_id===clubId?match.away_club_id:match.home_club_id;
    const contacts=await q('SELECT COALESCE(u.email,c.owner_email) AS email FROM clubs c LEFT JOIN users u ON u.id=COALESCE(c.president_user_id,c.user_id) WHERE c.id=?',[opponent]);
    const emails=[...new Set(contacts.map(r=>String(r.email || '').trim().toLowerCase()).filter(Boolean))];
    if(!emails.length)throw Object.assign(Error('Opponent contact is unavailable; the reserve change was not saved'),{status:409});
    for(const email of emails)await q('INSERT INTO notifications (id,recipient_email,type,title,body,link,related_id,idempotency_key) VALUES (?,?,?,?,?,?,?,?)',[crypto.randomUUID(),email,'match_lineup_changed','Official reserve change','Your opponent changed their previously declared selection before kickoff. Review the updated preparation before kickoff.',`/game-day?match=${match.id}`,match.id,`lineup:${crypto.createHash('sha256').update(`${eventId}:${email}`).digest('hex')}`]);
  }
}
module.exports={OfficialMatchPreparationModel};
