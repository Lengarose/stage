'use strict';
const sporting=require('./regionalStructure');
const {fail}=require('./regionalEditionIdentity');
function resolve(plan,{count,confirmed,willing,replacements,seed,results,rankings}){
 if(!plan.ready)return plan;
 const finalIds=new Set(confirmed),rights=plan.rights.filter(r=>finalIds.has(r.club_id)).map(r=>({...r})),removed=plan.rights.filter(r=>!finalIds.has(r.club_id));
 const vacancies=plan.rights.filter(r=>r.division===1 && !finalIds.has(r.club_id)).length;
 const sourceGroups=plan.source_rankings || rankings;
 const candidates=rights.filter(r=>r.division===2 && willing.includes(r.club_id)).flatMap(right=>{
  const group=sourceGroups.find(g=>g.division===2 && g.ranked_club_ids.includes(right.club_id));if(!group)return [];
  const final=plan.fixtures.find(f=>f.ref===`promotion:${group.ref}:final`),played=final && results.find(r=>r.ref===final.ref),score=played && sporting.decide(final,results,[]);
  const losingFinalist=Boolean(score && [final.home,final.away].includes(right.club_id) && score!==right.club_id);
  return [{...right,group:group.ref,position:group.ranked_club_ids.indexOf(right.club_id)+1,priority:losingFinalist?0:1}];
 });
 const drawn=sporting.shuffle(candidates.map(c=>c.club_id),`${seed}:vacancy-priority`);
 candidates.sort((a,b)=>a.priority-b.priority || (a.priority===0?0:a.position-b.position) || drawn.indexOf(a.club_id)-drawn.indexOf(b.club_id));
 if(candidates.length<vacancies)fail('Not enough confirmed reserve-willing Division 2 clubs to fill Division 1 vacancies. Review sporting rights; no place was invented.');
 const promoted=candidates.slice(0,vacancies);
 for(const candidate of promoted)Object.assign(rights.find(r=>r.club_id===candidate.club_id),{division:1,route:'reserve_vacancy',reserve_source_group:candidate.group,reserve_source_position:candidate.position});
 for(const club_id of replacements)if(finalIds.has(club_id))rights.push({club_id,division:2,route:'reserve_replacement'});
 if(rights.length!==count || new Set(rights.map(r=>r.club_id)).size!==count || confirmed.some(id=>!rights.some(r=>r.club_id===id)))fail('The reserve replacement field does not preserve every confirmed club exactly once.');
 return {...plan,rights,groups:sporting.allocation(count,rights.filter(r=>r.division===1).map(r=>r.club_id),rights.filter(r=>r.division===2).map(r=>r.club_id),seed),reserve_allocation:{removed_rights:removed,promoted:promoted.map(c=>c.club_id),replacement_ids:replacements,draw_order:drawn}};
}
module.exports={resolve};
