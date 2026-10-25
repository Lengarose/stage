'use strict';
const {EXECUTESQL}=require('../db/database');
const {parse}=require('../lib/trophyHistory');
function types(scope) {if(!['regional','gost','all'].includes(scope))throw Object.assign(new Error('Invalid history scope'),{status:400});return scope==='regional'?['regional_league']:scope==='gost'?['competition_season']:['regional_league','competition_season'];}
async function preview(scope,query=EXECUTESQL,lock=false) {
  const kinds=types(scope),marks=kinds.map(()=>'?').join(',');
  const awards=await query(`SELECT * FROM trophy_awards WHERE source_type IN (${marks}) AND status='earned'${lock?' FOR UPDATE':''}`,kinds);
  const placements=await query('SELECT * FROM trophy_placements');
  const editions=await query(`SELECT * FROM league_entities WHERE entity_type IN (${marks})${lock?' FOR UPDATE':''}`,kinds);
  const achievementTypes=scope==='regional'?['regional_league','regional_league_fixture']:scope==='gost'?['competition','competition_season','competition_fixture','official_competition']:['regional_league','regional_league_fixture','competition','competition_season','competition_fixture','official_competition'];
  const placeholders=achievementTypes.map(()=>'?').join(',');
  const clubAchievements=await query(`SELECT id FROM club_achievements WHERE source_type IN (${placeholders})`,achievementTypes);
  const playerAchievements=await query(`SELECT id FROM player_achievements WHERE source_type IN (${placeholders})`,achievementTypes);
  const owners=[...new Set([...awards.map(a=>`${a.owner_type}:${a.owner_id}`),...editions.map(e=>parse(e.data_json).winner_club_id).filter(Boolean).map(id=>`club:${id}`)])];
  const titleCounts=[];
  for(const owner of owners) {
    const [ownerType,ownerId]=owner.split(':');
    const report=await require('./trophyEntitlementService').review(ownerId,ownerType,query);
    titleCounts.push({owner,before:report.titles,after:require('../lib/trophyHistory').titleSummary(report.awards.filter(a=>!kinds.includes(a.source_type)))});
  }
  const revision=require('crypto').createHash('sha256').update(JSON.stringify({scope,awards:awards.map(a=>[a.id,a.status,a.metadata_json]).sort(),editions:editions.map(e=>[e.id,e.data_json]).sort(),placements:placements.filter(p=>awards.some(a=>a.id===p.award_id)).map(p=>[p.id,p.award_id,p.locked_at]).sort(),clubAchievements:clubAchievements.map(a=>a.id).sort(),playerAchievements:playerAchievements.map(a=>a.id).sort()})).digest('hex');
  return {scope,revision,award_count:awards.length,placement_count:placements.filter(p=>awards.some(a=>a.id===p.award_id)).length,club_achievement_count:clubAchievements.length,player_achievement_count:playerAchievements.length,title_counts:titleCounts,affected_owners:owners,awards,editions:editions.map(e=>({id:e.id,type:e.entity_type,winner_club_id:parse(e.data_json).winner_club_id,season_number:parse(e.data_json).season_number})),financial_reversal:false};
}
async function revoke(scope,query,admin,reason) {
  const before=await preview(scope,query);
  for(const award of before.awards) {
    await new (require('../models/trophyAwardModel'))().update(award.id,{status:'revoked',revoked_reason:'[history-reset] '+reason},query);
  }
  // Locked placements are retained as audit evidence but excluded from all active displays.
  await require('./rewardConfigurationService').audit(query,admin,'revoke_competition_history','league_history',scope,before,{revoked_awards:before.award_count,financial_reversal:false},reason);
  return {revoked_awards:before.award_count,hidden_placements:before.placement_count};
}
async function refreshCaches(query=EXECUTESQL,clubId=null) {
  const players=await query(`SELECT id,club_id FROM players${clubId?' WHERE club_id=?':''}`,clubId?[clubId]:[]);
  const counts=new Map();
  for(const player of players) {
    if(player.club_id&&!counts.has(player.club_id))counts.set(player.club_id,(await require('./trophyEntitlementService').review(player.club_id,'club',query)).titles.official_ranking);
    await query('UPDATE players SET ranking_competition_wins=? WHERE id=?',[counts.get(player.club_id)||0,player.id]);
  }
}
module.exports={preview,revoke,refreshCaches};
