'use strict';
const {fail}=require('../lib/regionalEditionIdentity');
const VERSION='regional_cup_tied_v1';
const RULES='Cup-tied: a player who actually participated for another club in this Regional Cup edition cannot play for a second club in the same edition. A bench nomination alone does not count as actual participation. Participation is recorded from the official result declarations, not automatically verified by EA.';
function parse(value){try{return typeof value==='string'?JSON.parse(value):value;}catch{fail('Prior Cup participation evidence requires Admin review.');}}
function createService(){
 async function assertSelection(ctx,selection,q){
  if(ctx.engine?.legacy_fixture_type!=='regional_cup' || ctx.root.participation_window_snapshot?.cup_tied_policy_version!==VERSION || !selection.ids.length)return;
  const history=await q(`SELECT m.id,m.home_club_id,m.away_club_id,m.home_submission,m.away_submission,m.result_state,m.status
    FROM matches m JOIN league_entities s ON s.entity_type='official_match_selection'
      AND JSON_UNQUOTE(JSON_EXTRACT(s.data_json,'$.match_id'))=m.id
      AND JSON_UNQUOTE(JSON_EXTRACT(s.data_json,'$.edition_id'))=?
    WHERE m.competition_context=? AND m.id<>? AND (m.home_submission IS NOT NULL OR m.away_submission IS NOT NULL)
    ORDER BY m.id FOR UPDATE`,[ctx.root.id,ctx.root.id,ctx.match.id]);
  for(const match of history)for(const side of ['home','away']){
   const sheet=parse(match[`${side}_submission`]);if(!sheet)continue;
   if(sheet.participating_player_ids!=null && !Array.isArray(sheet.participating_player_ids))fail('Prior Cup participation evidence requires Admin review.');
   if(match[`${side}_club_id`]!==selection.club_id && sheet.participating_player_ids?.some(id=>selection.ids.includes(id)))fail('A selected player already declared actual participation for another club in this Cup edition. Cup-tied eligibility requires Admin review.',422);
  }
 }
 return {assertSelection};
}
module.exports={VERSION,RULES,createService,...createService()};
