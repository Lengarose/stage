'use strict';
const assert = require('node:assert/strict');
const { randomUUID: id } = require('node:crypto');
const { configure, bootstrap } = require('./bootstrap.cjs');
let db, server;
(async () => {
  db = await bootstrap(configure());
  const q = db.EXECUTESQL, uid = id(), pid = id(), otherUser = id(), otherPlayer = id(), cid = id();
  for (const [u,p] of [[uid,pid],[otherUser,otherPlayer]]) {
    await q('INSERT INTO users(id,email,role_id,player_id,credits) VALUES(?,?,1,?,75)', [u,`${u}@example.test`,p]);
    await q('INSERT INTO players(id,user_id,email,gamertag,stc,credits) VALUES(?,?,?,?,123456.50,999)', [p,u,`${u}@example.test`,'Wallet demonstration']);
  }
  await q('INSERT INTO clubs(id,name,president_user_id,owner_email) VALUES(?,?,?,?)',[cid,'Wallet FC',uid,`${uid}@example.test`]);
  const now = Date.now(), iso = ms => new Date(ms).toISOString();
  const agreementIds = [id(),id()];
  for (const [i,kind] of ['player','management'].entries()) {
    const a={id:agreementIds[i],club_id:cid,player_id:pid,kind,status:'active',weekly_salary_stc:(i+1)*5000,signing_bonus_stc:1000,bonus_payment:{status:'paid'},starts_at:iso(now-86400000),ends_at:iso(now+40*86400000)};
    await q('INSERT INTO league_entities(id,entity_type,club_id,data_json) VALUES(?,?,?,?)',[a.id,'club_agreement',cid,JSON.stringify(a)]);
  }
  const receipt={player_id:pid,agreement_id:agreementIds[0],amount_stc:5000,status:'arrears',from:iso(now-8*86400000),through:iso(now-86400000)};
  await q('INSERT INTO league_entities(id,entity_type,data_json) VALUES(?,?,?)',[id(),'club_payroll',JSON.stringify(receipt)]);
  for(let i=0;i<25;i++) await q('INSERT INTO player_stc_transactions(id,player_id,amount,balance_after,type,category,source,description,created_date) VALUES(?,?,?,123456.50,?,?,?,?,?)',[id(),pid,i===24?-250:100,i===24?'expense':'income',i===24?'lifestyle_purchase':'salary','Club Board',i===24?'Historic hotel purchase':'Weekly payroll',iso(now-i*86400000)]);
  await q('INSERT INTO player_stc_transactions(id,player_id,amount,type,description) VALUES(?,?,987654,?,?)',[id(),otherPlayer,'income','Private other account']);
  for(const [state,funded,amount]of[['active',1,100],['disputed',1,200],['settled',1,400],['active',0,800]]) await q('INSERT INTO matches(id,mode,home_player_id,away_player_id,wager_stc,wager_status,wager_home_locked) VALUES(?,?,?,?,?,?,?)',[id(),'solo',pid,otherPlayer,amount,state,funded]);
  const app=require('express')();app.use(require('express').json());
  require('../../src/server/routes/registerStageRoutes').registerStageRoutes(app,require('../../src/server/authMiddleware'));
  server=app.listen(0,'127.0.0.1');await new Promise((r,j)=>{server.once('listening',r);server.once('error',j);});
  async function call(params){const token=require('jsonwebtoken').sign({id:uid,email:`${uid}@example.test`},process.env.ACCESS_TOKEN_SECRET,{expiresIn:'1h'});const res=await fetch(`http://127.0.0.1:${server.address().port}/api/stage/functions/playerWallet`,{method:'POST',headers:{authorization:`Bearer ${token}`,'content-type':'application/json'},body:JSON.stringify(params)});return{status:res.status,body:await res.json()};}
  let res=await call({action:'get_balance',player_id:otherPlayer});assert.equal(res.status,200,JSON.stringify(res.body));
  const b=res.body.data;assert.equal(b.balance,123456.5);assert.equal(b.credits,75);assert.equal(b.agreements.length,2);assert.equal(b.payroll[0].status,'arrears');assert.equal(b.locked_stc,300);assert.equal(b.locked_match_count,2);assert.equal(b.passive_income.asset_count,0);assert.equal(b.managed_clubs[0].id,cid);assert.equal(b.credit_history_available,false);
  assert.equal(b.agreements[0].next_payment_at,iso(now+6*86400000));
  res=await call({action:'get_history',page:2});assert.equal(res.status,200);assert.equal(res.body.data.total,25);assert.equal(res.body.data.transactions.length,5);
  res=await call({action:'get_history',search:'Historic',direction:'expense',category:'lifestyle_purchase',player_id:otherPlayer});assert.equal(res.body.data.total,1);assert.equal(Number(res.body.data.transactions[0].amount),-250);
  res=await call({action:'get_history',from_date:iso(now).slice(0,10),to_date:iso(now).slice(0,10)});assert.equal(res.body.data.total,1);
  res=await call({action:'get_history',currency:'credits'});assert.equal(res.body.data.history_available,false);
  res=await call({action:'get_history',from_date:'2026-02-30'});assert.equal(res.status,400);
  const item=id();await q('INSERT INTO lifestyle_items(id,name,passive_income_stc) VALUES(?,?,500)',[item,'Income hotel']);
  await q('INSERT INTO lifestyle_purchases(id,player_id,item_id,purchase_type,status,created_date) VALUES(?,?,?,?,?,?)',[id(),pid,item,'buy','active',iso(now-10*86400000)]);
  res=await call({action:'get_balance'});assert.equal(res.body.data.passive_income.collectable_stc,500);assert.equal(res.body.data.balance,123456.5);
  console.log('PASS: Wallet HTTP reads, authenticated isolation, shared credits, modern agreements, weekly payroll date, arrears, funded stakes, full-history filtering/pagination, dates, asset income and no balance mutation.');
})().catch(e=>{console.error(e);process.exitCode=1;}).finally(async()=>{if(server)await new Promise(r=>server.close(r));if(db)await db.pool.promise().end();});
