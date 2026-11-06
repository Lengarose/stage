import test from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';

const source=fileURLToPath(new URL('../../components/admin/disputes/DisputeEvidence.jsx',import.meta.url));
const result=await build({entryPoints:[source],bundle:true,platform:'node',format:'cjs',write:false,jsx:'automatic',packages:'external',alias:{'@':fileURLToPath(new URL('../../',import.meta.url))}});
const compiled={exports:{}};
new Function('require','module','exports',result.outputFiles[0].text)(createRequire(import.meta.url),compiled,compiled.exports);
const Evidence=compiled.exports.default;

test('review rendering includes separate evidence attachments and escapes submitted explanations',()=>{
 const html=renderToStaticMarkup(React.createElement(Evidence,{match:{home_club_name:'Home club',away_club_name:'Away club',home_submission:{home_score:2,away_score:2,proof_url:'/uploads/original.png'},home_dispute_submission:{home_score:3,away_score:2,proof_url:'/uploads/dispute.png',explanation:'<script>not markup</script>'},away_dispute_submission:{home_score:2,away_score:3,proof_url:'/uploads/away.png'},proof_url:'/uploads/match.png',forfeit_proof_url:'/uploads/forfeit.png'}}));
 for(const file of ['original','dispute','away','match','forfeit'])assert.ok(html.includes(`/uploads/${file}.png`));
 assert.match(html,/Home club · Original proposal/);assert.match(html,/Home club · Dispute evidence/);assert.match(html,/Away club · Dispute evidence/);assert.match(html,/3 – 2/);assert.match(html,/Not submitted/);assert.ok(html.includes('&lt;script&gt;not markup&lt;/script&gt;'));assert.doesNotMatch(html,/<script>/);
});
test('unreadable claims and invalid attachments render clearly without borrowing global penalty outcomes',()=>{
 const html=renderToStaticMarkup(React.createElement(Evidence,{match:{decided_on_penalties:1,penalty_winner_side:'home',home_submission:'{',away_submission:{home_score:1,away_score:1,proof_url:'javascript:bad'},home_dispute_submission:{home_score:1,away_score:1,decided_on_penalties:1,penalty_winner_side:'away'}}}));
 assert.match(html,/could not be read/);assert.match(html,/attachment link is unavailable/);assert.doesNotMatch(html,/href="javascript:/);assert.equal((html.match(/won on penalties/g)||[]).length,1);assert.match(html,/Away won on penalties/);
});
