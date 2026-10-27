import test from 'node:test';
import assert from 'node:assert/strict';
import {calendarGrid,calendarRange,calendarDay,calendarTime,shiftCalendarMonth,groupCalendarEvents,identicalKickoffs,CALENDAR_CATEGORIES} from '../scheduleCalendar.js';
test('Monday-first grids include every five/six week month and year rollover',()=>{
  assert.equal(calendarGrid('2026-10').length,35);
  assert.equal(calendarGrid('2026-03').length,42);
  assert.equal(calendarGrid('2026-03')[0],'2026-02-23');
  assert.deepEqual(calendarRange('2026-03'),{from:'2026-02-23',to:'2026-04-06'});
  assert.equal(shiftCalendarMonth('2026-12',1),'2027-01');
});
test('day grouping and time use the same zone including midnight and DST',()=>{
  const event={id:'m',startsAt:'2026-10-31T23:30:00Z'};
  assert.equal(calendarDay(event.startsAt,'Europe/Brussels'),'2026-11-01');
  assert.equal(calendarTime(event.startsAt,'Europe/Brussels'),'00:30');
  assert.equal(groupCalendarEvents([event],'Europe/Brussels').get('2026-11-01').length,1);
  assert.equal(calendarTime('2026-10-24T18:00:00Z','Europe/Brussels'),'20:00');
  assert.equal(calendarTime('2026-10-26T19:00:00Z','Europe/Brussels'),'20:00');
});
test('busy days keep all games, stable tie order and only known identical kickoff conflicts',()=>{
  const events=Array.from({length:8},(_,i)=>({id:`m${7-i}`,startsAt:'2026-10-27T20:00:00+01:00'}));
  const list=groupCalendarEvents(events,'Europe/Brussels').get('2026-10-27');
  assert.equal(list.length,8);assert.equal(list[0].id,'m0');
  assert.equal(identicalKickoffs(list).size,8);
  assert.equal(identicalKickoffs([list[0],{id:'later',startsAt:'2026-10-27T20:01:00+01:00'}]).size,0);
});
test('legend has six distinct smoky backgrounds with Tournament last',()=>{
  assert.equal(new Set(Object.values(CALENDAR_CATEGORIES).map(c=>c.background)).size,6);
  assert.equal(Object.keys(CALENDAR_CATEGORIES).at(-1),'tournament');
});
