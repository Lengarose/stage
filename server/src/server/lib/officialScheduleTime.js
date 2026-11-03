'use strict';
const {fail}=require('./regionalEditionIdentity');
const {isValidTimeZone,wallClockToOffsetIso}=require('../utils/datetime');
function scheduleTime(value,zone) {
  if(!isValidTimeZone(zone))fail('Choose a valid official IANA timezone',400);
  if(typeof value!=='string')fail('Provide an official kickoff date and time',400);
  const calendar=/^(\d{4})-(\d{2})-(\d{2})[T ]/.exec(value);
  if(!calendar || new Date(Date.UTC(Number(calendar[1]),Number(calendar[2])-1,Number(calendar[3]))).toISOString().slice(0,10)!==value.slice(0,10))fail('Invalid kickoff calendar date',400);
  let wall=value.trim().replace('T',' ');
  if(/(?:Z|[+-]\d{2}:?\d{2})$/.test(value)) {
    if(!Number.isFinite(Date.parse(value)))fail('Invalid kickoff timestamp',400);
    const parts=new Intl.DateTimeFormat('en-CA',{timeZone:zone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'}).formatToParts(new Date(value));
    const p=key=>parts.find(p=>p.type===key).value;
    wall=`${p('year')}-${p('month')}-${p('day')} ${p('hour')}:${p('minute')}:${p('second')}`;
  } else if(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/.test(wall))wall+=':00';
  if(!/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(wall))fail('Provide a complete kickoff date and time',400);
  const iso=wallClockToOffsetIso(wall,zone),instant=Date.parse(iso);
  if(!Number.isFinite(instant))fail('Invalid kickoff timestamp',400);
  if(/(?:Z|[+-]\d{2}:?\d{2})$/.test(value) && Date.parse(value)!==instant)fail('This daylight-saving offset cannot be represented by the official timezone; choose another time',400);
  const local=new Intl.DateTimeFormat('sv-SE',{timeZone:zone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'}).format(new Date(instant));
  if(!Number.isFinite(instant) || local!==wall)fail('Invalid or nonexistent local kickoff time',400);
  return {wall,iso,instant};
}
module.exports={scheduleTime};
