const { EXECUTESQL } = require('../db/database');

const DEFAULT_STORE_SETTINGS = {
  stage_plus_monthly_price: 4.99,
  stage_plus_yearly_price: 49.99,
  monthly_credits: 150,
  starter_credits: 50,
  tournament_entry_credits: 50,
  community_tournament_limit: 5,
  headline: 'One membership for serious competitors',
  description: 'STAGE Plus unlocks official competitions, community tournament creation, full rankings, full stats, and a monthly credit refresh.',
  badge_image_url: '/uploads/stage-plus-badge.png',
  perks: [
    '150 credits refreshed every month',
    'Enter official STAGE competitions and regional leagues',
    'Create community tournaments',
    'Ranked player and club tournament access',
    'Full rankings and position rankings',
    'Full player and club stats',
    'Advanced recruitment and search filters',
  ],
};

function parsePerks(value) {
  if (Array.isArray(value)) return value.filter(Boolean);
  if (!value) return DEFAULT_STORE_SETTINGS.perks;
  try {
    const parsed = JSON.parse(value);
    if (Array.isArray(parsed)) return parsed.filter(Boolean);
  } catch {}
  return DEFAULT_STORE_SETTINGS.perks;
}

function normalizeStoreSettings(row = {}) {
  return {
    ...DEFAULT_STORE_SETTINGS,
    ...row,
    stage_plus_monthly_price: Number(row.stage_plus_monthly_price ?? DEFAULT_STORE_SETTINGS.stage_plus_monthly_price),
    stage_plus_yearly_price: Number(row.stage_plus_yearly_price ?? DEFAULT_STORE_SETTINGS.stage_plus_yearly_price),
    monthly_credits: Number(row.monthly_credits ?? DEFAULT_STORE_SETTINGS.monthly_credits),
    starter_credits: Number(row.starter_credits ?? DEFAULT_STORE_SETTINGS.starter_credits),
    tournament_entry_credits: Number(row.tournament_entry_credits ?? DEFAULT_STORE_SETTINGS.tournament_entry_credits),
    community_tournament_limit: Number(row.community_tournament_limit ?? DEFAULT_STORE_SETTINGS.community_tournament_limit),
    badge_image_url: row.badge_image_url || DEFAULT_STORE_SETTINGS.badge_image_url,
    perks: parsePerks(row.perks),
  };
}

async function getActiveStoreSettings() {
  try {
    const rows = await EXECUTESQL(
      'SELECT * FROM store_configs WHERE is_active = 1 ORDER BY updated_date DESC LIMIT 1',
      []
    );
    return normalizeStoreSettings(rows[0] || {});
  } catch {
    return normalizeStoreSettings({});
  }
}

module.exports = {
  DEFAULT_STORE_SETTINGS,
  getActiveStoreSettings,
  normalizeStoreSettings,
};
