'use strict';
const {EXECUTESQL}=require('../db/database');
const {parse}=require('../lib/trophyHistory');
function types(scope) {if(!['regional','gost','all'].includes(scope))throw Object.assign(new Error('Invalid history scope'),{status:400});return scope==='regional'?['regional_league']:scope==='gost'?['competition_season']:['regional_league','competition_season'];}
function selected(record, selection) {
  if (!selection) return true;
  const editions = new Set(selection.edition_ids || []);
  const references = new Set([...editions, ...(selection.fixture_ids || []), ...(selection.instance_ids || [])]);
  if (record.season_id) return editions.has(record.season_id);
  if (['competition','official_competition'].includes(record.source_type) && (selection.competition_ids || []).includes(record.source_id)) return true;
  return references.has(record.source_id) || editions.has(record.edition_id)
    || (selection.edition_aliases || []).includes(record.edition_id)
    || [...editions].some(id => String(record.edition_id || '').startsWith(`${id}:`));
}
async function preview(scope,query=EXECUTESQL,lock=false,selection=null) {
  const kinds=types(scope),marks=kinds.map(()=>'?').join(',');
  const awards=(await query(`SELECT * FROM trophy_awards WHERE source_type IN (${marks}) AND status='earned'${lock?' FOR UPDATE':''}`,kinds)).filter(a=>selected(a,selection));
  const placements=await query('SELECT * FROM trophy_placements');
  const editions=(await query(`SELECT * FROM league_entities WHERE entity_type IN (${marks})${lock?' FOR UPDATE':''}`,kinds)).filter(e=>!selection || selection.edition_ids.includes(e.id));
  const achievementTypes=scope==='regional'?['regional_league','regional_league_fixture']:scope==='gost'?['competition','competition_season','competition_fixture','official_competition']:['regional_league','regional_league_fixture','competition','competition_season','competition_fixture','official_competition'];
  const placeholders=achievementTypes.map(()=>'?').join(',');
  const clubAchievements=(await query(`SELECT * FROM club_achievements WHERE source_type IN (${placeholders})`,achievementTypes)).filter(a=>selected(a,selection));
  const playerAchievements=(await query(`SELECT * FROM player_achievements WHERE source_type IN (${placeholders})`,achievementTypes)).filter(a=>selected(a,selection));
  const owners=[...new Set([...awards.map(a=>`${a.owner_type}:${a.owner_id}`),...editions.map(e=>parse(e.data_json).winner_club_id).filter(Boolean).map(id=>`club:${id}`)])];
  const titleCounts=[],legacyAwards=[];
  for(const owner of owners) {
    const [ownerType,ownerId]=owner.split(':');
    const report=await require('./trophyEntitlementService').review(ownerId,ownerType,query);
    legacyAwards.push(...report.awards.filter(a=>!a.persisted&&!a.id&&kinds.includes(a.source_type)&&selected(a,selection)));
    titleCounts.push({owner,before:report.titles,after:require('../lib/trophyHistory').titleSummary(report.awards.filter(a=>!kinds.includes(a.source_type)||!selected(a,selection)))});
  }
  const revision=require('crypto').createHash('sha256').update(JSON.stringify({scope,awards:awards.map(a=>[a.id,a.status,a.metadata_json]).sort(),editions:editions.map(e=>[e.id,e.data_json]).sort(),placements:placements.filter(p=>awards.some(a=>a.id===p.award_id)).map(p=>[p.id,p.award_id,p.locked_at]).sort(),clubAchievements:clubAchievements.map(a=>a.id).sort(),playerAchievements:playerAchievements.map(a=>a.id).sort()})).digest('hex');
  return {scope,revision,award_count:awards.length+legacyAwards.length,placement_count:placements.filter(p=>awards.some(a=>a.id===p.award_id)).length,club_achievement_count:clubAchievements.length,player_achievement_count:playerAchievements.length,title_counts:titleCounts,affected_owners:owners,awards,legacy_awards:legacyAwards,club_achievements:clubAchievements,player_achievements:playerAchievements,editions:editions.map(e=>({id:e.id,type:e.entity_type,winner_club_id:parse(e.data_json).winner_club_id,season_number:parse(e.data_json).season_number})),financial_reversal:false};
}
async function revoke(scope,query,admin,reason,selection=null) {
  const before=await preview(scope,query,false,selection);
  // A verified legacy win may be derived from the immutable original edition.
  // Persist its revocation so preserving that evidence cannot re-grant a title.
  for (const award of before.legacy_awards) {
    const model = new (require('../models/trophyAwardModel'))();
    const id = await model.create(award,query);
    await model.update(id,{status:'revoked',revoked_reason:'[history-reset] '+reason},query);
  }
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
module.exports={preview,revoke,refreshCaches,selected};
