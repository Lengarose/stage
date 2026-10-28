const test = require('node:test');
const assert = require('node:assert/strict');
const { assertResultSnapshotCurrent } = require('../matchResultNegotiation');
const { writeGuardedMatchPatch } = require('../matchResultWrite');

test('MySQL TEXT/native JSON/null-safe guarded confirmation and no-op semantics', { skip: process.env.STAGE_TEST_MYSQL !== '1' && 'Requires explicitly configured disposable local MySQL test database' }, async () => {
  const mysql = require('mysql2/promise');
  const host = process.env.STAGE_TEST_MYSQL_HOST || '127.0.0.1';
  const database = process.env.STAGE_TEST_MYSQL_DATABASE;
  assert(['127.0.0.1','localhost','::1'].includes(host), 'This test only permits a loopback database');
  assert(database && database.endsWith('_test'), 'Use an explicit disposable _test database, not production');
  const conn = await mysql.createConnection({ host, database, port: Number(process.env.STAGE_TEST_MYSQL_PORT || 3306), user: process.env.STAGE_TEST_MYSQL_USER, password: process.env.STAGE_TEST_MYSQL_PASSWORD, dateStrings: true });
  const query = async (sql, args = []) => (await conn.query(sql, args))[0];
  try {
    await query('CREATE TEMPORARY TABLE matches (id VARCHAR(36) PRIMARY KEY,home_submission TEXT,away_submission TEXT,result_history JSON,home_dispute_submission TEXT,away_dispute_submission TEXT,result_state VARCHAR(40),status VARCHAR(40),result_submit_side VARCHAR(8),correction_count INT,home_counter_count INT,stats_processed TINYINT DEFAULT 0,report_finalized TINYINT DEFAULT 0,result_away_submitted TINYINT DEFAULT 0,updated_date DATETIME)');
    await query('INSERT INTO matches (id,home_submission,result_history,result_state,status,result_submit_side,correction_count,home_counter_count) VALUES (?,?,?,?,?,?,0,0)', ['local-check','{ "away_score":2, "home_score":2 }','[{"side":"home","event":"initial_result"}]','AWAITING_AWAY_CONFIRMATION','in_progress','home']);
    await conn.beginTransaction();
    const [observed] = await query('SELECT * FROM matches WHERE id=? FOR UPDATE',['local-check']);
    const expected = { ...observed, home_submission: { home_score: 2, away_score: 2 }, result_history: [{ event: 'initial_result', side: 'home' }] };
    assertResultSnapshotCurrent(expected, observed);
    await writeGuardedMatchPatch(query,'local-check',{ away_submission: '{"confirmed":true}', result_away_submitted: 1 },observed,expected);
    const [updated] = await query('SELECT * FROM matches WHERE id=? FOR UPDATE',['local-check']);
    assert.equal(updated.result_away_submitted,1);
    await writeGuardedMatchPatch(query,'local-check',{ result_away_submitted: 1 },updated);
    assert.throws(() => assertResultSnapshotCurrent(expected,{ ...updated, home_submission: '{"home_score":3,"away_score":2}' }), { code: 'RESULT_CHANGED' });
    await conn.rollback();
  } finally { await query('DROP TEMPORARY TABLE IF EXISTS matches'); await conn.end(); }
});
