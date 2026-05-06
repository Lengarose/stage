const mysql = require('mysql2');
const { get } = require('../../constants/env');

const dbSocketPath = String(get('DB_SOCKET_PATH') || '').trim();
if (!dbSocketPath) {
  throw new Error('DB_SOCKET_PATH is required for Gandi MySQL');
}

const pool = mysql.createPool({
  socketPath:         dbSocketPath,
  user:               get('DB_USER')     || 'root',
  password:           get('DB_PASSWORD') || '',
  database:           get('DB_NAME')     || 'stage_league',
  charset:            'utf8mb4',
  waitForConnections: true,
  connectionLimit:    10,
});

const EXECUTESQL = (p_sql, p_values) =>
  new Promise((resolve, reject) => {
    pool.query(p_sql, p_values, (err, result) => {
      if (err) {
      console.error('[SQL ERROR]', err.message, p_sql);
      return reject(err);
    }
      resolve(result);
    });
  });

module.exports = { EXECUTESQL, pool };
