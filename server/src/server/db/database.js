const mysql = require('mysql2');
const { get } = require('../../constants/env');
const { isIsoDateString, toMysqlDateTime } = require('../utils/datetime');

const dbSocketPath = String(get('DB_SOCKET_PATH') || '').trim();
if (!dbSocketPath) {
  throw new Error('DB_SOCKET_PATH is required for Gandi MySQL');
}

const pool = mysql.createPool({
  socketPath:         dbSocketPath,
  user:              'root',
  password:          '',
  database:          'stage_league',
  charset:           'utf8mb4',
  waitForConnections: true,
  connectionLimit:    10,
});

// Coerce ISO 8601 datetime strings to MySQL DATETIME format inside the parameter
// array of EXECUTESQL. This is done in the DB layer (and nowhere else) so every
// model + controller benefits without per-field handling. The regex is strict
// enough that UUIDs, names, JSON payloads, etc. are never touched — see
// utils/datetime.js for the full rationale.
function coerceParams(p_values) {
  if (!Array.isArray(p_values) || !p_values.length) return p_values;
  let mutated = false;
  const out = new Array(p_values.length);
  for (let i = 0; i < p_values.length; i++) {
    const v = p_values[i];
    if (isIsoDateString(v)) {
      out[i] = toMysqlDateTime(v);
      mutated = true;
    } else {
      out[i] = v;
    }
  }
  return mutated ? out : p_values;
}

const EXECUTESQL = (p_sql, p_values) =>
  new Promise((resolve, reject) => {
    pool.query(p_sql, coerceParams(p_values), (err, result) => {
      if (err) {
      console.error('[SQL ERROR]', err.message, p_sql);
      return reject(err);
    }
      resolve(result);
    });
  });

/**
 * Run queries on one connection with COMMIT / ROLLBACK.
 * Callback receives exec(sql, params) returning mysql2 execute result rows.
 */
async function withTransaction(fn) {
  const promisePool = pool.promise();
  const conn = await promisePool.getConnection();
  try {
    await conn.beginTransaction();
    const exec = async (sql, vals = []) => {
      const params = coerceParams(vals);
      const [rows] = await conn.execute(sql, params);
      return rows;
    };
    await fn(exec);
    await conn.commit();
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

module.exports = { EXECUTESQL, pool, withTransaction };
