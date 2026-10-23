const test = require('node:test');
const assert = require('node:assert/strict');
const {
  GANDI_MYSQL_SOCKET,
  applyGandiMysqlSocketIfPresent,
  applyGandiMysqlEnv,
  get,
} = require('../env');

test('laptop TCP overrides stay in place when the Gandi socket is absent', () => {
  const env = { DB_SOCKET_PATH: '', DB_HOST: '127.0.0.1' };
  assert.equal(applyGandiMysqlSocketIfPresent(env, () => false), false);
  assert.equal(env.DB_SOCKET_PATH, '');
  assert.equal(env.DB_HOST, '127.0.0.1');
});

test('Gandi socket wins over a copied laptop env.local that blanked it', () => {
  const env = { DB_SOCKET_PATH: '', DB_HOST: '127.0.0.1' };
  assert.equal(applyGandiMysqlSocketIfPresent(env, () => true), true);
  assert.equal(env.DB_SOCKET_PATH, GANDI_MYSQL_SOCKET);
  assert.equal(env.DB_HOST, '127.0.0.1');
});

test('Gandi MySQL env remaps PostgreSQL hosting-db to root', () => {
  const env = {
    DB_SOCKET_PATH: '',
    DB_HOST: '127.0.0.1',
    DB_USER: 'hosting-db',
    DB_NAME: 'postgres',
  };
  assert.equal(applyGandiMysqlEnv(env, () => true), true);
  assert.equal(env.DB_SOCKET_PATH, GANDI_MYSQL_SOCKET);
  assert.equal(env.DB_USER, 'root');
  assert.equal(env.DB_NAME, 'stage_league');
});

test('laptop TCP env does not remap hosting-db when the Gandi socket is absent', () => {
  const env = { DB_SOCKET_PATH: '', DB_USER: 'hosting-db', DB_NAME: 'postgres' };
  assert.equal(applyGandiMysqlEnv(env, () => false), false);
  assert.equal(env.DB_USER, 'hosting-db');
  assert.equal(env.DB_NAME, 'postgres');
});

test('get prefers host process.env over the merged ENV file', () => {
  const previous = process.env.DB_SOCKET_PATH;
  process.env.DB_SOCKET_PATH = GANDI_MYSQL_SOCKET;
  try {
    assert.equal(get('DB_SOCKET_PATH'), GANDI_MYSQL_SOCKET);
  } finally {
    if (previous === undefined) delete process.env.DB_SOCKET_PATH;
    else process.env.DB_SOCKET_PATH = previous;
  }
});
