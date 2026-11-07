'use strict';
const assert=require('node:assert/strict');
if(!/^stage_acceptance_[a-f0-9]{12}$/.test(process.env.DB_NAME || '') || !/^\/private\/tmp\/stage-season-acceptance[^/]*\.sock$/.test(process.env.DB_SOCKET_PATH || ''))throw Error('Restart probe requires the isolated acceptance database and local socket.');
const instant=Number(process.env.STAGE_ACCEPTANCE_INSTANT);if(!Number.isFinite(instant))throw Error('An acceptance clock is required.');
const NativeDate=Date;global.Date=class extends NativeDate{constructor(...args){super(...(args.length?args:[instant]));}static now(){return instant;}};
const db=require('../../src/server/db/database');
async function counts(){return (await db.EXECUTESQL("SELECT 'fixtures' AS kind,COUNT(*) AS n FROM league_entities WHERE entity_type='regional_league_fixture' UNION ALL SELECT 'payouts',COUNT(*) FROM competition_payouts UNION ALL SELECT 'awards',COUNT(*) FROM trophy_awards ORDER BY kind"));}
(async()=>{const before=await counts();await require('../../src/server/services/regionalSeasonOrchestrationService').tick();await require('../../src/server/services/regionalCycleRecoveryService').tick();await require('../../src/server/services/regionalCupRecoveryService').tick();await require('../../src/server/services/competitionPrizeService').retryPending();assert.deepEqual(await counts(),before);console.log(JSON.stringify({fresh_process_recovery:true,counts:before}));})().catch(error=>{console.error(error.stack);process.exitCode=1;}).finally(async()=>{await db.pool.promise().end();});
