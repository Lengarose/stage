'use strict';
const crypto=require('crypto');
const {unpack}=require('../lib/regionalEditionIdentity');
const {OfficialScheduleModel}=require('./officialScheduleModel');
const {resolveClubPresidentContact}=require('../services/clubContactService');
const {parseMaybeJson,resolveDelivery}=require('../services/notificationPreferenceService');
const noticeId=(calendar,club)=>{const h=crypto.createHash('sha256').update(JSON.stringify(['regional_calendar_notice',calendar,club])).digest('hex');return `${h.slice(0,8)}-${h.slice(8,12)}-${h.slice(12,16)}-${h.slice(16,20)}-${h.slice(20,32)}`;};
class RegionalCalendarModel extends OfficialScheduleModel {
  async cycle(id,q) {const [row]=await q("SELECT * FROM league_entities WHERE entity_type='regional_cycle' AND id=? FOR UPDATE",[id]);return row?unpack(row):null;}
  async editions(q) {return (await q("SELECT * FROM league_entities WHERE entity_type='regional_league' ORDER BY id FOR UPDATE")).map(unpack);}
  async fixtures(ids,q) {return (await q(`SELECT * FROM league_entities WHERE entity_type='regional_league_fixture' AND league_id IN (${ids.map(()=>'?').join(',')}) ORDER BY id FOR UPDATE`,ids)).map(unpack);}
  async selections(matchIds,q) {
    if(!matchIds.length)return [];
    return q(`SELECT id,data_json FROM league_entities WHERE entity_type IN ('official_match_selection','official_match_preparation') AND JSON_UNQUOTE(JSON_EXTRACT(data_json,'$.match_id')) IN (${matchIds.map(()=>'?').join(',')}) ORDER BY id FOR UPDATE`,matchIds);
  }
  async published(id,q) {const [row]=await q("SELECT * FROM league_entities WHERE entity_type='regional_calendar' AND id=? FOR UPDATE",[id]);return row?unpack(row):null;}
  async save(record,user,reason,q) {
    await q("INSERT INTO league_entities (id,entity_type,data_json) VALUES (?,'regional_calendar',?)",[record.id,JSON.stringify(record)]);
    await q('INSERT INTO admin_audit_log (id,admin_user_id,admin_email,action,entity_type,entity_id,old_value,new_value,reason) VALUES (?,?,?,?,?,?,?,?,?)',[crypto.randomUUID(),user.id,user.email,'publish_regional_calendar','regional_calendar',record.id,'null',JSON.stringify(record),reason]);
  }
  async summary(clubs,record,q) {
    const summary={version:'regional_calendar_notice_v1',stored:0,muted:0},settings=new Map();
    for(const club of clubs) {
      const editions=[...new Set(record.entries.filter(e=>[e.home_club_id,e.away_club_id].includes(club)).map(e=>e.edition_id))];
      if(editions.length!==1 || !record.edition_ids.includes(editions[0]))throw Object.assign(Error('Calendar club assignment needs review; calendar was not published'),{status:409});
      const contact=await resolveClubPresidentContact({clubId:club,query:q,forUpdate:true});
      if(!contact.email)throw Object.assign(Error('Competition contacts are unavailable; calendar was not published'),{status:409});
      if(!settings.has(contact.email)) {
        const [row]=await q('SELECT notification_settings FROM players WHERE LOWER(email)=LOWER(?) LIMIT 1 FOR UPDATE',[contact.email]);
        settings.set(contact.email,parseMaybeJson(row?.notification_settings,{}));
      }
      if(!resolveDelivery(settings.get(contact.email),'match_reminders').inApp){summary.muted++;continue;}
      const edition=editions[0],encoded=encodeURIComponent(edition),season=`${record.reset_series?`Series ${record.reset_series} · `:''}Season ${record.season_number}`;
      await q('INSERT INTO notifications (id,recipient_email,type,title,body,link,related_id,idempotency_key) VALUES (?,?,?,?,?,?,?,?)',[
        noticeId(record.id,club),contact.email,'match_scheduled','Regional season calendar published',
        `${contact.club?.name || 'Your club'} · ${record.region_slug} · ${season}: 38 rounds from the week of ${record.start_monday} (${record.timezone}). Open your edition's stages to review the published kickoff times and prepare your selections.`,
        `/leagues/${encoded}?season=${encoded}&tab=stages`,edition,`calendar:${record.id}:club:${club}`]);
      summary.stored++;
    }
    return summary;
  }
}
module.exports={RegionalCalendarModel};
