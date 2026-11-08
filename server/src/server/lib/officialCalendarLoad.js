'use strict';
const {policy}=require('./regionalCalendarPlan');
const {scheduleTime}=require('./officialScheduleTime');
const {toMysqlDateTime}=require('../utils/datetime');
const closed=new Set(['cancelled','canceled','reset','superseded','abandoned','voided','deleted']);
function busyEvents({matches=[],engines=[],fixtures=[]},excluded=new Set()) {
  const knownMatches=new Set(matches.map(m=>m.id)),knownSources=new Set(matches.map(m=>m.source_fixture_id).filter(Boolean));
  const knownEngines=new Set(engines.map(e=>e.id)),engineSources=new Set(engines.map(e=>e.legacy_fixture_id).filter(Boolean));
  const rows=[...matches.map(m=>({...m,fixture_id:m.source_fixture_id})),...engines.filter(e=>!knownMatches.has(e.match_id) && !knownSources.has(e.id)).map(e=>({...e,fixture_id:e.legacy_fixture_id || e.id,scheduled_date:e.confirmed_at || e.scheduled_at})),...fixtures.filter(f=>!knownMatches.has(f.match_id) && !knownSources.has(f.id) && !engineSources.has(f.id) && !knownEngines.has(f.id))];
  return rows.filter(e=>!closed.has(e.status) && !excluded.has(e.id) && !excluded.has(e.fixture_id) && (e.confirmed_date || e.scheduled_date)).map(e=>{
    const value=e.confirmed_date || e.scheduled_date;
    const time=scheduleTime(value instanceof Date?toMysqlDateTime(value):value,e.timezone);
    return {id:e.id,fixture_id:e.fixture_id,home_club_id:e.home_club_id,away_club_id:e.away_club_id,instant:time.instant,minutes:['league','league_phase','regional_league','group','group_stage','ucl_league'].includes(e.type || e.phase)?policy.league_minutes:policy.knockout_minutes};
  });
}
module.exports={busyEvents};
