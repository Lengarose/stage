'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {publicParticipationConditions:conditions}=require('../publicParticipationConditions');
const root={id:'league',region_slug:'uk-ireland',platform:'Cross-Platform',season_number:1,reset_series:0,regional_registration_window_id:'window',regional_participation_policy_version:'regional_registration_v1'};
const window={id:'window',region_slug:'uk-ireland',platform:'cross-platform',season_number:1,reset_series:0,policy_version:'regional_registration_v1',result_policy_version:'regional_result_review_v2',cup_policy_version:'regional_cup_v1',rules_text:'Captured terms',draw_seed:'private seed',admin_email:'private@example.test',confirmed_player_ids:['private player']};
test('published edition conditions preserve exact captured text and expose only the explicit public projection',()=>{
 const before=JSON.stringify(window),result=conditions(root,window);assert.equal(result.state,'published');assert.equal(result.rules_text,'Captured terms');assert.equal(result.result_policy_version,'regional_result_review_v2');assert.equal(JSON.stringify(window),before);assert.doesNotMatch(JSON.stringify(result),/private|draw_seed|admin_email|confirmed_player/);
 assert.deepEqual(Object.keys(result).sort(),['state','window_id','policy_version','result_policy_version','cup_policy_version','rules_text'].sort());
 assert.equal(conditions({...root,status:'archived'},window).rules_text,'Captured terms');
});
test('missing, wrong edition/scope/series and unknown registration versions never fall back to current terms',()=>{
 assert.equal(conditions({id:'old'},null),null);assert.deepEqual(conditions(root,null),{state:'unavailable'});
 for(const patch of [{id:'new-window'},{region_slug:'france'},{platform:'playstation'},{season_number:2},{reset_series:1},{policy_version:'unknown'},{rules_text:null},{rules_text:''}])assert.deepEqual(conditions(root,{...window,...patch}),{state:'unavailable'});
 assert.deepEqual(conditions({...root,regional_participation_policy_version:'unknown'},window),{state:'unavailable'});
});
test('Cup snapshots can publish their own captured conditions without a linked registration lookup',()=>{
 const cup={id:'cup',region_slug:'uk-ireland',platform:'cross-platform',season_number:1,reset_series:0};
 assert.equal(conditions(cup,window).rules_text,'Captured terms');assert.equal(conditions(cup,null),null);
 assert.deepEqual(conditions(cup,{id:'window',policy_version:'regional_registration_v1'}),{state:'unavailable'});
});
