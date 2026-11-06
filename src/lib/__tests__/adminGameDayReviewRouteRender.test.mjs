import test from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {initialGameDayFeeds} from '../adminGameDayFeeds.js';
import {MemoryRouter} from 'react-router-dom';

const source=fileURLToPath(new URL('../../components/admin/sections/GameDayTab.jsx',import.meta.url));
const result=await build({entryPoints:[source],bundle:true,platform:'node',format:'cjs',write:false,jsx:'automatic',packages:'external',alias:{'@':fileURLToPath(new URL('../../',import.meta.url))},plugins:[{name:'review-child-boundaries',setup(builder){
 builder.onResolve({filter:/^lucide-react$/},()=>({path:fileURLToPath(new URL('../../../node_modules/lucide-react/dist/esm/lucide-react.js',import.meta.url))}));
 builder.onResolve({filter:/^react$/,namespace:'test-boundary'},()=>({path:'react',external:true}));
 builder.onResolve({filter:/DisputesTab$|ForfeitsTab$|ExpiredFixtureRow$|GameDayBannerEditor$|stageClient$|AdminGamerUI$|\/utils$|\/button$|\/swal$/},args=>({path:args.path,namespace:'test-boundary'}));
 builder.onLoad({filter:/.*/,namespace:'test-boundary'},args=>({contents:args.path.endsWith('AdminGamerUI')?"import React from 'react'; export function AdminGamerSection({title,children}){return React.createElement('section',{},title,children);}":args.path.endsWith('/utils')?'export function cn(...args){return args.filter(Boolean).join(" ");}':args.path.endsWith('/button')?"import React from 'react'; export function Button({children}){return React.createElement('button',{},children);}":args.path.endsWith('stageClient')?'export const stageClient={};':args.path.endsWith('/swal')?'export function swalAlert(){}; export function swalConfirm(){};':`import React from 'react'; export default function Boundary(){return React.createElement('div',{'data-review-boundary':${JSON.stringify(args.path)}});}`}));
}}]});
const compiled={exports:{}};
new Function('require','module','exports',result.outputFiles[0].text)(createRequire(import.meta.url),compiled,compiled.exports);
const GameDay=compiled.exports.default;
function render(path,props={}){return renderToStaticMarkup(React.createElement(MemoryRouter,{initialEntries:[path]},React.createElement(GameDay,props)));}

test('an exact review deep link mounts the disputes view instead of hiding it behind Needs Action',()=>{
 const html=render('/admin/disputes?match=outside-first-page');
 assert.match(html,/data-review-boundary="[^"]*DisputesTab/);assert.doesNotMatch(html,/GameDay Command Queue/);
});
test('the initial queue reports an unknown review total while the independent summary is loading',()=>{
 const html=render('/admin/gameday');assert.match(html,/GameDay Command Queue/);assert.match(html,/Checking pending result reviews/);assert.doesNotMatch(html,/No items in this snapshot|All Clear/);
});

test('a failed scheduling source renders an unknown total and a retry instead of a healthy empty queue',()=>{
 const feeds=initialGameDayFeeds();for(const key of Object.keys(feeds))feeds[key]={status:'ready',total:0,items:[],as_of:'2026-11-06T20:00:00Z'};
 feeds.scheduling={status:'error',total:null,items:[]};
 const html=render('/admin/gameday',{gameDayFeeds:feeds,onRefreshFeeds:()=>{}});
 assert.match(html,/Expired fixtures could not be loaded/);assert.match(html,/Retry action feeds/);assert.match(html,/partial overview/);assert.doesNotMatch(html,/No items in this snapshot|Schedule Healthy/);
});
test('verified empty sources alone permit an empty snapshot message',()=>{
 const feeds=initialGameDayFeeds();for(const key of Object.keys(feeds))feeds[key]={status:'ready',total:0,items:[],as_of:'2026-11-06T20:00:00Z'};
 assert.match(render('/admin/gameday',{gameDayFeeds:feeds}),/No items in this snapshot/);
});

test('forfeit and dispute links open their associated view without requiring a focused match',()=>{
 assert.match(render('/admin/forfeits'),/data-review-boundary="[^"]*ForfeitsTab/);
 assert.match(render('/admin/disputes'),/data-review-boundary="[^"]*DisputesTab/);
});
test('a failed scheduling source also stays unknown inside its own view',()=>{
 const feeds=initialGameDayFeeds();feeds.scheduling={status:'error',items:[],total:null};
 const html=render('/admin/gameday?view=scheduling',{gameDayFeeds:feeds,onRefreshFeeds:()=>{}});
 assert.match(html,/Expired fixtures could not be loaded/);assert.doesNotMatch(html,/Schedule Healthy/);
});
