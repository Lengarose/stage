#!/usr/bin/env node
/**
 * Socket load test for production readiness.
 *
 * Defaults simulate the target launch size:
 *   200 connected users, 50 active channels, 30 seconds.
 *
 * Usage:
 *   cd socket-server
 *   ACCESS_TOKEN_SECRET=... EMIT_SECRET=... npm run load:test
 *   ACCESS_TOKEN_SECRET=... SOCKET_SERVER_SECRET=... npm run load:test -- https://stage-7osn.onrender.com 200 50 30000
 */

const jwt = require('jsonwebtoken');
const { io } = require('socket.io-client');
const crypto = require('crypto');

const baseUrl = (
  process.argv[2] ||
  process.env.SOCKET_SERVER_URL ||
  process.env.SOCKET_URL ||
  'http://localhost:3001'
).replace(/\/$/, '');

const totalClients = Number(process.argv[3] || process.env.SOCKET_LOAD_CLIENTS || 200);
const activeChannels = Number(process.argv[4] || process.env.SOCKET_LOAD_ACTIVE_CHANNELS || 50);
const durationMs = Number(process.argv[5] || process.env.SOCKET_LOAD_DURATION_MS || 30000);
const intervalMs = Number(process.env.SOCKET_LOAD_INTERVAL_MS || 100);
const emitSecret = process.env.EMIT_SECRET || process.env.SOCKET_SERVER_SECRET || '';
const accessSecret = process.env.ACCESS_TOKEN_SECRET || '';

function fail(message) {
  console.error(`\n✗ ${message}\n`);
  process.exit(1);
}

function assertPositiveInteger(value, name) {
  if (!Number.isInteger(value) || value <= 0) fail(`${name} must be a positive integer`);
}

async function postEmit(channel, data) {
  const res = await fetch(`${baseUrl}/emit`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-emit-secret': emitSecret,
    },
    body: JSON.stringify({ channel, data }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`POST /emit ${res.status}: ${JSON.stringify(body)}`);
  return body;
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
  if (!accessSecret) fail('Set ACCESS_TOKEN_SECRET');
  if (!emitSecret) fail('Set EMIT_SECRET or SOCKET_SERVER_SECRET');
  assertPositiveInteger(totalClients, 'client count');
  assertPositiveInteger(activeChannels, 'active channel count');
  assertPositiveInteger(durationMs, 'durationMs');

  const runId = crypto.randomUUID ? crypto.randomUUID() : crypto.randomBytes(16).toString('hex');
  const channels = Array.from(
    { length: activeChannels },
    (_unused, i) => `STAGE_CHAT_MESSAGE_loadtest-${runId}-${i}`
  );

  let connected = 0;
  let connectErrors = 0;
  let joinErrors = 0;
  let received = 0;
  let duplicates = 0;
  let emitted = 0;
  let expectedDeliveries = 0;
  const seen = new Set();
  const clients = [];
  const subscribersByChannel = new Map(channels.map((channel) => [channel, 0]));

  console.log(`\nSocket load test -> ${baseUrl}`);
  console.log(`Clients: ${totalClients}, active channels: ${activeChannels}, duration: ${durationMs}ms\n`);

  await Promise.all(Array.from({ length: totalClients }, (_unused, i) => new Promise((resolve) => {
    const channel = channels[i % channels.length];
    const token = jwt.sign(
      {
        id: `load-test-user-${runId}-${i}`,
        email: `load-test-${runId}-${i}@stage.test`,
      },
      accessSecret,
      { expiresIn: '10m' }
    );

    const client = io(baseUrl, {
      auth: { token },
      transports: ['websocket', 'polling'],
      reconnection: false,
      timeout: 20000,
    });

    const done = () => {
      clients.push(client);
      resolve();
    };

    client.on('connect', () => {
      connected += 1;
      subscribersByChannel.set(channel, (subscribersByChannel.get(channel) || 0) + 1);
      client.emit('JOINLEAVEROOM', { action: 'join', channel });
      done();
    });

    client.on('connect_error', () => {
      connectErrors += 1;
      client.close();
      done();
    });

    client.on('join_error', () => {
      joinErrors += 1;
    });

    client.on('update', (payload = {}) => {
      if (!payload.event_id) return;
      const key = `${client.id}:${payload.event_id}`;
      if (seen.has(key)) {
        duplicates += 1;
        return;
      }
      seen.add(key);
      received += 1;
    });
  })));

  if (connected !== totalClients) {
    clients.forEach((client) => client.close());
    fail(`Only ${connected}/${totalClients} clients connected (${connectErrors} errors)`);
  }

  await wait(500);

  const started = Date.now();
  while (Date.now() - started < durationMs) {
    const channel = channels[emitted % channels.length];
    const eventId = `${runId}-${emitted}`;
    const result = await postEmit(channel, {
      event_id: eventId,
      source: 'socket-load-test',
      sequence: emitted,
      sent_at: new Date().toISOString(),
    });
    emitted += 1;
    expectedDeliveries += Number(result.recipients || subscribersByChannel.get(channel) || 0);
    await wait(intervalMs);
  }

  await wait(1500);
  clients.forEach((client) => client.close());

  const lost = Math.max(0, expectedDeliveries - received);
  const lossRate = expectedDeliveries > 0 ? lost / expectedDeliveries : 0;
  const summary = {
    connected,
    connectErrors,
    joinErrors,
    emitted,
    expectedDeliveries,
    received,
    duplicates,
    lost,
    lossRate: Number(lossRate.toFixed(4)),
  };

  console.log(JSON.stringify(summary, null, 2));

  if (joinErrors > 0) fail(`${joinErrors} join errors`);
  if (duplicates > 0) fail(`${duplicates} duplicate deliveries`);
  if (lossRate > 0.02) fail(`Delivery loss rate too high: ${(lossRate * 100).toFixed(2)}%`);

  console.log('\nAll socket load-test checks passed.\n');
}

main().catch((err) => fail(err.message || String(err)));
