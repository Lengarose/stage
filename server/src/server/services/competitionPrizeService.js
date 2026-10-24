'use strict';
const crypto = require('crypto');
const { EXECUTESQL, withTransaction } = require('../db/database');
const { CompetitionScopeModel } = require('../models/competitionScopeModel');
const { cents, stc, configuredPrizes, planPrizes, parse } = require('../lib/competitionPrizes');
const model = new CompetitionScopeModel();
const uuid = key => { const h = crypto.createHash('sha256').update(key).digest('hex'); return `${h.slice(0,8)}-${h.slice(8,12)}-${h.slice(12,16)}-${h.slice(16,20)}-${h.slice(20,32)}`; };
async function loadPlan(kind, id, query, lock) {
  const scope = await model.selectOne(kind, id, query, lock);
  const stateId = uuid(`prize-settlement:${kind}:${scope.edition_id}`);
  const [record] = await query("SELECT * FROM league_entities WHERE id=? AND entity_type='competition_settlement'", [stateId]);
  const saved = record ? parse(record.data_json, {}) : {};
  const achievements = kind === 'competition_season' ? await query('SELECT * FROM club_achievements WHERE season_id=?',[id]) : kind === 'regional_league' ? await query('SELECT * FROM club_achievements WHERE source_id=? AND season_number=?',[id,scope.root.season_number || 1]) : [];
  scope.ambiguous_legacy_references = kind === 'competition_season' ? [scope.config_source_id].filter(Boolean) : [];
  scope.legacy_references.push(...achievements.map(a => a.id));
  let config = saved.config;
  if (!config) {
    if (kind === 'tournament') config = configuredPrizes(scope.root);
    else if (scope.root.status !== 'completed') {
      const rewards = await query('SELECT * FROM reward_configs WHERE source_id=? ORDER BY position', [scope.config_source_id]);
      config = configuredPrizes(scope.root, rewards);
    } else if (Array.isArray(scope.root.reward_snapshot)) config = configuredPrizes(scope.root, scope.root.reward_snapshot);
    else if (achievements.some(a=>Number(a.stc_awarded) > 0)) config = configuredPrizes(scope.root, achievements.map(a => ({ ...a, stc_amount: a.stc_awarded })));
  }
  const payments = await query('SELECT * FROM competition_payouts WHERE source_type=? AND source_id=? AND edition_id=?', [kind,id,scope.edition_id]);
  const player = scope.root.participant_type === 'player';
  const table = player ? 'player_stc_transactions' : 'stc_transactions';
  const recipientIds = scope.participants.map(p => p.id);
  const ledgers = recipientIds.length ? await query(`SELECT * FROM ${table} WHERE ${player ? 'player' : 'club'}_id IN (${recipientIds.map(() => '?').join(',')}) AND category IN ('tournament_prize','competition_reward','competition_prize','regional_league_prize')`, recipientIds) : [];
  const plan = planPrizes(scope, config, payments, ledgers);
  const [instance] = await query('SELECT id FROM competition_instances WHERE legacy_source_type=? AND legacy_source_id=? LIMIT 1',[kind,id]);
  return { scope, plan, config, stateId, saved, payments, instanceId:instance?.id || null };
}
async function saveState(query, ctx, state, reason = null) {
  const data = { ...ctx.saved, source_type: ctx.scope.source_type, source_id: ctx.scope.root.id, edition_id: ctx.scope.edition_id, config: ctx.config, state, blocking_reason: reason, updated_at: new Date().toISOString() };
  await query(`INSERT INTO league_entities (id,entity_type,data_json,status,created_date,updated_date) VALUES (?,'competition_settlement',?,?,NOW(),NOW()) ON DUPLICATE KEY UPDATE data_json=VALUES(data_json),status=VALUES(status),updated_date=NOW()`, [ctx.stateId, JSON.stringify(data), state]);
}
async function capture(kind,id) {
  return withTransaction(async query => {
    const ctx = await loadPlan(kind,id,query,true);
    if (!ctx.saved.config && ctx.scope.root.status !== 'completed') await saveState(query,ctx,'pending');
    return ctx;
  });
}
async function review(kind,id,{ apply = false, admin = null, reason = null } = {}) {
  let context;
  try {
    return await withTransaction(async query => {
      const ctx = await loadPlan(kind,id,query,apply);
      context = ctx;
      const report = { source_type: kind, source_id: id, competition_name:ctx.scope.root.name || ctx.scope.root.competition_name || null, edition_id: ctx.scope.edition_id, dry_run: !apply, ...ctx.plan };
      if (!apply) return report;
      const mayPay = !ctx.plan.blocking_reasons.length && ctx.scope.root.status === 'completed';
      for (const obligation of ctx.plan.obligations) {
        if (!mayPay || obligation.blocking_reasons.length || !obligation.recipient_id) continue;
        const paymentId = uuid(obligation.key);
        const ledgerId = uuid(`ledger:${obligation.key}`);
        if (cents(obligation.missing_amount) > 0n) {
          const player = obligation.recipient_type === 'player';
          const accountTable = player ? 'players' : 'clubs';
          const ledgerTable = player ? 'player_stc_transactions' : 'stc_transactions';
          const [account] = await query(`SELECT id, stc${player ? ', email' : ''} FROM ${accountTable} WHERE id=? FOR UPDATE`, [obligation.recipient_id]);
          if (!account) throw new Error('Prize recipient account no longer exists');
          await query(`UPDATE ${accountTable} SET stc=COALESCE(stc,0)+?,updated_date=NOW() WHERE id=?`, [obligation.missing_amount,obligation.recipient_id]);
          const [updated] = await query(`SELECT stc FROM ${accountTable} WHERE id=?`, [obligation.recipient_id]);
          const label = kind === 'tournament' ? 'Tournament' : kind === 'regional_league' ? 'Regional league' : 'GOST league';
          const description = `${label} prize - ${ctx.scope.root.name || ctx.scope.root.competition_name || id} - ${obligation.position} place - ${ctx.scope.edition_id}`;
          const columns = ['id',`${obligation.recipient_type}_id`, ...(player ? ['player_email'] : []),'amount','balance_after','type','category','description','reference_id','settlement_key','competition_type','competition_id','edition_id','finishing_position'];
          const values = [ledgerId,obligation.recipient_id,...(player ? [account.email] : []),obligation.missing_amount,updated.stc,'income',kind === 'tournament' ? 'tournament_prize' : 'competition_reward',description,id,obligation.key,kind,id,ctx.scope.edition_id,obligation.position];
          await query(`INSERT INTO ${ledgerTable} (${columns.join(',')},created_date) VALUES (${values.map(() => '?').join(',')},NOW())`,values);
          obligation.paid_now = obligation.missing_amount;
        }
        await query(`INSERT INTO competition_payouts (id,competition_instance_id,recipient_type,club_id,player_id,amount_stc,category,status,idempotency_key,ledger_transaction_id,source_type,source_id,edition_id,position_no,config_json) VALUES (?,?,?,?,?,?,?,'paid',?,?,?,?,?,?,?) ON DUPLICATE KEY UPDATE status='paid',ledger_transaction_id=VALUES(ledger_transaction_id),updated_date=NOW()`, [paymentId,ctx.instanceId,obligation.recipient_type,obligation.recipient_type === 'club' ? obligation.recipient_id : null,obligation.recipient_type === 'player' ? obligation.recipient_id : null,obligation.expected_amount,'placement_prize',obligation.key,obligation.paid_now ? ledgerId : obligation.ledger_ids[0] || null,kind,id,ctx.scope.edition_id,obligation.position,JSON.stringify(ctx.config)]);
        if (obligation.paid_now) {
          obligation.missing_before = obligation.missing_amount;
          obligation.proven_payment = stc(cents(obligation.proven_payment)+cents(obligation.paid_now));
          obligation.missing_amount = '0.00';
        }
      }
      const blocked = ctx.plan.blocking_reasons.length || ctx.plan.obligations.some(o => o.blocking_reasons.length);
      report.state = blocked ? 'blocked' : ctx.plan.state === 'zero_prize' ? 'zero_prize' : 'paid';
      if (ctx.scope.root.status !== 'completed') report.state = 'pending';
      await saveState(query,ctx,report.state,JSON.stringify([...ctx.plan.blocking_reasons,...ctx.plan.obligations.flatMap(o => o.blocking_reasons)]));
      if (admin) await query(`INSERT INTO admin_audit_log (id,admin_user_id,admin_email,action,entity_type,entity_id,old_value,new_value,reason) VALUES (?,?,?,'reconcile_competition_prizes',?,?,?,?,?)`, [crypto.randomUUID(),admin.id,admin.email,kind,id,JSON.stringify(ctx.saved),JSON.stringify(report),reason || 'Reviewed missing STC prizes']);
      return report;
    });
  } catch (error) {
    if (apply && context) await withTransaction(query => saveState(query,context,'failed',error.message)).catch(err => console.error('[competition settlement record]',err.message));
    throw error;
  }
}
async function retryPending() {
  const rows = await EXECUTESQL("SELECT * FROM league_entities WHERE entity_type='competition_settlement' AND status IN ('pending','failed') ORDER BY updated_date LIMIT 50");
  for (const row of rows) { const data = parse(row.data_json,{}); try { await review(data.source_type,data.source_id,{apply:true}); } catch(err) { console.error('[competition settlement retry]',data.source_id,err.message); } }
}
function startPrizeSettlementJob() { let running = false; const timer = setInterval(async () => { if (running) return; running=true; try { await retryPending(); } catch(err) { console.error('[competition settlement job]',err.message); } finally { running=false; } },60000); timer.unref(); return timer; }
module.exports = { review, capture, retryPending, startPrizeSettlementJob, uuid, cents, stc };
