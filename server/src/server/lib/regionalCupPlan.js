'use strict';
const policy=require('./regionalCupPolicy.json');
const {fail}=require('./regionalEditionIdentity');
const {shuffle,unique}=require('./regionalStructure');
const {dateAt,weekOf}=require('./regionalCalendarPlan');
const {scheduleTime}=require('./officialScheduleTime');
function calendar(count,monday,region) {
  const weeks=policy.weeks[count];
  if(!weeks)fail('This Cup field has no approved round calendar');
  if(!policy.names[region])fail('This region needs a confirmed Cup time profile');
  const profile=policy.regional_time_profiles?.[region] || policy;
  if(!/^\d{4}-\d{2}-\d{2}$/.test(monday || '') || !Number.isFinite(Date.parse(monday)) || weekOf(monday)!==monday)fail('Choose the published source calendar Monday',400);
  return weeks.map((week,index)=>{const date=dateAt(monday,(week-1)*7+profile.day),time=scheduleTime(`${date}T${profile.time}`,profile.timezone);return {round:index+1,week,scheduled_date:time.wall,timezone:profile.timezone,instant:time.instant,minutes:profile.minutes};});
}
function drawRound(clubs,seed) {
  unique(clubs,'Cup participants');if(clubs.length<2 || clubs.length>240)fail('Cup draw requires 2–240 participants');
  if(typeof seed!=='string' || !seed)fail('A recorded server draw seed is required');
  const drawn=shuffle(clubs,seed),size=2**Math.ceil(Math.log2(clubs.length)),byes=size-clubs.length;
  const advanced=drawn.slice(0,byes),playing=drawn.slice(byes),fixtures=[];
  for(let i=0;i<playing.length;i+=2)fixtures.push({home_club_id:playing[i],away_club_id:playing[i+1],allow_penalties:true});
  return {drawn_club_ids:drawn,byes:advanced,fixtures,next_field_count:size/2};
}
const rules='Regional Cup: all confirmed regional clubs enter automatically, across divisions and groups. Single-match knockout; a recorded open draw follows each finalised round, with transparent byes. European rounds are Sunday 20:00 Europe/Brussels; North American rounds are Sunday 20:00 America/New_York. Both use 60-minute blocks. No automatic GOST qualification.';
module.exports={calendar,drawRound,policy,rules};
