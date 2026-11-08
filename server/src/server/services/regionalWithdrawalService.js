'use strict';
const {withTransaction}=require('../db/database');
const {v5:uuid,v4}=require('uuid');
const {CompetitionScopeModel,unpack}=require('../models/competitionScopeModel');
const policy=require('../lib/regionalWithdrawal');
const fail=(message,status=409)=>{throw Object.assign(Error(message),{status});};
const receiptId=(edition,club)=>uuid(`regional_withdrawal:${edition}:${club}`,uuid.URL);
async function action(editionId,body,actor) {
 const outcome=await withTransaction(async q=>{
  const admin=await require('./regionalEditionService').admin(actor,q);
  await require('./regionalEditionService').model.lock(q);
  const [previous]=await q("SELECT * FROM league_entities WHERE id=? AND entity_type='regional_withdrawal' FOR UPDATE",[receiptId(editionId,body.club_id)]);
  if(previous)return {already_applied:true,withdrawal:unpack(previous)};
  await require('./leagueLifecycleService').assertEditionWritable(q,'regional_league',editionId,{allowCompleted:false});
  const scope=await new CompetitionScopeModel().selectOne('regional_league',editionId,q,true);
  if(scope.root.pending_regional_cycle_id || scope.root.next_season_id || scope.root.regional_final_ranking_cycle_id)fail('Existing sporting progression depends on this edition. Resolve the downstream competition review before applying withdrawal.');
  const paid=await q("SELECT id FROM competition_payouts WHERE source_type='regional_league' AND source_id=? AND edition_id=? AND status='paid' LIMIT 1",[editionId,scope.edition_id]);
  const qualifications=await q("SELECT id FROM league_entities WHERE entity_type='qualification_entry' AND JSON_UNQUOTE(JSON_EXTRACT(data_json,'$.source_league_id'))=? LIMIT 1",[editionId]);
  if(paid.length||qualifications.length)fail('Awards, qualification or payments depend on this edition. Resolve their existing Admin review before applying withdrawal; history is preserved.');
  const registrations=new (require('../models/regionalRegistrationModel').RegionalRegistrationModel)();
  const futureRegistrations=(await registrations.registrations(body.club_id,q)).filter(r=>
   r.region_slug===scope.root.region_slug && r.platform===scope.root.platform
   && Number(r.season_number)===Number(scope.root.season_number)+1
   && Number(r.reset_series || 0)===Number(scope.root.reset_series || 0)
   && !['withdrawn','rejected','cancelled','removed'].includes(r.status));
  const preview=policy.plan(scope,body.club_id,futureRegistrations);
  if(body.apply!==true)return {...preview,financial_mutations:false,requires_sporting_review:false};
  if(body.expected_revision!==preview.revision)fail('League evidence changed. Review the withdrawal consequences again.');
  if(!String(body.reason||'').trim()||!String(body.evidence_url||'').trim())fail('Provide the decision reason and evidence link.',422);
  if(!/^(\/uploads\/|https?:\/\/)/i.test(body.evidence_url))fail('Provide an uploaded or HTTP(S) evidence link.',422);
  const originals=[];
  for(const change of preview.changes) {
   const fixture=scope.fixtures.find(f=>f.id===change.fixture_id),match=scope.matches.find(m=>m.fixture_id===change.fixture_id);
   if(!fixture||!match?.match_id)fail('Canonical match identity requires review before withdrawal.');
   originals.push({fixture,match});
   const patch={...change,stats_processed:true,withdrawal_decision_id:receiptId(editionId,body.club_id),decided_on_penalties:0,penalty_winner_side:null};
   await q("UPDATE league_entities SET data_json=?,status=?,updated_date=NOW() WHERE id=? AND entity_type='regional_league_fixture'",[JSON.stringify({...fixture,...patch}),patch.status,fixture.id]);
   await q("UPDATE matches SET status=?,result_state=?,home_score=?,away_score=?,winner_club_id=?,winner_club_name=NULL,loser_club_id=NULL,loser_club_name=NULL,administrative_result=1,stats_processed=1,report_finalized=1,decided_on_penalties=0,penalty_winner_side=NULL,updated_date=NOW() WHERE id=?",[patch.status,patch.result_state,patch.home_score,patch.away_score,patch.winner_club_id,match.match_id]);
   await q('UPDATE competition_fixtures SET status=?,home_score=?,away_score=?,winner_participant_id=?,stats_processed=1,updated_date=NOW() WHERE match_id=?',[patch.status,patch.home_score,patch.away_score,patch.winner_club_id,match.match_id]);
  }
  const changed=new Map(preview.changes.map(c=>[c.fixture_id,c]));
  const standings=policy.standings(scope.standings,scope.matches.map(m=>({...m,...changed.get(m.fixture_id)})));
  for(const row of standings){if(row.club_id===body.club_id){row.is_excluded=true;row.sporting_eligibility='withdrawn';row.is_promoted=false;row.is_stage_qualified=false;row.stage_competition_slug=null;}await q("UPDATE league_entities SET data_json=?,updated_date=NOW() WHERE id=? AND entity_type='regional_league_standing'",[JSON.stringify(row),row.id]);}
  // Raw appearance/evidence rows remain historical. Rebuild affected club-career
  // fields from remaining real results, never from administrative player goals.
  const ids=preview.changes.map(c=>c.match_id);
  const players=await q(`SELECT DISTINCT p.id FROM players p JOIN match_player_stats s ON s.player_id=p.id OR (s.player_id IS NULL AND LOWER(s.player_email)=LOWER(p.email)) WHERE s.match_id IN (${ids.map(()=>'?').join(',')}) ORDER BY p.id FOR UPDATE`,ids);
  for(const player of players)await recalculatePlayer(player.id,q);
  for(const registration of futureRegistrations)await registrations.saveRegistration({...registration,status:'withdrawn',participation_status:'withdrawn',withdrawal_decision_id:receiptId(editionId,body.club_id)},q);
  const root={...scope.root,withdrawn_club_ids:[...new Set([...(scope.root.withdrawn_club_ids||[]),body.club_id])],withdrawal_review_required:false};
  await q("UPDATE league_entities SET data_json=?,updated_date=NOW() WHERE id=? AND entity_type='regional_league'",[JSON.stringify(root),editionId]);
  const record={id:receiptId(editionId,body.club_id),edition_id:editionId,...preview,status:'applied',eligibility_policy:'withdrawal_exclusion_v1',title_eligible:false,prize_eligible:false,promotion_eligible:false,next_season_guaranteed:false,reason:body.reason,evidence_url:body.evidence_url,decided_by:admin.id,decided_at:new Date().toISOString(),originals,original_standings:scope.standings,original_root:scope.root,original_future_registrations:futureRegistrations,financial_mutations:false};
  await q("INSERT INTO league_entities (id,entity_type,league_id,club_id,status,data_json) VALUES (?,'regional_withdrawal',?,?,'applied',?)",[record.id,editionId,body.club_id,JSON.stringify(record)]);
  await q('INSERT INTO admin_audit_log (id,admin_user_id,admin_email,action,entity_type,entity_id,old_value,new_value,reason) VALUES (?,?,?,?,?,?,?,?,?)',[v4(),admin.id,admin.email,'regional_club_withdrawal','regional_withdrawal',record.id,JSON.stringify({root:scope.root,revision:preview.revision,future_registrations:futureRegistrations}),JSON.stringify({id:record.id,mode:record.mode,club_id:record.club_id,future_registration_status:'withdrawn'}),body.reason]);
  return {applied:true,withdrawal:record,standings,requires_sporting_review:false};
 });
 if(outcome.applied || outcome.already_applied) {
  const progression=await require('./competitionEngineService').advanceRegionalLeagueIfReady({league_id:editionId,phase:'league'});
  return {...outcome,progression};
 }
 return outcome;
}
async function recalculatePlayer(playerId,q) {
 const rows=await q(`SELECT s.*,m.mode,m.home_club_id,m.away_club_id,m.home_score,m.away_score FROM match_player_stats s JOIN matches m ON m.id=s.match_id JOIN players p ON p.id=? WHERE (s.player_id=p.id OR (s.player_id IS NULL AND LOWER(s.player_email)=LOWER(p.email))) AND m.status='completed' AND COALESCE(m.administrative_result,0)=0 ORDER BY s.created_date DESC,s.id DESC`,[playerId]);
 const shared={assists:0,clean:0,motm:0};
 const seen=new Set(),total={games:0,goals:0,assists:0,wins:0,draws:0,losses:0,clean:0,motm:0,rating:0};
 for(const s of rows){if(seen.has(s.match_id))continue;seen.add(s.match_id);shared.assists+=Number(s.assists||0);shared.clean+=Number(s.clean_sheet||0);shared.motm+=Number(s.is_motm||0);if(s.mode!=='club'||![s.home_club_id,s.away_club_id].includes(s.club_id))continue;const h=s.club_id===s.home_club_id,gf=Number(h?s.home_score:s.away_score),ga=Number(h?s.away_score:s.home_score);total.games++;total.goals+=Number(s.goals||0);total.assists+=Number(s.assists||0);total.wins+=gf>ga?1:0;total.draws+=gf===ga?1:0;total.losses+=gf<ga?1:0;total.clean+=Number(s.clean_sheet||0);total.motm+=Number(s.is_motm||0);total.rating+=Number(s.rating||0);}
 await q('UPDATE players SET matches_played_club=?,goals_player=?,assists=?,wins_club=?,draws_club=?,losses_club=?,clean_sheets=?,man_of_the_match=?,avg_match_rating=?,updated_date=NOW() WHERE id=?',[total.games,total.goals,shared.assists,total.wins,total.draws,total.losses,shared.clean,shared.motm,total.games?total.rating/total.games:0,playerId]);
}
module.exports={action};
