'use strict';
const crypto=require('crypto');
const {unpack}=require('../lib/regionalEditionIdentity');
const Match=require('./matchModel');
class OfficialScheduleModel {
  async lock(q) {
    await q("INSERT INTO league_entities (id,entity_type,data_json) VALUES ('official-calendar-write-lock','official_calendar_lock','{}') ON DUPLICATE KEY UPDATE id=id");
    await q("SELECT id FROM league_entities WHERE id='official-calendar-write-lock' FOR UPDATE");
  }
  async events(clubs,q) {
    const marks=clubs.map(()=>'?').join(','),values=[...clubs,...clubs];
    const matches=await q(`SELECT * FROM matches WHERE (home_club_id IN (${marks}) OR away_club_id IN (${marks})) ORDER BY id FOR UPDATE`,values);
    const engines=await q(`SELECT * FROM competition_fixtures WHERE (home_club_id IN (${marks}) OR away_club_id IN (${marks})) ORDER BY id FOR UPDATE`,values);
    const fixtures=(await q(`SELECT * FROM league_entities WHERE entity_type IN ('regional_league_fixture','competition_fixture') AND (JSON_UNQUOTE(JSON_EXTRACT(data_json,'$.home_club_id')) IN (${marks}) OR JSON_UNQUOTE(JSON_EXTRACT(data_json,'$.away_club_id')) IN (${marks})) ORDER BY id FOR UPDATE`,values)).map(unpack);
    return {matches,engines,fixtures};
  }

  async actor(id,q) {return (await q('SELECT id,email,role_id,timezone FROM users WHERE id=? FOR UPDATE',[id]))[0];}
  async hasKickoff(id,q) {return (await q("SELECT id FROM league_entities WHERE entity_type='official_match_selection' AND JSON_UNQUOTE(JSON_EXTRACT(data_json,'$.match_id'))=? LIMIT 1 FOR UPDATE",[id])).length>0;}
  async createMatch(row,q) {const model=new Match(row);await model.create(q);return {...row,id:model.id};}
  async updateMatch(row,q) {await q("UPDATE matches SET scheduled_date=?,confirmed_date=?,timezone=?,status='scheduled',scheduling_status='confirmed',updated_date=NOW() WHERE id=?",[row.scheduled_date,row.confirmed_date,row.timezone,row.id]);}
  async saveFixture(row,q) {await q("UPDATE league_entities SET data_json=?,status=?,scheduling_status=?,updated_date=NOW() WHERE entity_type='regional_league_fixture' AND id=?",[JSON.stringify(row),row.status,row.scheduling_status,row.id]);}
  async saveEngine(row,q) {await q("UPDATE competition_fixtures SET match_id=?,scheduled_at=?,confirmed_at=?,status='scheduled',scheduling_status='confirmed',updated_date=NOW() WHERE id=?",[row.match_id,row.scheduled_at,row.confirmed_at,row.id]);}
  async clashes(match,q) {return q("SELECT * FROM matches WHERE id<>? AND (home_club_id IN (?,?) OR away_club_id IN (?,?)) AND status IN ('scheduled','confirmed','in_progress') FOR UPDATE",[match.id,match.home_club_id,match.away_club_id,match.home_club_id,match.away_club_id]);}
  async audit(ctx,user,before,after,reason,q) {
    const id=crypto.randomUUID();
    await q('INSERT INTO fixture_admin_actions (id,fixture_id,fixture_type,action_type,performed_by,performed_by_name,home_club_id,away_club_id,payload,admin_note) VALUES (?,?,?,?,?,?,?,?,?,?)',[id,ctx.engine?.legacy_fixture_id || ctx.sourceFixture?.id || ctx.engine?.id,ctx.sourceFixture?'regional_league':'regional_pathway',ctx.calendar?'publish_calendar':'force_schedule',user.id,user.email,after.match.home_club_id,after.match.away_club_id,JSON.stringify({before,after}),reason]);
    return {id,action_type:ctx.calendar?'publish_calendar':'force_schedule'};
  }
  async notify(match,revision,q) {
    const contacts=await q('SELECT COALESCE(u.email,c.owner_email) AS email FROM clubs c LEFT JOIN users u ON u.id=COALESCE(c.president_user_id,c.user_id) WHERE c.id IN (?,?)',[match.home_club_id,match.away_club_id]);
    const emails=[...new Set(contacts.map(r=>String(r.email || '').trim().toLowerCase()).filter(Boolean))];
    if(contacts.length!==2 || contacts.some(r=>!String(r.email || '').trim()))throw Object.assign(Error('Competition contacts are unavailable; schedule was not saved'),{status:409});
    for(const email of emails)await q('INSERT INTO notifications (id,recipient_email,type,title,body,link,related_id,idempotency_key) VALUES (?,?,?,?,?,?,?,?)',[crypto.randomUUID(),email,'match_scheduled','Official match scheduled',`${match.scheduled_date} (${match.timezone}). Review the updated time and publish/confirm your selection again if the time changed.`,`/game-day?match=${match.id}`,match.id,`schedule:${crypto.createHash('sha256').update(`${revision}:${email}`).digest('hex')}`]);
  }
}
module.exports={OfficialScheduleModel};
