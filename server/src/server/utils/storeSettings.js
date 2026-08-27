const { EXECUTESQL } = require('../db/database');

// Credit packs are top-up purchases, framed as extra tournament entries for
// casual/occasional use. STAGE Plus (below) is the better-value option for
// active users — these packs intentionally do not try to compete with it.
// Tournament entry/creation costs 50 credits (DEFAULT_STORE_SETTINGS.tournament_entry_credits),
// so `purpose` here is derived from credits / 50.
const CREDIT_PACKS = [
  { id: 'credits_entry', credits: 50, price_eur: 1.99, label: 'Entry Pack', purpose: '1 tournament entry' },
  { id: 'credits_starter', credits: 100, price_eur: 2.99, label: 'Starter Pack', purpose: '2 tournament entries' },
  { id: 'credits_competitor', credits: 250, price_eur: 5.99, label: 'Competitor Pack', purpose: '5 tournament entries' },
  { id: 'credits_club', credits: 600, price_eur: 10.99, label: 'Club Pack', purpose: '12 tournament entries' },
];

function getCreditPack(packId) {
  return CREDIT_PACKS.find((p) => p.id === packId) || null;
}

const DEFAULT_STORE_SETTINGS = {
  stage_plus_monthly_price: 4.99,
  stage_plus_yearly_price: 49.99,
  monthly_credits: 150,
  starter_credits: 50,
  tournament_entry_credits: 50,
  community_tournament_limit: 0,
  headline: 'One membership for serious competitors',
  description: 'STAGE Plus unlocks official competitions, community tournament creation, full rankings, full stats, monthly credits, and premium visual customization across your football identity.',
  badge_image_url: '/uploads/stage-plus-badge.png',
  perks: [
    '150 credits refreshed every month',
    'Enter official STAGE competitions and regional leagues',
    'Create community tournaments',
    'Ranked player and club tournament access',
    'Full rankings and position rankings',
    'Full player and club stats',
    'Advanced recruitment and search filters',
    'Custom player card backgrounds',
    'Upload your own player card background',
    'Choose exclusive STAGE Plus card background designs',
    'Custom Club Profile stats tile backgrounds',
    'Upload your own club stats tile background',
    'Custom Career tab tile backgrounds',
    'Upload your own career tile background',
    'Custom Game Day panel backgrounds',
    'Personalize Match Screens and Dressing Room tiles',
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

function normalizeStoreCopy(row = {}) {
  const rawDescription = String(row.description || '').trim();
  const legacyDescription = !rawDescription
    || /ranked play/i.test(rawDescription)
    || /monthly credit refresh/i.test(rawDescription) && !/full rankings/i.test(rawDescription);
  const perks = parsePerks(row.perks);
  const hasLegacyPerks = perks.some((perk) => /300 credits|advanced player and club discovery|active events|premium/i.test(String(perk)));
  return {
    description: legacyDescription ? DEFAULT_STORE_SETTINGS.description : rawDescription,
    perks: hasLegacyPerks ? DEFAULT_STORE_SETTINGS.perks : perks,
  };
}

function normalizeStoreSettings(row = {}) {
  const normalizedCopy = normalizeStoreCopy(row);
  return {
    ...DEFAULT_STORE_SETTINGS,
    ...row,
    // These values are policy, not presentation. Keep them fixed so old DB rows
    // cannot make the frontend or Stripe charge/show legacy prices.
    stage_plus_monthly_price: DEFAULT_STORE_SETTINGS.stage_plus_monthly_price,
    stage_plus_yearly_price: DEFAULT_STORE_SETTINGS.stage_plus_yearly_price,
    monthly_credits: DEFAULT_STORE_SETTINGS.monthly_credits,
    starter_credits: DEFAULT_STORE_SETTINGS.starter_credits,
    tournament_entry_credits: DEFAULT_STORE_SETTINGS.tournament_entry_credits,
    community_tournament_limit: DEFAULT_STORE_SETTINGS.community_tournament_limit,
    description: normalizedCopy.description,
    badge_image_url: row.badge_image_url || DEFAULT_STORE_SETTINGS.badge_image_url,
    perks: normalizedCopy.perks.length ? normalizedCopy.perks : DEFAULT_STORE_SETTINGS.perks,
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
  CREDIT_PACKS,
  getCreditPack,
  getActiveStoreSettings,
  normalizeStoreSettings,
};
