const assert=require('node:assert/strict');
const path=require('node:path');
const {cents,stc}=require('../../lib/competitionPrizes');
function setup(player=false, sourceType='tournament') {
  const kind=player ? 'player' : 'club';
  let state={root:{id:'cup',name:'Local Cup',type:'knockout',participant_type:kind,status:'completed',prize_winner_stc:'10.01',prize_runner_up_stc:'2.50',prize_semi_final_stc:0},matches:[{id:'final',tournament_id:'cup',type:'final',status:'completed',result_state:'CONFIRMED',home_score:2,away_score:0,[`home_${kind}_id`]:'a',[`away_${kind}_id`]:'b'}],accounts:[{id:'a',stc:'100.00',email:'a@example.test'},{id:'b',stc:'100.00',email:'b@example.test'}],ledgers:[],payouts:[],metadata:[],audits:[]};
  let fail=false;
  if (sourceType !== 'tournament') {
    Object.assign(state.root,{participant_type:'club',format:'league',season_number:1,num_league_matchdays:2,competition_id:'parent',reward_snapshot:[{position:1,stc_amount:'10.01'},{position:2,stc_amount:'2.50'}]});
    state.matches=[{id:'one',type:'league',status:'completed',result_state:'CONFIRMED',home_club_id:'a',away_club_id:'b',home_score:2,away_score:0},{id:'two',type:'league',status:'completed',result_state:'CONFIRMED',home_club_id:'b',away_club_id:'a',home_score:0,away_score:1}];
  }
  async function query(sql,v=[]) {
    if (/FROM tournaments/.test(sql)) return v[0]==='cup' ? [{...state.root}] : [];
    if (/FROM matches/.test(sql)) return state.matches.map(m=>({...m}));
    if (/FROM league_entities/.test(sql)) {
      if(v[1]===sourceType && v[0]==='cup') return [{...state.root,entity_type:sourceType,data_json:JSON.stringify(state.root)}];
      if(['competition_fixture','regional_league_fixture'].includes(v[0])) return state.matches.map(m=>({...m,phase:'league',match_id:m.id,data_json:JSON.stringify({...m,phase:'league',match_id:m.id,stats_processed:1})}));
      if(['competition_standing','regional_league_standing'].includes(v[0])) return state.accounts.map((a,i)=>({id:`standing-${a.id}`,club_id:a.id,data_json:JSON.stringify({points:i===0 ? 6:0,goals_for:i===0 ? 3:0,goals_against:i===0 ? 0:3})}));
      return state.metadata.filter(m=>m.id===v[0]);
    }
    if (/FROM club_achievements/.test(sql)) return [];
    if (/FROM competition_payouts/.test(sql)) return state.payouts;
    if (/FROM competition_instances/.test(sql)) return [];
    if (/FROM (player_stc_transactions|stc_transactions)/.test(sql)) return state.ledgers;
    if (/SELECT.*FROM (players|clubs)/.test(sql)) return /WHERE id=\?/.test(sql) ? state.accounts.filter(a=>a.id===v[0]).map(a=>({...a})) : state.accounts.map(a=>({...a}));
    if (/^UPDATE (players|clubs)/.test(sql)) {const a=state.accounts.find(a=>a.id===v[1]);a.stc=stc(cents(a.stc)+cents(v[0]));return {affectedRows:1};}
    if (/^INSERT INTO/.test(sql)) {
      if (fail && /INSERT INTO (stc_transactions|player_stc_transactions)/.test(sql)) throw new Error('Injected ledger failure');
      const table=sql.match(/INSERT INTO (\w+)/)[1];
      const cols=sql.match(/\(([^)]+)\)/)[1].split(',').map(c=>c.trim());
      const expressions=sql.slice(sql.indexOf('VALUES (')+8).split(')')[0].split(',');
      let i=0;const row={};cols.forEach((c,j)=>{if(expressions[j]?.trim()==='?')row[c]=v[i++];else if(/^'/.test(expressions[j]?.trim()))row[c]=expressions[j].trim().slice(1,-1);});
      if(table==='league_entities') {const old=state.metadata.find(m=>m.id===row.id);if(old)Object.assign(old,row);else state.metadata.push(row);}
      else if(table==='competition_payouts') {const old=state.payouts.find(m=>m.id===row.id);if(old)Object.assign(old,row);else state.payouts.push(row);}
      else if(table==='admin_audit_log') state.audits.push(row);
      else {assert(!state.ledgers.some(l=>l.settlement_key===row.settlement_key),'unique ledger key');state.ledgers.push(row);}
      return {affectedRows:1};
    }
    throw new Error(`Unhandled isolated SQL: ${sql}`);
  }
  let queue=Promise.resolve();
  const withTransaction=fn=>{const result=queue.then(async()=>{const snapshot=structuredClone(state);try{return await fn(query);}catch(e){state=snapshot;throw e;}});queue=result.catch(()=>{});return result;};
  const db=path.resolve(__dirname,'../../db/database.js');require.cache[db]={id:db,filename:db,loaded:true,exports:{EXECUTESQL:query,withTransaction}};
  for(const f of ['../../models/competitionScopeModel.js','../competitionPrizeService.js']) delete require.cache[path.resolve(__dirname,f)];
  return {service:require('../competitionPrizeService'),get state(){return state;},set fail(value){fail=value;},query};
}
module.exports={setup};
