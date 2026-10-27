'use strict';
const {penaltyEligibility}=require('../lib/penaltyPolicy');
const {buildStageCatalogue}=require('../lib/tournamentStageView');
const {normalizePenaltySelection}=require('../lib/matchResultNegotiation');
async function readPenaltyContext(match,homeScore,awayScore,query=require('../db/database').EXECUTESQL) {
  if(match.tournament_id && match.tournament_id!=='ranked') {
    const [t]=await query('SELECT * FROM tournaments WHERE id=? LIMIT 1',[match.tournament_id]);
    if(t) {
      const matches=await query('SELECT * FROM matches WHERE tournament_id=?',[t.id]);
      const stage=buildStageCatalogue(t,matches).find(s=>s.matches.some(m=>String(m.id)===String(match.id)));
      if(stage) {
        const kind=t.participant_type==='player'?'player':'club';
        const pair=[match[`home_${kind}_id`],match[`away_${kind}_id`]].map(String).sort().join(':');
        const rows=stage.matches.filter(m=>match.tie_id?m.tie_id===match.tie_id:[m[`home_${kind}_id`],m[`away_${kind}_id`]].map(String).sort().join(':')===pair && String(m.group_number??'')===String(match.group_number??''));
        const rounds=[...new Set(stage.matches.map(m=>Number(m.round)))].sort((a,b)=>a-b);
        return penaltyEligibility({match,rows,phase:stage.key,legs:stage.legs,leg:match.leg || rounds.indexOf(Number(match.round))+1,extraTimeRequired:Number(t.extra_time_required)===1},homeScore,awayScore);
      }
    }
  } else if(match.source_fixture_id || match.source_fixture_type) {
    const [engine]=await query('SELECT * FROM competition_fixtures WHERE match_id=? OR id=? LIMIT 1',[match.id,match.source_fixture_id||'']);
    const source=engine?.legacy_fixture_type || match.source_fixture_type;
    const sourceId=engine?.legacy_fixture_id || match.source_fixture_id;
    if(['competition','competition_fixture','regional_league','regional_league_fixture'].includes(source)) {
      const [stored]=await query('SELECT * FROM league_entities WHERE id=? LIMIT 1',[sourceId]);
      if(stored) {
        const {unpack,CompetitionScopeModel}=require('../models/competitionScopeModel');
        const f=unpack(stored), regional=source.startsWith('regional');
        const scope=await new CompetitionScopeModel().selectOne(regional?'regional_league':'competition_season',f.league_id || f.season_id,query);
        const phase=f.phase || 'league';
        const legs=phase==='knockout_final'?1:Number(scope.root.stage_legs?.[phase] || 2);
        const rows=scope.matches.filter(m=>m.type===phase && (f.tie_id?m.tie_id===f.tie_id:[m.home_club_id,m.away_club_id].map(String).sort().join(':')===[f.home_club_id,f.away_club_id].map(String).sort().join(':')));
        return penaltyEligibility({match:{...f,...match},rows:rows.filter(m=>String(m.fixture_id)!==String(f.id)).concat({...f,...match}),phase,legs,leg:f.leg||1},homeScore,awayScore);
      }
    }
    if(engine && !engine.legacy_fixture_id) {
      const rows=await query('SELECT m.*, cf.leg FROM competition_fixtures cf JOIN matches m ON m.id=cf.match_id WHERE cf.competition_instance_id=? AND cf.phase=? AND cf.tie_id=?',[engine.competition_instance_id,engine.phase,engine.tie_id]);
      const mapped=rows;
      return penaltyEligibility({match,rows:mapped,phase:engine.phase,legs:engine.phase==='knockout_final'?1:2,leg:engine.leg},homeScore,awayScore);
    }
  }
  return penaltyEligibility({match,phase:null},homeScore,awayScore);
}
async function validateMatchPenalty(match,scores,submission,query) {
  const eligibility=await readPenaltyContext(match,scores.home_score,scores.away_score,query);
  if(eligibility.blocked)throw Object.assign(new Error(eligibility.reason),{status:409,code:'TIE_CONTEXT_UNRESOLVED'});
  return {...normalizePenaltySelection({homeScore:scores.home_score,awayScore:scores.away_score,decidedOnPenalties:submission.decided_on_penalties,penaltyWinnerSide:submission.penalty_winner_side,allowed:eligibility.applicable,eligibility}),
    aggregate_home_score:eligibility.legs===2?eligibility.aggregate?.home??null:null,
    aggregate_away_score:eligibility.legs===2?eligibility.aggregate?.away??null:null};
}
module.exports={readPenaltyContext,validateMatchPenalty};
