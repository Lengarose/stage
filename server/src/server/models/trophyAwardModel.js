'use strict';
const {EXECUTESQL}=require('../db/database');
const crypto=require('crypto');
class TrophyAwardModel {
  async create(data,query=EXECUTESQL) {
    const key=[data.owner_type,data.owner_id,data.trophy_item_id,data.source_type,data.source_id,data.edition_id].join(':');
    const hex=crypto.createHash('sha256').update(key).digest('hex');
    const id=`${hex.slice(0,8)}-${hex.slice(8,12)}-${hex.slice(12,16)}-${hex.slice(16,20)}-${hex.slice(20,32)}`;
    const role=data.award_role||(data.owner_type==='club'?'club_champion':data.winning_club_id?'associated_player':'player_champion');
    const awardKey=crypto.createHash('sha256').update([data.owner_type,data.owner_id,data.source_type,data.source_id,data.edition_id,role].join(':')).digest('hex');
    await query("INSERT INTO trophy_awards (id,owner_id,owner_type,trophy_item_id,source_type,source_id,edition_id,winning_club_id,status,award_key,award_role,metadata_json) VALUES (?,?,?,?,?,?,?,?,'earned',?,?,?) ON DUPLICATE KEY UPDATE award_key=COALESCE(award_key,VALUES(award_key)),award_role=COALESCE(award_role,VALUES(award_role)),metadata_json=COALESCE(metadata_json,VALUES(metadata_json))",[id,data.owner_id,data.owner_type,data.trophy_item_id||null,data.source_type,data.source_id,data.edition_id,data.winning_club_id||null,awardKey,role,data.metadata_json?JSON.stringify(data.metadata_json):null]);
    const [record]=await query('SELECT * FROM trophy_awards WHERE award_key=?',[awardKey]);
    return record?.id||id;
  }
  selectOne(id,query=EXECUTESQL){return query('SELECT * FROM trophy_awards WHERE id=?',[id]);}
  selectAll(filters={},query=EXECUTESQL) {
    const where=[],values=[];
    for(const k of ['owner_id','owner_type','trophy_item_id','source_type','source_id','edition_id','status'])if(filters[k]!=null){where.push(`${k}=?`);values.push(String(filters[k]));}
    return query(`SELECT * FROM trophy_awards${where.length?' WHERE '+where.join(' AND '):''} ORDER BY created_date,id`,values);
  }
  update(id,data,query=EXECUTESQL){return query('UPDATE trophy_awards SET status=?,revoked_reason=?,revoked_at=NOW() WHERE id=?',[data.status,data.revoked_reason,id]);}
  delete(){throw new Error('Earned trophy evidence is retained; use audited revocation');}
}
module.exports=TrophyAwardModel;
