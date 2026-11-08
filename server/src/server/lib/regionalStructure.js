'use strict';
const crypto = require('node:crypto');
const VERSION = 'regional_structure_v1';
const TIE_VERSION = 'regional_sporting_decisions_v1';
const SOURCE_RANKING_VERSION = 'regional_source_decisions_v1';
const SIZES = Object.freeze({20:[1,0],40:[1,1],60:[1,2],80:[2,2],100:[2,3],120:[2,4],180:[3,6],240:[4,8]});
function fail(message, details) { throw Object.assign(new Error(message), {status:409,code:'REGIONAL_STRUCTURE_REVIEW',details}); }
function unique(ids, label) {
  if (!Array.isArray(ids) || ids.some(id => typeof id !== 'string' || !id.trim()) || new Set(ids).size !== ids.length) fail(`${label} must contain unique club IDs`);
  return ids;
}
function leagueResultRevision(matches) {
  const rows=matches.map(match=>({id:match.id,home:match.home_club_id,away:match.away_club_id,
    status:match.status,result_state:match.result_state,stats_processed:Number(match.stats_processed || 0),
    home_score:Number(match.home_score),away_score:Number(match.away_score)})).sort((a,b)=>String(a.id).localeCompare(String(b.id)));
  return crypto.createHash('sha256').update(JSON.stringify(rows)).digest('hex');
}
function finalLeagueTable(scope) {
  const ranking=scope.root.regional_final_ranked_club_ids;
  if(!scope.root.regional_final_ranking_cycle_id || !Array.isArray(ranking) || ranking.length!==scope.standings.length ||
    new Set(ranking).size!==ranking.length || scope.root.regional_final_results_revision!==leagueResultRevision(scope.matches))return null;
  const table=ranking.map(id=>scope.standings.find(row=>row.club_id===id));
  return table.every((row,i)=>row && Number(row.final_position)===i+1)?table:null;
}
function structure(count) {
  if (!Number.isSafeInteger(count) || !SIZES[count]) fail('This confirmed club count has no approved structure; review waiting list or growth policy');
  const [d1,d2] = SIZES[count];
  return {version:VERSION,count,groups:[d1,d2].flatMap((n,i)=>Array.from({length:n},(_,j)=>({ref:`D${i+1}${String.fromCharCode(65+j)}`,division:i+1,group_code:String.fromCharCode(65+j),capacity:20}))),relegated_per_d1:d1 && d2 ? d2*2/d1 : 0};
}
function shuffle(ids, seed) {
  if (typeof seed!=='string' || seed.length<16) fail('A captured server draw seed is required');
  return [...ids].map(id=>({id,key:crypto.createHash('sha256').update(JSON.stringify([seed,id])).digest('hex')})).sort((a,b)=>a.key.localeCompare(b.key)).map(r=>r.id);
}
function roundRobin(ids, prefix) {
  const circle=ids.length%2?[...ids,null]:[...ids], fixtures=[];
  for(let round=1;round<circle.length;round++) {
    for(let i=0;i<circle.length/2;i++) {
      let home=circle[i],away=circle[circle.length-1-i];
      if(!home||!away)continue;
      if(round%2===0)[home,away]=[away,home];
      fixtures.push({ref:`${prefix}:r${round}:${i+1}`,home,away,round,allow_penalties:false});
    }
    circle.splice(1,0,circle.pop());
  }
  return fixtures;
}
function score(result) {
  if(!result || !['completed','forfeit'].includes(result.status) || result.disputed || ![true,1].includes(result.confirmed))return null;
  const values=[result.home_score,result.away_score];
  if(values.some(v=>v==null||String(v).trim()===''||!Number.isSafeInteger(Number(v))||Number(v)<0))return null;
  return values.map(Number);
}
function resultFor(fixture, results) {
  const matches=results.filter(r=>r.ref===fixture.ref);
  if(matches.length>1)fail('Duplicate official result reference',{ref:fixture.ref});
  const result=matches[0];
  if(result && (result.home!==fixture.home||result.away!==fixture.away))fail('A result no longer matches its captured fixture',{ref:fixture.ref});
  return score(result)?result:null;
}
function decide(fixture, results, pending) {
  const result=resultFor(fixture,results);
  if(!result) {pending.push(fixture);return null;}
  const [h,a]=score(result);
  if(h!==a)return h>a?fixture.home:fixture.away;
  if([true,1].includes(result.decided_on_penalties)&&['home','away'].includes(result.penalty_winner_side))return result.penalty_winner_side==='home'?fixture.home:fixture.away;
  pending.push({...fixture,review:'A confirmed penalty winner or sporting decision is required'});return null;
}
function standings(ids, fixtures, results, {excluded=[]}={}) {
  const rows=new Map(ids.map(id=>[id,{id,points:0,gd:0,gf:0}]));
  const played=[];
  for(const f of fixtures) {
    if(results.some(r=>r.ref===f.ref && r.resolved_withdrawal && r.status==='cancelled'))continue;
    const result=resultFor(f,results);
    if(!result)return null;
    const [h,a]=score(result),home=rows.get(f.home),away=rows.get(f.away);
    home.points+=h>a?3:h===a?1:0;away.points+=a>h?3:h===a?1:0;
    home.gd+=h-a;away.gd+=a-h;home.gf+=h;away.gf+=a;
    played.push({f,h,a});
  }
  const compare=(a,b)=>b.points-a.points||b.gd-a.gd||b.gf-a.gf;
  const sorted=[...rows.values()].filter(row=>!excluded.includes(row.id)).sort(compare);
  // Resolve global ties using the mini-table. Still tied => explicit sporting review,
  // never alphabetical/ID placement at a decisive boundary.
  for(let i=0;i<sorted.length;) {
    let end=i+1;while(end<sorted.length&&!compare(sorted[i],sorted[end]))end++;
    if(end-i>1) {
      const tied=new Set(sorted.slice(i,end).map(r=>r.id));
      const mini=new Map([...tied].map(id=>[id,{id,points:0,gd:0,gf:0}]));
      for(const {f,h,a} of played.filter(r=>tied.has(r.f.home)&&tied.has(r.f.away))) {
        const home=mini.get(f.home),away=mini.get(f.away);
        home.points+=h>a?3:h===a?1:0;away.points+=a>h?3:h===a?1:0;
        home.gd+=h-a;away.gd+=a-h;home.gf+=h;away.gf+=a;
      }
      const order=[...mini.values()].sort(compare);
      sorted.splice(i,end-i,...order.map(r=>({...rows.get(r.id),tied:order.some(other=>other.id!==r.id&&!compare(r,other)),tied_with:order.filter(other=>other.id!==r.id&&!compare(r,other)).map(other=>other.id)})));
    }
    i=end;
  }
  return [...sorted,...excluded.filter(id=>rows.has(id)).map(id=>({...rows.get(id),excluded:true,tied:false,tied_with:[]}))];
}
function unresolvedTies(table, cutoffs, group_ref) {
  // Report only ties crossing a sporting boundary. This describes the review;
  // it does not choose a winner or authorize a supplementary match format.
  const seen=new Set(),reviews=[];
  for(const row of table) {
    if(seen.has(row.id) || !row.tied_with?.length)continue;
    const members=new Set([row.id,...row.tied_with]);
    const positions=table.flatMap((entry,index)=>members.has(entry.id)?[index+1]:[]);
    const from_position=Math.min(...positions),to_position=Math.max(...positions);
    const boundaries=cutoffs.filter(cutoff=>from_position<=cutoff && to_position>cutoff);
    members.forEach(id=>seen.add(id));
    if(boundaries.length)reviews.push({group_ref,club_ids:table.filter(entry=>members.has(entry.id)).map(entry=>entry.id),from_position,to_position,boundaries});
  }
  return reviews;
}
function resolveTies(table, cutoffs, group_ref, seed, results, enabled=true) {
  const updated=table.slice(),fixtures=[],pending=[],reviews=[];
  for(const tie of unresolvedTies(table,cutoffs,group_ref)) {
    if(!enabled || tie.club_ids.length>4) {reviews.push(tie);continue;}
    const key=crypto.createHash('sha256').update(JSON.stringify(tie.club_ids.slice().sort())).digest('hex').slice(0,12);
    const prefix=`${group_ref}:tie:${key}`;
    const drawn=shuffle(tie.club_ids,`${seed}:${prefix}`);
    let order;
    if(drawn.length===2) {
      const fixture={ref:prefix,home:drawn[0],away:drawn[1],round:1,allow_penalties:true};
      fixtures.push(fixture);
      const winner=decide(fixture,results,pending);
      if(!winner)continue;
      order=[winner,...drawn.filter(id=>id!==winner)].map(id=>({id,tied:false,tied_with:[]}));
    } else {
      const extra=roundRobin(drawn,prefix);fixtures.push(...extra);
      const missing=extra.filter(f=>!resultFor(f,results));pending.push(...missing);
      if(missing.length)continue;
      order=standings(drawn,extra,results);
      const relativeCutoffs=tie.boundaries.map(cutoff=>cutoff-tie.from_position+1);
      if(unresolvedTies(order,relativeCutoffs,group_ref).length) {reviews.push({...tie,reason:'Supplementary mini-league remains tied at a decisive boundary'});continue;}
    }
    // Supplementary results decide order, never rewrite original league points.
    updated.splice(tie.from_position-1,order.length,...order.map((row,index)=>({
      ...table.find(original=>original.id===row.id),tied:!!row.tied,tied_with:row.tied_with || [],decision_position:tie.from_position+index,
    })));
  }
  return {table:updated,fixtures,pending,unresolved_ties:reviews};
}
function allocation(count,d1,d2,seed) {
  const spec=structure(count);
  unique([...d1,...d2],'Final allocation');
  const one=spec.groups.filter(g=>g.division===1),two=spec.groups.filter(g=>g.division===2);
  if(d1.length!==one.length*20||d2.length!==two.length*20)fail('Sporting rights do not fill the approved target structure');
  return spec.groups.map(g=>({...g,club_ids:shuffle(g.division===1?d1:d2,`${seed}:division:${g.division}`).filter((_,i)=>i%(g.division===1?one:two).length===g.group_code.charCodeAt(0)-65)}));
}
function placement(count,ids,seed,results=[],options={}) {
  structure(count);unique(ids,'Placement participants');
  if(ids.length!==count)fail('Placement requires the complete confirmed field');
  if(count>120)fail('Direct launch at 180/240 clubs has no approved placement format');
  if(count===20)return {ready:true,fixtures:[],pending:[],groups:allocation(count,ids,[],seed),rights:ids.map(club_id=>({club_id,division:1,route:'initial_placement'}))};
  const size=[60,120].includes(count)?6:5;
  const shuffled=shuffle(ids,seed),groups=Array.from({length:count/size},(_,i)=>shuffled.slice(i*size,(i+1)*size));
  const fixtures=groups.flatMap((g,i)=>roundRobin(g,`placement:g${i+1}`));
  const pending=fixtures.filter(f=>!resultFor(f,results));
  if(pending.length)return {ready:false,fixtures,pending,placement_groups:groups};
  let tables=groups.map((g,i)=>standings(g,fixtures.filter(f=>f.ref.startsWith(`placement:g${i+1}:`)),results));
  const cutoffs=count===40||count===80?[2,3]:[2];
  const decisions=tables.map((table,i)=>resolveTies(table,cutoffs,`placement:g${i+1}`,seed,results,options.resolve_ties!==false));
  tables=decisions.map(d=>d.table);fixtures.push(...decisions.flatMap(d=>d.fixtures));pending.push(...decisions.flatMap(d=>d.pending));
  const unresolved_ties=decisions.flatMap(d=>d.unresolved_ties);
  if(unresolved_ties.length)return {ready:false,fixtures,pending,blockers:['Placement standings require a sporting decision; no ID/name tiebreaker is permitted'],tables,unresolved_ties};
  if(pending.length)return {ready:false,fixtures,pending,tables};
  const d1=tables.flatMap(t=>t.slice(0,2).map(r=>r.id));
  if([40,80].includes(count)) {
    const thirds=shuffle(tables.map(t=>t[2].id),`${seed}:thirds`);
    for(let i=0;i<thirds.length;i+=2) {
      const fixture={ref:`placement:decision:${i/2+1}`,home:thirds[i],away:thirds[i+1],round:1,allow_penalties:true};
      fixtures.push(fixture);const winner=decide(fixture,results,pending);if(winner)d1.push(winner);
    }
  }
  if(pending.length)return {ready:false,fixtures,pending};
  const d2=ids.filter(id=>!d1.includes(id));
  return {ready:true,fixtures,pending:[],groups:allocation(count,d1,d2,seed),rights:ids.map(club_id=>({club_id,division:d1.includes(club_id)?1:2,route:'initial_placement'}))};
}
function transition(from,to,groups,newIds,seed,results=[],options={}) {
  const source=structure(from),target=structure(to);
  if(to<from||!(to===from||[[20,40],[40,60],[60,80],[80,100],[100,120],[120,180],[180,240]].some(([a,b])=>a===from&&b===to)))fail('This growth/shrink path has no approved sporting route');
  unique(newIds,'New participants');
  if(newIds.length!==to-from)fail('Growth requires exactly the new confirmed participants for the target structure');
  if(groups.length!==source.groups.length)fail('All source groups are required');
  for(const g of source.groups) {
    const matching=groups.filter(row=>row.ref===g.ref);
    if(matching.length!==1||matching[0].division!==g.division||!matching[0].final)fail('Every source group needs a unique final sporting ranking');
    if(unique(matching[0].ranked_club_ids,'Ranked group').length!==20)fail('A source group needs twenty ranked clubs');
  }
  const oldIds=groups.flatMap(g=>g.ranked_club_ids);unique([...oldIds,...newIds],'Regional field');
  const pending=[],fixtures=[],up=[];
  let source_rankings;
  if(options.resolve_source_ties) {
    const decisions=groups.map(group=>{
      if(!Array.isArray(group.table) || group.table.length!==20 || group.table.some((row,i)=>row.id!==group.ranked_club_ids[i]))fail('Confirmed source tables are required for supplementary decisions');
      // Every final league place is a sporting position: ties may affect titles,
      // promotion seeding, relegation or configured position-based rewards.
      return resolveTies(group.table,Array.from({length:19},(_,i)=>i+1),`source:${group.ref}`,seed,results);
    });
    fixtures.push(...decisions.flatMap(d=>d.fixtures));pending.push(...decisions.flatMap(d=>d.pending));
    const unresolved_ties=decisions.flatMap(d=>d.unresolved_ties);
    const tables=decisions.map(d=>d.table);
    if(unresolved_ties.length)return {ready:false,fixtures,pending,tables,unresolved_ties,blockers:['Final league places require Admin sporting review']};
    if(pending.length)return {ready:false,fixtures,pending,tables};
    source_rankings=groups.map((group,i)=>({...group,table:tables[i],ranked_club_ids:tables[i].map(row=>row.id)}));
    groups=source_rankings;
  }
  const expansion=from===60&&to===80?'wide_80':from===120&&to===180?'wide_180':null;
  const down=expansion?4:source.relegated_per_d1;
  for(const group of groups.filter(g=>g.division===2)) {
    const ids=group.ranked_club_ids.filter(id=>!group.table?.find(row=>row.id===id)?.excluded);
    const needed=expansion==='wide_80'?14:expansion==='wide_180'?9:5;
    if(ids.length<needed)fail('The confirmed sporting route has too few eligible Division 2 clubs after withdrawal; use the existing exception review.');
    if(expansion) {
      const direct=expansion==='wide_80'?10:5;
      up.push(...ids.slice(0,direct));
      for(const [h,a] of [[direct,direct+3],[direct+1,direct+2]]) {
        const f={ref:`growth:${group.ref}:${h+1}-${a+1}`,home:ids[h],away:ids[a],round:1,allow_penalties:true};
        fixtures.push(f);const winner=decide(f,results,pending);if(winner)up.push(winner);
      }
    } else {
      up.push(ids[0]);
      const winners=[];
      for(const [h,a] of [[1,4],[2,3]]) {
        const f={ref:`promotion:${group.ref}:sf:${h+1}-${a+1}`,home:ids[h],away:ids[a],round:1,allow_penalties:true};
        fixtures.push(f);const winner=decide(f,results,pending);if(winner)winners.push(winner);
      }
      if(winners.length===2) {
        winners.sort((a,b)=>ids.indexOf(a)-ids.indexOf(b));
        const f={ref:`promotion:${group.ref}:final`,home:winners[0],away:winners[1],round:2,allow_penalties:true};
        fixtures.push(f);const winner=decide(f,results,pending);if(winner)up.push(winner);
      }
    }
  }
  if(pending.length)return {ready:false,fixtures,pending,source_rankings};
  if(from===180&&to===240) {
    const candidateGroups=groups.filter(g=>g.division===2).sort((a,b)=>a.ref.localeCompare(b.ref)).map(g=>shuffle(g.ranked_club_ids.filter(id=>!up.includes(id)).slice(0,5),`${seed}:extra:${g.ref}`));
    const pools=Array.from({length:5},(_,i)=>candidateGroups.map(g=>g[i]));
    const extra=pools.flatMap((ids,i)=>roundRobin(ids,`growth:extra:g${i+1}`));fixtures.push(...extra);
    pending.push(...extra.filter(f=>!resultFor(f,results)));
    if(pending.length)return {ready:false,fixtures,pending};
    const decisions=pools.map((ids,i)=>resolveTies(standings(ids,extra.filter(f=>f.ref.startsWith(`growth:extra:g${i+1}:`)),results),[4],`growth:extra:g${i+1}`,seed,results,options.resolve_ties!==false));
    const tables=decisions.map(d=>d.table);fixtures.push(...decisions.flatMap(d=>d.fixtures));pending.push(...decisions.flatMap(d=>d.pending));
    const unresolved_ties=decisions.flatMap(d=>d.unresolved_ties);
    if(unresolved_ties.length)return {ready:false,fixtures,pending,blockers:['Extra promotion standings require a sporting decision'],tables,unresolved_ties};
    if(pending.length)return {ready:false,fixtures,pending,tables};
    up.push(...tables.flatMap(t=>t.slice(0,4).map(r=>r.id)));
  }
  const retained=groups.filter(g=>g.division===1).flatMap(g=>g.ranked_club_ids.slice(0,20-down));
  const d1=[...retained,...up],d2=[...oldIds,...newIds].filter(id=>!d1.includes(id));
  if(d1.length!==target.groups.filter(g=>g.division===1).length*20)fail('The sporting route does not fill the target Division 1');
  return {ready:true,fixtures,pending:[],source_rankings,groups:allocation(to,d1,d2,seed),rights:[...oldIds,...newIds].map(club_id=>({club_id,division:d1.includes(club_id)?1:2,route:newIds.includes(club_id)?'new_entry':up.includes(club_id)?(expansion || (from===180&&to===240?'expansion_promotion':'promotion')):retained.includes(club_id)?'retained':'division_2'}))};
}
module.exports={allocation,decide,VERSION,TIE_VERSION,SOURCE_RANKING_VERSION,SIZES,structure,placement,transition,standings,roundRobin,shuffle,unique,unresolvedTies,resolveTies,leagueResultRevision,finalLeagueTable};
