const assert = require('node:assert/strict');
const { cents, stc } = require('../../lib/competitionPrizes');
const { RESULT_SNAPSHOT_FIELDS } = require('../../lib/matchResultNegotiation');
const stable = value => Array.isArray(value) ? value.map(stable) : value && typeof value === 'object' ? Object.fromEntries(Object.keys(value).sort().map(k => [k, stable(value[k])])) : value;
let state, failure, tail = Promise.resolve();
async function acquire() { let unlock; const next = new Promise(resolve => { unlock = resolve; }); const previous = tail; tail = next; await previous; return unlock; }
async function transaction(fn) {
  const unlock = await acquire(), before = structuredClone(state);
  try { return await fn(query); } catch (error) { state = before; throw error; } finally { unlock(); }
}
function storedRow() { const row = structuredClone(state.match); if (row.result_history) row.result_history = stable(JSON.parse(row.result_history)); return row; }
async function query(sql, values = []) {
  const match = state.match;
  if (sql.startsWith('SELECT * FROM matches')) return values[0] === match.id ? [storedRow()] : [];
  if (sql.includes('FROM players') || sql.includes('FROM clubs')) return structuredClone(state.accounts.filter(a => a.id === values[0]));
  if (sql.includes('FROM player_stc_transactions') || sql.includes('FROM stc_transactions')) return state.ledger.filter(l => l.account === values[0] && l.reference === values[1]);
  if (sql.includes('FROM match_player_stats')) return structuredClone(state.stats);
  if (sql.startsWith('SELECT * FROM stadium_config')) return [];
  if (sql.startsWith('INSERT INTO match_player_stats')) { state.stats.push(values); return { affectedRows: 1 }; }
  if (sql.startsWith('INSERT INTO player_stc_transactions') || sql.startsWith('INSERT INTO stc_transactions')) {
    if (failure === 'wager') { failure = null; throw Error('Injected wager failure'); }
    const columns = sql.match(/\(([^)]+)\)/)[1].split(','); const row = Object.fromEntries(columns.map((k, i) => [k, values[i]]));
    assert(!state.ledger.some(l => l.key === row.settlement_key));
    state.ledger.push({ account: row.player_id || row.club_id, reference: row.reference_id, category: row.category, key: row.settlement_key, amount: row.amount }); return { affectedRows: 1 };
  }
  if (sql.startsWith('SELECT stc FROM')) return state.accounts.filter(a => a.id === values[0]).map(a => ({ stc: a.stc }));
  if (/UPDATE (players|clubs) SET stc=/.test(sql)) { const a = state.accounts.find(a => a.id === values[1]); a.stc = stc(cents(a.stc) + cents(values[0])); return { affectedRows: 1 }; }
  if (/UPDATE players\s+SET matches_played/.test(sql)) { const a = state.accounts.find(a => a.id === values.at(-1)); a.appearances++; a.draws += values[2]; return { affectedRows: 1 }; }
  if (/UPDATE clubs SET\s+wins/.test(sql)) { const a = state.accounts.find(a => a.id === values.at(-1)); a.appearances++; a.draws += values[2]; return { affectedRows: 1 }; }
  if (sql.startsWith('UPDATE matches SET')) {
    if (sql.includes('BINARY home_submission')) {
      const keys = [...sql.split(' WHERE ')[0].matchAll(/`(\w+)` = \?/g)].map(m => m[1]);
      const observed = values.slice(keys.length, -1);
      const same = RESULT_SNAPSHOT_FIELDS.every((field, i) => field === 'result_history'
        ? JSON.stringify(stable(typeof match[field] === 'string' ? JSON.parse(match[field]) : match[field] ?? null)) === JSON.stringify(stable(observed[i] == null ? null : JSON.parse(observed[i])))
        : String(match[field] ?? '<NULL>') === String(observed[i] ?? '<NULL>'));
      if (!same || Number(match.stats_processed) || Number(match.report_finalized)) return { affectedRows: 0 };
      keys.forEach((key, i) => { match[key] = values[i]; }); state.guardedWrites++; return { affectedRows: 1 };
    }
    if (sql.includes("status='completed'")) {
      if (failure === 'finalisation') { failure = null; throw Error('Injected finalisation failure'); }
      Object.assign(match, { status: 'completed', home_score: values[0], away_score: values[1], decided_on_penalties: values[8], penalty_winner_side: values[9], result_state: values[10], report_finalized: 1 }); state.finalisations++; return { affectedRows: 1 };
    }
    if (sql.includes('winner_player_id=?')) { match.winner_player_id = values[0]; return { affectedRows: 1 }; }
    if (sql.includes('stats_processed = 1')) { match.stats_processed = 1; return { affectedRows: 1 }; }
    if (sql.includes('wager_status=?')) { match.wager_status = values[0]; return { affectedRows: 1 }; }
    if (sql.includes('home_ticket_revenue')) return { affectedRows: 1 };
  }
  if (sql.includes('FROM league_entities') || sql.includes('FROM competition_') || sql.includes('FROM tournaments')) return [];
  throw Error(`Unhandled confirmation fixture SQL: ${sql}`);
}
const pool = { promise: () => ({ getConnection: async () => {
  let unlock, before;
  return { beginTransaction: async () => { unlock = await acquire(); before = structuredClone(state); }, query: async (sql, args) => [await query(sql, args), []], commit: async () => {}, rollback: async () => { state = before; }, release: () => unlock?.() };
} }) };
function stub(relative, exports) { const id = require.resolve(relative); require.cache[id] = { id, filename: id, loaded: true, exports }; }
stub('../../db/database', { EXECUTESQL: query, withTransaction: transaction, pool });
stub('../identityService', { resolveUserIdentity: async id => {
  const side = id === 'home-user' ? 'home' : id === 'away-user' ? 'away' : null;
  const account = state.accounts.find(a => a.id === side);
  return { user: { id, email: `${side || 'stranger'}@example.test`, player_id: side, role_id: 1 }, player: state.match.mode === 'solo' ? account : null, club: state.match.mode === 'club' ? account : null };
} });
stub('../messageDeliveryService', { sendActionMessage: async args => { state.notifications.add(args.idempotencyKey); }, createNotificationIfEnabled: async () => {} });
stub('../matchNotificationService', { notifyMatchSide: async (m, side, type, title, body, key) => { state.notifications.add(`${m.id}:${side}:${key}`); }, resolveMatchSideEmails: async (m, side) => [`${side}@example.test`] });
stub('../../utils/socketBroadcast', { broadcastMatch: () => {}, broadcastMatchById: async () => {}, broadcastMatchPlayerStat: () => {}, broadcastNotification: () => {}, broadcastInbox: () => {} });
const proof = require('../scoreProofService');
stub('../scoreProofService', { ...proof, recognizeScoreFromImageUrl: async () => ({ ok: false, reason: 'controlled test proof' }) });
const { createFunctionsRouter } = require('../../functions/functionsRouter');
const { HANDLERS } = require('../../functions/legacyFunctions');
function setup({ wager = true, club = false } = {}) {
  state = { match: { id: 'match', mode: club ? 'club' : 'solo', type: 'friendly', source_fixture_type: 'arranged_game', status: 'in_progress', result_state: 'AWAITING_RESULT', result_submit_side: 'home', result_history: '[]', home_submission: null, away_submission: null, home_dispute_submission: null, away_dispute_submission: null, correction_count: 0, home_counter_count: 0, report_finalized: 0, stats_processed: 0, result_home_submitted: 0, result_away_submitted: 0, [`home_${club ? 'club' : 'player'}_id`]: 'home', [`away_${club ? 'club' : 'player'}_id`]: 'away', wager_stc: wager ? '10.01' : '0', wager_status: wager ? 'active' : null, wager_home_locked: wager ? 1 : 0, wager_away_locked: wager ? 1 : 0 }, accounts: ['home','away'].map(id => ({ id, name: id, gamertag: id, email: `${id}@example.test`, stc: '100.00', appearances: 0, draws: 0 })), ledger: [], stats: [], notifications: new Set(), guardedWrites: 0, finalisations: 0 };
  failure = null;
  return { router: createFunctionsRouter(HANDLERS), get state() { return state; }, query, transaction, set failure(value) { failure = value; }, snapshot: () => storedRow(), invoke: (body, user = 'away-user') => HANDLERS.matchKickoff({ ...body, match_id: 'match', _auth_user_id: user }) };
}
module.exports = { setup };
