const test = require('node:test');
const assert = require('node:assert/strict');
const { writeGuardedMatchPatch } = require('../matchResultWrite');
test('zero affectedRows distinguishes a no-op, missing match, terminal result and database guard mismatch', async () => {
  const observed = { home_submission: '{"home_score":2,"away_score":2}', result_history: [] };
  for (const [current, code] of [[{ result_home_submitted: 1 }, null], [null, 'MATCH_NOT_FOUND'], [{ report_finalized: 1 }, 'RESULT_ALREADY_PROCESSED'], [{ result_home_submitted: 0 }, 'RESULT_GUARD_MISMATCH']]) {
    const query = async (sql, args) => {
      if (sql.startsWith('UPDATE')) {
        assert.match(sql, /BINARY home_submission <=> BINARY \?/);
        assert.match(sql, /result_history <=> CAST\(\? AS JSON\)/);
        assert(args.includes(observed.home_submission));
        return { affectedRows: 0 };
      }
      return current ? [current] : [];
    };
    if (code) await assert.rejects(writeGuardedMatchPatch(query,'m',{ result_home_submitted: 1 },observed), { code });
    else await writeGuardedMatchPatch(query,'m',{ result_home_submitted: 1 },observed);
  }
});
test('database exceptions are not mislabeled as stale results', async () => {
  await assert.rejects(writeGuardedMatchPatch(async () => { throw Error('Controlled DB failure'); },'m',{ result_home_submitted: 1 },{}), /Controlled DB failure/);
});
