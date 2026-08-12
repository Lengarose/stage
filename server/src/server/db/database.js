const mysql = require('mysql2');
const { get } = require('../../constants/env');
const { isIsoDateString, toMysqlDateTime } = require('../utils/datetime');

function buildPoolConfig(env = {}) {
  console.log('buildPoolConfig', JSON.stringify(env, null, 2));
  const read = (key, fallback = '') => {
    if (Object.prototype.hasOwnProperty.call(env, key)) return env[key];
    return get(key) ?? fallback;
  };

  const socketPath = String(read('DB_SOCKET_PATH')).trim();
  const user = read('DB_USER', 'root') || 'root';
  if (socketPath === '/srv/run/mysqld/mysqld.sock' && user === 'hosting-db') {
    throw new Error(
      '[db-config] Invalid Gandi MySQL configuration: DB_USER=hosting-db is a PostgreSQL-style default. ' +
      'Use DB_USER=root with DB_SOCKET_PATH=/srv/run/mysqld/mysqld.sock unless a real MySQL user was created.'
    );
  }

  const baseConfig = {
    user,
    password:          read('DB_PASSWORD', ''),
    database:          read('DB_NAME', 'stage_league') || 'stage_league',
    charset:           'utf8mb4',
    waitForConnections: true,
    connectionLimit:    10,
    // Return DATETIME as "YYYY-MM-DD HH:mm:ss" — wall-clock, no UTC JSON shift in API responses.
    dateStrings:        true,
  };

  if (socketPath) {
    return {
      ...baseConfig,
      socketPath,
    };
  }

  return {
    ...baseConfig,
    host: read('DB_HOST', 'localhost') || 'localhost',
    port: Number(read('DB_PORT', '3306')) || 3306,
  };
}

const pool = mysql.createPool(buildPoolConfig());

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

module.exports = { EXECUTESQL, pool, withTransaction, buildPoolConfig };
