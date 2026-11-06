'use strict';
const {scheduleTime}=require('./officialScheduleTime');
const {weekOf}=require('./regionalCalendarPlan');
const {fail}=require('./regionalEditionIdentity');
const VERSION='regional_reschedule_europe_v1';
const RULES='Official European rescheduling: at most two approved requests per club per edition, charged only to the requesting club after approval. Request at least 48 hours before the original kickoff. The opponent has at most 24 hours to reply, and agreement must be at least 24 hours before the new kickoff. The new kickoff stays in the same Monday–Sunday week: Monday–Friday 20:00 or 20:40, or Saturday 18:00–21:00, Europe/Brussels. Silence keeps the existing kickoff. Final-round and platform-outage exceptions require Admin review.';
function proposal(match,date,now=new Date()) {
 const value=match.confirmed_date || match.scheduled_date;
 const original=scheduleTime(value instanceof Date?require('../utils/datetime').toMysqlDateTime(value):value,match.timezone);
 const next=scheduleTime(date,'Europe/Brussels'),at=now.getTime();
 if(original.instant-at<48*3600000)fail('Request a change at least 48 hours before the existing kickoff.');
 if(next.instant-at<24*3600000)fail('The new kickoff must allow agreement at least 24 hours beforehand.');
 const oldDay=original.wall.slice(0,10),newDay=next.wall.slice(0,10),day=new Date(newDay+'T00:00:00Z').getUTCDay(),hour=next.wall.slice(11,16);
 if(weekOf(oldDay)!==weekOf(newDay) || next.wall.slice(17)!=='00' || !(day>=1 && day<=5 && ['20:00','20:40'].includes(hour) || day===6 && hour>='18:00' && hour<='21:00'))fail('Choose an approved kickoff window in the same Monday–Sunday week, Europe/Brussels.');
 return {original,new_time:next,respond_by:new Date(Math.min(at+24*3600000,next.instant-24*3600000)).toISOString()};
}
const scheduleKey=match=>{const value=match.confirmed_date || match.scheduled_date;return JSON.stringify([match.id,value instanceof Date?require('../utils/datetime').toMysqlDateTime(value):value,match.timezone]);};
module.exports={VERSION,RULES,proposal,scheduleKey};
