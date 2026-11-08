'use strict';
const {withTransaction}=require('../db/database');
const {v4:uuid,v5}=require('uuid');
const {unpack}=require('../models/competitionScopeModel');
const fail=(message,status=422)=>{throw Object.assign(Error(message),{status});};
function money(value){const s=String(value).trim();if(!/^-?\d{1,10}(?:\.\d{1,2})?$/.test(s))fail('Enter an explicit STC amount with at most two decimal places.');const negative=s.startsWith('-'),[whole,fraction='']=s.replace('-','').split('.');return (BigInt(whole)*100n+BigInt(fraction.padEnd(2,'0')))*(negative?-1n:1n);}
const amount=cents=>`${cents<0n?'-':''}${(cents<0n?-cents:cents)/100n}.${String((cents<0n?-cents:cents)%100n).padStart(2,'0')}`;
async function action(body,actor){return withTransaction(async q=>{
 const admin=await require('./regionalEditionService').admin(actor,q);
 if(!['club','player'].includes(body.recipient_type)||!['refund','compensation'].includes(body.kind))fail('Choose club/player and refund/compensation.');
 if(!/^[a-f0-9-]{36}$/i.test(String(body.decision_id||''))||!String(body.reason||'').trim())fail('Provide a stable decision ID and the decision reason.');
 const delta=money(body.amount);if(delta===0n)fail('The adjustment amount cannot be zero.');
 const normalized={id:body.decision_id,recipient_type:body.recipient_type,recipient_id:body.recipient_id,kind:body.kind,amount:amount(delta),reference_transaction_id:body.reference_transaction_id,reason:body.reason};
 const player=body.recipient_type==='player',table=player?'players':'clubs',ledger=player?'player_stc_transactions':'stc_transactions',recipientColumn=player?'player_id':'club_id';
 const [account]=await q(`SELECT id,stc${player?',email':''} FROM ${table} WHERE id=? FOR UPDATE`,[body.recipient_id]);if(!account)fail('Recipient account not found.',404);
 const [existing]=await q('SELECT * FROM league_entities WHERE id=? FOR UPDATE',[body.decision_id]);
 if(existing){const prior=unpack(existing);if(existing.entity_type!=='competition_adjustment'||Object.keys(normalized).some(k=>prior[k]!==normalized[k]))fail('This decision ID is already used for a different adjustment.',409);return {already_applied:true,adjustment:prior};}
 const [source]=await q(`SELECT * FROM ${ledger} WHERE id=? FOR UPDATE`,[body.reference_transaction_id]);if(!source)fail('Choose an existing transaction as the correction reference.',404);
 if(body.kind==='refund'){
  if(source[recipientColumn]!==account.id||delta<0n||money(source.amount)>=0n)fail('A refund is a positive amount against an existing debit.');
  const prior=await q("SELECT data_json FROM league_entities WHERE entity_type='competition_adjustment' AND JSON_UNQUOTE(JSON_EXTRACT(data_json,'$.reference_transaction_id'))=? AND JSON_UNQUOTE(JSON_EXTRACT(data_json,'$.recipient_type'))=? AND status='applied' FOR UPDATE",[source.id,body.recipient_type]);
  const already=prior.map(unpack).filter(r=>r.kind==='refund').reduce((sum,r)=>sum+money(r.amount),0n);
  if(already+delta>-money(source.amount))fail('This refund would exceed the original debit after previous refunds.',409);
 }
 const balance=money(account.stc||0)+delta;if(balance<0n)fail('This correction would make the recipient balance negative.',409);if(balance>999999999999n)fail('The resulting balance exceeds the supported STC range.');
 const ledgerId=v5(`competition_adjustment_ledger:${body.decision_id}`,v5.URL),record={...normalized,status:'applied',ledger_transaction_id:ledgerId,balance_before:amount(money(account.stc||0)),balance_after:amount(balance),source_transaction_snapshot:source,decided_by:admin.id,decided_at:new Date().toISOString()};
 await q(`UPDATE ${table} SET stc=?,updated_date=NOW() WHERE id=?`,[record.balance_after,account.id]);
 const columns=['id',recipientColumn,...(player?['player_email']:[]),'amount','balance_after','type','category','description','reference_id','settlement_key'];
 const values=[ledgerId,account.id,...(player?[account.email||null]:[]),record.amount,record.balance_after,'adjustment',body.kind,body.reason,source.id,`competition_adjustment:${record.id}`];
 await q(`INSERT INTO ${ledger} (${columns.join(',')},created_date) VALUES (${values.map(()=>'?').join(',')},NOW())`,values);
 await q("INSERT INTO league_entities (id,entity_type,status,data_json) VALUES (?,'competition_adjustment','applied',?)",[record.id,JSON.stringify(record)]);
 await q('INSERT INTO admin_audit_log (id,admin_user_id,admin_email,action,entity_type,entity_id,old_value,new_value,reason) VALUES (?,?,?,?,?,?,?,?,?)',[uuid(),admin.id,admin.email,`competition_${body.kind}`,'competition_adjustment',record.id,JSON.stringify({account,source}),JSON.stringify(record),body.reason]);
 return {applied:true,adjustment:record};
});}
module.exports={action,money};
