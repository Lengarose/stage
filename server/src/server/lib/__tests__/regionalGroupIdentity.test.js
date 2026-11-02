'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const {identity}=require('../regionalEditionIdentity');
const {buildCatalogue}=require('../regionalLeagueHierarchy');
const base={id:'original',region_slug:'uk-ireland',division:1,platform:'cross-platform',season_number:1,slug:'uk-ireland-div-1',status:'completed'};
test('implicit and explicit group A retain the original hash; B is distinct and canonical',()=>{
  const old=crypto.createHash('sha256').update(JSON.stringify({region_slug:base.region_slug,division:1,platform:base.platform,season_number:1})).digest('hex');
  assert.equal(identity(base).key,old);assert.equal(identity({...base,group_code:'A'}).key,old);
  const b=identity({...base,slug:'uk-ireland-div-1-group-b',group_code:'b'});
  assert.notEqual(b.key,old);assert.equal(b.group_code,'B');assert.equal(b.canonical_slug,'uk-ireland-div-1-group-b');
  assert.throws(()=>identity({...base,slug:b.canonical_slug,group_code:'C'}),/group/i);
});
test('one permanent division exposes separate current group editions, never a duplicate league',()=>{
  const rows=[{...base,current_edition_id:'a2',group_current_edition_ids:{A:'a2',B:'b2'}},
    {...base,id:'a2',permanent_league_id:base.id,season_number:2,slug:base.slug+'-s2',status:'draft'},
    {...base,id:'b2',permanent_league_id:base.id,group_code:'B',season_number:2,slug:base.slug+'-group-b-s2',status:'draft'}];
  const report=buildCatalogue(rows);
  assert.equal(report.definitions.length,1);assert.equal(report.leagues.length,1);
  assert.equal(report.groups.length,2);assert.deepEqual(report.groups.map(g=>g.current_edition_id),['a2','b2']);
  assert.ok(report.groups.every(g=>!g.identity_conflict));
  assert.equal(report.groups[1].stable_slug,base.slug+'-group-b');
});
