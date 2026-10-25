'use strict';
const {EXECUTESQL,withTransaction}=require('../db/database');
const DAY=86400000;
function archiveDue(t,now=Date.now()) {const stamp=t.completed_at?new Date(t.completed_at).getTime():NaN;return t.status==='completed'&&Number.isFinite(stamp)&&stamp+7*DAY<=now;}
async function archive(id,{admin,reason='Completed tournament removed from active listing',query}={}) {
  const action=async q=>{
    const [t]=await q('SELECT * FROM tournaments WHERE id=? FOR UPDATE',[id]);
    if(!t)throw Object.assign(new Error('Tournament not found'),{status:404});
    if(!['completed','archived'].includes(t.status))throw Object.assign(new Error('Only completed tournaments can be archived'),{status:409});
    if(t.status==='archived')return {success:true,archived:true};
    const award=require('./trophyAwardService'),player=t.participant_type==='player';
    const established=await new (require('../models/trophyAwardModel'))().selectAll({source_type:'tournament',source_id:id},q);
    let awardError=null;
    if(!established.some(a=>require('../lib/trophyHistory').durable(a)&&a.owner_type===(player?'player':'club')&&a.owner_id===(player?t.winner_player_id:t.winner_club_id)))try {
      await award[player?'awardPlayerOnlyTrophy':'awardClubTrophyToClubAndPlayers']({clubId:t.winner_club_id,playerId:t.winner_player_id,trophyItemId:t.trophy_item_id,tournamentId:id,tournament:{...t,_historical_backfill:true},query:q});
    }catch(error){awardError=error.message;await q('UPDATE tournaments SET archive_review_required=1 WHERE id=?',[id]);}
    await q("UPDATE tournaments SET status='archived',archived_at=NOW(),updated_date=NOW() WHERE id=?",[id]);
    if(admin)await require('./rewardConfigurationService').audit(q,admin,'archive_tournament','tournament',id,t,{...t,status:'archived'},reason);
    return {success:true,archived:true,deleted:false,archive_review_required:!!awardError,award_error:awardError};
  };
  return query?action(query):withTransaction(action);
}
async function tick() {
  const rows=await EXECUTESQL("SELECT * FROM tournaments WHERE status='completed'");
  for(const t of rows) {
    if(!t.completed_at){await EXECUTESQL('UPDATE tournaments SET archive_review_required=1 WHERE id=?',[t.id]);continue;}
    if(archiveDue(t))try{await archive(t.id);}catch(e){console.error('[tournament archive]',t.id,e.message);await EXECUTESQL('UPDATE tournaments SET archive_review_required=1 WHERE id=?',[t.id]);}
  }
}
function start() {let running=false;const run=async()=>{if(running)return;running=true;try{await tick();}catch(e){console.error('[tournament archive]',e.message);}finally{running=false;}};const timer=setInterval(run,60000);timer.unref();run();return timer;}
async function list(input={},query=EXECUTESQL) {
  const where=["status='archived'"],values=[];
  if(input.search){where.push('name LIKE ?');values.push(`%${String(input.search).slice(0,150)}%`);}
  for(const field of ['type','organizer_email'])if(input[field]){where.push(`${field}=?`);values.push(String(input[field]));}
  if(input.year){where.push('YEAR(completed_at)=?');values.push(Number(input.year));}
  const limit=Math.max(1,Math.min(Number(input.limit)||20,100)),offset=Math.max(0,Number(input.offset)||0);
  const [total]=await query(`SELECT COUNT(*) AS total FROM tournaments WHERE ${where.join(' AND ')}`,values);
  const items=await query(`SELECT * FROM tournaments WHERE ${where.join(' AND ')} ORDER BY completed_at DESC,id LIMIT ? OFFSET ?`,[...values,limit,offset]);
  const states=await query("SELECT * FROM league_entities WHERE entity_type='competition_settlement'");
  for(const item of items) {
    const parse=require('../lib/trophyHistory').parse;
    const state=states.map(row=>parse(row.data_json)).find(data=>data.source_type==='tournament'&&data.source_id===item.id);
    item.prize_settlement_state=state?.state||'Not reviewed';
    const awards=await new (require('../models/trophyAwardModel'))().selectAll({source_type:'tournament',source_id:item.id,status:'earned'},query);
    const award=awards.find(row=>row.award_role!=='associated_player'&&require('../lib/trophyHistory').durable(row));
    const details=parse(award?.metadata_json);
    if(!item.runner_up_club_name&&!item.runner_up_player_name&&details.runner_up_name)item[item.participant_type==='player'?'runner_up_player_name':'runner_up_club_name']=details.runner_up_name;
    item.historical_trophy=award?{display_name:details.display_name,image_url:details.image_url,edition_label:details.edition_label}:null;
  }
  return {items,total:Number(total?.total||0),limit,offset};
}
module.exports={archive,archiveDue,tick,start,list};
