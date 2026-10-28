'use strict';
const { RESULT_SNAPSHOT_FIELDS, resultSnapshotValues, httpError } = require('./matchResultNegotiation');

// The caller holds the match row lock and has compared the reviewed snapshot semantically.
// Bind the observed database representation, not a browser re-serialization of TEXT JSON.
async function writeGuardedMatchPatch(query, id, fields, observed, reviewed = observed) {
  if (fields.result_history !== undefined) {
    const history = value => value == null ? [] : typeof value === 'string' ? JSON.parse(value) : value;
    const prior = history(reviewed.result_history), current = history(observed.result_history), next = history(fields.result_history);
    // Every negotiation history patch appends one event. Retain any concurrent,
    // explicitly non-proposal bookkeeping rather than overwriting its audit trail.
    if (JSON.stringify(prior) !== JSON.stringify(current) && next.length) fields = { ...fields, result_history: JSON.stringify([...current, next.at(-1)].slice(-40)) };
  }
  const keys = Object.keys(fields).filter(key => fields[key] !== undefined);
  if (!keys.length) return;
  const guard = RESULT_SNAPSHOT_FIELDS.map(key => key === 'result_history' ? `${key} <=> CAST(? AS JSON)` : `BINARY ${key} <=> BINARY ?`).join(' AND ');
  const result = await query(`UPDATE matches SET ${keys.map(key => `\`${key}\` = ?`).join(', ')}, updated_date = NOW() WHERE ${guard} AND COALESCE(stats_processed,0)=0 AND COALESCE(report_finalized,0)=0 AND id = ?`, [...keys.map(key => fields[key]), ...resultSnapshotValues(observed), id]);
  if (result.affectedRows !== 0) return;
  const [current] = await query('SELECT * FROM matches WHERE id = ? LIMIT 1 FOR UPDATE', [id]);
  if (!current) throw httpError('Match not found.', 404, 'MATCH_NOT_FOUND');
  if (Number(current.report_finalized) || Number(current.stats_processed)) throw httpError('This result is already processed. Refresh to view the official report.', 409, 'RESULT_ALREADY_PROCESSED');
  const stable = value => Array.isArray(value) ? value.map(stable) : value && typeof value === 'object' ? Object.fromEntries(Object.keys(value).sort().map(k => [k, stable(value[k])])) : value;
  const jsonFields = require('./resultSnapshotContract.json').jsonFields;
  const exact = (key, value) => jsonFields.includes(key) ? JSON.stringify(stable(typeof value === 'string' ? JSON.parse(value) : value ?? null)) : value ?? null;
  if (keys.every(key => exact(key,current[key]) === exact(key,fields[key]))) return; // MySQL changedRows/no-op semantics.
  const error = httpError('The database result guard could not apply this report. Refresh and review before retrying.', 409, 'RESULT_GUARD_MISMATCH');
  error.conflict = { guard: 'database_write', fields: [] };
  throw error;
}
module.exports = { writeGuardedMatchPatch };
