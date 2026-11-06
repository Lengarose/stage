import {useEffect,useState} from 'react';
import {stageClient} from '@/api/stageClient';
import {isValidAdminScore} from '@/lib/gameDayResultFlow';
import {adminPenaltyDecision,resolutionPenaltyKey} from '@/lib/adminResolutionPenalty';

export default function AdminResolutionPenalty({match,score,side,onChange}) {
  const key=resolutionPenaltyKey(match,score,side);
  const [loaded,setLoaded]=useState(null),[choice,setChoice]=useState(''),[error,setError]=useState(''),[refresh,setRefresh]=useState(0);
  useEffect(()=>{
    let active=true;setLoaded(null);setChoice('');setError('');onChange({key,ready:false});
    if(!isValidAdminScore(score.home_score) || !isValidAdminScore(score.away_score))return;
    const timer=setTimeout(()=>{
      stageClient.http.get(`/game-day/${encodeURIComponent(match.id)}/penalties`,{home_score:Number(score.home_score),away_score:Number(score.away_score)}).then(context=>{
        if(!active)return;
        if(typeof context?.applicable!=='boolean' || typeof context?.required!=='boolean')throw Error('The penalty context could not be verified.');
        setLoaded({key,context});onChange(adminPenaltyDecision(context,'',key));
      }).catch(err=>{if(active)setError(err.message || 'Penalty eligibility could not be verified.');});
    },200);
    return ()=>{active=false;clearTimeout(timer);};
  },[key,refresh,match.id,score.home_score,score.away_score,onChange]);
  const context=loaded?.key===key?loaded.context:null;
  const name=s=>match[`${s}_club_name`] || match[`${s}_player_name`] || (s==='home'?'Home':'Away');
  return <section className="space-y-2 border-t border-border pt-3 text-sm" aria-label="Admin penalty decision">
    <p className="font-semibold">Penalty decision</p>
    {!isValidAdminScore(score.home_score) || !isValidAdminScore(score.away_score)?<p>Enter the final home and away scores to check the deciding-leg rules.</p>:error?<p role="alert" className="text-destructive">{error}</p>:!context?<p role="status">Checking the match and any aggregate score…</p>:<>
      {context.aggregate && <p>{context.legs===2?'Aggregate (current home – away)':'Match score'}: {context.aggregate.home} – {context.aggregate.away}</p>}
      {context.blocked?<p role="alert" className="text-destructive">{context.reason || 'The tie context requires review.'}</p>:context.applicable?<label className="block space-y-2"><span>Select the verified penalty winner. This is separate from choosing an original proposal.</span><select className="min-h-11 w-full border border-border bg-background px-3" value={choice} onChange={e=>{setChoice(e.target.value);onChange(adminPenaltyDecision(context,e.target.value,key));}}><option value="" disabled>Choose penalty outcome</option>{!context.required && <option value="none">No penalty shootout</option>}<option value="home">{name('home')} won on penalties</option><option value="away">{name('away')} won on penalties</option></select></label>:<p>{context.reason || 'This result does not use a penalty shootout.'} The decision will explicitly record no penalty shootout.</p>}
    </>}
    <button type="button" className="min-h-11 font-semibold" onClick={()=>{onChange({key,ready:false});setLoaded(null);setChoice('');setRefresh(v=>v+1);}}>Recheck penalty context →</button>
  </section>;
}
