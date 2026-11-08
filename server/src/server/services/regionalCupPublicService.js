'use strict';
const {withTransaction}=require('../db/database');
const {RegionalCupModel}=require('../models/regionalCupModel');
const {safeImage,assignment}=require('./gostOverviewService');
const cupPolicy=require('../lib/regionalCupPolicy.json');
const {matchWindows}=require('../lib/officialMatchWindows');
const {isConfirmedResult}=require('../lib/tournamentStatistics');
const confirmed=m=>isConfirmedResult(m) && String(m.result_state || '').toLowerCase()!=='auto_confirmed_timeout';
const {publicParticipationConditions}=require('../lib/publicParticipationConditions');
function createService({model=new RegionalCupModel(),transaction=withTransaction,trophyAssignment=assignment}={}) {
  async function catalogue() {
    return transaction(async q=>{
      const records=await model.records(q);
      const editions=records.filter(e=>e.entity_type==='regional_cup_edition' && e.play_enabled && ['running','completed'].includes(e.status) && !e.edition_invalidated);
      const cups=[];
      for(const e of editions) {
        const clubs=await model.clubs(e.participant_ids,q),matches=await model.matches(e.id,q);
        let rewards={state:'configuration_review_required',winner_stc:null,runner_up_stc:null,entry_fee_stc:null};
        if(e.cup_reward_snapshot) {
          try {const config=require('../lib/regionalCupRewards').validate(e.cup_reward_snapshot,e);rewards={state:e.prize_settlement_state || 'pending',winner_stc:config.rows[0].stc_amount,runner_up_stc:config.rows[1].stc_amount,entry_fee_stc:config.entry_fee,funding:config.funding};}
          catch {rewards={...rewards,state:'configuration_review_required'};}
        }
        const directory=clubs.map(c=>({id:c.id,name:c.name,logo_url:safeImage(c.logo_url)}));
        cups.push({id:e.id,permanent_cup_id:e.permanent_cup_id,reset_series:Number(e.reset_series || 0),name:e.name,region_slug:e.region_slug,platform:e.platform,season_number:e.season_number,status:e.status,participant_count:e.participant_ids.length,participants:directory,rewards,rules:e.rules,participation_conditions:publicParticipationConditions(e,e.participation_window_snapshot),no_gost_ticket:true,trophy:e.trophy_snapshot?{name:e.trophy_snapshot.name,image_url:safeImage(e.trophy_snapshot.image_url)}:null,winner_club_id:e.winner_club_id || null,winner_club_name:e.winner_club_name || null,honours_state:e.honours_state || null,
          rounds:e.round_calendar.map(slot=>{const round=e.rounds?.find(r=>r.number===slot.round);if(round?.results_revision && (round.fixture_ids.some(id=>!matches.some(m=>m.source_fixture_id===id)) || round.results_revision!==require('./regionalCupLifecycleService').resultRevision(round.fixture_ids.map(id=>matches.find(m=>m.source_fixture_id===id)))))throw Object.assign(Error('A processed Cup result requires review'),{status:409});return {number:slot.round,week:slot.week,kickoff_at:new Date(slot.instant).toISOString(),timezone:slot.timezone,drawn:!!round,byes:round?.draw.byes || [],matches:round?round.fixture_ids.map(id=>{const m=matches.find(m=>m.source_fixture_id===id);if(!m)throw Object.assign(Error('Published Cup match requires review'),{status:409});return {id:m.id,home_club_id:m.home_club_id,away_club_id:m.away_club_id,home_club_name:m.home_club_name,away_club_name:m.away_club_name,status:m.status,kickoff_at:matchWindows(m).kickoff_at,timezone:m.timezone,home_score:confirmed(m)?m.home_score:null,away_score:confirmed(m)?m.away_score:null,decided_on_penalties:confirmed(m)?Number(m.decided_on_penalties)===1:false,penalty_winner_side:confirmed(m)?m.penalty_winner_side:null};}):[]};})});
      }
      // Publish identities and approved names, never unpublished participants or draws.
      const definitions=[];
      for(const [region_slug,name] of Object.entries(cupPolicy.names)) {
        const sources=records.filter(row=>row.entity_type==='regional_cup' && row.region_slug===region_slug && !row.edition_invalidated && !row.retired);
        const profile=cupPolicy.regional_time_profiles?.[region_slug] || cupPolicy;
        const schedule={day:profile.day,time:profile.time,timezone:profile.timezone,minutes:profile.minutes};
        if(!sources.length)definitions.push({id:null,name,region_slug,platform:null,state:'awaiting_setup',trophy:null,schedule});
        for(const source of sources) {
          const artwork=await trophyAssignment(source.id,q,false,'regional_cup');
          definitions.push({id:source.id,name:source.name || name,region_slug,platform:source.platform,state:'configured',schedule,
            trophy:artwork.state==='assigned' && artwork.trophy?{id:artwork.trophy.id,name:artwork.trophy.name,image_url:safeImage(artwork.trophy.image_url)}:null});
        }
      }
      return {cups,definitions};
    });
  }
  return {catalogue};
}
module.exports={createService,...createService()};
