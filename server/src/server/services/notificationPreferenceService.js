const { EXECUTESQL } = require('../db/database');

const CHANNELS = ['web', 'email', 'mobile', 'push'];

function parseMaybeJson(value, fallback = {}) {
  if (value == null) return fallback;
  if (typeof value === 'object' && !Array.isArray(value)) return value;
  try {
    const parsed = JSON.parse(String(value));
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : fallback;
  } catch {
    return fallback;
  }
}

function isTruthyFlag(val) {
  if (val === undefined || val === null) return null;
  return val === true || val === 1 || val === 'true' || val === '1';
}

function isChannelEnabled(settings, channel, key) {
  if (!key) return true;
  const nested = settings?.[channel];
  if (nested && typeof nested === 'object' && !Array.isArray(nested) && Object.prototype.hasOwnProperty.call(nested, key)) {
    const nestedVal = isTruthyFlag(nested[key]);
    if (nestedVal != null) return nestedVal;
  }
  const flat = isTruthyFlag(settings?.[key]);
  return flat == null ? true : flat;
}

function resolveDelivery(settings, categoryKey) {
  if (!categoryKey) return { inApp: true, push: true, email: true };
  return {
    inApp: isChannelEnabled(settings, 'web', categoryKey) || isChannelEnabled(settings, 'mobile', categoryKey),
    push: isChannelEnabled(settings, 'push', categoryKey),
    email: isChannelEnabled(settings, 'email', categoryKey),
  };
}

async function loadPlayerSettings(recipientEmail) {
  const email = String(recipientEmail || '').trim();
  if (!email) return {};
  const rows = await EXECUTESQL(
    'SELECT notification_settings FROM players WHERE LOWER(email)=LOWER(?) LIMIT 1',
    [email]
  ).catch(() => []);
  return parseMaybeJson(rows[0]?.notification_settings, {});
}

async function isEmailCategoryEnabled(recipientEmail, categoryKey) {
  const settings = await loadPlayerSettings(recipientEmail);
  return resolveDelivery(settings, categoryKey).email;
}

module.exports = {
  CHANNELS,
  parseMaybeJson,
  isChannelEnabled,
  resolveDelivery,
  loadPlayerSettings,
  isEmailCategoryEnabled,
};
