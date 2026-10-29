import test from 'node:test';
import assert from 'node:assert/strict';
import { regionalSystems, selectRegionalEdition, regionalHref } from '../regionalPresentation.js';
import { stageInitialSelection, buildTournamentStages } from '../tournamentStages.js';
import { formatProfilePlatform } from '../profilePlatform.js';
import { isBannerStickyFullBleedRoute } from '../pageBanner.js';
test('normal-flow competition pages are not trapped inside the fixed banner shell',()=>{
 for(const path of ['/leagues/north-america','/tournaments/a']) assert.equal(isBannerStickyFullBleedRoute(path),false);
 for(const path of ['/game-day','/tournaments/game-day','/players/a','/tournaments/profile-player/a']) assert.equal(isBannerStickyFullBleedRoute(path),true);
});
const base={id:'a',slug:'north-america-div-1',system_key:'north:cross',division_key:'north:cross:1',region_slug:'north-america',division:1,season_number:1,status:'registration',name:'North America',platform:'Cross-Platform'};
test('systems deduplicate repeated IDs, retain conflicting records and separate valid platforms and archive editions',()=>{
 const conflict={...base,id:'duplicate',identity_conflict:true};
 const seasons=[base,base,conflict,{...base,id:'d2',division:2},{...base,id:'old',status:'archived',season_number:0},{...base,id:'ps4',system_key:'north:ps4',division_key:'north:ps4:1',platform:'PS4'}];
 const groups=regionalSystems(seasons);
 assert.equal(groups.length,2);assert.equal(groups.find(g=>g.key==='north:cross').divisions,2);
 assert.equal(groups.find(g=>g.key==='north:cross').editions.length,3);
 assert.equal(regionalSystems(seasons,{archive:true})[0].editions[0].id,'old');
 assert.equal(regionalSystems(seasons,{search:'North',division:'2',region:'north-america'})[0].editions.length,1);
 assert.equal(selectRegionalEdition([base,conflict],base.slug,null),null);
 assert.equal(selectRegionalEdition([base,conflict],base.slug,'duplicate').id,'duplicate');
 assert.equal(selectRegionalEdition([base,{...base,id:'unrelated',division_key:'other',slug:'other'}],base.slug,'unrelated'),null);
});
test('fixture shortcut selects the actual stage and matchday, not the first matchday',()=>{
 const matches=[1,4].map(round=>({id:`m${round}`,fixture_id:`f${round}`,type:'league',round,status:'scheduled'}));
 const stages=buildTournamentStages({type:'league',registered_clubs:['a','b']},matches);
 assert.deepEqual(stageInitialSelection(stages,'f4'),{stage:'league',day:4});
 assert.deepEqual(stageInitialSelection(stages,'missing'),{stage:null,day:null});
});
test('competition platform labels preserve unknown PlayStation generation',()=>{
 assert.equal(formatProfilePlatform('PlayStation','Unavailable',{preserveUnspecified:true}),'PlayStation');
 assert.equal(formatProfilePlatform('PS5','Unavailable',{preserveUnspecified:true}),'PS5');
 assert.equal(formatProfilePlatform('PS4','Unavailable',{preserveUnspecified:true}),'PS4');
});

test('permanent routes select the explicit current edition and preserve exact historical links across reset series',()=>{
 const first={...base,id:'original',permanent_league_id:'original',division_key:'original',stable_slug:base.slug,status:'archived',is_current:false};
 const second={...first,id:'season-two',slug:base.slug+'-s2',season_number:2};
 const fresh={...first,id:'fresh',slug:base.slug+'-reset-1',season_number:1,reset_series:1,season_label:'Series 1 · Season 1',status:'registration',is_current:true};
 const rows=[first,second,fresh];
 assert.equal(regionalSystems(rows)[0].editions.length,1);
 assert.equal(regionalSystems(rows)[0].divisions,1);
 assert.equal(selectRegionalEdition(rows,base.slug).id,'fresh');
 assert.equal(selectRegionalEdition(rows,base.slug,'season-two').id,'season-two');
 assert.equal(regionalHref(second),`/leagues/${base.slug}?season=season-two`);
 assert.equal(regionalSystems(rows,{archive:true})[0].editions.length,2);
 assert.equal(regionalSystems(rows.map(row=>({...row,retired:true}))).length,0);
});
