'use strict';
const crypto = require('crypto');
const { withTransaction } = require('../db/database');
const { cents, stc } = require('../lib/competitionPrizes');
const { isConfirmedResult } = require('../lib/tournamentStatistics');

async function settle(matchId, action = 'settle', actorId = null, { winner: forcedWinner, reason } = {}) {
  return withTransaction(async query => {
    const [match] = await query('SELECT * FROM matches WHERE id=? FOR UPDATE', [matchId]);
    if (!match) throw new Error('Match not found');
    const kind = match.mode === 'club' ? 'club' : 'player';
    const administrative = ['admin_settle','admin_cancel'].includes(action);
    let admin = null;
    if (administrative && !actorId) throw new Error('Admin authentication required');
    if (actorId) {
      const [actor] = await query('SELECT id,email,role_id FROM users WHERE id=?',[actorId]);
      if (actor && [0,2].includes(Number(actor.role_id))) admin=actor;
      if (administrative) {
        if (!actor || ![0,2].includes(Number(actor.role_id))) throw new Error('Admin access required');
        admin = actor;
        if (action === 'admin_settle' && !['home','away','draw'].includes(forcedWinner)) throw new Error('Choose home, away, or draw');
      }
      let eligible = false;
      if (kind === 'club') {
        const sides = await query('SELECT id,president_user_id,user_id,owner_email FROM clubs WHERE id IN (?,?)',[match.home_club_id,match.away_club_id]);
        eligible = sides.some(c=>(!['reserve','decline'].includes(action) || c.id === match.away_club_id) && (c.president_user_id === actor?.id || c.user_id === actor?.id || (actor?.email && String(c.owner_email || '').toLowerCase() === actor.email.toLowerCase())));
      } else {
        const sides = await query('SELECT id,user_id,email FROM players WHERE id IN (?,?)',[match.home_player_id,match.away_player_id]);
        eligible = sides.some(p=>(!['reserve','decline'].includes(action) || p.id === match.away_player_id) && (p.user_id === actor?.id || (actor?.email && p.email === actor.email)));
      }
      if (!eligible && ![0,2].includes(Number(actor?.role_id))) throw new Error('Only an eligible participant may change this wager');
    }
    if (['decline','cancel'].includes(action) && ['pending','proposed','pending_acceptance'].includes(match.wager_status)) {
      const table=kind === 'club' ? 'stc_transactions':'player_stc_transactions';
      const debits=await query(`SELECT id FROM ${table} WHERE reference_id=? AND category='wager_stake'`,[matchId]);
      if(debits.length || Number(match.wager_home_locked) || Number(match.wager_away_locked)) throw new Error('Partial wager funding requires authorised review');
      const status=action === 'decline' ? 'declined':'cancelled';
      await query('UPDATE matches SET wager_status=?,wager_stc=0,wager_home_locked=0,wager_away_locked=0,updated_date=NOW() WHERE id=?',[status,matchId]);
      if(admin) await query(`INSERT INTO admin_audit_log (id,admin_user_id,admin_email,action,entity_type,entity_id,old_value,new_value,reason) VALUES (?,?,?,?,'match',?,?,?,?)`,[crypto.randomUUID(),admin.id,admin.email,action,matchId,JSON.stringify({wager_status:match.wager_status}),JSON.stringify({wager_status:status}),reason || 'Admin wager action']);
      return {result:status};
    }
    if(action === 'decline') throw new Error('A funded wager cannot be declined; use cancellation and refund');
    if (action === 'reserve' && match.wager_status === 'active' && Number(match.wager_home_locked) === 1 && Number(match.wager_away_locked) === 1) return {skipped:true};
    if(action === 'reserve' && ['completed','forfeit','cancelled','disputed','in_progress','awaiting_confirmation'].includes(match.status)) throw new Error('This match is no longer accepting wagers');
    if (administrative && !['active','settling','disputed'].includes(match.wager_status)) return {skipped:true};
    if (!administrative && action !== 'reserve' && match.wager_status !== 'active') return { skipped:true };
    if (action === 'settle' && !isConfirmedResult(match)) return {skipped:true};
    if (action === 'reserve' && !['pending','proposed','pending_acceptance'].includes(match.wager_status)) throw new Error('Wager is not awaiting acceptance');
    if (action === 'cancel' && isConfirmedResult(match)) throw new Error('A completed wager must be settled, not cancelled');
    if (action !== 'reserve' && (Number(match.wager_home_locked) !== 1 || Number(match.wager_away_locked) !== 1)) throw new Error('Wager funding requires review: both reservations are not confirmed');
    const amount = cents(match.wager_stc);
    if (amount === 0n) return { skipped: true };
    const home = Number(match.home_score), away = Number(match.away_score);
    if (!Number.isFinite(home) || !Number.isFinite(away)) throw new Error('Wager result is unavailable');
    const draw = ['cancel','admin_cancel'].includes(action) || (administrative ? forcedWinner === 'draw' : home === away);
    const winner = administrative ? forcedWinner : home > away ? 'home' : 'away';
    // Lock accounts in stable order; the match lock serialises duplicate settlement.
    const sides = ['home', 'away'].sort((a,b) => String(match[`${a}_${kind}_id`]).localeCompare(String(match[`${b}_${kind}_id`])));
    for (const side of sides) {
      const id = match[`${side}_${kind}_id`];
      if (!id) throw new Error('Wager recipient is missing');
      const [account] = await query(`SELECT * FROM ${kind === 'club' ? 'clubs' : 'players'} WHERE id=? FOR UPDATE`, [id]);
      if (!account) throw new Error('Wager account no longer exists');
      const reserve = action === 'reserve';
      if (reserve && cents(account.stc) < amount) throw new Error('Insufficient STC for wager reservation');
      const credit = reserve ? amount : draw ? amount : side === winner ? amount * 2n : 0n;
      const category = reserve ? 'wager_stake' : draw ? 'wager_refund' : side === winner ? 'wager_win' : 'wager_loss';
      const key = `wager:${matchId}:${kind}:${id}${reserve ? ':stake' : ''}`;
      const table = kind === 'club' ? 'stc_transactions' : 'player_stc_transactions';
      const existing = await query(`SELECT id FROM ${table} WHERE ${kind}_id=? AND reference_id=? AND category IN (${reserve ? "'wager_stake'" : "'wager_win','wager_loss','wager_refund'"})`, [id,matchId]);
      if (existing.length) throw new Error('Legacy wager payment exists while wager remains active; authorised review required');
      await query(`UPDATE ${kind === 'club' ? 'clubs' : 'players'} SET stc=COALESCE(stc,0)${reserve ? '-' : '+'}?,updated_date=NOW() WHERE id=?`, [stc(credit),id]);
      const [updated] = await query(`SELECT stc FROM ${kind === 'club' ? 'clubs' : 'players'} WHERE id=?`, [id]);
      const columns = ['id',`${kind}_id`,...(kind === 'player' ? ['player_email'] : []),'amount','balance_after','type','category','description','reference_id','settlement_key'];
      const values = [crypto.randomUUID(),id,...(kind === 'player' ? [account.email] : []),`${reserve ? '-' : ''}${stc(credit)}`,updated.stc,reserve || !credit ? 'expense' : 'income',category,`${category.replaceAll('_',' ')} - ${match.home_club_name || match.home_player_name || 'Home'} vs ${match.away_club_name || match.away_player_name || 'Away'}`,matchId,key];
      await query(`INSERT INTO ${table} (${columns.join(',')},created_date) VALUES (${values.map(() => '?').join(',')},NOW())`,values);
    }
    const status = action === 'reserve' ? 'active' : ['cancel','admin_cancel'].includes(action) ? 'cancelled' : draw ? 'refunded' : 'settled';
    if (action === 'reserve') await query('UPDATE matches SET wager_status=?,wager_home_locked=1,wager_away_locked=1,updated_date=NOW() WHERE id=?',[status,matchId]);
    else if (['cancel','admin_cancel'].includes(action)) await query('UPDATE matches SET wager_status=?,wager_home_locked=0,wager_away_locked=0,wager_stc=0,updated_date=NOW() WHERE id=?',[status,matchId]);
    else await query('UPDATE matches SET wager_status=?,updated_date=NOW() WHERE id=?', [status,matchId]);
    if (admin) await query(`INSERT INTO admin_audit_log (id,admin_user_id,admin_email,action,entity_type,entity_id,old_value,new_value,reason) VALUES (?,?,?,?,'match',?,?,?,?)`,[crypto.randomUUID(),admin.id,admin.email,action,matchId,JSON.stringify({wager_status:match.wager_status,wager_stc:match.wager_stc}),JSON.stringify({wager_status:status,winner,amount:stc(amount)}),reason || 'Admin wager resolution']);
    return { result: status };
  });
}
module.exports = { settle };
