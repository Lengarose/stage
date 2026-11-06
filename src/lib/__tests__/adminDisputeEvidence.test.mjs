import test from 'node:test';
import assert from 'node:assert/strict';
import {disputeEvidence,evidenceLink,restoreEvidenceFocus} from '../adminDisputeEvidence.js';

test('both original claims and separate dispute sheets retain their own scores, proof, explanation and timestamps',()=>{
 const match={home_submission:JSON.stringify({home_score:2,away_score:2,proof_url:'/uploads/original.png'}),away_submission:{home_score:2,away_score:2,proof_url:'https://example.test/away.png'},home_dispute_submission:JSON.stringify({home_score:3,away_score:2,proof_url:'/uploads/dispute.png',explanation:'Opponent score is wrong.',submitted_at:'2026-11-04T20:00:00Z'}),away_dispute_submission:{home_score:2,away_score:3,proof_url:'/uploads/response.png',explanation:'My response.'},proof_url:'/uploads/match.png',forfeit_proof_url:'/uploads/forfeit.png'};
 const before=JSON.stringify(match),result=disputeEvidence(match);assert.equal(JSON.stringify(match),before);
 assert.deepEqual(result.sheets.map(s=>s.key),['home_submission','away_submission','home_dispute_submission','away_dispute_submission']);
 assert.deepEqual(result.sheets.map(s=>s.score),['2 – 2','2 – 2','3 – 2','2 – 3']);assert.equal(result.sheets[2].explanation,'Opponent score is wrong.');assert.equal(result.sheets[2].proof,'/uploads/dispute.png');assert.equal(result.sheets[2].submittedAt,'2026-11-04T20:00:00.000Z');assert.equal(result.attachments.length,2);
});
test('missing and corrupt sheets are distinguishable and incomplete scores never become a zero claim',()=>{
 for(const raw of ['{',[],42,'null','[]','true'])assert.equal(disputeEvidence({home_submission:raw}).sheets[0].status,'unreadable');
 assert.equal(disputeEvidence({}).sheets[0].status,'missing');
 for(const score of [null,undefined,'',false,-1,'1.5','1e2',{},9007199254740992])assert.equal(disputeEvidence({home_submission:{home_score:score,away_score:2}}).sheets[0].score,null);
 assert.equal(disputeEvidence({home_submission:{home_score:'0',away_score:0,submitted_at:{toString:'bad'}}}).sheets[0].score,'0 – 0');
 assert.equal(disputeEvidence({home_submission:{submitted_at:{}}}).sheets[0].submittedAt,null);
});
test('stored evidence links permit upload and HTTP attachments without making executable or malformed URLs clickable',()=>{
 for(const url of ['/uploads/proof.png','https://example.test/proof.png','http://example.test/proof.png'])assert.equal(evidenceLink(url),url);
 for(const url of ['javascript:alert(1)','data:text/html,bad','//example.test/proof','/\\example.test/file','/uploads/\nfile',{},'not a url'])assert.equal(evidenceLink(url),null);
 const result=disputeEvidence({home_dispute_submission:{proof_url:'javascript:bad',explanation:'<script>text remains text</script>'}});assert.equal(result.sheets[2].invalidProof,true);assert.equal(result.sheets[2].proof,null);assert.equal(result.sheets[2].explanation,'<script>text remains text</script>');
});
test('closing evidence restores its still-mounted opener and preserves default focus handling when the opener disappeared',()=>{
 let prevented=0,focused=0;const event={preventDefault:()=>prevented++};
 restoreEvidenceFocus(event,{isConnected:true,focus:()=>focused++});assert.equal(prevented,1);assert.equal(focused,1);
 for(const opener of [null,{isConnected:false,focus:()=>focused++},{isConnected:true}])restoreEvidenceFocus(event,opener);
 assert.equal(prevented,1);assert.equal(focused,1);
});
