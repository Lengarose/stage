'use strict';
const {wallClockToOffsetIso,isValidTimeZone}=require('../utils/datetime');
const {fail}=require('./regionalEditionIdentity');
function matchWindows(match,now=new Date()) {
  const value=match.confirmed_date || match.scheduled_date;
  let iso;
  if(typeof value==='string' && /(?:Z|[+-]\d{2}:?\d{2})$/.test(value))iso=value;
  else {
    if(!isValidTimeZone(match.timezone))fail('A valid match timezone is required before preparation');
    iso=wallClockToOffsetIso(value,match.timezone);
  }
  const at=Date.parse(iso),time=new Date(now).getTime();
  if(!Number.isFinite(at))fail('Confirm a valid official kickoff time before preparation');
  return {schedule_key:new Date(at).toISOString(),kickoff_at:new Date(at).toISOString(),ready_opens_at:new Date(at-15*60000).toISOString(),locks_at:new Date(at-5*60000).toISOString(),waiting_until:new Date(at+10*60000).toISOString(),can_ready:time>=at-15*60000,locked:time>=at-5*60000,can_kickoff:time>=at,waiting_elapsed:time>=at+10*60000};
}
module.exports={matchWindows};
