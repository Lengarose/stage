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
    else if (Array.isArray(scope.root.reward_snapshot)) config = configuredPrizes(scope.root, scope.root.reward_snapshot);
    else if (!['completed','archived'].includes(scope.root.status)) config = await editionConfiguration(scope,query);
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
async function editionConfiguration(scope,query) {
  const type=scope.source_type==='regional_league'?'regional_league':'competition';
  const settings=await require('./rewardConfigurationService').read(type,scope.config_source_id,query);
  const roster=require('../lib/componentPrizePlan').eligibleClubIds(scope);
  if(!settings.version && (settings.rows.length || type==='competition'))return null;
  const policy=require('../lib/rewardPolicy');
  const rows=settings.version?settings.rows:type==='regional_league'?policy.regionalRows(roster.length,scope.root):[];
  const configuration=require('../lib/rewardPolicy').validateConfiguration(type,type==='regional_league'?rows.filter(r=>Number(r.position)<=roster.length):rows,roster.length);
  return {...configuration,...(type==='regional_league'?{division:scope.root.division??null,template_version:policy.regionalPreset(scope.root).version}:{}),source_id:scope.config_source_id,source_type:type,edition_id:scope.edition_id,version:settings.version||policy.regionalPreset(scope.root).version,roster,trophy_item_id:settings.settings.trophy_item_id||scope.root.trophy_item_id||null};
}
async function saveState(query, ctx, state, reason = null) {
  const data = { ...ctx.saved, source_type: ctx.scope.source_type, source_id: ctx.scope.root.id, edition_id: ctx.scope.edition_id, config: ctx.config, obligations:ctx.plan.obligations, sporting_completion:['completed','archived'].includes(ctx.scope.root.status), archived:ctx.scope.root.status==='archived', trophy_state:ctx.trophyState||ctx.saved.trophy_state||'pending', state, blocking_reason: reason, updated_at: new Date().toISOString() };
  await query(`INSERT INTO league_entities (id,entity_type,data_json,status,created_date,updated_date) VALUES (?,'competition_settlement',?,?,NOW(),NOW()) ON DUPLICATE KEY UPDATE data_json=VALUES(data_json),status=VALUES(status),updated_date=NOW()`, [ctx.stateId, JSON.stringify(data), state]);
}
async function capture(kind,id,{admin,reason}={}) {
  return withTransaction(async query => {
    const ctx = await loadPlan(kind,id,query,true);
    if (!ctx.saved.config && !['completed','archived'].includes(ctx.scope.root.status)) {
      if(ctx.config?.model) {
        const root={...ctx.scope.root,prize_pool_stc:ctx.config.budget,effective_prize_budget_stc:ctx.config.budget,reward_funding:'system',reward_configuration_version:ctx.config.version};
        await query('UPDATE league_entities SET data_json=?,updated_date=NOW() WHERE id=? AND entity_type=?',[JSON.stringify(root),id,kind]);
        ctx.scope.root=root;
      }
      await saveState(query,ctx,'pending');
      if(admin)await require('./rewardConfigurationService').audit(query,admin,'capture_edition_rewards',kind,id,ctx.saved,ctx.config,reason||'Capture rewards before edition play');
    }
    return ctx;
  });
}
async function review(kind,id,{ apply = false, admin = null, reason = null } = {}) {
  let context;
  try {
    return await withTransaction(async query => {
      const ctx = await loadPlan(kind,id,query,apply);
      context = ctx;
      const report = { source_type: kind, source_id: id, competition_name:ctx.scope.root.name || ctx.scope.root.competition_name || null, edition_id: ctx.scope.edition_id, configuration:ctx.config, dry_run: !apply, ...ctx.plan };
      if (!apply) return report;
      const mayPay = !ctx.plan.blocking_reasons.length && !ctx.plan.obligations.some(o=>o.blocking_reasons.length) && ['completed','archived'].includes(ctx.scope.root.status);
      if(mayPay && kind!=='tournament') {
        const placed=require('../lib/competitionPrizes').placements(ctx.scope,[{position:1,amount:'0.00'},{position:2,amount:'0.00'}]);
        const winner=placed.map.get(1);
        if(winner) {
          const root={...ctx.scope.root,winner_club_id:winner,runner_up_club_id:placed.map.get(2)||null};
          await query('UPDATE league_entities SET data_json=?,updated_date=NOW() WHERE id=? AND entity_type=?',[JSON.stringify(root),id,kind]);
          const trophyId=ctx.config?.trophy_item_id||root.trophy_item_id;
          if(trophyId)try {
            await require('./trophyAwardService').awardClubTrophyToClubAndPlayers({clubId:winner,trophyItemId:trophyId,tournamentId:id,tournament:{...root,_source_type:kind,_source_id:id},query});
            ctx.trophyState='awarded';
          }catch(e){ctx.trophyState='blocked';report.trophy_error=e.message;}
          else ctx.trophyState='unconfigured';
        }
      }
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
          const component=obligation.component_key?.startsWith('participation:')?'participation payment':obligation.component_key==='winner_bonus'?'winner bonus':obligation.component_key==='runner_up_bonus'?'runner-up bonus':`${obligation.position} placement prize`;
          const description = `${label} ${component} - ${ctx.scope.root.name || ctx.scope.root.competition_name || id} - ${ctx.scope.edition_id}`;
          const columns = ['id',`${obligation.recipient_type}_id`, ...(player ? ['player_email'] : []),'amount','balance_after','type','category','description','reference_id','settlement_key','competition_type','competition_id','edition_id','finishing_position'];
          const values = [ledgerId,obligation.recipient_id,...(player ? [account.email] : []),obligation.missing_amount,updated.stc,'income',kind === 'tournament' ? 'tournament_prize' : 'competition_reward',description,id,obligation.key,kind,id,ctx.scope.edition_id,obligation.position];
          await query(`INSERT INTO ${ledgerTable} (${columns.join(',')},created_date) VALUES (${values.map(() => '?').join(',')},NOW())`,values);
          obligation.paid_now = obligation.missing_amount;
        }
        await query(`INSERT INTO competition_payouts (id,competition_instance_id,recipient_type,club_id,player_id,amount_stc,category,status,idempotency_key,ledger_transaction_id,source_type,source_id,edition_id,position_no,config_json,component_key) VALUES (?,?,?,?,?,?,?,'paid',?,?,?,?,?,?,?,?) ON DUPLICATE KEY UPDATE status='paid',ledger_transaction_id=VALUES(ledger_transaction_id),updated_date=NOW()`, [paymentId,ctx.instanceId,obligation.recipient_type,obligation.recipient_type === 'club' ? obligation.recipient_id : null,obligation.recipient_type === 'player' ? obligation.recipient_id : null,obligation.expected_amount,'placement_prize',obligation.key,obligation.paid_now ? ledgerId : obligation.ledger_ids[0] || null,kind,id,ctx.scope.edition_id,obligation.position,JSON.stringify(ctx.config),obligation.component_key||null]);
        if (obligation.paid_now) {
          obligation.missing_before = obligation.missing_amount;
          obligation.proven_payment = stc(cents(obligation.proven_payment)+cents(obligation.paid_now));
          obligation.missing_amount = '0.00';
        }
      }
      const blocked = ctx.plan.blocking_reasons.length || ctx.plan.obligations.some(o => o.blocking_reasons.length);
      report.state = blocked ? 'blocked' : ctx.plan.state === 'zero_prize' ? 'zero_prize' : 'paid';
      if (!['completed','archived'].includes(ctx.scope.root.status)) report.state = 'pending';
      await saveState(query,ctx,report.state,JSON.stringify([...ctx.plan.blocking_reasons,...ctx.plan.obligations.flatMap(o => o.blocking_reasons)]));
      report.trophy_state=ctx.trophyState||ctx.saved.trophy_state||'pending';
      if (admin) await query(`INSERT INTO admin_audit_log (id,admin_user_id,admin_email,action,entity_type,entity_id,old_value,new_value,reason) VALUES (?,?,?,'reconcile_competition_prizes',?,?,?,?,?)`, [crypto.randomUUID(),admin.id,admin.email,kind,id,JSON.stringify(ctx.saved),JSON.stringify(report),reason || 'Reviewed missing STC prizes']);
      return report;
    });
  } catch (error) {
    if (apply && context) await withTransaction(async query => {
      const [current]=await query("SELECT * FROM league_entities WHERE id=? AND entity_type='competition_settlement' FOR UPDATE",[context.stateId]);
      if(current?.status==='paid')return;
      if(current && JSON.stringify(parse(current.data_json,{}).config)!==JSON.stringify(context.config))return;
      await saveState(query,context,'failed',error.message);
    }).catch(err => console.error('[competition settlement record]',err.message));
    throw error;
  }
}
async function adoptConfiguration(kind,id,{apply=false,admin,reason,version}={}) {
  if(!admin?.id || !String(reason||'').trim())throw Object.assign(new Error('Admin identity and review reason required'),{status:403});
  return withTransaction(async query=>{
    const ctx=await loadPlan(kind,id,query,true);
    if(kind==='tournament')throw Object.assign(new Error('Use tournament prize settings'),{status:400});
    const proposed=await editionConfiguration({...ctx.scope,root:{...ctx.scope.root,status:'in_progress'}},query);
    if(!proposed || String(version)!==String(proposed.version))throw Object.assign(new Error('Review the current source configuration/version first'),{status:409});
    const report={dry_run:!apply,source_type:kind,source_id:id,edition_id:ctx.scope.edition_id,original:ctx.config,proposed,differs:JSON.stringify(ctx.config)!==JSON.stringify(proposed),current_settlement:ctx.plan};
    if(!apply)return report;
    if(ctx.payments.length || ctx.plan.obligations.some(o=>cents(o.proven_payment)>0n)||ctx.plan.obligations.some(o=>o.blocking_reasons.some(r=>/legacy|ambiguous/i.test(r))))throw Object.assign(new Error('Payment evidence/established obligations exist; explicit financial review is required before changing the snapshot'),{status:409});
    const accounts=ctx.scope.participants.map(p=>p.id);
    const evidence=accounts.length?await query(`SELECT id FROM stc_transactions WHERE club_id IN (${accounts.map(()=>'?').join(',')}) AND category IN ('competition_reward','competition_prize','regional_league_prize') AND (reference_id=? OR (competition_id=? AND edition_id=?))`,[...accounts,id,id,ctx.scope.edition_id]):[];
    if(evidence.length)throw Object.assign(new Error('Historical ledger evidence must be reviewed before replacing the promise'),{status:409});
    ctx.config=proposed;ctx.plan=planPrizes(ctx.scope,proposed,[],[]);
    const updated={...ctx.scope.root,original_prize_pool_stc:ctx.scope.root.original_prize_pool_stc??ctx.scope.root.prize_pool_stc,prize_pool_stc:proposed.budget,effective_prize_budget_stc:proposed.budget,reward_funding:'system',reward_configuration_version:proposed.version};
    await query('UPDATE league_entities SET data_json=?,updated_date=NOW() WHERE id=? AND entity_type=?',[JSON.stringify(updated),id,kind]);
    ctx.scope.root=updated;
    await saveState(query,ctx,'pending','Explicitly reviewed unpaid edition configuration');
    await require('./rewardConfigurationService').audit(query,admin,'adopt_unpaid_edition_rewards',kind,id,report.original,proposed,reason);
    return report;
  });
}
async function archive(kind,id,{admin,reason}={}) {
  if(!['regional_league','competition_season'].includes(kind))throw Object.assign(new Error('Unsupported league archive source'),{status:400});
  if(!admin?.id || !String(reason||'').trim())throw Object.assign(new Error('Admin identity and archive reason required'),{status:403});
  const settlement=await review(kind,id,{apply:true,admin,reason});
  if(!['paid','zero_prize'].includes(settlement.state))throw Object.assign(new Error(`Cannot archive: settlement is ${settlement.state}. Review its blocking reasons.`),{status:409});
  return withTransaction(async query=>{
    const ctx=await loadPlan(kind,id,query,true);
    if(!['paid','zero_prize'].includes(ctx.plan.state))throw Object.assign(new Error('Settlement changed; review before archival'),{status:409});
    const before=ctx.scope.root;
    if(before.status==='archived')return {archived:true,already_archived:true,settlement};
    const next={...before,status:'archived',sporting_completed_at:before.sporting_completed_at||before.completed_at||new Date().toISOString(),archived_at:new Date().toISOString(),prize_settlement_state:settlement.state,trophy_state:settlement.trophy_state};
    await query('UPDATE league_entities SET data_json=?,status=?,updated_date=NOW() WHERE id=? AND entity_type=?',[JSON.stringify(next),'archived',id,kind]);
    await require('./rewardConfigurationService').audit(query,admin,'archive_settled_competition',kind,id,before,next,reason);
    await saveState(query,{...ctx,scope:{...ctx.scope,root:next}},settlement.state);
    return {archived:true,settlement};
  });
}
async function retryPending() {
  const rows = await EXECUTESQL("SELECT * FROM league_entities WHERE entity_type='competition_settlement' AND (status IN ('pending','failed') OR (status IN ('paid','zero_prize') AND JSON_UNQUOTE(JSON_EXTRACT(data_json,'$.trophy_state')) IN ('pending','blocked'))) ORDER BY updated_date LIMIT 50");
  for (const row of rows) { const data = parse(row.data_json,{}); try { await review(data.source_type,data.source_id,{apply:true}); } catch(err) { console.error('[competition settlement retry]',data.source_id,err.message); } }
}
function startPrizeSettlementJob() { let running = false; const timer = setInterval(async () => { if (running) return; running=true; try { await retryPending(); } catch(err) { console.error('[competition settlement job]',err.message); } finally { running=false; } },60000); timer.unref(); return timer; }
module.exports = { review, capture, retryPending, startPrizeSettlementJob, uuid, cents, stc, adoptConfiguration,archive };
