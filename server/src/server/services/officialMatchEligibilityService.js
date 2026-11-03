'use strict';
const { v4: uuid } = require('uuid');
const crypto = require('crypto');
const snapshotId = matchId => { const h=crypto.createHash('sha256').update(`official_match_selection:${matchId}`).digest('hex'); return `${h.slice(0,8)}-${h.slice(8,12)}-${h.slice(12,16)}-${h.slice(16,20)}-${h.slice(20,32)}`; };
const { EXECUTESQL, withTransaction } = require('../db/database');
const { unpack, fail } = require('../lib/regionalEditionIdentity');
const { VERSION, rosterReport } = require('../lib/regionalRegistrationPolicy');
const { RegionalRegistrationModel } = require('../models/regionalRegistrationModel');
const Lineup = require('../models/clubFixtureLineupModel');
const {OfficialMatchPreparationModel}=require('../models/officialMatchPreparationModel');
const {matchWindows}=require('../lib/officialMatchWindows');
const selectionRevision = value => crypto.createHash('sha256').update(JSON.stringify({players:playerIds(value),captain:value.captain_player_id || null,formation:value.formation || null,notes:value.notes || null})).digest('hex');
const parse = value => typeof value === 'string' ? JSON.parse(value) : value;
const closed = new Set(['completed','archived','cancelled','canceled','voided','deleted','reset','superseded','abandoned','retired']);
const begun = new Set(['in_progress','awaiting_confirmation','disputed','completed','forfeit']);

function playerIds(body) {
  const starters=parse(body.starting_players || []), bench=parse(body.bench_players || []);
  if(!Array.isArray(starters) || !Array.isArray(bench) || [...starters,...bench].some(id=>typeof id!=='string' || !id.trim()))fail('Select players by their player ID',422);
  const ids=[...starters,...bench];
  if(new Set(ids).size!==ids.length)fail('A player can appear only once in the selection',422);
  if(starters.length>11)fail('A starting selection has at most eleven human players',422);
  if(body.captain_player_id && !starters.includes(body.captain_player_id))fail('The captain must be a starting player',422);
  return {starters,bench,ids};
}
function createService({query=EXECUTESQL,transaction=withTransaction,rosters=new RegionalRegistrationModel(),preparations=new OfficialMatchPreparationModel(),clock=()=>new Date()}={}) {
  // Resolve aliases from stored relationships. A client-supplied fixture_type never
  // decides whether official conditions apply.
  async function context(ref,q=query,{allowMissingMatch=false}={}) {
    const engines=await q('SELECT * FROM competition_fixtures WHERE id=? OR match_id=? OR legacy_fixture_id=? ORDER BY id FOR UPDATE',[ref,ref,ref]);
    if(engines.length>1)fail('Ambiguous fixture identity requires Admin review');
    const engine=engines[0];
    const matches=await q('SELECT * FROM matches WHERE id=? OR id=? OR source_fixture_id=? ORDER BY id FOR UPDATE',[ref,engine?.match_id || '',ref]);
    if(matches.length>1)fail('Ambiguous match identity requires Admin review');
    const match=matches[0];
    if(match?.source_fixture_type==='competition_engine' && !engine)fail('Official engine fixture is unavailable; Admin review required');
    const source=engine?.legacy_fixture_type || match?.source_fixture_type;
    const sourceId=engine?.legacy_fixture_id || match?.source_fixture_id || ref;
    let root=null,sourceFixture=null;
    if(source==='regional_cup') {
      const [row]=await q("SELECT * FROM league_entities WHERE entity_type='regional_cup_edition' AND id=? FOR UPDATE",[engine?.competition_instance_id || match?.competition_context]);
      if(!row)fail('Official Cup edition is unavailable; Admin review required');
      root=unpack(row);
      if(root.policy_version!==require('../lib/regionalCupPolicy.json').version || root.participation_window_snapshot?.policy_version!==VERSION || root.participation_window_snapshot?.cup_policy_version!=='regional_cup_v1' || !root.participant_ids?.includes(match?.home_club_id) || !root.participant_ids?.includes(match?.away_club_id) || !root.rounds?.some(r=>r.fixture_ids?.includes(engine?.id)) || engine?.home_club_id!==match?.home_club_id || engine?.away_club_id!==match?.away_club_id || !root.play_enabled || root.status!=='running' || !engine || engine.match_id!==match?.id || match?.competition_context!==root.id)fail('This Cup edition is not open for official play');
    } else if(source==='regional_pathway') {
      const [row]=await q("SELECT * FROM league_entities WHERE entity_type='regional_cycle' AND id=? FOR UPDATE",[engine?.competition_instance_id || match?.competition_context]);
      if(!row)fail('Official pathway is unavailable; Admin review required');
      root=unpack(row);
    } else {
      const [fixture]=await q("SELECT * FROM league_entities WHERE entity_type='regional_league_fixture' AND id=? FOR UPDATE",[sourceId]);
      if(fixture) {
        const f=unpack(fixture);sourceFixture=f;
        const [row]=await q("SELECT * FROM league_entities WHERE entity_type='regional_league' AND id=? FOR UPDATE",[f.league_id]);
        if(!row)fail('Official league edition is unavailable; Admin review required');
        root=unpack(row);
      } else if(['regional_league','regional_league_fixture'].includes(source))fail('Official fixture is unavailable; Admin review required');
    }
    const version=root?.regional_participation_policy_version || root?.participation_window_snapshot?.policy_version;
    if(version && version!==VERSION)fail('Unsupported official participation policy; Admin review required');
    if(!version)return {official:false,match,engine};
    if((!match && !allowMissingMatch) || (match && (!match.home_club_id || !match.away_club_id || match.home_club_id===match.away_club_id)))fail('Official fixture has no unambiguous playable match');
    if(root.edition_invalidated || root.retired_at || root.retired || closed.has(root.status) || closed.has(match?.status) || closed.has(engine?.status))fail('This official edition or match is closed');
    if(source==='regional_pathway' && !['running','review','ready'].includes(root.status))fail('This official pathway is closed');
    const aliases=[match?.id,match?.source_fixture_id,engine?.id,engine?.legacy_fixture_id,sourceFixture?.id].filter(Boolean);
    return {official:true,match,engine,root,sourceFixture,aliases:[...new Set(aliases)],version};
  }
  async function snapshot(matchId,q=query) {
    const [row]=await q("SELECT * FROM league_entities WHERE entity_type='official_match_selection' AND id=? FOR UPDATE",[snapshotId(matchId)]);
    return row?unpack(row):null;
  }
  function validateRoster(body,players,now,{publish=false}={}) {
    const selection=playerIds(body);
    const roster=rosterReport(players,body.club_id,now);
    const invalid=selection.ids.filter(id=>roster.players.find(p=>p.id===id)?.status!=='eligible');
    if(invalid.length)fail('Every selected player, including reserves, needs active Plus and playing registration for this club',422,{player_ids:invalid});
    if(publish && selection.starters.length<3)fail('At least three eligible human starting players are required',422);
    return selection;
  }
  async function validate(body,q,options) {
    return validateRoster(body,await rosters.players(body.club_id,q),clock(),options);
  }
  async function assertEditable(body,existing,q) {
    if(existing && ['id','club_id','fixture_id','fixture_type'].some(key=>body[key]!==existing[key]))fail('A selection cannot move to another club or fixture',409);
    const ctx=await context(body.fixture_id,q);
    if(!ctx.official)return ctx;
    if(![ctx.match.home_club_id,ctx.match.away_club_id].includes(body.club_id))fail('This club is not a participant in the official fixture',403);
    if(await snapshot(ctx.match.id,q) || begun.has(ctx.match.status))fail('The official selection is frozen after kickoff');
    return ctx;
  }
  async function preparation(ctx,q) {
    const windows=matchWindows(ctx.match,clock());
    const stored=await preparations.selectOne(ctx.match.id,q);
    const state=stored?.schedule_key===windows.schedule_key?stored:{match_id:ctx.match.id,edition_id:ctx.root.id,schedule_key:windows.schedule_key,sides:{},history:stored?[...(stored.history || []),{schedule_key:stored.schedule_key,sides:stored.sides}]:[]};
    return {windows,state};
  }
  async function preparationStatus(clubId,ref) {
    return transaction(async q=>{
      const ctx=await context(ref,q);
      if(!ctx.official)return {official:false};
      if(![ctx.match.home_club_id,ctx.match.away_club_id].includes(clubId))fail('This club is not a participant',403);
      const {windows,state}=await preparation(ctx,q);
      const current=state.sides[clubId];
      let eligible=null,eligibility_message=null,player_labels={};
      if(current && !(await snapshot(ctx.match.id,q))) {
        try {const roster=await rosters.players(clubId,q);player_labels=Object.fromEntries(roster.filter(p=>playerIds(current.selection).ids.includes(p.id)).map(p=>[p.id,p.gamertag || p.id]));validateRoster(current.selection,roster,clock(),{publish:true});eligible=true;}
        catch(err) {if(err.status!==422)throw err;eligible=false;eligibility_message=err.message;}
      }
      return {official:true,eligible,eligibility_message,player_labels,...windows,started:Boolean(await snapshot(ctx.match.id,q)),lineup_id:current?.lineup_id || null,selection:current?playerIds(current.selection):null,selection_revision:current?selectionRevision(current.selection):null,ready_at:current?.ready_at || null,opponent_ready:Boolean(state.sides[ctx.match.home_club_id===clubId?ctx.match.away_club_id:ctx.match.home_club_id]?.ready_at)};
    });
  }
  async function preparationAction(clubId,ref,body,user) {
    return transaction(async q=>{
      const ctx=await assertEditable({club_id:clubId,fixture_id:ref},null,q);
      if(!ctx.official)fail('This match does not use official preparation',409);
      const {windows,state}=await preparation(ctx,q);
      if(!windows.can_ready)fail('Ready check opens fifteen minutes before kickoff');
      const current=state.sides[clubId];
      if(!current)fail('Publish your selection before the five-minute deadline');
      const [lineup]=await new Lineup().selectOne(current.lineup_id,q,true);
      if(!lineup || lineup.status!=='published' || selectionRevision(lineup)!==selectionRevision(current.selection))fail('Published selection evidence disagrees; reload or request Admin review');
      if(['reserve','withdraw_reserve'].includes(body.action) && current.last_reserve?.action===body.action && current.last_reserve?.out===body.out_player_id && current.last_reserve?.in===body.in_player_id)return {already_applied:true};
      if(body.expected_revision!==selectionRevision(lineup))fail('The published selection changed; review it before retrying');
      let next=lineup,action;
      if(body.action==='ready') {
        await validate(lineup,q,{publish:true});
        if(!matchWindows(ctx.match,clock()).can_ready)fail('Ready window changed');
        if(current.ready_at)return {already_applied:true};
        current.ready_at=clock().toISOString();action='official_selection_ready';
      } else if(['reserve','withdraw_reserve'].includes(body.action)) {
        if(!windows.locked)fail('Use the normal selection editor before the lock deadline');
        const selected=playerIds(lineup),original=current.locked_selection || selected;
        const withdraw=body.action==='withdraw_reserve';
        if(withdraw?!selected.bench.includes(body.out_player_id):(!selected.starters.includes(body.out_player_id) || !selected.bench.includes(body.in_player_id) || !original.bench.includes(body.in_player_id)))fail('Replace a starting player only with a previously declared reserve',422);
        const starters=withdraw?selected.starters:selected.starters.map(id=>id===body.out_player_id?body.in_player_id:id);
        const bench=selected.bench.filter(id=>id!==(withdraw?body.out_player_id:body.in_player_id));
        next={...lineup,starting_players:starters,bench_players:bench,captain_player_id:lineup.captain_player_id===body.out_player_id?body.in_player_id:lineup.captain_player_id};
        await validate(next,q,{publish:true});
        await new Lineup(next).update(lineup.id,q);
        current.locked_selection=original;current.selection=next;current.ready_at=null;current.last_reserve={action:body.action,out:body.out_player_id,in:body.in_player_id};
        action='official_reserve_changed';
        await preparations.notifyOpponent(ctx.match,clubId,uuid(),q);
      } else fail('Choose ready, reserve or withdraw_reserve',400);
      await preparations.save(state,q);
      await q('INSERT INTO club_operation_audit_logs (id,club_id,actor_user_id,actor_email,action,entity_type,entity_id,old_value,new_value,reason,created_date) VALUES (?,?,?,?,?,?,?,?,?,?,NOW())',[uuid(),clubId,user.id,user.email || null,action,'club_fixture_lineup',lineup.id,JSON.stringify(lineup),JSON.stringify({lineup:next,ready_at:current.ready_at}),null]);
      if(user.role_id!=null && [0,2].includes(Number(user.role_id)))await q('INSERT INTO admin_audit_log (id,admin_user_id,admin_email,action,entity_type,entity_id,old_value,new_value,reason,created_date) VALUES (?,?,?,?,?,?,?,?,?,NOW())',[uuid(),user.id,user.email || null,action,'club_fixture_lineup',lineup.id,JSON.stringify(lineup),JSON.stringify(next),'Official preparation']);
      return {success:true};
    });
  }
  async function mutate({body,existingId,user,remove=false}) {
    return transaction(async q=>{
      // All aliases serialize through the authoritative match before lineup rows.
      const seed=existingId?(await new Lineup().selectOne(existingId,q))[0]:null;
      if(existingId && !seed)fail('Lineup not found',404);
      const next={...seed,...body,created_by_user_id:seed?.created_by_user_id || user.id};
      const ctx=await assertEditable(next,seed,q);
      const existing=existingId?(await new Lineup().selectOne(existingId,q,true))[0]:null;
      if(existingId && (!existing || JSON.stringify(existing)!==JSON.stringify(seed)))fail('Selection changed; reload before retrying');
      let prepared;
      if(ctx.official) {
        prepared=await preparation(ctx,q);
        if(prepared.windows.locked)fail('Selection locked five minutes before kickoff; use the reserve action');
        const rows=await q(`SELECT * FROM club_fixture_lineups WHERE club_id=? AND fixture_id IN (${ctx.aliases.map(()=>'?').join(',')}) FOR UPDATE`,[next.club_id,...ctx.aliases]);
        if(rows.some(row=>row.id!==existingId))fail('A selection already exists for this match; edit that selection');
        if(!remove)await validate(next,q,{publish:next.status==='published'});
      } else if(!remove)await require('./playerLoanService').assertLineupEligibleForClub(next.club_id,next,{query:q});
      if(!remove && !['draft','published'].includes(next.status || 'draft'))fail('Invalid lineup status',400);
      const model=new Lineup(next);
      if(remove)await model.delete(existingId,q);
      else if(existingId)await model.update(existingId,q);
      else await model.create(q);
      const updated=remove?null:(await model.selectOne(existingId || model.id,q))[0];
      if(ctx.official) {
        if(matchWindows(ctx.match,clock()).locked)fail('The selection deadline passed while saving; no changes were saved');
        if(remove || next.status!=='published')delete prepared.state.sides[next.club_id];
        else prepared.state.sides[next.club_id]={lineup_id:updated.id,selection:updated,published_at:clock().toISOString(),ready_at:null};
        await preparations.save(prepared.state,q);
      }
      const action=remove?'lineup_deleted':next.status==='published'?'lineup_published':'lineup_saved';
      const values=[uuid(),next.club_id,user.id,user.email || null,action,'club_fixture_lineup',existingId || model.id,JSON.stringify(existing || null),JSON.stringify(updated),null];
      await q('INSERT INTO club_operation_audit_logs (id,club_id,actor_user_id,actor_email,action,entity_type,entity_id,old_value,new_value,reason,created_date) VALUES (?,?,?,?,?,?,?,?,?,?,NOW())',values);
      if(user.role_id!=null && [0,2].includes(Number(user.role_id)))await q('INSERT INTO admin_audit_log (id,admin_user_id,admin_email,action,entity_type,entity_id,old_value,new_value,reason,created_date) VALUES (?,?,?,?,?,?,?,?,?,NOW())',[uuid(),user.id,user.email || null,action,'club_fixture_lineup',existingId || model.id,JSON.stringify(existing || null),JSON.stringify(updated),'Club selection management']);
      return updated;
    });
  }
  async function kickoff(matchId,write,actor=null) {
    return transaction(async q=>{
      const ctx=await context(matchId,q);
      if(!ctx.official)return false;
      const captured=await snapshot(ctx.match.id,q);
      if(captured) {
        if(!begun.has(ctx.match.status))fail('Kickoff snapshot and match state disagree; Admin review required');
        return true;
      }
      if(begun.has(ctx.match.status))fail('Official kickoff evidence is missing; Admin review required');
      if(!['scheduled','confirmed'].includes(ctx.match.status))fail('Confirm the official match schedule before kickoff');
      const {windows,state}=await preparation(ctx,q);
      if(!windows.can_kickoff)fail('Official kickoff cannot start before the scheduled time');
      const selections={},pending=[];
      for(const side of ['home','away']) {
        const clubId=ctx.match[`${side}_club_id`];
        const rows=await q(`SELECT * FROM club_fixture_lineups WHERE club_id=? AND fixture_id IN (${ctx.aliases.map(()=>'?').join(',')}) FOR UPDATE`,[clubId,...ctx.aliases]);
        if(rows.length!==1 || rows[0].status!=='published')fail('Both clubs must publish one eligible selection before official kickoff',422);
        const prepared=state.sides[clubId];
        if(!prepared?.ready_at || prepared.lineup_id!==rows[0].id || selectionRevision(prepared.selection)!==selectionRevision(rows[0]))fail('Both clubs must mark their current published selection ready before kickoff');
        pending.push({side,clubId,lineup:rows[0],players:await rosters.players(clubId,q)});
      }
      const now=clock();
      for(const entry of pending)selections[entry.side]={club_id:entry.clubId,...validateRoster(entry.lineup,entry.players,now,{publish:true})};
      const record={id:snapshotId(ctx.match.id),policy_version:VERSION,match_id:ctx.match.id,edition_id:ctx.root.id,started_at:now.toISOString(),started_by_user_id:actor?.id || null,selections};
      await q("INSERT INTO league_entities (id,entity_type,data_json) VALUES (?,'official_match_selection',?)",[record.id,JSON.stringify(record)]);
      await write(q,ctx.match);
      if(actor?.role_id!=null && [0,2].includes(Number(actor.role_id)))await q('INSERT INTO admin_audit_log (id,admin_user_id,admin_email,action,entity_type,entity_id,old_value,new_value,reason,created_date) VALUES (?,?,?,?,?,?,?,?,?,NOW())',[uuid(),actor.id,actor.email || null,'official_match_kickoff','official_match_selection',ctx.match.id,null,JSON.stringify(record),'Home participant started official match']);
      return true;
    });
  }
  async function assertParticipants(match,side,args,q=query) {
    if(!['competition_engine','regional_league','regional_league_fixture','regional_pathway'].includes(match.source_fixture_type))return;
    const ctx=await context(match.id,q);
    if(!ctx.official)return;
    const captured=await snapshot(ctx.match.id,q);
    if(!captured || captured.policy_version!==VERSION)fail('Official kickoff selection evidence is missing; Admin review required');
    const selection=captured.selections?.[side];
    if(selection?.club_id!==match[`${side}_club_id`])fail('Official selection identity requires Admin review');
    const allowed=new Set(selection.ids);
    const ids=args.participating_player_ids;
    if(!Array.isArray(ids) || new Set(ids).size!==ids.length || ids.length<3 || ids.some(id=>!allowed.has(id)))fail('Declare at least three actual participants from the frozen official selection',422);
    const mentioned=[...(args.player_stats || []).map(s=>s.player_id),...(args.goal_events || []).flatMap(e=>[e.player_id,e.scorer_id,e.scorer_player_id,e.assist_player_id].filter(Boolean))];
    if(mentioned.some(id=>!ids.includes(id)))fail('Statistics must belong to declared actual participants',422);
  }
  async function assertGenericCreate(body) {
    if(body.source_fixture_id && (await context(body.source_fixture_id)).official)fail('Official fixtures are generated by the protected competition workflow',403);
  }
  async function assertGenericPatch(match,patch) {
    if(patch.source_fixture_id && patch.source_fixture_id!==match.source_fixture_id && (await context(patch.source_fixture_id)).official)fail('Use the official GameDay workflow to change this match');
    if(!['competition_engine','regional_league','regional_league_fixture','regional_pathway'].includes(match.source_fixture_type))return;
    const ctx=await context(match.id);
    if(!ctx.official)return;
    const editable=new Set(['notes','home_stream_url','away_stream_url']);
    if(Object.keys(patch).some(k=>!editable.has(k) && String(patch[k])!==String(match[k])))fail('Use the official GameDay workflow to change this match');
  }
  return {context,mutate,kickoff,assertParticipants,assertGenericPatch,assertGenericCreate,preparationStatus,preparationAction};
}
module.exports={createService,playerIds,...createService()};
