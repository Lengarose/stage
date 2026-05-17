#!/usr/bin/env node
/**
 * Smoke-test the socket server (local or Render).
 *
 * Usage:
 *   cd socket-server
 *   EMIT_SECRET=... ACCESS_TOKEN_SECRET=... npm run test:socket
 *   EMIT_SECRET=... ACCESS_TOKEN_SECRET=... npm run test:socket -- https://stage-7osn.onrender.com
 *
 * Env (or pass URL as first arg):
 *   SOCKET_SERVER_URL / SOCKET_URL — base URL, default http://localhost:3001
 *   EMIT_SECRET or SOCKET_SERVER_SECRET — must match Render + Gandi
 *   ACCESS_TOKEN_SECRET — same JWT secret as REST API
 *   TEST_CHANNEL — optional, default STAGE_CHAT_MESSAGE_smoke-test
 */

const jwt = require('jsonwebtoken');
const { io } = require('socket.io-client');

const baseUrl = (
  process.argv[2] ||
  process.env.SOCKET_SERVER_URL ||
  process.env.SOCKET_URL ||
  'https://stage-7osn.onrender.com'
).replace(/\/$/, '');

const emitSecret =
  process.env.EMIT_SECRET || process.env.SOCKET_SERVER_SECRET || '#1?BCJw[JrZ}Y|>?6CVpCHrSCm$6><#)1O_{mRgIdlw';
const accessSecret = process.env.ACCESS_TOKEN_SECRET || 'e11c51e0d9b810e4a6765904a144361248d4976b';
const testChannel =
  process.env.TEST_CHANNEL || 'STAGE_CHAT_MESSAGE_smoke-test';

function fail(msg) {
  console.error(`\n✗ ${msg}\n`);
  process.exit(1);
}

function ok(msg) {
  console.log(`✓ ${msg}`);
}

async function checkHealth() {
  const res = await fetch(`${baseUrl}/health`);
  const body = await res.json().catch(() => ({}));
  if (!res.ok) fail(`GET /health → ${res.status} ${JSON.stringify(body)}`);
  ok(`GET /health → ${JSON.stringify(body)}`);
  return body;
}

async function postEmit(payload) {
  const res = await fetch(`${baseUrl}/emit`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-emit-secret': emitSecret,
    },
    body: JSON.stringify(payload),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) fail(`POST /emit → ${res.status} ${JSON.stringify(body)}`);
  ok(`POST /emit → ${JSON.stringify(body)}`);
}

function connectAndListen(channel) {
  const token = jwt.sign({ id: 'socket-smoke-test' }, accessSecret, { expiresIn: '5m' });

  return new Promise((resolve, reject) => {
    const client = io(baseUrl, {
      auth: { token },
      transports: ['websocket', 'polling'],
      reconnection: false,
      timeout: 20000,
    });

    const timer = setTimeout(() => {
      client.close();
      reject(new Error('Timed out waiting for socket "update" event (5s)'));
    }, 5000);

    client.on('connect_error', (err) => {
      clearTimeout(timer);
      client.close();
      reject(new Error(`Socket connect failed: ${err.message}`));
    });

    client.on('update', (data) => {
      if (data._channel !== channel) return;
      clearTimeout(timer);
      client.close();
      resolve(data);
    });

    client.on('connect', () => {
      ok(`Socket connected (${client.id})`);
      client.emit('JOINLEAVEROOM', { action: 'join', channel });
      ok(`Joined room ${channel}`);
    });
  });
}

async function main() {
  console.log(`\nStage socket smoke test → ${baseUrl}\n`);

  if (!emitSecret) {
    fail('Set EMIT_SECRET or SOCKET_SERVER_SECRET (same as Gandi SOCKET_SERVER_SECRET)');
  }
  if (!accessSecret) {
    fail('Set ACCESS_TOKEN_SECRET (same as Gandi REST API)');
  }

  await checkHealth();

  const testPayload = {
    id: 'smoke-test',
    message: 'hello from test-socket.js',
    at: new Date().toISOString(),
  };

  const listenPromise = connectAndListen(testChannel);

  // Let JOINLEAVEROOM reach the server before /emit
  await new Promise((r) => setTimeout(r, 500));

  await postEmit({ channel: testChannel, data: testPayload });

  const received = await listenPromise;
  ok(`Received update: ${JSON.stringify(received)}`);

  console.log('\nAll checks passed. Gandi → POST /emit → browser path should work the same.\n');
}

main().catch((err) => fail(err.message || String(err)));
