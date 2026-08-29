const STAGE_PLUS_TIERS = new Set(['stage_plus', 'plus', 'pro', 'elite']);

function readSubscriptionFields(subscriptionOrEntity, expiresAt) {
  if (subscriptionOrEntity && typeof subscriptionOrEntity === 'object' && !Array.isArray(subscriptionOrEntity)) {
    return {
      subscription: subscriptionOrEntity.subscription ?? subscriptionOrEntity.tier ?? null,
      expiresAt: expiresAt ?? subscriptionOrEntity.subscription_expires_at ?? subscriptionOrEntity.expires_at ?? null,
    };
  }
  return {
    subscription: subscriptionOrEntity,
    expiresAt: expiresAt ?? null,
  };
}

/**
 * STAGE Plus access: paid tiers stay active when Stripe has not written an
 * expiry (legacy rows). A parseable expires_at at or before now is not Plus.
 */
function hasStagePlus(subscriptionOrEntity, expiresAt, now = new Date()) {
  const fields = readSubscriptionFields(subscriptionOrEntity, expiresAt);
  const tier = String(fields.subscription || '').toLowerCase();
  if (!STAGE_PLUS_TIERS.has(tier)) return false;
  if (fields.expiresAt == null || fields.expiresAt === '') return true;
  const expires = new Date(fields.expiresAt);
  if (Number.isNaN(expires.getTime())) return true;
  return expires.getTime() > new Date(now).getTime();
}

module.exports = {
  STAGE_PLUS_TIERS,
  hasStagePlus,
};
