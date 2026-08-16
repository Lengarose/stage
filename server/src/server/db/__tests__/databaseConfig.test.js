const test = require('node:test');
const assert = require('node:assert/strict');
const { buildPoolConfig, resolveMysqlTimeZone, offsetForIanaTimeZone } = require('../database');

test('database config uses Gandi socket when DB_SOCKET_PATH is set', () => {
  const config = buildPoolConfig({
    DB_SOCKET_PATH: '/srv/run/mysqld/mysqld.sock',
    DB_USER: 'socket-user',
    DB_PASSWORD: 'socket-pass',
    DB_NAME: 'socket-db',
  });

  assert.equal(config.socketPath, '/srv/run/mysqld/mysqld.sock');
  assert.equal(config.user, 'socket-user');
  assert.equal(config.password, 'socket-pass');
  assert.equal(config.database, 'socket-db');
  assert.equal(config.host, undefined);
});

test('database config uses TCP when DB_SOCKET_PATH is empty', () => {
  const config = buildPoolConfig({
    DB_SOCKET_PATH: '',
    DB_HOST: '127.0.0.1',
    DB_PORT: '3307',
    DB_USER: 'tcp-user',
    DB_PASSWORD: 'tcp-pass',
    DB_NAME: 'tcp-db',
  });

  assert.equal(config.socketPath, undefined);
  assert.equal(config.host, '127.0.0.1');
  assert.equal(config.port, 3307);
  assert.equal(config.user, 'tcp-user');
  assert.equal(config.password, 'tcp-pass');
  assert.equal(config.database, 'tcp-db');
});

test('database config rejects Gandi socket with PostgreSQL default user', () => {
  assert.throws(
    () => buildPoolConfig({
      DB_SOCKET_PATH: '/srv/run/mysqld/mysqld.sock',
      DB_USER: 'hosting-db',
      DB_PASSWORD: '',
      DB_NAME: 'stage_league',
    }),
    /DB_USER=hosting-db is a PostgreSQL-style default/
  );
});

test('database timezone defaults to Brussels and can be overridden', () => {
  assert.equal(resolveMysqlTimeZone({}), 'Europe/Brussels');
  assert.equal(resolveMysqlTimeZone({ DB_TIME_ZONE: 'Europe/Paris' }), 'Europe/Paris');
  assert.match(offsetForIanaTimeZone('Europe/Brussels'), /^[+-]\d{2}:\d{2}$/);
});
