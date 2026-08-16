const { EXECUTESQL } = require('../db/database');

function getOneSignalConfig(env = process.env) {
  const appId = String(env.ONESIGNAL_APP_ID || '').trim();
  const apiKey = String(env.ONESIGNAL_REST_API_KEY || '').trim();
  const frontendUrl = String(env.FRONTEND_URL || 'https://stageleagues.com').replace(/\/$/, '');
  return {
    appId,
    apiKey,
    frontendUrl,
    configured: Boolean(appId && apiKey),
  };
}

function buildWebUrl(link, frontendUrl = 'https://stageleagues.com') {
  const base = String(frontendUrl || 'https://stageleagues.com').replace(/\/$/, '');
  const path = String(link || '/notifications').trim();
  if (!path) return `${base}/notifications`;
  if (/^https?:\/\//i.test(path)) return path;
  return `${base}${path.startsWith('/') ? path : `/${path}`}`;
}

function buildOneSignalPayload({
  appId,
  externalId,
  title,
  body,
  link,
  type,
  notificationId,
  frontendUrl,
}) {
  return {
    app_id: appId,
    include_aliases: { external_id: [String(externalId)] },
    target_channel: 'push',
    headings: { en: String(title || 'STAGE') },
    contents: { en: String(body || title || 'Open STAGE') },
    data: {
      link: link || '/notifications',
      type: type || '',
      notification_id: notificationId || '',
    },
    url: buildWebUrl(link, frontendUrl),
    ios_sound: 'default',
  };
}

async function resolveExternalId(recipientEmail) {
  const rows = await EXECUTESQL(
    `SELECT COALESCE(NULLIF(user_id, ''), id) AS external_id
       FROM players
      WHERE LOWER(email) = LOWER(?)
      LIMIT 1`,
    [recipientEmail],
  );
  return rows[0]?.external_id || null;
}

async function sendOneSignalPush({
  recipientEmail,
  title,
  body = '',
  link = '',
  type = '',
  notificationId = null,
} = {}, env = process.env, fetchImpl = globalThis.fetch) {
  const config = getOneSignalConfig(env);
  if (!config.configured) return { skipped: true, reason: 'onesignal not configured' };
  if (!recipientEmail) return { skipped: true, reason: 'recipient missing' };
  const externalId = await resolveExternalId(recipientEmail);
  if (!externalId) return { skipped: true, reason: 'no external id' };
  if (typeof fetchImpl !== 'function') return { skipped: true, reason: 'fetch unavailable' };

  const payload = buildOneSignalPayload({
    appId: config.appId,
    externalId,
    title,
    body,
    link,
    type,
    notificationId,
    frontendUrl: config.frontendUrl,
  });

  const response = await fetchImpl('https://api.onesignal.com/notifications', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      Authorization: `Key ${config.apiKey}`,
    },
    body: JSON.stringify(payload),
  });
  if (!response?.ok) {
    const err = await response.json?.().catch(() => ({}));
    return { skipped: true, reason: err?.errors?.[0] || response.statusText || 'onesignal rejected' };
  }
  return { success: true };
}

function queueOneSignalPush(payload) {
  Promise.resolve(sendOneSignalPush(payload)).catch(() => {});
}

module.exports = {
  getOneSignalConfig,
  buildWebUrl,
  buildOneSignalPayload,
  sendOneSignalPush,
  queueOneSignalPush,
};
