'use strict';
const {isConfirmedResult}=require('./tournamentStatistics');
function penaltyEligibility({match,rows=[match],phase,legs=1,leg=1,extraTimeRequired=false},homeScore,awayScore) {
  const block=(reason,blocked=false)=>({applicable:false,required:false,decidingLeg:false,aggregate:null,reason,blocked});
  if (!['knockout','playoff','r16','qf','sf','final','third','third_place','semi_final','quarter_final','round_of_16','ucl_playoff','ucl_r16','ucl_qf','ucl_sf','knockout_r16','knockout_qf','knockout_sf','knockout_final','playoff_round'].includes(phase) && !/^last-\d+$/.test(phase || '')) return block('This phase does not use penalty shootouts.');
  if (![1,2].includes(Number(legs))) return block('The required leg configuration is unavailable.',true);
  if (Number(leg)!==Number(legs)) return block('Only the deciding leg may be resolved on penalties.');
  const kind=match.home_club_id?'club':'player';
  const home=String(match[`home_${kind}_id`]||''), away=String(match[`away_${kind}_id`]||'');
  if (!home||!away) return block('Both participants must be known.');
  let h=Number(homeScore),a=Number(awayScore);
  if (![h,a].every(v=>Number.isInteger(v)&&v>=0)) return block('Enter valid match scores first.');
  if (Number(legs)===2) {
    const prior=rows.filter(m=>String(m.id)!==String(match.id));
    if (prior.length!==1 || !isConfirmedResult(prior[0])) return block('The confirmed first-leg result is missing or unresolved.',true);
    const first=prior[0];
    const fh=String(first[`home_${kind}_id`]),fa=String(first[`away_${kind}_id`]);
    if (!([home,away].includes(fh)&&[home,away].includes(fa))||fh===fa||first.home_score==null||first.away_score==null) return block('The first-leg participants or score cannot be verified.');
    h+=Number(fh===home?first.home_score:first.away_score);
    a+=Number(fh===home?first.away_score:first.home_score);
  }
  const aggregate={home:h,away:a};
  if(extraTimeRequired && !Number(match.extra_time)) return {...block('Complete the configured extra-time stage before recording penalties.'),decidingLeg:true,aggregate};
  const level=h===a;
  return {applicable:level,required:level,decidingLeg:true,aggregate,legs:Number(legs),reason:level?null:'The match or aggregate already determines a winner.'};
}
module.exports={penaltyEligibility};
