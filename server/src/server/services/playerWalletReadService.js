'use strict';
const { EXECUTESQL } = require('../db/database');
const WEEK = 7 * 86400000;
const record = row => ({ ...JSON.parse(row.data_json || '{}'), id: row.id, club_name: row.club_name });
function nextPayment(a) {
  const start = Date.parse(a.payroll_through || a.starts_at), end = Date.parse(a.ends_at);
  return Number.isFinite(start) && Number.isFinite(end) && start < end ? new Date(Math.min(start + WEEK, end)).toISOString() : null;
}
async function balance({ player, user }, q = EXECUTESQL) {
  const [accounts, summary, rawAgreements, rawPayroll, assets, wagers, managed, categories] = await Promise.all([
    q('SELECT credits FROM users WHERE id=? LIMIT 1', [user.id]),
    q("SELECT type,category,SUM(amount) AS total FROM player_stc_transactions WHERE player_id=? AND created_date>=DATE_SUB(NOW(),INTERVAL 30 DAY) GROUP BY type,category", [player.id]),
    q("SELECT e.id,e.data_json,c.name AS club_name FROM league_entities e LEFT JOIN clubs c ON c.id=e.club_id WHERE e.entity_type='club_agreement' AND JSON_UNQUOTE(JSON_EXTRACT(e.data_json,'$.player_id'))=? ORDER BY e.created_date DESC,e.id DESC", [player.id]),
    q("SELECT e.id,e.data_json FROM league_entities e WHERE e.entity_type='club_payroll' AND JSON_UNQUOTE(JSON_EXTRACT(e.data_json,'$.player_id'))=? ORDER BY e.created_date DESC,e.id DESC", [player.id]),
    q("SELECT p.id,p.last_passive_collected,p.created_date,i.name,i.passive_income_stc,i.passive_income_interval_days FROM lifestyle_purchases p JOIN lifestyle_items i ON i.id=p.item_id WHERE p.player_id=? AND p.purchase_type='buy' AND p.status='active' AND i.passive_income_stc>0", [player.id]),
    q("SELECT id,wager_stc,wager_home_locked,wager_away_locked,home_player_id,away_player_id FROM matches WHERE mode='solo' AND wager_status IN ('active','settling','disputed') AND (home_player_id=? OR away_player_id=?)", [player.id, player.id]),
    q('SELECT id,name FROM clubs WHERE president_user_id=? OR user_id=? OR president_player_id=?', [user.id,user.id,player.id]),
    q('SELECT DISTINCT category FROM player_stc_transactions WHERE player_id=? AND category IS NOT NULL ORDER BY category', [player.id]),
  ]);
  const agreements = rawAgreements.map(record).map(a => ({ id:a.id,club_id:a.club_id,club_name:a.club_name || 'Former club',kind:a.kind,status:a.status,weekly_salary_stc:Number(a.weekly_salary_stc || 0),starts_at:a.starts_at,ends_at:a.ends_at,payroll_through:a.payroll_through,next_payment_at:a.status==='active' ? nextPayment(a) : null,signing_bonus_stc:Number(a.signing_bonus_stc || 0),bonus_status:a.bonus_payment?.status || 'not_due' }));
  const payroll = rawPayroll.map(record).map(p=>({id:p.id,agreement_id:p.agreement_id,amount_stc:Number(p.amount_stc||0),status:p.status,from:p.from,through:p.through}));
  const now=Date.now();
  const passive=assets.map(a=>({...a,due:now-Date.parse(a.last_passive_collected || a.created_date)>=Number(a.passive_income_interval_days || 7)*86400000}));
  const locked=wagers.reduce((sum,m)=>sum+((m.home_player_id===player.id&&Number(m.wager_home_locked)===1)||(m.away_player_id===player.id&&Number(m.wager_away_locked)===1)?Number(m.wager_stc||0):0),0);
  return {balance:Number(player.stc||0),credits:Number(accounts[0]?.credits||0),summary,agreements,payroll,locked_stc:locked,locked_match_count:wagers.filter(m=>(m.home_player_id===player.id&&Number(m.wager_home_locked)===1)||(m.away_player_id===player.id&&Number(m.wager_away_locked)===1)).length,passive_income:{asset_count:passive.length,due_assets:passive.filter(a=>a.due).length,collectable_stc:passive.filter(a=>a.due).reduce((n,a)=>n+Number(a.passive_income_stc),0)},managed_clubs:managed,categories:categories.map(c=>c.category),credit_history_available:false};
}
async function history({player}, options={}, q=EXECUTESQL) {
  const page=Math.max(1,Math.floor(Number(options.page)||1));
  const limit=Math.max(1,Math.min(50,Math.floor(Number(options.limit)||20)));
  if(options.currency==='credits')return {transactions:[],total:0,page,history_available:false};
  const where=['player_id=?'],args=[player.id];
  if(options.direction==='income')where.push('amount>0');
  if(options.direction==='expense')where.push('amount<0');
  if(options.category&&options.category!=='all'){where.push('category=?');args.push(String(options.category).slice(0,100));}
  if(options.search){where.push('(description LIKE ? OR source LIKE ? OR reference_id LIKE ?)');const query=`%${String(options.search).slice(0,150)}%`;args.push(query,query,query);}
  for(const [key,sql]of[['from_date','created_date>=?'],['to_date','created_date<DATE_ADD(?,INTERVAL 1 DAY)']]) {
    if(!options[key])continue;
    const date=String(options[key]);
    if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||!Number.isFinite(Date.parse(date))||new Date(date).toISOString().slice(0,10)!==date)throw Object.assign(new Error('Choose a valid date'),{status:400});
    where.push(sql);args.push(date);
  }
  const clause=where.join(' AND ');
  const [rows,count]=await Promise.all([q(`SELECT * FROM player_stc_transactions WHERE ${clause} ORDER BY created_date DESC,id DESC LIMIT ? OFFSET ?`,[...args,limit,(page-1)*limit]),q(`SELECT COUNT(*) AS total FROM player_stc_transactions WHERE ${clause}`,args)]);
  return {transactions:rows,total:Number(count[0]?.total||0),page,history_available:true};
}
module.exports={balance,history,nextPayment};
