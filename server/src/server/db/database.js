const fs = require('fs');
const mysql = require('mysql2');
const { get } = require('../../constants/env');

const dbSocketPath = String(get('DB_SOCKET_PATH') || '').trim();
if (!dbSocketPath) {
  throw new Error('DB_SOCKET_PATH is required for Gandi MySQL');
}
if (!fs.existsSync(dbSocketPath)) {
  throw new Error(`MySQL socket not found at ${dbSocketPath}`);
}

const pool = mysql.createPool({
  socketPath: dbSocketPath,
  user:'root',
  password:'',
  database:'stage_league',
  charset: 'utf8mb4',
  waitForConnections: true,
  connectionLimit: 10,
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
