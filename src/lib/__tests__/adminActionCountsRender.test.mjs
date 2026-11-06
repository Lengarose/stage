import test from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {MemoryRouter} from 'react-router-dom';
import {initialGameDayFeeds} from '../adminGameDayFeeds.js';

async function component(file){
 const result=await build({entryPoints:[fileURLToPath(new URL(`../../components/admin/${file}.jsx`,import.meta.url))],bundle:true,platform:'node',format:'cjs',write:false,jsx:'automatic',packages:'external',alias:{'@':fileURLToPath(new URL('../../',import.meta.url))},plugins:[{name:'display-boundaries',setup(builder){
  builder.onResolve({filter:/^lucide-react$/},()=>({path:fileURLToPath(new URL('../../../node_modules/lucide-react/dist/esm/lucide-react.js',import.meta.url))}));
  builder.onResolve({filter:/^react$/,namespace:'display-boundary'},()=>({path:'react',external:true}));
  builder.onResolve({filter:/DashboardGamerStatCard$|GamerProfileUI$|useTranslation$|adminI18n$|AnalyticsTab$|stageClient$|AdminGamerUI$|\/utils$|\/button$/},args=>({path:args.path,namespace:'display-boundary'}));
  builder.onLoad({filter:/.*/,namespace:'display-boundary'},({path})=>{
   let contents;
   if(path.endsWith('useTranslation'))contents='export const useTranslation=()=>({t:key=>key});';
   else if(path.endsWith('adminI18n'))contents='export const getAdminSectionLabel=(t,key)=>key;';
   else if(path.endsWith('/utils'))contents='export const cn=(...a)=>a.filter(Boolean).join(" ");';
   else if(path.endsWith('stageClient'))contents='export const stageClient={};';
   else if(path.endsWith('AnalyticsTab'))contents='export const CHART_LINE_META=[]; export function UsageChart(){return null;} export function AppGuideVisual(){return null;}';
   else if(path.endsWith('DashboardGamerStatCard'))contents="import React from 'react'; export default function Card({label,value,sub}){return React.createElement('article',{},label,String(value),sub);}";
   else if(path.endsWith('GamerProfileUI'))contents="import React from 'react'; export function GamerProfileShell({children}){return React.createElement('main',{},children);}";
   else if(path.endsWith('AdminGamerUI'))contents="import React from 'react'; export function AdminGamerSection({children}){return React.createElement('section',{},children);}";
   else contents="import React from 'react'; export function Button({children}){return React.createElement('button',{},children);}";
   return {contents};
  });
 }}]});
 const compiled={exports:{}};new Function('require','module','exports',result.outputFiles[0].text)(createRequire(import.meta.url),compiled,compiled.exports);return compiled.exports.default;
}
const Layout=await component('AdminGamerUI'),Dashboard=await component('AdminDashboardPanel');
function readyFeeds(){const feeds=initialGameDayFeeds();for(const key of Object.keys(feeds))feeds[key]={status:'ready',total:0,items:[]};return feeds;}
function render(Component,feeds){return renderToStaticMarkup(React.createElement(MemoryRouter,{},React.createElement(Component,{gameDayFeeds:feeds,players:[],clubs:[],tournaments:[],identityClaims:[],regApplications:[]})));}

test('the Admin shell shows an unavailable claim source and unknown ring instead of none pending',()=>{
 const feeds=readyFeeds();feeds.forfeits={status:'error',total:null,items:[]};
 const html=render(Layout,feeds);assert.match(html,/Unavailable/);assert.match(html,/Claim status not verified/);assert.doesNotMatch(html,/admin.stats.nonePending/);assert.match(html,/>\?<\/span>/);
});
test('the shell uses the full review count and all four action categories, not preview length',()=>{
 const feeds=readyFeeds();feeds.reviews={status:'ready',total:53,items:[{id:'preview'}]};feeds.forfeits.total=2;feeds.scheduling.total=3;feeds.stuck.total=1;
 const html=render(Layout,feeds);assert.match(html,/>59<\/span>/);assert.match(html,/admin.sections.disputes53/);
});
test('the dashboard never calls failed scheduling healthy or claims the GameDay total is zero',()=>{
 const feeds=readyFeeds();feeds.scheduling={status:'error',total:null,items:[]};
 const html=render(Dashboard,feeds);assert.match(html,/Scheduling status not verified/);assert.match(html,/Action total unknown/);assert.match(html,/Expired fixtures could not be loaded/);assert.doesNotMatch(html,/admin.stats.scheduleHealthy/);
});
