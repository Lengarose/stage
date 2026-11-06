import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {isPendingForfeit,forfeitSnapshot,loadForfeitReviewSummary,loadForfeitReviewPage,resolveReviewedForfeit} from '../adminForfeitReview.js';
const {assertForfeitSnapshotCurrent}=createRequire(import.meta.url)('../../../server/src/server/lib/forfeitReviewSnapshot.js');
const match={id:'m',status:'scheduled',forfeit_status:'pending',forfeit_claimed_by:'home',forfeit_proof_url:'/uploads/proof.png',home_club_id:'home',away_club_id:'away',home_score:2,away_score:2};
const summary={items:[match],total:1,as_of:'2026-11-06T20:00:00Z'};
test('forfeit eligibility excludes completed, final and unclaimed records',()=>{
 assert.equal(isPendingForfeit(match),true);
 for(const patch of [{forfeit_claimed_by:null},{forfeit_status:'rejected'},{status:'completed'},{status:'forfeit'},{status:'voided'},{status:'archived'},{result_state:'CONFIRMED'}])assert.equal(isPendingForfeit({...match,...patch}),false);
});
test('forfeit summary preserves full totals while pages bind cursor identity without mutating records',async()=>{
 const items=Array.from({length:10},(_,i)=>({...match,id:`m-${i}`}));
 const calls=[],client={http:{get:async(path,query)=>{calls.push([path,query]);return path.endsWith('/summary')?{...summary,total:53,items}:{items:[match],has_more:true,next_cursor:'m'};}}};
 assert.equal((await loadForfeitReviewSummary(client)).total,53);
 const page=await loadForfeitReviewPage(client,'previous');assert.equal(page.request_cursor,'previous');assert.deepEqual(calls[1],['/matches/forfeit-reviews',{limit:50,cursor:'previous'}]);assert.equal(match._source,undefined);
});
test('bad pages, counts, resolved rows and read failures never become an empty successful claim list',async()=>{
 for(const data of [null,[],{...summary,total:0},{...summary,total:'1'},{...summary,as_of:'bad'},{...summary,items:[{...match,status:'completed'}]}])await assert.rejects(loadForfeitReviewSummary({http:{get:async()=>data}}),/could not be verified/);
 for(const data of [{items:[],has_more:true,next_cursor:'m'},{items:[match,match],has_more:false,next_cursor:null},{items:[match],has_more:true,next_cursor:'other'},{items:[match],has_more:true,next_cursor:'m'},{items:[{...match,forfeit_status:'approved'}],has_more:false,next_cursor:null}])await assert.rejects(loadForfeitReviewPage({http:{get:async()=>data}},'m'),/could not be verified/);
 const error=Error('offline');await assert.rejects(loadForfeitReviewPage({http:{get:async()=>{throw error;}}}),e=>e===error);
});
test('browser and server snapshots agree on evidence changes while unrelated operational updates remain valid',()=>{
 for(const patch of [{updated_date:'later',stream_url:'new'},{home_score:'2'},{forfeit_claimed_by:'away'},{forfeit_proof_url:'/uploads/new.png'},{home_score:3},{status:'completed'},{result_state:'CONFIRMED'},{forfeit_status:'rejected'}]){
  const after={...match,...patch};const same=JSON.stringify(forfeitSnapshot(match))===JSON.stringify(forfeitSnapshot(after));
  if(same)assert.doesNotThrow(()=>assertForfeitSnapshotCurrent(forfeitSnapshot(match),after));else assert.throws(()=>assertForfeitSnapshotCurrent(forfeitSnapshot(match),after),e=>e.status===409 && e.code==='FORFEIT_REVIEW_CHANGED');
 }
});
test('claim actions outside the preview reread the exact ID and submit their reviewed snapshot',async()=>{
 const calls=[],client={entities:{Match:{get:async id=>{calls.push(id);return {...match};}}},functions:{invoke:async(name,args)=>{calls.push({name,args});return {data:{success:true}};}}};
 await resolveReviewedForfeit(client,match,false);assert.equal(calls[0],'m');assert.equal(calls[1].name,'adminMatchActions');assert.equal(calls[1].args.approve,false);assert.deepEqual(calls[1].args.expected_forfeit_snapshot,forfeitSnapshot(match));
});
test('changed, resolved, denied and wrong-ID rereads do not send a decision',async()=>{
 let writes=0;
 for(const fresh of [null,{...match,id:'other'},{...match,forfeit_claimed_by:'away'},{...match,status:'completed'}])await assert.rejects(resolveReviewedForfeit({entities:{Match:{get:async()=>fresh}},functions:{invoke:()=>{writes++;}}},match,true),/changed|no longer/);
 await assert.rejects(resolveReviewedForfeit({entities:{Match:{get:async()=>{throw Error('denied');}}},functions:{invoke:()=>{writes++;}}},match,true),/denied/);assert.equal(writes,0);
});
