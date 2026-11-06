import test from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';

const result=await build({entryPoints:[fileURLToPath(new URL('../../components/gameday/OfficialResultPolicyNotice.jsx',import.meta.url))],bundle:true,platform:'node',format:'cjs',write:false,jsx:'automatic',packages:'external',alias:{'@':fileURLToPath(new URL('../../',import.meta.url))}});
const compiled={exports:{}};new Function('require','module','exports',result.outputFiles[0].text)(createRequire(import.meta.url),compiled,compiled.exports);
const render=(game,policy)=>renderToStaticMarkup(React.createElement(compiled.exports.default,{game,policy}));
const policy={match_id:'m',version:'regional_result_review_v2',response_hours:24,allow_either_initial:true,timeout_action:'admin_review'};
test('official notice renders captured terms, an absolute time element and explicit nonapproval on silence',()=>{
 const html=render({id:'m',result_state:'AWAITING_AWAY_CONFIRMATION',confirmation_due_at:'2026-11-05 20:00:00'},policy);
 assert.match(html,/24 hours/);assert.match(html,/silence never approves/);assert.match(html,/Either club may submit/);assert.match(html,/dateTime="2026-11-05T20:00:00.000Z"/i);assert.match(html,/your local time/);
 const earlier=render({id:'m'},{...policy,version:'regional_result_review_v1',allow_either_initial:false});assert.match(earlier,/home club submits/);assert.doesNotMatch(earlier,/Either club/);
});
test('legacy and mismatched context render nothing, unsupported policy and missing deadlines are explicit',()=>{
 assert.equal(render({id:'m'},null),'');assert.equal(render({id:'other'},policy),'');
 assert.match(render({id:'m'},{...policy,version:'unknown'}),/could not be verified/);
 const html=render({id:'m',result_state:'AWAITING_HOME_REVIEW'},policy);assert.match(html,/deadline is unavailable/);assert.doesNotMatch(html,/<time/);
 assert.match(render({id:'m',result_state:'ADMIN_REVIEW'},policy),/awaiting Admin review/);
});
