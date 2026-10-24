'use strict';
const crypto = require('crypto');
const { withTransaction } = require('../db/database');
const { CompetitionScopeModel } = require('../models/competitionScopeModel');
const { reviewStandings } = require('../lib/standingIntegrity');
async function reconcileStandings(kind, id, { apply = false, admin, reason } = {}) {
  if (!['regional_league','competition_season'].includes(kind)) throw Object.assign(new Error('Unsupported standings edition'), { status: 400 });
  if (apply && (!admin?.id || !String(reason || '').trim())) throw Object.assign(new Error('Authenticated admin and reason required'), { status: 403 });
  return withTransaction(async query => {
    const scope = await new CompetitionScopeModel().selectOne(kind, id, query, true);
    const report = reviewStandings(scope);
    if (!apply) return { ...report, dry_run: true };
    if (scope.root.status === 'completed') throw Object.assign(new Error('Completed editions require explicit historical dependency review'), { status:409 });
    if (!report.repairable) throw Object.assign(new Error(report.conflicts.join('; ')), { status: 409 });
    const paid = await query('SELECT id FROM competition_payouts WHERE source_type=? AND source_id=? AND edition_id=? LIMIT 1', [kind, id, scope.edition_id]);
    if (paid.length) throw Object.assign(new Error('Existing prize obligations require explicit financial review before standings repair'), { status: 409 });
    const type = kind === 'regional_league' ? 'regional_league_standing' : 'competition_standing';
    const column = kind === 'regional_league' ? 'league_id' : 'season_id';
    const changes = report.missing.length + report.duplicates.length + report.mismatches.length;
    if (!changes) return { ...report, dry_run: false, changed: false };
    for (const row of report.expected) {
      const old = scope.standings.filter(s => String(s.club_id) === row.club_id).sort((a,b) => String(a.id).localeCompare(String(b.id)));
      const standingId = old[0]?.id || crypto.randomUUID();
      const data = { ...old[0], ...row, id: standingId, [column]: id, season_number: scope.root.season_number };
      await query(`INSERT INTO league_entities (id,entity_type,data_json,status,${column},club_id,created_date,updated_date) VALUES (?,?,?,'active',?,?,NOW(),NOW()) ON DUPLICATE KEY UPDATE data_json=VALUES(data_json),updated_date=NOW()`, [standingId,type,JSON.stringify(data),id,row.club_id]);
      for (const duplicate of old.slice(1)) await query('DELETE FROM league_entities WHERE id=? AND entity_type=?', [duplicate.id,type]);
    }
    await query('INSERT INTO admin_audit_log (id,admin_user_id,admin_email,action,entity_type,entity_id,old_value,new_value,reason) VALUES (?,?,?,?,?,?,?,?,?)', [crypto.randomUUID(),admin.id,admin.email,'reconcile_competition_standings',kind,id,JSON.stringify(scope.standings),JSON.stringify(report.expected),reason]);
    return { ...report, dry_run: false, changed: true };
  });
}
module.exports = { reconcileStandings };
