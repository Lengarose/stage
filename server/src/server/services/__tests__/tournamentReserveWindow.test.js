'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {windowFor}=require('../tournamentReserveService');
test('reserve entry closes at the first published kickoff rather than the date-only event heading',async()=>{
  const t={id:'t',status:'registration',start_date:'2030-06-01',timezone:'Europe/Brussels'};
  const q=async sql=>sql.includes('FROM matches')?[]:[{data_json:JSON.stringify({entries:[{starts_at:'2030-06-01T18:00:00Z'}]})}];
  const at=Date.parse('2030-06-01T17:00:00Z');
  const result=await windowFor(t,q,at);
  assert.equal(result.open,true);assert.equal(result.closes,Date.parse('2030-06-01T18:00:00Z'));
  assert.equal((await windowFor(t,q,result.closes)).open,false);
  assert.equal((await windowFor({...t,registration_closes_at:'2030-06-01T17:30:00Z'},q,at)).closes,Date.parse('2030-06-01T17:30:00Z'));
  assert.equal((await windowFor({...t,status:'in_progress'},q,at)).open,false);
});
