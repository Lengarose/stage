import test from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';

const result=await build({entryPoints:[fileURLToPath(new URL('../../components/competition/EditionParticipationConditions.jsx',import.meta.url))],bundle:true,platform:'node',format:'cjs',write:false,jsx:'automatic',packages:'external'});
const compiled={exports:{}};new Function('require','module','exports',result.outputFiles[0].text)(createRequire(import.meta.url),compiled,compiled.exports);
const render=conditions=>renderToStaticMarkup(React.createElement(compiled.exports.default,{conditions}));
test('edition conditions render the captured text and policy versions without treating text as HTML',()=>{
 const html=render({state:'published',rules_text:'Original accepted terms\n<script>text</script>',policy_version:'regional_registration_v1',result_policy_version:'regional_result_review_v2',cup_policy_version:'regional_cup_v1'});
 assert.match(html,/Original accepted terms/);assert.match(html,/regional_result_review_v2/);assert.match(html,/regional_cup_v1/);assert.match(html,/does not register your club/);assert.ok(html.includes('&lt;script&gt;text&lt;/script&gt;'));assert.doesNotMatch(html,/<script>/);
});
test('legacy conditions stay absent and missing captured terms display review rather than current default promises',()=>{
 assert.equal(render(null),'');const html=render({state:'unavailable'});assert.match(html,/unavailable or need review/);assert.match(html,/not been substituted/);assert.doesNotMatch(html,/24 hours|7000000|first six/);
});
