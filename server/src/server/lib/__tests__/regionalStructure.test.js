'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {structure,placement,transition,standings,unresolvedTies,resolveTies}=require('../regionalStructure');
const seed='captured-regional-draw-seed';
const ids=n=>Array.from({length:n},(_,i)=>`club-${i}`);
const result=f=>({...f,status:'completed',confirmed:true,home_score:1,away_score:0});
function resolve(run) {
  const results=[];
  for(let i=0;i<8;i++) {
    const plan=run(results);
    if(plan.ready)return plan;
    assert.ok(!plan.blockers?.length,JSON.stringify(plan.blockers));
    assert.ok(plan.pending.length);
    // A strict total strength order avoids artificial tied mini-tables.
    for(const f of plan.pending)results.push({...result(f),home_score: f.home.localeCompare(f.away)<0?1:0,away_score:f.home.localeCompare(f.away)<0?0:1});
  }
  assert.fail('Progression did not converge');
}
test('every approved structure has twenty clubs per group and balanced normal movements',()=>{
  for(const count of [20,40,60,80,100,120,180,240]) {
    const s=structure(count);assert.equal(s.groups.length*20,count);
    assert.equal(s.groups.filter(g=>g.division===1).length*s.relegated_per_d1,s.groups.filter(g=>g.division===2).length*2);
  }
  for(const count of [0,13,30,50,130,260,40.5])assert.throws(()=>structure(count),/no approved structure/);
});
test('forty-club placement converges through eighty group games and four decisions into D1/D2',()=>{
  const plan=resolve(results=>placement(40,ids(40),seed,results));
  assert.equal(plan.fixtures.length,84);assert.equal(plan.groups.length,2);
  assert.ok(plan.groups.every(g=>g.club_ids.length===20));assert.equal(new Set(plan.groups.flatMap(g=>g.club_ids)).size,40);
  assert.equal(plan.fixtures.filter(f=>f.allow_penalties).length,4);
  assert.deepEqual(plan,resolve(results=>placement(40,ids(40),seed,results)));
});
test('all approved launch formats converge; direct 180/240 launch remains blocked',()=>{
  for(const count of [20,60,80,100,120]) {
    const p=resolve(results=>placement(count,ids(count),seed,results));
    assert.equal(p.groups.length,structure(count).groups.length);
    assert.ok(p.groups.every(g=>g.club_ids.length===20));
  }
  for(const count of [180,240])assert.throws(()=>placement(count,ids(count),seed),/no approved placement/);
});
test('every normal and approved expansion route preserves unique sporting rights and capacity',()=>{
  for(const [from,to] of [...[20,40,60,80,100,120,180,240].map(n=>[n,n]),[20,40],[40,60],[60,80],[80,100],[100,120],[120,180],[180,240]]) {
    const old=ids(from),groups=structure(from).groups.map((g,i)=>({...g,final:true,ranked_club_ids:old.slice(i*20,(i+1)*20)}));
    const newcomers=Array.from({length:to-from},(_,i)=>`new-${i}`);
    const plan=resolve(results=>transition(from,to,groups,newcomers,seed,results));
    assert.equal(plan.rights.length,to);assert.equal(new Set(plan.rights.map(r=>r.club_id)).size,to);
    assert.ok(plan.groups.every(g=>g.club_ids.length===20));
    assert.ok(newcomers.every(id=>plan.rights.find(r=>r.club_id===id).division===2));
  }
});
test('duplicate participants, disputed results, changed fixture sides and unsupported growth fail safely',()=>{
  assert.throws(()=>placement(40,[...ids(39),'club-0'],seed),/unique/);
  const plan=placement(40,ids(40),seed),first=plan.pending[0];
  assert.equal(placement(40,ids(40),seed,[{...result(first),disputed:true}]).ready,false);
  assert.throws(()=>placement(40,ids(40),seed,[{...result(first),away:'impostor'}]),/captured fixture/);
  assert.throws(()=>placement(40,ids(40),seed,[result(first),result(first)]),/Duplicate official/);
  assert.throws(()=>transition(40,80,[],[],seed),/no approved sporting/);
  assert.throws(()=>transition(60,40,[],[],seed),/no approved sporting/);
});
test('sporting ties never award a place by name or ID',()=>{
  const plan=placement(40,ids(40),seed);
  const tied=placement(40,ids(40),seed,plan.fixtures.map(f=>({...result(f),home_score:0,away_score:0})));
  assert.equal(tied.ready,false);assert.match(tied.blockers[0],/sporting decision/);assert.equal(tied.groups,undefined);
  assert.equal(tied.unresolved_ties.length,8);
  for(const review of tied.unresolved_ties) {
    assert.equal(review.club_ids.length,5);
    assert.equal(review.from_position,1);assert.equal(review.to_position,5);
    assert.deepEqual(review.boundaries,[2,3]);
    const groupFixtures=tied.fixtures.filter(f=>f.ref.startsWith(`${review.group_ref}:`));
    assert.deepEqual(new Set(review.club_ids),new Set(groupFixtures.flatMap(f=>[f.home,f.away])));
  }
});

test('tie review separates equal blocks and ignores equality wholly inside one sporting outcome',()=>{
  const table=[
    {id:'winner'},
    {id:'a',tied_with:['b']},{id:'b',tied_with:['a']},
    {id:'c',tied_with:['d']},{id:'d',tied_with:['c']},
  ];
  assert.deepEqual(unresolvedTies(table,[3],'placement:g1'),[]);
  assert.deepEqual(unresolvedTies(table,[2,4],'placement:g1'),[
    {group_ref:'placement:g1',club_ids:['a','b'],from_position:2,to_position:3,boundaries:[2]},
    {group_ref:'placement:g1',club_ids:['c','d'],from_position:4,to_position:5,boundaries:[4]},
  ]);
  assert.deepEqual(unresolvedTies(table,[0,5],'placement:g1'),[]);
});

test('head-to-head resolves equal league totals before creating a supplementary decision',()=>{
  const clubs=['a','b','c','d'],fixtures=[];
  for(const home of clubs)for(const away of clubs.filter(id=>id!==home))fixtures.push({ref:`${home}:${away}`,home,away});
  const results=fixtures.map(f=>{
    const pair=[f.home,f.away].sort().join('');
    const winner={ab:'a',ac:'c',bc:'b',cd:'c'}[pair];
    return {...result(f),home_score:winner===f.home?1:0,away_score:winner===f.away?1:0};
  });
  const table=standings(clubs,fixtures,results),a=table.find(row=>row.id==='a'),b=table.find(row=>row.id==='b');
  assert.equal(a.points,b.points);assert.equal(a.gd,b.gd);assert.equal(a.gf,b.gf);
  assert.ok(table.indexOf(a)<table.indexOf(b));assert.equal(a.tied,false);assert.equal(b.tied,false);
  assert.equal(resolveTies(table,[1,2,3],'source:D1A',seed,[]).fixtures.length,0);
});

test('two-club sporting decision uses a repeatable home draw and requires an official winner',()=>{
  const table=['a','b'].map(id=>({id,points:10,gd:3,gf:5,tied:true,tied_with:[id==='a'?'b':'a']}));
  const run=results=>resolveTies(table,[1],'placement:g1',seed,results);
  const first=run([]);assert.equal(first.pending.length,1);assert.deepEqual(first,run([]));
  const f=first.fixtures[0];assert.equal(f.allow_penalties,true);
  assert.equal(run([{...result(f),home_score:0,away_score:0}]).pending.length,1);
  assert.equal(run([{...result(f),disputed:true}]).pending.length,1);
  const complete=run([{...result(f),home_score:0,away_score:0,decided_on_penalties:true,penalty_winner_side:'away'}]);
  assert.equal(complete.pending.length,0);assert.equal(complete.table[0].id,f.away);
  assert.equal(complete.table[0].points,10);assert.equal(complete.table[0].gf,5);
  assert.equal(complete.table[0].tied,false);
  assert.equal(resolveTies(table,[1],'placement:g1',seed,[],false).fixtures.length,0,'legacy snapshots do not adopt a new format');
});

test('three/four-club mini-leagues play once per pairing; recurring and larger ties remain in review',()=>{
  for(const n of [3,4,5]) {
    const clubs=ids(n),table=clubs.map(id=>({id,points:7,tied:true,tied_with:clubs.filter(other=>other!==id)}));
    const run=results=>resolveTies(table,[2],'placement:g1',seed,results);
    const first=run([]);
    if(n===5) {assert.equal(first.fixtures.length,0);assert.equal(first.unresolved_ties.length,1);continue;}
    assert.equal(first.fixtures.length,n*(n-1)/2);
    assert.ok(first.fixtures.every(f=>!f.allow_penalties));
    const draws=run(first.fixtures.map(f=>({...result(f),home_score:0,away_score:0})));
    assert.equal(draws.unresolved_ties.length,1);assert.match(draws.unresolved_ties[0].reason,/remains tied/);
    assert.equal(draws.fixtures.length,first.fixtures.length,'no recursive mini-leagues');
    const complete=run(first.fixtures.map(f=>({...result(f),home_score:f.home<f.away?1:0,away_score:f.home<f.away?0:1})));
    assert.equal(complete.pending.length,0);assert.equal(complete.unresolved_ties.length,0);
    assert.deepEqual(complete.table.map(r=>r.id),clubs);assert.ok(complete.table.every(r=>r.points===7));
  }
});

test('placement matches are single round-robin with the approved per-club workload',()=>{
  for(const count of [40,60,80,100,120]) {
    const plan=placement(count,ids(count),seed);
    const expected=[60,120].includes(count)?5:4;
    for(const club of ids(count))assert.equal(plan.fixtures.filter(f=>f.home===club||f.away===club).length,expected);
    const pairs=plan.fixtures.map(f=>[f.home,f.away].sort().join(':'));
    assert.equal(new Set(pairs).size,pairs.length);
  }
});

test('normal promotion is champion plus playoff winner, with higher finishing club at home',()=>{
  const clubs=ids(40), groups=structure(40).groups.map((g,i)=>({...g,final:true,ranked_club_ids:clubs.slice(i*20,(i+1)*20)}));
  const first=transition(40,40,groups,[],seed);
  assert.deepEqual(first.fixtures.map(f=>[f.home,f.away]),[['club-21','club-24'],['club-22','club-23']]);
  const semis=first.fixtures.map(result);
  const second=transition(40,40,groups,[],seed,semis);
  const final=second.fixtures.find(f=>f.ref.endsWith(':final'));
  assert.deepEqual([final.home,final.away],['club-21','club-22']);
  const plan=transition(40,40,groups,[],seed,[...semis,result(final)]);
  assert.equal(plan.ready,true);
  assert.deepEqual(plan.rights.filter(r=>r.route==='promotion').map(r=>r.club_id),['club-20','club-21']);
  for(const id of ['club-18','club-19'])assert.equal(plan.rights.find(r=>r.club_id===id).division,2);
});
