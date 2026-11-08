'use strict';
const crypto = require('node:crypto');
const { v4: uuid } = require('uuid');
const { EXECUTESQL, withTransaction } = require('../db/database');
const { identity, unpack, describe, fail } = require('../lib/regionalEditionIdentity');
const { buildCatalogue, permanentId } = require('../lib/regionalLeagueHierarchy');
const { RegionalCycleModel } = require('../models/regionalCycleModel');
const { CompetitionScopeModel } = require('../models/competitionScopeModel');
const { isConfirmedResult } = require('../lib/tournamentStatistics');
const policy = require('../lib/regionalStructure');
const autoAllocation = require('../lib/regionalAutoAllocationPolicy');
const {resolveClubPresidentContact}=require('./clubContactService');
const {parseMaybeJson,resolveDelivery}=require('./notificationPreferenceService');
const editions = require('./regionalEditionService');
const model = new RegionalCycleModel();
const scopes = new CompetitionScopeModel();
const canonical = value => value instanceof Date?value.toISOString():Array.isArray(value)?value.map(canonical):value && typeof value==='object'?Object.fromEntries(Object.keys(value).sort().map(k=>[k,canonical(value[k])])):value;
const hash = value => crypto.createHash('sha256').update(JSON.stringify(canonical(value))).digest('hex');
const stableId = value => { const h = hash(value).slice(0,32); return `${h.slice(0,8)}-${h.slice(8,12)}-${h.slice(12,16)}-${h.slice(16,20)}-${h.slice(20)}`; };
const list = value => { try { return typeof value === 'string' ? JSON.parse(value) : value; } catch { return null; } };
const allocationResultRevision = matches => hash(matches.map(m=>({id:m.id,source_fixture_id:m.source_fixture_id,home:m.home_club_id,away:m.away_club_id,status:String(m.status || '').toLowerCase(),state:String(m.result_state || '').toLowerCase(),home_score:Number(m.home_score),away_score:Number(m.away_score),decided_on_penalties:Number(m.decided_on_penalties || 0),penalty_winner_side:m.penalty_winner_side || null})).sort((a,b)=>String(a.id).localeCompare(String(b.id))));
const finished = ['completed','archived'];

function request(body) {
  if (!['placement','transition'].includes(body.mode)) fail('Choose placement or transition',400);
  const source_edition_ids = policy.unique(body.source_edition_ids, 'Source editions').slice().sort();
  const registration_ids = policy.unique(body.registration_ids || [], 'Approved registrations').slice().sort();
  if (!source_edition_ids.length || source_edition_ids.length>12 || registration_ids.length>240) fail('Provide a supported regional source field',400);
  if (['club_ids','winners','results','seed','rights','groups'].some(k=>Object.hasOwn(body,k))) fail('Participants, results, rights and the draw seed are read or assigned by the server',400);
  policy.structure(body.target_count);
  return {mode:body.mode,source_edition_ids,registration_ids,target_count:body.target_count};
}
async function audit(query,actor,action,before,after,reason) {
  await query('INSERT INTO admin_audit_log (id,admin_user_id,admin_email,action,entity_type,entity_id,old_value,new_value,reason) VALUES (?,?,?,?,?,?,?,?,?)',
    [uuid(),actor?.id || null,actor?.email || null,action,'regional_cycle',after.id,JSON.stringify(before || null),JSON.stringify(after),reason]);
}
function result(match, ref) {
  return {ref,home:match.home_club_id,away:match.away_club_id,status:match.status,confirmed:isConfirmedResult(match),home_score:match.home_score,away_score:match.away_score,
    disputed:['disputed','voided'].includes(String(match.result_state || '').toLowerCase()),decided_on_penalties:match.decided_on_penalties,penalty_winner_side:match.penalty_winner_side};
}
function sourceProjection(scope) {
  // Bookkeeping pointers change as a cycle is prepared. Sporting data, roster,
  // rules and all official result states remain part of the immutable source.
  const { pending_regional_cycle_id, next_season_id, current_edition_id, group_current_edition_ids, updated_date, regional_edition_key, regional_league_key, ...root } = scope.root;
  const byId=rows=>rows.slice().sort((a,b)=>String(a.id).localeCompare(String(b.id)));
  return {root,fixtures:byId(scope.fixtures),matches:byId(scope.matches),standings:byId(scope.standings)};
}
async function sources(input,query, cycleId = null, resolveSourceTies = false) {
  const all = await editions.model.selectAll(query,true);
  const catalogue = buildCatalogue(all);
  const source = [];
  for (const id of input.source_edition_ids) {
    const raw = all.find(r=>r.id===id);
    if (!raw || describe(raw).identity_error || describe(raw).indexed_json_differences.length) fail('Source edition identity requires review',409,{id});
    const scope = await scopes.selectOne('regional_league',id,query,true);
    const current = catalogue.groups.find(g=>g.current_edition_id===id);
    if (!current || current.identity_conflict || current.retired || scope.root.edition_invalidated) fail('Use the unambiguous current edition of an active permanent division',409,{id});
    source.push(scope);
  }
  const first = identity(source[0].root);
  for (const scope of source) {
    const i=identity(scope.root);
    if (i.region_slug!==first.region_slug || i.platform!==first.platform || i.season_number!==first.season_number || Number(i.reset_series || 0)!==Number(first.reset_series || 0)) fail('Source groups must belong to the same region, platform, season and reset series');
  }
  const season_number = first.season_number + (input.mode==='transition'?1:0);
  const reset_series = Number(first.reset_series || 0);
  const expectedCycle=cycleId || stableId(['regional_cycle',first.region_slug,first.platform,reset_series,season_number]);
  if(source.some(s=>s.root.pending_regional_cycle_id && s.root.pending_regional_cycle_id!==expectedCycle))fail('This edition already belongs to another pending regional cycle');
  const regionalCurrent = catalogue.groups.filter(g=>g.current_edition_id && identity(g).region_slug===first.region_slug && identity(g).platform===first.platform && Number(g.reset_series || 0)===reset_series);
  if (regionalCurrent.some(g=>!source.some(s=>s.root.id===g.current_edition_id) && (list(g.registered_club_ids)?.length || !['draft','registration'].includes(g.status)))) fail('Include all populated or started current groups of this regional system');
  const ids = source.flatMap(scope=>{
    const roster=list(scope.root.registered_club_ids);
    if (!Array.isArray(roster)) fail('A confirmed source roster is required',409,{id:scope.root.id});
    return roster;
  });
  const registrations = await model.registrations(input.registration_ids,query);
  if (registrations.length!==input.registration_ids.length) fail('An approved registration is unavailable');
  for (const registration of registrations) {
    const i=identity({...registration,slug:'',region_slug:registration.region_slug || registration.region,season_number:registration.season_number,division:registration.division || 1});
    if (registration.status!=='approved' || !registration.club_id || i.region_slug!==first.region_slug || i.platform!==first.platform || i.season_number!==season_number || Number(registration.reset_series || 0)!==reset_series) fail('New entrants require approved registrations for the exact target region, platform, season and reset series');
  }
  const newcomers=registrations.map(r=>r.club_id);
  const withdrawn=source.flatMap(scope=>scope.root.withdrawn_club_ids || []);
  let reserveField=null;
  if(input.mode==='transition') {
    const windows=new (require('../models/regionalRegistrationModel').RegionalRegistrationModel)();
    const matching=(await windows.selectAll(query)).filter(w=>w.status==='published' && w.region_slug===first.region_slug && w.platform===first.platform && Number(w.season_number)===season_number && Number(w.reset_series || 0)===reset_series);
    if(matching.length===1 && matching[0].reserve_policy_version===require('../lib/regionalReservePolicy').VERSION) {
      const entries=await windows.confirmedField(matching[0].id,query);
      const confirmed=entries.filter(r=>r.status==='approved' && r.participation_status==='confirmed');
      reserveField={confirmed:confirmed.map(r=>r.club_id),willing:confirmed.filter(r=>r.reserve_response?.decision==='accept').map(r=>r.club_id)};
    }
  }
  policy.unique([...ids.filter(id=>!withdrawn.includes(id)),...newcomers],'Regional participants');
  const participantSet=new Set([...ids,...newcomers]);
  for(const group of catalogue.groups.filter(g=>g.current_edition_id && !source.some(s=>s.root.id===g.current_edition_id))) {
    if(!finished.includes(group.status) && !['reset','cancelled','abandoned','superseded'].includes(group.status) && (list(group.registered_club_ids) || []).some(id=>participantSet.has(id)))fail('A club is still participating in another current regional group');
  }
  if(input.mode==='placement' && catalogue.editions.some(e=>finished.includes(e.status) && (list(e.registered_club_ids) || []).some(id=>participantSet.has(id))))fail('Clubs with prior regional sporting rights cannot be placed again as launch newcomers');
  if((reserveField?ids.filter(id=>!withdrawn.includes(id) && reserveField.confirmed.includes(id)).length:ids.length)+newcomers.length!==input.target_count)fail('The confirmed field does not fill the selected target structure');
  const clubs=await model.clubs([...participantSet],query);
  if(clubs.length!==participantSet.size)fail('A participating club is unavailable; review withdrawals');
  const sourceRegistrations=(await model.linkedRegistrations([...ids,...newcomers],query)).filter(r=>participantSet.has(r.club_id) && !input.registration_ids.includes(r.id) && input.source_edition_ids.includes(r.assigned_league_id));
  const rankings=[];
  for(const scope of source) {
    if(input.mode==='placement') {
      if(!['draft','registration'].includes(scope.root.status) || scope.fixtures.length)fail('Initial placement requires unplayed registration editions; it cannot replace earned sporting rights');
      const i=identity(scope.root);
      if(!policy.structure(input.target_count).groups.some(g=>g.division===i.division&&g.group_code===i.group_code))fail('A source group lies outside the target launch structure; review staging instead of silently dropping a group');
    } else {
      if(!finished.includes(scope.root.status) && !(resolveSourceTies && ['in_progress','active'].includes(scope.root.status)))fail('All source groups must have completed their league season');
      const integrity=require('../lib/standingIntegrity').reviewStandings(scope);
      if(integrity.requires_review)fail('Source standings do not match the confirmed league results',409,integrity);
      const roster=list(scope.root.registered_club_ids);
      if(roster.length!==20 || scope.fixtures.length!==380 || scope.matches.length!==380 || scope.matches.some(m=>!m.match_id))fail('A source group needs twenty clubs and all 380 confirmed official league matches');
      if(scope.matches.some(m=>!require('../lib/regionalWithdrawal').resolvedFixture(scope,m))){const error=new Error('A source group needs twenty clubs and all 380 confirmed official league matches');error.status=409;error.code='REGIONAL_SOURCE_RESULTS_PENDING';throw error;}
      const pairs=scope.matches.map(m=>`${m.home_club_id}:${m.away_club_id}`);
      if(new Set(pairs).size!==380 || scope.matches.some(m=>!roster.includes(m.home_club_id)||!roster.includes(m.away_club_id)||m.home_club_id===m.away_club_id))fail('The source league schedule is incomplete or contains duplicate/foreign pairings');
      const fixtures=scope.matches.map(m=>({ref:m.id,home:m.home_club_id,away:m.away_club_id}));
      const table=policy.standings(roster,fixtures,scope.matches.map(m=>({...result(m,m.id),resolved_withdrawal:require('../lib/regionalWithdrawal').resolvedFixture(scope,m)})),{excluded:scope.root.withdrawn_club_ids || []});
      if(!table || (!resolveSourceTies && table.some(r=>r.tied)))fail('Final source ranking requires a sporting decision before promotion can be drawn');
      if(resolveSourceTies && table.some(r=>r.tied) && scope.root.winner_club_id)fail('A tied historical edition already records a champion; review honours before drawing new decisions');
      const i=identity(scope.root);
      rankings.push({ref:`D${i.division}${i.group_code}`,division:i.division,final:true,ranked_club_ids:table.map(r=>r.id),table});
    }
  }
  // Validate all permanent target divisions before a draw creates any matches.
  const target=policy.structure(input.target_count);
  const definitions=[];
  for(const division of [...new Set(target.groups.map(g=>g.division))]) {
    const matching=catalogue.definitions.filter(d=>{const i=identity(d);return i.region_slug===first.region_slug&&i.platform===first.platform&&i.division===division;});
    if(matching.length!==1 || matching[0].retired || matching[0].retired_at || matching[0].status==='retired')fail('Configure one active permanent league for every target division before preparing the cycle',409,{division});
    definitions.push(matching[0]);
  }
  const participation=await require('./regionalRegistrationService').confirmedField(first.region_slug,first.platform,season_number,reset_series,[...ids.filter(id=>!withdrawn.includes(id) && (!reserveField || reserveField.confirmed.includes(id))),...newcomers],query);
  const source_revision=hash({source:source.map(sourceProjection),registrations,sourceRegistrations,clubs,...(participation?{participation}:{}),definitions:definitions.map(d=>({id:d.id,trophy_item_id:d.trophy_item_id,rules:d.rules,retired:d.retired,reward_defaults:d.reward_defaults}))});
  return {source,ids,newcomers,withdrawn,rankings,clubs,definitions,registrations,sourceRegistrations,participation,reserveField,source_revision,region_slug:first.region_slug,platform:first.platform,season_number,reset_series};
}
function calculate(input, evidence, seed, results=[], tieVersion=policy.TIE_VERSION, sourceVersion=policy.SOURCE_RANKING_VERSION) {
  if(tieVersion && tieVersion!==policy.TIE_VERSION)fail('Unsupported supplementary sporting decision policy');
  if(sourceVersion && sourceVersion!==policy.SOURCE_RANKING_VERSION)fail('Unsupported final league ranking policy');
  const options={resolve_ties:tieVersion===policy.TIE_VERSION,resolve_source_ties:sourceVersion===policy.SOURCE_RANKING_VERSION};
  if(input.mode==='placement')return policy.placement(input.target_count,[...evidence.ids,...evidence.newcomers],seed,results,options);
  if(!evidence.reserveField && evidence.withdrawn?.length)fail('Withdrawal vacancies need the captured confirmed reserve field; use the existing participation review.');
  if(!evidence.reserveField)return policy.transition(evidence.ids.length,input.target_count,evidence.rankings,evidence.newcomers,seed,results,options);
  const entrants=policy.shuffle(evidence.newcomers.filter(id=>!evidence.ids.includes(id)),`${seed}:confirmed-entrants`),growth=input.target_count-evidence.ids.length;
  if(growth<0)fail('Regional shrinkage requires an approved sporting policy.');
  const plan=policy.transition(evidence.ids.length,input.target_count,evidence.rankings,entrants.slice(0,growth),seed,results,options);
  return require('../lib/regionalReserveAllocation').resolve(plan,{count:input.target_count,...evidence.reserveField,replacements:[...entrants.slice(growth),...evidence.newcomers.filter(id=>evidence.withdrawn?.includes(id))],excluded:evidence.withdrawn,seed,results,rankings:evidence.rankings});
}
async function preview(body,actor,query=EXECUTESQL,automatic=false) {
  if(!automatic)await editions.admin(actor,query);
  const input=request(body), evidence=await sources(input,query,null,true);
  const id=stableId(['regional_cycle',evidence.region_slug,evidence.platform,evidence.reset_series,evidence.season_number]);
  const existing=await model.selectOne(id,query);
  const blockers=[];
  if(evidence.ids.length===180 && input.target_count===240)blockers.push('The extra five-match promotion calendar must be verified in the calendar phase before this growth can activate');
  const plan=calculate(input,evidence,'preview-only-not-a-published-draw');
  blockers.push(...(plan.blockers || []));
  return {id,input,version:policy.VERSION,tie_policy_version:policy.TIE_VERSION,source_ranking_policy_version:policy.SOURCE_RANKING_VERSION,source_revision:evidence.source_revision,
    revision:hash([input,evidence.source_revision,policy.VERSION,policy.TIE_VERSION,policy.SOURCE_RANKING_VERSION]),existing_cycle_id:existing?.id || null,
    structure:policy.structure(input.target_count),initial_fixtures:plan.fixtures.length,blockers,region_slug:evidence.region_slug,platform:evidence.platform,season_number:evidence.season_number,reset_series:evidence.reset_series,
    confirmed_participants:evidence.reserveField?evidence.reserveField.confirmed.length:evidence.ids.length+evidence.newcomers.length,automatic_allocation:autoAllocation.capturesAutomaticAllocation(evidence.participation?.window),financial_mutations:false};
}
async function applyPreparation(body,actor,automatic=false) {
  if (Object.hasOwn(body,'registration_window_id')) {
    if (Object.keys(body).some(key => key !== 'registration_window_id')) fail('A confirmed-field request only accepts its registration window. Review the returned preview before applying its canonical input.',400);
    const input=await require('./regionalConfirmedCycleService').inputForWindow(body.registration_window_id,actor);
    return withTransaction(query=>preview(input,actor,query));
  }
  if(body.apply!==true)return withTransaction(query=>preview(body,actor,query));
  if(!String(body.reason || '').trim())fail('An administrative reason is required',400);
  return withTransaction(async query=>{
    const user=automatic?{id:null,email:null}:await editions.admin(actor,query);await editions.model.lock(query);
    const input=request(body);
    // A timeout retry may arrive after allocation moved every current pointer.
    // Resolve its established operation before requiring fresh source editions.
    const firstRow=(await editions.model.selectAll(query,true)).find(r=>r.id===input.source_edition_ids[0]);
    if(firstRow) {
      const i=identity(unpack(firstRow));
      const priorId=stableId(['regional_cycle',i.region_slug,i.platform,Number(i.reset_series || 0),i.season_number+(input.mode==='transition'?1:0)]);
      const prior=await model.selectOne(priorId,query,true);
      if(prior) {
        if(hash(prior.input)!==hash(input))fail('A different regional cycle already occupies this target season');
        return {already_applied:true,cycle:prior};
      }
    }
    const evidence=await sources(input,query,null,true);
    const id=stableId(['regional_cycle',evidence.region_slug,evidence.platform,evidence.reset_series,evidence.season_number]);
    const existing=await model.selectOne(id,query,true);
    if(existing) {
      if(hash(existing.input)!==hash(input))fail('A different regional cycle already occupies this target season');
      return {already_applied:true,cycle:existing};
    }
    if(automatic && !require('../lib/regionalSeasonOrchestrationPolicy').enabled({...evidence.participation?.window,status:'published'}))fail('Automatic preparation requires captured current participation conditions.');
    const report=await preview(body,actor,query,automatic);
    if(report.revision!==body.expected_revision)fail('Regional sources changed since preview; review again');
    if(report.blockers.length)fail('Regional cycle activation requires review',409,report.blockers);
    const seed=crypto.randomBytes(32).toString('hex');
    const cycle={id,input,policy_version:policy.VERSION,tie_policy_version:policy.TIE_VERSION,source_ranking_policy_version:policy.SOURCE_RANKING_VERSION,status:'running',seed,source_revision:evidence.source_revision,source_edition_ids:input.source_edition_ids,
      region_slug:evidence.region_slug,platform:evidence.platform,season_number:evidence.season_number,reset_series:evidence.reset_series,
      permanent_league_ids:evidence.definitions.map(d=>d.id),created_by_user_id:user.id,created_at:new Date().toISOString(),fixture_refs:{}};
    cycle.source_snapshot=evidence.source.map(s=>({edition_id:s.root.id,permanent_league_id:permanentId(s.root),identity:identity(s.root),club_ids:list(s.root.registered_club_ids),results:s.matches.map(m=>result(m,m.id))}));
    cycle.structure_snapshot=policy.structure(input.target_count);
    cycle.registration_snapshot=[...evidence.registrations,...evidence.sourceRegistrations];
    cycle.participation_window_snapshot=evidence.participation?.window || null;
    if(automatic)cycle.preparation_mode='automatic_followup';
    if(autoAllocation.capturesAutomaticAllocation(cycle.participation_window_snapshot))cycle.automatic_allocation_policy_version=autoAllocation.VERSION;
    await model.create(cycle,query);
    for(const scope of evidence.source)await editions.model.update({...scope.root,pending_regional_cycle_id:id},identity(scope.root).key,query);
    await model.insert('competition_instances',{id,product_type:'regional_league',legacy_source_type:'regional_cycle',legacy_source_id:id,name:`${cycle.region_slug} · ${input.mode} · Season ${cycle.season_number}`,region:cycle.region_slug,platform:cycle.platform,status:'in_progress',created_by_user_id:user.id},query);
    for(const club of evidence.clubs)await model.insert('competition_participants',{id:stableId([id,club.id]),competition_instance_id:id,participant_type:'club',club_id:club.id,status:'approved'},query);
    const plan=calculate(input,evidence,seed);
    await materialize(cycle,plan,evidence.clubs,[],query);
    await audit(query,user,'prepare_regional_cycle',null,cycle,body.reason);
    return {applied:true,cycle};
  });
}
async function prepare(body,actor) {
  return applyPreparation(body,actor,false);
}
async function reconcilePreparation(windowId) {
  const input=await require('./regionalConfirmedCycleService').automaticInputForWindow(windowId);
  if(input.existing_cycle_id) {
    const cycle=await model.selectOne(input.existing_cycle_id,EXECUTESQL);
    if(!cycle || cycle.edition_invalidated || !['running','review','ready','allocated'].includes(cycle.status))fail('The saved automatic regional cycle requires review.');
    return {already_applied:true,cycle};
  }
  let report;
  try{report=await withTransaction(query=>preview(input,null,query,true));}catch(error){if(error.code==='REGIONAL_SOURCE_RESULTS_PENDING')return {waiting_source_results:true};throw error;}
  return applyPreparation({...input,apply:true,expected_revision:report.revision,reason:'Automatic preparation after the published regional confirmation cutoff'},null,true);
}
async function materialize(cycle,plan,clubs,stored,query) {
  for(const fixture of plan.fixtures) {
    const id=stableId([cycle.id,fixture.ref]);
    const old=stored.find(f=>f.id===id);
    if(old) {
      if(old.home_club_id!==fixture.home || old.away_club_id!==fixture.away)fail('An official result changed a published draw; authorised review is required');
      continue;
    }
    const home=clubs.find(c=>c.id===fixture.home),away=clubs.find(c=>c.id===fixture.away);
    const matchId=stableId([id,'match']);
    const phase=fixture.allow_penalties?'knockout_final':'league';
    await model.insert('competition_fixtures',{id,competition_instance_id:cycle.id,legacy_fixture_type:'regional_pathway',legacy_fixture_id:id,match_id:matchId,participant_type:'club',format:fixture.allow_penalties?'knockout':'league',phase,round:fixture.round,leg:1,
      home_participant_id:stableId([cycle.id,fixture.home]),away_participant_id:stableId([cycle.id,fixture.away]),home_club_id:fixture.home,away_club_id:fixture.away,
      home_club_name:home.name,away_club_name:away.name,home_owner_email:home.owner_email,away_owner_email:away.owner_email,status:'unscheduled',scheduling_status:'open',idempotency_key:`regional:${cycle.id}:${fixture.ref}`},query);
    await model.insert('matches',{id:matchId,home_club_id:home.id,away_club_id:away.id,home_club_name:home.name,away_club_name:away.name,home_owner_email:home.owner_email,away_owner_email:away.owner_email,
      status:'pending_schedule',mode:'club',type:fixture.allow_penalties?'knockout':'league',round:fixture.round,source_fixture_type:'competition_engine',source_fixture_id:id,competition_context:cycle.id,allow_penalties:fixture.allow_penalties?1:0},query);
    cycle.fixture_refs[fixture.ref]=id;
  }
  if(cycle.automatic_allocation_policy_version && plan.ready) {
    const revision=allocationResultRevision(await model.matches(cycle.id,query));
    if(cycle.ready_result_revision && cycle.ready_result_revision!==revision)fail('Previously final pathway evidence changed; review allocation before applying new sporting rights.');
    cycle.ready_result_revision=revision;
  }
  cycle.plan=plan;cycle.status=plan.blockers?.length?'review':plan.ready?'ready':'running';
  cycle.updated_at=new Date().toISOString();
  await model.update(cycle,query);
}
async function evaluate(cycle,query) {
  if(cycle.policy_version!==policy.VERSION)fail('Unsupported regional policy snapshot');
  if(!['running','review','ready'].includes(cycle.status))fail('This regional cycle is closed');
  const evidence=await sources(cycle.input,query,cycle.id,cycle.source_ranking_policy_version===policy.SOURCE_RANKING_VERSION);
  if(evidence.source_revision!==cycle.source_revision)fail('Regional source data changed; the captured cycle requires review');
  const stored=await model.fixtures(cycle.id,query),matches=await model.matches(cycle.id,query);
  const results=Object.entries(cycle.fixture_refs).map(([ref,id])=>{
    const fixture=stored.find(f=>f.id===id),matching=matches.filter(m=>m.source_fixture_id===id);
    if(!fixture || matching.length!==1 || matching[0].id!==fixture.match_id)fail('Missing or ambiguous official pathway fixture',409,{ref});
    return result(matching[0],ref);
  });
  const plan=calculate(cycle.input,evidence,cycle.seed,results,cycle.tie_policy_version || null,cycle.source_ranking_policy_version || null);
  if(stored.some(f=>!plan.fixtures.some(p=>stableId([cycle.id,p.ref])===f.id)))fail('A published downstream fixture no longer follows the official results');
  return {evidence,stored,plan};
}
async function progress(id,actor=null,reason='Official result reconciliation') {
  return withTransaction(async query=>{
    const user=actor?await editions.admin(actor,query):null;
    await editions.model.lock(query);
    const cycle=await model.selectOne(id,query,true);
    if(!cycle)fail('Regional cycle not found',404);
    if(cycle.status==='allocated')return {already_applied:true,cycle};
    const before=structuredClone(cycle),{evidence,stored,plan}=await evaluate(cycle,query);
    await materialize(cycle,plan,evidence.clubs,stored,query);
    if(user || hash(before.plan)!==hash(plan))await audit(query,user,'progress_regional_cycle',before,cycle,reason);
    return {cycle};
  });
}
async function allocationPreview(id,actor,query=EXECUTESQL,automatic=false) {
  if(!automatic)await editions.admin(actor,query);
  const cycle=await model.selectOne(id,query,true);
  if(!cycle)fail('Regional cycle not found',404);
  if(cycle.status==='allocated')return {already_applied:true,cycle};
  const {evidence,plan}=await evaluate(cycle,query);
  return {id,ready:plan.ready,revision:hash([cycle.id,evidence.source_revision,plan]),groups:plan.groups || [],rights:plan.rights || [],blockers:plan.blockers || (plan.ready?[]:['Official placement or promotion results are still missing']),financial_mutations:false};
}
async function allocationNotices(cycle,plan,allocated,evidence,query) {
  const settings=new Map();let stored=0,muted=0;
  for(const right of plan.rights) {
    const group=plan.groups.find(g=>g.club_ids.includes(right.club_id));
    const target=allocated.find(g=>g.division===group.division && g.group_code===group.group_code);
    const club=evidence.clubs.find(c=>c.id===right.club_id),definition=evidence.definitions.find(d=>d.id===target.permanent_league_id);
    const contact=await resolveClubPresidentContact({clubId:club.id,query,forUpdate:true});
    if(!contact.email)fail('A club has no reachable president contact. Group allocation was not saved; review club contact details.');
    if(!settings.has(contact.email))settings.set(contact.email,parseMaybeJson(await model.notificationSettings(contact.email,query),{}));
    if(!resolveDelivery(settings.get(contact.email),'club_updates').inApp){muted++;continue;}
    const edition=encodeURIComponent(target.id),season=`${cycle.reset_series?`Series ${cycle.reset_series} · `:''}Season ${cycle.season_number}`;
    await model.saveAllocationNotification({id:stableId(['regional_allocation_notice',cycle.id,club.id]),recipient_email:contact.email,
      body:`${club.name}: ${definition.name} · Division ${group.division} · Group ${group.group_code} · ${season}. Your group is a draft. Match dates will appear after the official calendar is published.`,
      link:`/leagues/${edition}?season=${edition}`,edition_id:target.id,idempotency_key:`regional_allocation:${cycle.id}:${club.id}`},query);
    stored++;
  }
  return {version:'regional_allocation_notice_v1',stored,muted};
}
async function applyAllocation(id,body,actor,automatic=false) {
  if(body.apply!==true)return withTransaction(query=>allocationPreview(id,actor,query));
  if(!String(body.reason || '').trim())fail('An administrative reason is required',400);
  return withTransaction(async query=>{
    const user=automatic?{id:null,email:null}:await editions.admin(actor,query);await editions.model.lock(query);
    const cycle=await model.selectOne(id,query,true);
    if(!cycle)fail('Regional cycle not found',404);
    if(automatic) {
      if(!cycle.automatic_allocation_policy_version)return {status:'not_enabled',cycle};
      if(cycle.automatic_allocation_policy_version!==autoAllocation.VERSION || cycle.policy_version!==policy.VERSION || cycle.tie_policy_version!==policy.TIE_VERSION || cycle.source_ranking_policy_version!==policy.SOURCE_RANKING_VERSION || !autoAllocation.capturesAutomaticAllocation(cycle.participation_window_snapshot))fail('Automatic allocation policy or captured participation conditions require review.');
      if(cycle.edition_invalidated)fail('An invalidated regional cycle cannot allocate groups.');
    }
    if(cycle.status==='allocated')return {already_applied:true,cycle};
    const report=await allocationPreview(id,actor,query,automatic);
    if(!report.ready || report.blockers.length)fail('Sporting rights are not final',409,report.blockers);
    if(!automatic && report.revision!==body.expected_revision)fail('Official results changed since allocation preview');
    if(automatic) {
      const matches=await model.matches(id,query);
      if(matches.length!==Object.keys(cycle.fixture_refs).length || matches.some(m=>!isConfirmedResult(m) || !['confirmed','admin_confirmed','admin_resolved'].includes(String(m.result_state || '').toLowerCase())))fail('Automatic allocation requires explicit definitive results for every captured pathway match.');
      if(!cycle.ready_result_revision || cycle.ready_result_revision!==allocationResultRevision(matches))fail('Final pathway evidence changed or is not captured; review automatic allocation.');
    }
    const {evidence,plan}=await evaluate(cycle,query);
    const all=(await editions.model.selectAll(query,true)).map(unpack);
    const allocated=[];
    for(const group of plan.groups) {
      const root=evidence.definitions.find(d=>Number(d.division)===group.division);
      const normalized=identity({...root,slug:'',group_code:group.group_code,season_number:cycle.season_number,reset_series:cycle.reset_series});
      let edition=all.find(e=>identity(e).key===normalized.key);
      if(edition && (permanentId(edition)!==root.id || !['draft','registration'].includes(edition.status) || edition.edition_invalidated))fail('The target group already has incompatible activity');
      if(edition) {
        if(!evidence.source.some(s=>s.root.id===edition.id) && (list(edition.registered_club_ids)?.length || list(edition.registered_clubs)?.length))fail('The target group already has participants outside this captured source field');
        const targetScope=await scopes.selectOne('regional_league',edition.id,query,true);
        if(targetScope.fixtures.length || targetScope.standings.some(s=>Number(s.played)>0))fail('Cannot replace a target group after fixture generation');
      } else {
        const defaults=Object.fromEntries(Object.entries(root).filter(([k])=>['name','region','region_slug','country_code','platform','division','trophy_item_id','rules','rules_text','rules_file_url','linked_league_id','linked_league_slug','entry_credits','entry_fee'].includes(k)||k.startsWith('default_')));
        const previous=evidence.source.find(s=>permanentId(s.root)===root.id && identity(s.root).group_code===group.group_code)?.root;
        const made=await editions.createInside({...defaults,slug:normalized.canonical_slug,group_code:group.group_code,season_number:cycle.season_number,reset_series:cycle.reset_series,permanent_league_id:root.id,
          status:'draft',previous_season_id:previous?.id,season_label:`${cycle.reset_series?`Series ${cycle.reset_series} · `:''}Season ${cycle.season_number}`,registered_club_ids:[]},query,user);
        edition=made.record;all.push(edition);
        if(previous)await editions.model.update({...previous,next_season_id:edition.id},identity(previous).key,query);
      }
      const record={...edition,status:'draft',registered_club_ids:group.club_ids,registered_clubs:group.club_ids,num_clubs:20,max_clubs:20,group_code:group.group_code,regional_cycle_id:cycle.id,regional_structure_version:cycle.policy_version,pending_regional_cycle_id:null,
        regional_registration_window_id:evidence.participation?.window.id || null,regional_participation_policy_version:evidence.participation?.window.policy_version || null,
        ...(evidence.participation?{rules:evidence.participation.window.rules_text,rules_file_url:null}:{}),
        promoted_slots:group.division===2?2:0,relegated_slots:group.division===1?policy.structure(cycle.input.target_count).relegated_per_d1:0};
      await editions.model.update(record,normalized.key,query);
      await query("DELETE FROM league_entities WHERE entity_type='regional_league_standing' AND league_id=?",[record.id]);
      for(const club_id of group.club_ids) {
        const club=evidence.clubs.find(c=>c.id===club_id);
        const standing={id:stableId([record.id,club_id,'standing']),league_id:record.id,club_id,club_name:club.name,status:'active',played:0,wins:0,draws:0,losses:0,goals_for:0,goals_against:0,goal_difference:0,points:0};
        await model.insert('league_entities',{id:standing.id,entity_type:'regional_league_standing',data_json:JSON.stringify(standing),league_id:record.id,club_id,status:'active'},query);
      }
      allocated.push({id:record.id,permanent_league_id:root.id,group_code:group.group_code,division:group.division});
    }
    const assignable=[...new Map([...evidence.registrations,...(evidence.participation?.registrations || []),...(cycle.input.mode==='placement'?evidence.sourceRegistrations.filter(r=>r.status==='approved'):[])].map(r=>[r.id,r])).values()];
    for(const registration of assignable) {
      const group=plan.groups.find(g=>g.club_ids.includes(registration.club_id));
      const target=allocated.find(g=>g.division===group.division&&g.group_code===group.group_code);
      const definition=evidence.definitions.find(d=>d.id===target.permanent_league_id);
      await model.assignRegistration({...registration,league_id:target.id,division:target.division,platform:cycle.platform,region:cycle.region_slug,region_slug:cycle.region_slug,season_number:cycle.season_number,reset_series:cycle.reset_series,assigned_league_id:target.id,assigned_division:target.division,assigned_league_name:definition.name,assigned_group_code:target.group_code,regional_cycle_id:cycle.id},query);
    }
    // Update each root once, after group A may itself have been the root row.
    const latest=(await editions.model.selectAll(query,true)).map(unpack);
    for(const definition of evidence.definitions) {
      const root=latest.find(r=>r.id===definition.id),groups=allocated.filter(g=>g.permanent_league_id===root.id);
      await editions.model.update({...root,current_edition_id:groups.find(g=>g.group_code==='A').id,group_current_edition_ids:Object.fromEntries(groups.map(g=>[g.group_code,g.id])),pending_regional_cycle_id:null},identity(root).key,query);
    }
    if(cycle.input.mode==='transition')for(const scope of evidence.source)for(const row of scope.standings) {
      const right=plan.rights.find(r=>r.club_id===row.club_id);
      const position=(plan.source_rankings || evidence.rankings).find(g=>g.ref===`D${scope.root.division}${identity(scope.root).group_code}`).ranked_club_ids.indexOf(row.club_id)+1;
      const record={...row,final_position:position,is_promoted:!row.is_excluded && !!right && right.division<Number(scope.root.division),is_relegated:!row.is_excluded && !!right && right.division>Number(scope.root.division),...(!right?{next_edition_participation:'not_confirmed'}:{})};
      await query("UPDATE league_entities SET data_json=?,updated_date=NOW() WHERE id=? AND entity_type='regional_league_standing'",[JSON.stringify(record),row.id]);
    }
    if(cycle.input.mode==='transition' && plan.source_rankings) {
      const updated=(await editions.model.selectAll(query,true)).map(unpack);
      for(const scope of evidence.source) {
        const root=updated.find(r=>r.id===scope.root.id),i=identity(root);
        const ranking=plan.source_rankings.find(g=>g.ref===`D${i.division}${i.group_code}`);
        // Complete the source edition only after the supplementary decisions and
        // official promotion route are final. Keep original points and matches.
        const winner=evidence.clubs.find(club=>club.id===ranking.ranked_club_ids[0]);
        await editions.model.update({...root,status:'completed',completed_at:root.completed_at || new Date().toISOString(),
          ...(!root.winner_club_id?{winner_club_id:winner.id,winner_club_name:winner.name}:{}),
          regional_final_ranked_club_ids:ranking.ranked_club_ids,regional_final_ranking_cycle_id:cycle.id,regional_final_results_revision:policy.leagueResultRevision(scope.matches),pending_regional_cycle_id:null,withdrawal_review_required:false},i.key,query);
      }
    }
    const before=structuredClone(cycle);
    const allocation_notifications=cycle.automatic_allocation_policy_version===autoAllocation.VERSION?await allocationNotices(cycle,plan,allocated,evidence,query):null;
    Object.assign(cycle,{status:'allocated',plan,allocated_groups:allocated,allocated_at:new Date().toISOString(),allocated_by:user.id,allocation_mode:automatic?'automatic_followup':'admin_reviewed',...(allocation_notifications?{allocation_notifications}:{})});
    await model.completeInstance(cycle.id,query);
    await model.update(cycle,query);
    await audit(query,user,'allocate_regional_groups',before,cycle,body.reason);
    return {applied:true,cycle};
  });
}
async function allocate(id,body,actor) {return applyAllocation(id,body,actor);}
async function reconcileAllocation(id) {
  return applyAllocation(id,{apply:true,reason:'System allocated final captured sporting rights into draft groups.'},null,true);
}
async function read(id,actor) {
  await editions.admin(actor);
  const cycle=await model.selectOne(id,EXECUTESQL);
  if(!cycle)fail('Regional cycle not found',404);
  return {cycle};
}
async function catalogue(actor) {
  await editions.admin(actor);
  return {cycles:(await model.selectAll(EXECUTESQL)).map(c=>({id:c.id,status:c.status,mode:c.input.mode,region_slug:c.region_slug,platform:c.platform,season_number:c.season_number,reset_series:c.reset_series,target_count:c.input.target_count,source_edition_ids:c.source_edition_ids}))};
}
async function draw(id,query=EXECUTESQL) {
  const cycle=await model.selectOne(id,query);
  if(!cycle)fail('Regional cycle not found',404);
  const fixtures=await model.fixtures(id,query,false);
  const matches=await model.matches(id,query,false);
  return {id,status:cycle.status,version:cycle.policy_version,region_slug:cycle.region_slug,season_number:cycle.season_number,reset_series:cycle.reset_series,
    fixtures:fixtures.map(f=>({id:f.id,ref:Object.entries(cycle.fixture_refs).find(([,id])=>id===f.id)?.[0],match_id:f.match_id,home_club_id:f.home_club_id,home_club_name:f.home_club_name,away_club_id:f.away_club_id,away_club_name:f.away_club_name,status:matches.find(m=>m.id===f.match_id)?.status || f.status,round:f.round,phase:f.phase})),blockers:cycle.plan?.blockers || []};
}
async function assertWritableFixture(fixture,query=EXECUTESQL) {
  if(fixture?.legacy_fixture_type!=='regional_pathway')return;
  const cycle=await model.selectOne(fixture.competition_instance_id,query);
  if(!cycle || !['running','review','ready'].includes(cycle.status) || cycle.edition_invalidated)fail('This pathway cycle is closed; its results cannot change sporting rights');
}
module.exports={prepare,reconcilePreparation,preview,progress,allocate,reconcileAllocation,read,draw,catalogue,assertWritableFixture,stableId,evaluate};
