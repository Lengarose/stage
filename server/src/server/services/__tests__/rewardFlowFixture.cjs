const path=require('node:path');
const {cents,stc}=require('../../lib/competitionPrizes');
function setup(kind='regional_league',count=20,{legacyRewardPosition=false}={}) {
  const sourceId=kind==='regional_league'?'edition':'gost';
  const standingType=kind==='regional_league'?'regional_league_standing':'competition_standing';
  const fixtureType=kind==='regional_league'?'regional_league_fixture':'competition_fixture';
  const column=kind==='regional_league'?'league_id':'season_id';
  let state={entities:[],configs:[],clubs:[],players:[],payouts:[],ledgers:[],awards:[],placements:[],items:[],audits:[],tournaments:[],matches:[]};
  let failOn=null,failAfter=0;
  const entity=(id,entity_type,data)=>({id,entity_type,...data,data_json:JSON.stringify(data)});
  const ids=Array.from({length:count},(_,i)=>`club-${i+1}`);
  const root={id:'edition',name:'Controlled Test League',participant_type:'club',registered_club_ids:ids,status:'in_progress',season_number:1,division:2,competition_id:kind==='competition_season'?sourceId:null,num_league_matchdays:8,league_matchday_total:8,prize_pool_stc:'1.00',trophy_item_id:'trophy'};
  state.entities.push(entity('edition',kind,root));
  if(kind==='competition_season')state.entities.push(entity(sourceId,'competition',{id:sourceId,name:'Supreme Test',slug:'supreme',max_clubs:count}));
  state.clubs=ids.map(id=>({id,name:id,stc:'0.00',user_id:`user-${id}`,owner_email:`${id}@example.test`}));
  state.items=[{id:'trophy',name:'Test Championship',image_url:'/uploads/test.png',linked_source_type:kind==='regional_league'?kind:'competition',linked_source_id:sourceId}];
  const totals=new Map(ids.map(id=>[id,{played:0,wins:0,draws:0,losses:0,points:0,goals_for:0,goals_against:0,goal_difference:0}]));
  let serial=0;
  function add(home,away,phase='league',tie=0,leg=1) {
    const homeWin=ids.indexOf(home)<ids.indexOf(away),hs=homeWin?1:0,as=homeWin?0:1;
    const f={id:`fixture-${serial++}`,[column]:'edition',phase,home_club_id:home,away_club_id:away,home_club_name:home,away_club_name:away,home_score:hs,away_score:as,status:'played',stats_processed:true,result_state:'CONFIRMED',tie_id:`${phase}-${tie}`,group_number:tie,leg,matchday:leg};
    state.entities.push(entity(f.id,fixtureType,f));
    if(phase==='league')for(const [id,own,opp]of [[home,hs,as],[away,as,hs]]) {const s=totals.get(id);s.played++;s.goals_for+=own;s.goals_against+=opp;s.goal_difference=s.goals_for-s.goals_against;if(own>opp){s.wins++;s.points+=3;}else s.losses++;}
  }
  if(kind==='regional_league') {for(const home of ids)for(const away of ids)if(home!==away)add(home,away);}
  else {
    const ring=ids.slice();
    for(let day=0;day<4;day++){for(let i=0;i<count/2;i++){add(ring[i],ring[count-1-i]);add(ring[count-1-i],ring[i]);}ring.splice(1,0,ring.pop());}
    const stages=[['playoff_round',ids.slice(8,24)],['knockout_r16',ids.slice(0,16)],['knockout_qf',ids.slice(0,8)],['knockout_sf',ids.slice(0,4)]];
    for(const [phase,clubs]of stages)for(let i=0;i<clubs.length/2;i++){add(clubs[i],clubs[clubs.length-1-i],phase,i,1);add(clubs[clubs.length-1-i],clubs[i],phase,i,2);}
    add(ids[0],ids[1],'knockout_final');
  }
  for(const id of ids)state.entities.push(entity(`standing-${id}`,standingType,{[column]:'edition',club_id:id,club_name:id,...totals.get(id)}));
  function rowsFor(table){return table==='league_entities'?state.entities:table==='reward_configs'?state.configs:table==='competition_payouts'?state.payouts:table==='stc_transactions'?state.ledgers:table==='trophy_awards'?state.awards:table==='trophy_placements'?state.placements:table==='trophy_items'?state.items:table==='clubs'?state.clubs:table==='players'?state.players:table==='tournaments'?state.tournaments:table==='matches'?state.matches:table==='admin_audit_log'?state.audits:[];}
  async function query(sql,v=[]) {
    if (/information_schema.columns/.test(sql) && v[0]==='reward_configs' && v[1]==='position') return [{IS_NULLABLE:legacyRewardPosition?'NO':'YES'}];
    if (sql==='ALTER TABLE reward_configs MODIFY COLUMN position INT NULL') {legacyRewardPosition=false;return {affectedRows:0};}
    if(failOn&&sql.includes(failOn)){if(failAfter--<=0)throw new Error('Injected transaction failure');}
    if(/FROM users/.test(sql))return [{id:v[0],email:`${v[0]}@example.test`,role_id:v[0]==='admin'?2:1}];
    if(/FROM (club_achievements|competition_instances|competition_fixtures)/.test(sql))return [];
    if(/SELECT DISTINCT p.id/.test(sql))return state.players.filter(p=>p.club_id===v[0]);
    if(/^SELECT/.test(sql)) {
      const table=sql.match(/FROM\s+`?(\w+)/)?.[1];let rows=rowsFor(table).map(r=>({...r}));
      if(table==='matches'&&/LEFT JOIN/.test(sql))return [];
      if(table==='league_entities') {
        const literal=sql.match(/entity_type\s*=\s*'([^']+)'/);if(literal)rows=rows.filter(r=>r.entity_type===literal[1]);
        if(/entity_type IN/.test(sql))rows=rows.filter(r=>['regional_league','competition_season'].includes(r.entity_type));
      }
      let index=0;
      for(const match of sql.matchAll(/(?:\b|`)(id|tournament_id|source_id|source_type|edition_id|entity_type|league_id|season_id|owner_id|owner_type|trophy_item_id|award_key|award_id|status|winner_club_id|winner_player_id|linked_source_type|linked_source_id)\s*=\s*\?/g)){const key=match[1],value=v[index++];rows=rows.filter(r=>String(r[key])===String(value));}
      if(/source_type IN/.test(sql))rows=rows.filter(r=>v.includes(r.source_type));
      if(/status='earned'/.test(sql))rows=rows.filter(r=>r.status==='earned');
      if(/status='archived'/.test(sql))rows=rows.filter(r=>r.status==='archived');
      if(/status='completed'/.test(sql))rows=rows.filter(r=>r.status==='completed');
      if(/WHERE id IN/.test(sql))rows=rows.filter(r=>v.includes(r.id));
      if(/club_id IN/.test(sql))rows=rows.filter(r=>v.includes(r.club_id));
      if(/JSON_UNQUOTE/.test(sql))rows=rows.filter(r=>JSON.parse(r.data_json||'{}').winner_club_id===v[0]);
      if(/COUNT\(\*\) AS total/.test(sql))return [{total:rows.length}];
      return rows;
    }
    if(/^UPDATE players SET ranking_competition_wins/.test(sql)){const p=state.players.find(p=>p.id===v[1]);if(p)p.ranking_competition_wins=v[0];return {affectedRows:1};}
    if(/^UPDATE (clubs|players)/.test(sql)){const account=rowsFor(sql.match(/^UPDATE (\w+)/)[1]).find(r=>r.id===v[1]);account.stc=stc(cents(account.stc)+cents(v[0]));return {affectedRows:1};}
    if(/^UPDATE league_entities/.test(sql)) {
      const data=JSON.parse(v[0]),row=state.entities.find(r=>r.id===(sql.includes('status=?')?v[2]:v[1]));
      Object.assign(row,data,{data_json:v[0]});return {affectedRows:1};
    }
    if(/^UPDATE trophy_placements/.test(sql)) {const row=state.placements.find(r=>r.id===v.at(-1));if(/locked_at=NOW/.test(sql))row.locked_at='2026-10-25 12:00:00';else if(/locked_at=NULL/.test(sql))row.locked_at=null;else if(/award_id=\?/.test(sql))row.award_id=v[0];else if(/win_count/.test(sql)){row.win_count++;row.won_tournament_ids=v[0];}else {let i=0;for(const k of sql.matchAll(/(x_percent|y_percent|scale|position) = \?/g))row[k[1]]=v[i++];}return {affectedRows:1};}
    if(/^UPDATE trophy_awards/.test(sql)){Object.assign(state.awards.find(r=>r.id===v[2]),{status:v[0],revoked_reason:v[1]});return {affectedRows:1};}
    if(/^UPDATE tournaments/.test(sql)){const row=state.tournaments.find(r=>r.id===v.at(-1));if(/status='archived'/.test(sql)){row.status='archived';row.archived_at='2026-10-25 12:00:00';}if(/archive_review_required=1/.test(sql))row.archive_review_required=1;return {affectedRows:1};}
    if(/^INSERT INTO/.test(sql)) {
      const table=sql.match(/^INSERT INTO (\w+)/)[1],target=rowsFor(table);
      const cols=sql.match(/\(([^)]+)\)/)[1].split(',').map(c=>c.trim());
      const expressions=sql.match(/VALUES\s*\(([^)]+)\)/i)[1].split(',').map(c=>c.trim());
      let i=0;const row={};cols.forEach((col,j)=>{const e=expressions[j];row[col]=e==='?'?v[i++]:e?.startsWith("'")?e.slice(1,-1):/^\d+$/.test(e||'')?Number(e):null;});
      if(table==='reward_configs' && legacyRewardPosition && row.position==null)throw new Error("Column 'position' cannot be null");
      const old=target.find(r=>r.id===row.id||(table==='trophy_awards'&&row.award_key&&r.award_key===row.award_key));
      if(old&&table==='trophy_awards'&&!old.metadata_json){old.metadata_json=row.metadata_json;old.award_key=row.award_key;old.award_role=row.award_role;}
      if(old && table!=='trophy_awards')Object.assign(old,row);else if(!old)target.push(row);
      return {affectedRows:old?0:1};
    }
    if(/^DELETE FROM/.test(sql)){const target=rowsFor(sql.match(/^DELETE FROM (\w+)/)[1]);const i=target.findIndex(r=>r.id===v[0]);if(i>=0)target.splice(i,1);return {affectedRows:1};}
    throw new Error(`Unhandled test SQL: ${sql}`);
  }
  let queue=Promise.resolve();
  const withTransaction=fn=>{const result=queue.then(async()=>{const snapshot=structuredClone(state);try{return await fn(query);}catch(e){state=snapshot;throw e;}});queue=result.catch(()=>{});return result;};
  const db=path.resolve(__dirname,'../../db/database.js');require.cache[db]={id:db,filename:db,loaded:true,exports:{EXECUTESQL:query,withTransaction}};
  for(const f of ['../competitionPrizeService.js','../rewardConfigurationService.js','../trophyAwardService.js','../trophyEntitlementService.js','../tournamentArchiveService.js','../competitionHistoryResetService.js','../../models/competitionScopeModel.js','../../models/trophyAwardModel.js','../../models/trophyPlacementModel.js'])delete require.cache[path.resolve(__dirname,f)];
  const config=require('../rewardConfigurationService'),prizes=require('../competitionPrizeService');
  return {query,withTransaction,config,prizes,kind,sourceId,ids,get state(){return state;},get root(){return JSON.parse(state.entities.find(r=>r.id==='edition').data_json);},setRoot(patch){const r=state.entities.find(r=>r.id==='edition');const next={...JSON.parse(r.data_json),...patch};Object.assign(r,next,{data_json:JSON.stringify(next)});},setFailure(text,after=0){failOn=text;failAfter=after;},entity};
}
module.exports={setup};
