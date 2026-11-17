import test from 'node:test';
import assert from 'node:assert/strict';
import {readWalletBalance,readWalletHistory} from '../walletResponse.mjs';

test('previous server response remains renderable without inventing missing finances',()=>{
  const data=readWalletBalance({balance:'128500.00',summary:[],contract:null,weekly_salary:0,recent_transactions:[]});
  assert.doesNotThrow(()=>data.agreements.filter(a=>a.status==='active'));
  assert.doesNotThrow(()=>data.payroll.filter(p=>p.status==='arrears'));
  assert.equal(data.balance,128500);
  assert.equal(data.credits,null);
  assert.equal(data.available.agreements,false);
  assert.equal(data.available.lifestyle,false);
  assert.equal(data.history_filters_available,false);
  assert.equal(data.incomplete,true);
});
test('complete zero-valued response is valid and distinct from unavailable data',()=>{
  const data=readWalletBalance({balance:0,credits:0,agreements:[],payroll:[],summary:[],managed_clubs:[],categories:[],locked_stc:0,locked_match_count:0,passive_income:{asset_count:0,due_assets:0,collectable_stc:0},history_filters_available:true});
  assert.equal(data.incomplete,false);
  assert.equal(data.available.agreements,true);
  assert.equal(data.credits,0);
  assert.equal(data.history_filters_available,true);
});
test('malformed lists cannot reach array operations, malformed balances/history report failure',()=>{
  const data=readWalletBalance({balance:50,agreements:[null],payroll:{},categories:[null,'salary']});
  assert.deepEqual(data.agreements,[]);
  assert.deepEqual(data.categories,['salary']);
  assert.equal(data.available.agreements,false);
  for(const value of [null,{},[],{balance:null},{balance:'invalid'}])assert.throws(()=>readWalletBalance(value));
  assert.throws(()=>readWalletHistory({total:0}));
  assert.throws(()=>readWalletHistory({transactions:[null],total:1}));
  assert.equal(readWalletHistory({transactions:[],total:0}).total,0);
});
