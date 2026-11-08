import test from 'node:test';
import assert from 'node:assert/strict';
import { regionalSystems, selectRegionalEdition, regionalHref, orderRegionalStandings } from '../regionalPresentation.js';
import { stageInitialSelection, buildTournamentStages } from '../tournamentStages.js';
import { formatProfilePlatform } from '../profilePlatform.js';
import { isBannerStickyFullBleedRoute } from '../pageBanner.js';
test('normal-flow competition pages are not trapped inside the fixed banner shell',()=>{
 for(const path of ['/leagues/north-america','/tournaments/a']) assert.equal(isBannerStickyFullBleedRoute(path),false);
 for(const path of ['/game-day','/tournaments/game-day','/players/a','/tournaments/profile-player/a']) assert.equal(isBannerStickyFullBleedRoute(path),true);
});
const base={id:'a',slug:'north-america-div-1',system_key:'north:cross',division_key:'north:cross:1',region_slug:'north-america',division:1,season_number:1,status:'registration',name:'North America',platform:'Cross-Platform'};
test('the completed league table follows official sporting decisions without rewriting points',()=>{
 const rows=[{club_id:'a',points:10},{club_id:'b',points:10}];
 const edition={status:'completed',regional_final_ranked_club_ids:['b','a']};
 assert.deepEqual(orderRegionalStandings(edition,rows).map(row=>row.club_id),['b','a']);
 assert.deepEqual(rows.map(row=>row.club_id),['a','b']);
 assert.ok(orderRegionalStandings(edition,rows).every(row=>row.points===10));
 for(const invalid of [['a','a'],['b'],['a','foreign']])assert.equal(orderRegionalStandings({...edition,regional_final_ranked_club_ids:invalid},rows),rows);
 assert.equal(orderRegionalStandings({...edition,status:'in_progress'},rows),rows);
});
test('parallel group routes select their own current edition while the old permanent ID opens A',()=>{
 const a={...base,id:'a2',permanent_league_id:'root',stable_slug:base.slug,group_code:'A',is_current:true};
 const b={...a,id:'b2',group_code:'B',group_label:'Group B',slug:base.slug+'-group-b-s2',stable_slug:base.slug+'-group-b'};
 const rows=[b,a];
 assert.equal(selectRegionalEdition(rows,'root').id,a.id);
 assert.equal(selectRegionalEdition(rows,b.stable_slug).id,b.id);
 assert.equal(selectRegionalEdition(rows,base.slug,b.id).id,b.id);
 assert.deepEqual(regionalSystems(rows)[0].editions.map(e=>e.group_code),['A','B']);
 assert.equal(regionalSystems(rows,{search:'D1B'})[0].editions[0].id,b.id);
 assert.equal(regionalSystems(rows)[0].divisions,1);
});
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

test('withdrawn clubs remain visible after eligible clubs without rewriting retained points',()=>{
 const rows=[{club_id:'withdrawn',points:57,is_excluded:true},{club_id:'eligible',points:50}];
 const ranked=orderRegionalStandings({status:'in_progress',withdrawn_club_ids:['withdrawn']},rows);
 assert.deepEqual(ranked.map(r=>r.club_id),['eligible','withdrawn']);assert.equal(ranked[1].points,57);assert.equal(rows[0].club_id,'withdrawn');
});
