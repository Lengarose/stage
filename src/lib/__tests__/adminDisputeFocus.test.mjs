import test from 'node:test';
import assert from 'node:assert/strict';
import {loadFocusedDispute,loadDisputeReviewPage,loadDisputeReviewSummary} from '../adminDisputeFocus.js';

test('focused review loads the exact canonical match independently of any paginated dispute list',async()=>{
 const calls=[],record={id:'outside-first-page',status:'disputed',result_state:'ADMIN_REVIEW',home_submission:'stored evidence'};
 const client={entities:{Match:{get:async id=>{calls.push(id);return record;},filter:()=>{throw Error('Must not use the general list');}}}};
 const result=await loadFocusedDispute(client,record.id);assert.deepEqual(calls,[record.id]);assert.equal(result.status,'review');assert.equal(result.match._source,'tournament');assert.equal(result.match.home_submission,'stored evidence');assert.equal(record._source,undefined);
});
test('already decided or no-longer-pending matches expose no resolution payload',async()=>{
 for(const patch of [{status:'completed'},{status:'cancelled'},{status:'deleted'},{status:'scheduled',result_state:'AWAITING_AWAY_CONFIRMATION'},{result_state:'CONFIRMED'},{result_state:'AUTO_CONFIRMED_TIMEOUT'},{result_state:'VOIDED'}]) {
  const record={id:'m',status:'disputed',...patch};const result=await loadFocusedDispute({entities:{Match:{get:async()=>record}}},'m');assert.deepEqual(result,{id:'m',status:'not_pending',match:null});
 }
 const result=await loadFocusedDispute({entities:{Match:{get:async()=>({id:'m',status:'awaiting_confirmation',result_state:'ADMIN_REVIEW'})}}},'m');assert.equal(result.status,'review');
});
test('missing, wrong-ID and failed reads never fall back to another available dispute',async()=>{
 for(const result of [null,{},[{id:'m'}],{id:'other',status:'disputed'}])await assert.rejects(loadFocusedDispute({entities:{Match:{get:async()=>result}}},'m'),/could not be verified/);
 const denied=Object.assign(Error('Forbidden'),{status:403});await assert.rejects(loadFocusedDispute({entities:{Match:{get:async()=>{throw denied;}}}},'m'),e=>e===denied);
 await assert.rejects(loadFocusedDispute({},''),/exact match/);
});
test('review list requests bounded pages and keeps its page identity separate from a focused match',async()=>{
 const calls=[],page={items:[{id:'next',status:'disputed'}],has_more:true,next_cursor:'next'};
 const result=await loadDisputeReviewPage({http:{get:async(path,args)=>{calls.push({path,args});return page;}}},'previous');
 assert.deepEqual(calls,[{path:'/matches/reviews',args:{limit:50,cursor:'previous'}}]);assert.equal(result.request_cursor,'previous');assert.equal(result.items[0]._source,'tournament');assert.equal(page.items[0]._source,undefined);
 const empty=await loadDisputeReviewPage({http:{get:async()=>({items:[],has_more:false,next_cursor:null})}});assert.deepEqual(empty.items,[]);
});
test('malformed or failed review pages never become a successful empty list',async()=>{
 const review={id:'m',status:'disputed'};
 for(const page of [null,[],{items:[]},{items:[],has_more:true,next_cursor:'m'},{items:[review,review],has_more:false,next_cursor:null},{items:[review],has_more:true,next_cursor:'other'},{items:[{...review,status:'completed'}],has_more:false,next_cursor:null},{items:[review],has_more:true,next_cursor:'m'}])await assert.rejects(loadDisputeReviewPage({http:{get:async()=>page}},'m'),/could not be verified/);
 const error=Error('Unavailable');await assert.rejects(loadDisputeReviewPage({http:{get:async()=>{throw error;}}}),e=>e===error);
});

test('review summary uses the bounded independent endpoint and preserves total and source records',async()=>{
 const calls=[],items=Array.from({length:10},(_,i)=>({id:`m-${i}`,result_state:'ADMIN_REVIEW'}));
 const summary={total:53,items,as_of:'2026-11-05T12:00:00Z'};
 const result=await loadDisputeReviewSummary({http:{get:async path=>{calls.push(path);return summary;}}});
 assert.deepEqual(calls,['/matches/reviews/summary']);assert.equal(result.total,53);assert.equal(result.items.length,10);assert.equal(result.items[0]._source,'tournament');assert.equal(items[0]._source,undefined);
 const empty=await loadDisputeReviewSummary({http:{get:async()=>({...summary,total:0,items:[]})}});assert.equal(empty.total,0);
});
test('invalid or failed summaries cannot report a successful empty review queue',async()=>{
 const valid={total:1,items:[{id:'m',status:'disputed'}],as_of:'2026-11-05T12:00:00Z'};
 for(const summary of [null,{}, {...valid,total:'1'}, {...valid,total:-1}, {...valid,total:0}, {...valid,items:[]}, {...valid,as_of:'bad'}, {...valid,total:2,items:[valid.items[0],valid.items[0]]}, {...valid,items:[{id:'m',status:'completed'}]}])await assert.rejects(loadDisputeReviewSummary({http:{get:async()=>summary}}),/could not be verified/);
 const error=Error('Unavailable');await assert.rejects(loadDisputeReviewSummary({http:{get:async()=>{throw error;}}}),e=>e===error);
});
