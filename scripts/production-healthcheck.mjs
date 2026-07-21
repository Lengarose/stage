#!/usr/bin/env node

const apiBase = (process.env.API_BASE_URL || process.argv[2] || 'http://localhost:4000').replace(/\/$/, '');
const socketBase = (process.env.SOCKET_BASE_URL || process.argv[3] || 'http://localhost:3001').replace(/\/$/, '');
const timeoutMs = Number(process.env.HEALTHCHECK_TIMEOUT_MS || 8000);
const alertWebhookUrl = process.env.ALERT_WEBHOOK_URL || '';

async function getJson(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: controller.signal });
    const body = await res.json().catch(() => ({}));
    return { ok: res.ok, status: res.status, body };
  } finally {
    clearTimeout(timer);
  }
}

const checks = [
  ['apiRootHealth', `${apiBase}/health`],
  ['apiStageHealth', `${apiBase}/api/stage/health`],
  ['socketHealth', `${socketBase}/health`],
  ['socketMetrics', `${socketBase}/metrics`],
];

const results = [];
for (const [name, url] of checks) {
  try {
    const result = await getJson(url);
    results.push({ name, url, ...result });
  } catch (err) {
    results.push({ name, url, ok: false, status: 0, error: err.message || String(err) });
  }
}

const payload = {
  ok: results.every((r) => r.ok),
  checkedAt: new Date().toISOString(),
  results,
};

console.log(JSON.stringify(payload, null, 2));

if (!payload.ok && alertWebhookUrl) {
  await fetch(alertWebhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      text: 'Stage production healthcheck failed',
      ...payload,
    }),
  }).catch(() => {});
}

if (!payload.ok) {
  process.exit(1);
}
