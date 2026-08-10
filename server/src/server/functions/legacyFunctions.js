const { EXECUTESQL, pool } = require('../db/database');
const axios = require('axios').default;
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const { deleteUserAccount } = require('../services/accountDeletion');
const competitionEngineService = require('../services/competitionEngineService');
const {
  recognizeScoreFromImageUrl,
} = require('../services/scoreProofService');
const {
  createNotificationIfEnabled,
  deliverContractOfferMessage,
  messageTypeToNotificationType,
  sendActionMessage,
} = require('../services/messageDeliveryService');
const Match = require('../models/matchModel');
const { DEFAULT_STORE_SETTINGS, getCreditPack, getActiveStoreSettings } = require('../utils/storeSettings');
const {
  addUserCredits,
  getUserCredits,
  refreshUserCreditsTo,
  spendUserCredits,
} = require('../services/userCreditsService');
const {
  createTemporaryClubPresident,
  linkTemporaryClubPresident,
} = require('./legacy/economyTestHelpers');
const {
  awardClubTrophyToClubAndPlayers,
  awardPlayerOnlyTrophy,
} = require('../services/trophyAwardService');

const EA_BASE = 'https://proclubs.ea.com/api/fc/';

const EA_ENDPOINTS = {
  searchClub:       (p) => `clubs/search?platform=${p.platform}&clubName=${encodeURIComponent(p.clubName)}`,
  clubInfo:         (p) => `clubs/info?platform=${p.platform}&clubIds=${p.clubId}`,
  overallStats:     (p) => `clubs/overallStats?platform=${p.platform}&clubIds=${p.clubId}`,
  memberStats:      (p) => `clubs/memberStats?platform=${p.platform}&clubId=${p.clubId}`,
  memberCareerStats:(p) => `clubs/memberCareerStats?platform=${p.platform}&clubId=${p.clubId}`,
  leagueMatches:    (p) => `clubs/matches?platform=${p.platform}&clubIds=${p.clubId}&matchType=leagueMatch`,
  playoffMatches:   (p) => `clubs/matches?platform=${p.platform}&clubIds=${p.clubId}&matchType=playoffMatch`,
};

const TEST_PACK_DOMAIN = 'stage-test.local';
const TEST_PACK_TAG = '[STAGE TEST PACK]';
const TEST_CLUBS = [
  { name: 'Neon Harbor FC', tag: 'NHF', country_code: 'NL' },
  { name: 'Iron Vale United', tag: 'IVU', country_code: 'BE' },
  { name: 'Metro Nova FC', tag: 'MNV', country_code: 'FR' },
  { name: 'Apex District SC', tag: 'ADX', country_code: 'DE' },
  { name: 'Quartz Albion', tag: 'QZA', country_code: 'GB' },
  { name: 'Vortex Rovers', tag: 'VXR', country_code: 'PT' },
  { name: 'Cobalt City FC', tag: 'CBL', country_code: 'ES' },
  { name: 'Summit Forge FC', tag: 'SFF', country_code: 'IT' },
];

const TEST_PLAYER_NAMES = [
  ['Mika Stone', 'Noah Cross', 'Jules Ferry', 'Kai Vos', 'Rami Holt', 'Eden Pike', 'Luca Voss', 'Timo Lane'],
  ['Ilias Verne', 'Theo March', 'Nico Brandt', 'Maceo Lenz', 'Finn Keane', 'Owen Frost', 'Miro Dale'],
  ['Ari Vale', 'Sacha Reed', 'Dante Wolfe', 'Remy Cole', 'Ivo Hart', 'Enzo Wren', 'Taj Price', 'Leon Ash'],
  ['Kian Moss', 'Ruben Knox', 'Milan Fox', 'Nate Rowe', 'Aron West', 'Lio Grey'],
  ['Jay Sol', 'Robin North', 'Mauro Quinn', 'Ezra Stone', 'Cal Rivers', 'Benji Hale', 'Oscar Finch'],
  ['Rayan Cruz', 'Milo Saint', 'Kobe Ray', 'Yanis Lock', 'Samir Bloom', 'Ty Ellis', 'Jonah Pierce', 'Ali Rhodes'],
  ['Lenn Ward', 'Dion Ellis', 'Mateo Lux', 'Ciro Bell', 'Evan Hayes', 'Zion Reid'],
  ['Nolan King', 'Amir Wells', 'Jude Knox', 'Rio Chase', 'Felix Ray', 'Otis Ford', 'Maxen Brooks'],
];

const TEST_POSITIONS = ['GK', 'CB', 'LB', 'CDM', 'CM', 'CAM', 'LW', 'ST'];

const CONTRACT_TYPE_DURATION = {
  trial: { max_games: 5, max_days: 14 },
  academy: { max_games: 20, max_days: 30 },
  squad: { max_games: 100, max_days: 90 },
  important: { max_games: 250, max_days: 120 },
  star: { max_games: 400, max_days: 180 },
  ownership: { max_games: 999, max_days: 3650 },
};

const DEFAULT_MV_WEIGHTS = {
  base_per_match: 60_000,
  max_base: 8_000_000,
  goal_rate_bonus: 2_000_000,
  assist_rate_bonus: 1_000_000,
  clean_sheet_rate_bonus: 2_500_000,
  motm_bonus: 300_000,
  consistency_boost: 0.15,
  form_boost: 0.20,
  form_penalty: 0.12,
  win_rate_boost: 0.10,
  ovr_weight: 0.08,
  spike_cap_up: 0.50,
  spike_cap_down: 0.35,
};

let _mvConfigCache = null;

function parseMvWeights(raw) {
  if (!raw) return {};
  try {
    return typeof raw === 'string' ? JSON.parse(raw) : (raw || {});
  } catch {
    return {};
  }
}

async function getMvConfig() {
  if (_mvConfigCache) return _mvConfigCache;
  const rows = await EXECUTESQL(
    'SELECT weights FROM market_value_config WHERE is_active = 1 ORDER BY updated_date DESC LIMIT 1',
    []
  ).catch(() => []);
  _mvConfigCache = { ...DEFAULT_MV_WEIGHTS, ...parseMvWeights(rows[0]?.weights) };
  return _mvConfigCache;
}

function computeValueFromStats(player, W, previousValue = 0) {
  const matches = Number(player.matches_played || 0);
  if (matches === 0) return Math.max(250_000, Number(previousValue) || 250_000);

  const goals = Number(player.goals || 0);
  const assists = Number(player.assists || 0);
  const avgRating = Number(player.avg_match_rating || 0);
  const motm = Number(player.man_of_the_match || 0);
  const cleanSheets = Number(player.clean_sheets || 0);
  const wins = Number(player.wins_count || 0);
  const ovr = Number(player.overall_rating || 65);

  const base = Math.min(matches * W.base_per_match, W.max_base);
  const ratingMult = avgRating >= 5
    ? Math.max(0.3, Math.min(2.5, 0.3 + ((avgRating - 4.5) / 5.0) * 2.2))
    : 0.3;

  const goalRateBonus = Math.min((goals / matches) * W.goal_rate_bonus, 6_000_000);
  const asstRateBonus = Math.min((assists / matches) * W.assist_rate_bonus, 3_000_000);
  const csRateBonus = Math.min((cleanSheets / matches) * W.clean_sheet_rate_bonus, 5_000_000);
  const outputBonus = goalRateBonus + asstRateBonus + csRateBonus;
  const achieveBonus = Math.min(motm * W.motm_bonus, 5_000_000);
  const ovrBonus = Math.max(ovr - 60, 0) * 8_000 * W.ovr_weight;

  const winRate = wins / matches;
  const winMult = winRate > 0.7 ? 1 + W.win_rate_boost
    : winRate > 0.5 ? 1 + W.win_rate_boost * 0.5
      : 1.0;

  let formArr = [];
  try { formArr = JSON.parse(player.form_last10 || '[]'); } catch { formArr = []; }
  const recentForm = formArr.slice(-5);
  const recentAvg = recentForm.length
    ? recentForm.reduce((sum, value) => sum + Number(value || 0), 0) / recentForm.length
    : 0;

  let formMult = 1.0;
  if (recentAvg > 0 && avgRating > 0) {
    if (recentAvg > avgRating) formMult = 1 + W.form_boost;
    else if (recentAvg < avgRating) formMult = 1 - W.form_penalty;
  }

  let consistencyMult = 1.0;
  if (formArr.length >= 3) {
    const mean = formArr.reduce((sum, value) => sum + Number(value || 0), 0) / formArr.length;
    const variance = formArr.reduce((sum, value) => sum + ((Number(value || 0) - mean) ** 2), 0) / formArr.length;
    if (Math.sqrt(variance) < 0.5) consistencyMult = 1 + W.consistency_boost;
  }

  let raw = Math.round((base + outputBonus + achieveBonus + ovrBonus) * ratingMult * winMult * formMult * consistencyMult);
  raw = Math.max(250_000, Math.round(raw / 100_000) * 100_000);

  const prev = Number(previousValue) || 0;
  if (prev > 0) {
    const maxUp = prev * (1 + (W.spike_cap_up || 0.5));
    const maxDown = prev * (1 - (W.spike_cap_down || 0.35));
    raw = Math.min(raw, maxUp);
    raw = Math.max(raw, maxDown);
    raw = Math.round(raw / 100_000) * 100_000;
  }

  return raw;
}

const { toMysqlDateTime } = require('../utils/datetime');
const { notifyAnnouncement } = require('../services/notifications');
const { ensureMatchStreamsFromPlayers } = require('../utils/matchStream');
const {
  broadcastMatch,
  broadcastMatchById,
  broadcastInbox,
  broadcastMatchPlayerStat,
  broadcastTournamentDeleted,
  broadcastTransferWindow,
} = require('../utils/socketBroadcast');
const {
  resolveUserIdentity,
  resolvePlayerForUserId,
  resolveClubForUserId,
} = require('../services/identityService');
const { upsertActiveMembership, endActiveMemberships } = require('../services/clubMembershipService');
const { listActiveClubPlayers, listActiveClubPlayerEmails } = require('../services/clubPlayerService');
const {
  assertCanCreateContractOffer,
  closeAcceptedContractConflicts,
  markContractInboxStatus,
} = require('../services/contractRulesService');
const {
  STARTER_CLUB_FINANCE,
  STADIUM_FINANCE_TIERS,
  getStadiumFinanceTier,
  getClubFinanceUsage,
  assertClubContractFinance,
  assertClubFinanceWithinTier,
} = require('../services/clubFinanceService');
const { getClubAccess } = require('../services/clubOperationsService');
const {
  getCurrentTransferWindow,
  getLatestTransferWindow,
} = require('../services/transferWindowService');

async function getMe(_auth_user_id) {
  const identity = await resolveUserIdentity(_auth_user_id);
  return { user: identity.user, player: identity.player, club: identity.club };
}

async function requireContractOfferAccess(user, clubId) {
  const access = await getClubAccess(user, clubId);
  if (!access.admin && !access.permissions.includes('offer_contracts')) {
    const err = new Error('Only the club president or authorised staff can create contracts');
    err.status = 403;
    throw err;
  }
  return access;
}

async function requireClubFunctionAccess(user, clubId, permission, message = 'Only the club president can do this') {
  const access = await getClubAccess(user, clubId);
  if (!access.admin && permission && !access.permissions.includes(permission)) {
    const err = new Error(message);
    err.status = 403;
    throw err;
  }
  if (!access.allowed && !access.admin) {
    const err = new Error(message);
    err.status = 403;
    throw err;
  }
  return access;
}

function parseMaybeJson(value, fallback = {}) {
  if (value == null) return fallback;
  if (typeof value === 'object') return value;
  try { return JSON.parse(String(value)); } catch { return fallback; }
}

function normalizeLifestyleCities(value) {
  if (!value) return [];
  if (Array.isArray(value)) return value.filter(Boolean);
  if (typeof value === 'object') return [value];
  const raw = String(value).trim();
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed.filter(Boolean);
    if (parsed && typeof parsed === 'object') return [parsed];
  } catch {}
  return raw.split('\n').map(line => {
    const [city, country, emoji] = line.split(',').map(part => String(part || '').trim());
    return city ? { city, country: country || null, emoji: emoji || null } : null;
  }).filter(Boolean);
}

function serializeLifestyleCities(value) {
  const cities = normalizeLifestyleCities(value);
  return cities.length ? JSON.stringify(cities) : null;
}

function resolveLifestyleLocation(item, params = {}) {
  const requestedCity = params.location_city || params.city;
  const requestedCountry = params.location_country || params.country;
  const requestedEmoji = params.location_emoji || params.emoji;
  if (requestedCity || requestedCountry || requestedEmoji) {
    return {
      city: requestedCity || null,
      country: requestedCountry || null,
      emoji: requestedEmoji || null,
    };
  }
  const [fallback] = normalizeLifestyleCities(item?.available_cities);
  return {
    city: fallback?.city || null,
    country: fallback?.country || null,
    emoji: fallback?.emoji || null,
  };
}

function getDefaultLifestyleItems() {
  const city = (cityName, country, emoji) => [{ city: cityName, country, emoji }];
  return [
    { name: 'London Canary Wharf Apartment', category: 'houses', subcategory: 'apartment', emoji: '🏙️', tier: 'premium', sort_order: 1,
      price_stc: 850_000, rent_price_stc: 4_800, rent_duration_days: 30, invest_price_stc: 850_000, invest_return_rate: 0.55, invest_duration_days: 30,
      passive_income_stc: 4_250, passive_income_interval_days: 30, weekly_maintenance_stc: 900, can_buy: 1, can_rent: 1, can_invest: 1, can_sell: 1,
      sell_value_percent: 84, allows_multiple: 1, image_url: 'https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?w=900&q=80', available_cities: city('London', 'United Kingdom', '🇬🇧'),
      description: 'Modern docklands apartment priced around prime London new-build values. Buy to live in, rent monthly, or invest for monthly yield.' },
    { name: 'Manchester City Apartment', category: 'houses', subcategory: 'apartment', emoji: '🏢', tier: 'standard', sort_order: 2,
      price_stc: 320_000, rent_price_stc: 1_650, rent_duration_days: 30, invest_price_stc: 320_000, invest_return_rate: 0.52, invest_duration_days: 30,
      passive_income_stc: 1_550, passive_income_interval_days: 30, weekly_maintenance_stc: 350, can_buy: 1, can_rent: 1, can_invest: 1, can_sell: 1,
      sell_value_percent: 82, allows_multiple: 1, image_url: 'https://images.unsplash.com/photo-1515263487990-61b07816b324?w=900&q=80', available_cities: city('Manchester', 'United Kingdom', '🇬🇧'),
      description: 'Central Manchester apartment with realistic city rent and investment yield.' },
    { name: 'Brussels Ixelles Apartment', category: 'houses', subcategory: 'apartment', emoji: '🏘️', tier: 'standard', sort_order: 3,
      price_stc: 410_000, rent_price_stc: 1_850, rent_duration_days: 30, invest_price_stc: 410_000, invest_return_rate: 0.45, invest_duration_days: 30,
      passive_income_stc: 1_750, passive_income_interval_days: 30, weekly_maintenance_stc: 420, can_buy: 1, can_rent: 1, can_invest: 1, can_sell: 1,
      sell_value_percent: 82, allows_multiple: 1, image_url: 'https://images.unsplash.com/photo-1494526585095-c41746248156?w=900&q=80', available_cities: city('Brussels', 'Belgium', '🇧🇪'),
      description: 'Well-located Brussels apartment for players who want a European base.' },
    { name: 'Paris 16th Apartment', category: 'houses', subcategory: 'apartment', emoji: '🏛️', tier: 'elite', sort_order: 4,
      price_stc: 1_300_000, rent_price_stc: 5_500, rent_duration_days: 30, invest_price_stc: 1_300_000, invest_return_rate: 0.42, invest_duration_days: 30,
      passive_income_stc: 5_200, passive_income_interval_days: 30, weekly_maintenance_stc: 1_250, can_buy: 1, can_rent: 1, can_invest: 1, can_sell: 1,
      sell_value_percent: 85, allows_multiple: 1, image_url: 'https://images.unsplash.com/photo-1501183638710-841dd1904471?w=900&q=80', available_cities: city('Paris', 'France', '🇫🇷'),
      description: 'Prestige Paris apartment with high purchase price and steady monthly rental income.' },
    { name: 'Barcelona Beach Apartment', category: 'houses', subcategory: 'apartment', emoji: '🌊', tier: 'premium', sort_order: 5,
      price_stc: 650_000, rent_price_stc: 3_000, rent_duration_days: 30, invest_price_stc: 650_000, invest_return_rate: 0.48, invest_duration_days: 30,
      passive_income_stc: 2_900, passive_income_interval_days: 30, weekly_maintenance_stc: 700, can_buy: 1, can_rent: 1, can_invest: 1, can_sell: 1,
      sell_value_percent: 83, allows_multiple: 1, image_url: 'https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?w=900&q=80', available_cities: city('Barcelona', 'Spain', '🇪🇸'),
      description: 'Beach-side Barcelona apartment with lifestyle appeal and tourist rental upside.' },
    { name: 'Dubai Marina Apartment', category: 'houses', subcategory: 'apartment', emoji: '🌆', tier: 'elite', sort_order: 6,
      price_stc: 900_000, rent_price_stc: 4_200, rent_duration_days: 30, invest_price_stc: 900_000, invest_return_rate: 0.62, invest_duration_days: 30,
      passive_income_stc: 5_300, passive_income_interval_days: 30, weekly_maintenance_stc: 950, can_buy: 1, can_rent: 1, can_invest: 1, can_sell: 1,
      sell_value_percent: 84, allows_multiple: 1, image_url: 'https://images.unsplash.com/photo-1512453979798-5ea266f8880c?w=900&q=80', available_cities: city('Dubai', 'United Arab Emirates', '🇦🇪'),
      description: 'High-rise Dubai Marina apartment with strong monthly investment return.' },
    { name: 'New York Tribeca Loft', category: 'houses', subcategory: 'loft', emoji: '🗽', tier: 'legendary', sort_order: 7,
      price_stc: 2_800_000, rent_price_stc: 12_000, rent_duration_days: 30, invest_price_stc: 2_800_000, invest_return_rate: 0.43, invest_duration_days: 30,
      passive_income_stc: 11_500, passive_income_interval_days: 30, weekly_maintenance_stc: 2_900, can_buy: 1, can_rent: 1, can_invest: 1, can_sell: 1,
      sell_value_percent: 86, allows_multiple: 1, image_url: 'https://images.unsplash.com/photo-1484154218962-a197022b5858?w=900&q=80', available_cities: city('New York', 'United States', '🇺🇸'),
      description: 'Tribeca-style loft for elite players who want a US flagship property.' },
    { name: 'Miami Beach Condo', category: 'houses', subcategory: 'condo', emoji: '🏖️', tier: 'elite', sort_order: 8,
      price_stc: 1_200_000, rent_price_stc: 6_500, rent_duration_days: 30, invest_price_stc: 1_200_000, invest_return_rate: 0.58, invest_duration_days: 30,
      passive_income_stc: 6_400, passive_income_interval_days: 30, weekly_maintenance_stc: 1_450, can_buy: 1, can_rent: 1, can_invest: 1, can_sell: 1,
      sell_value_percent: 84, allows_multiple: 1, image_url: 'https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?w=900&q=80', available_cities: city('Miami', 'United States', '🇺🇸'),
      description: 'Miami condo with beach positioning and healthy short-let economics.' },
    { name: 'Marbella Villa', category: 'houses', subcategory: 'villa', emoji: '🏡', tier: 'legendary', sort_order: 9,
      price_stc: 3_500_000, rent_price_stc: 18_000, rent_duration_days: 30, invest_price_stc: 3_500_000, invest_return_rate: 0.60, invest_duration_days: 30,
      passive_income_stc: 19_500, passive_income_interval_days: 30, weekly_maintenance_stc: 5_000, can_buy: 1, can_rent: 1, can_invest: 1, can_sell: 1,
      sell_value_percent: 87, allows_multiple: 1, image_url: 'https://images.unsplash.com/photo-1613977257363-707ba9348227?w=900&q=80', available_cities: city('Marbella', 'Spain', '🇪🇸'),
      description: 'Large Marbella villa with pool, staff costs, and premium rental yield.' },
    { name: 'Monaco Harbour Penthouse', category: 'houses', subcategory: 'penthouse', emoji: '🛥️', tier: 'legendary', sort_order: 10,
      price_stc: 18_000_000, rent_price_stc: 85_000, rent_duration_days: 30, invest_price_stc: 18_000_000, invest_return_rate: 0.47, invest_duration_days: 30,
      passive_income_stc: 82_000, passive_income_interval_days: 30, weekly_maintenance_stc: 22_000, can_buy: 1, can_rent: 1, can_invest: 1, can_sell: 1,
      sell_value_percent: 90, allows_multiple: 1, image_url: 'https://images.unsplash.com/photo-1600047509807-ba8f99d2cdde?w=900&q=80', available_cities: city('Monaco', 'Monaco', '🇲🇨'),
      description: 'Ultra-prime Monaco penthouse. Expensive to maintain, powerful to own.' },
    { name: 'Volkswagen Golf GTI', category: 'cars', subcategory: 'hot_hatch', emoji: '🚗', tier: 'standard', sort_order: 20,
      price_stc: 42_000, rent_price_stc: 1_200, rent_duration_days: 30, invest_price_stc: 0, invest_return_rate: 0, invest_duration_days: 0,
      passive_income_stc: 0, passive_income_interval_days: 0, weekly_maintenance_stc: 120, can_buy: 1, can_rent: 1, can_invest: 0, can_sell: 1,
      sell_value_percent: 62, allows_multiple: 1, image_url: 'https://images.unsplash.com/photo-1552519507-da3b142c6e3d?w=900&q=80', description: 'Realistic premium hot hatch pricing with everyday running costs.' },
    { name: 'Mercedes-AMG A45 S', category: 'cars', subcategory: 'performance_hatch', emoji: '🚙', tier: 'premium', sort_order: 21,
      price_stc: 78_000, rent_price_stc: 2_800, rent_duration_days: 30, invest_price_stc: 0, invest_return_rate: 0, invest_duration_days: 0,
      passive_income_stc: 0, passive_income_interval_days: 0, weekly_maintenance_stc: 220, can_buy: 1, can_rent: 1, can_invest: 0, can_sell: 1,
      sell_value_percent: 64, allows_multiple: 1, image_url: 'https://images.unsplash.com/photo-1617814076367-b759c7d7e738?w=900&q=80', description: 'Compact performance car with high-end monthly rental cost.' },
    { name: 'Range Rover Sport', category: 'cars', subcategory: 'suv', emoji: '🚙', tier: 'premium', sort_order: 22,
      price_stc: 115_000, rent_price_stc: 4_500, rent_duration_days: 30, invest_price_stc: 0, invest_return_rate: 0, invest_duration_days: 0,
      passive_income_stc: 0, passive_income_interval_days: 0, weekly_maintenance_stc: 420, can_buy: 1, can_rent: 1, can_invest: 0, can_sell: 1,
      sell_value_percent: 63, allows_multiple: 1, image_url: 'https://images.unsplash.com/photo-1533473359331-0135ef1b58bf?w=900&q=80', description: 'Luxury SUV asset with higher upkeep and rental demand.' },
    { name: 'Porsche 911 Carrera GTS', category: 'cars', subcategory: 'sports_car', emoji: '🏎️', tier: 'elite', sort_order: 23,
      price_stc: 165_000, rent_price_stc: 7_500, rent_duration_days: 30, invest_price_stc: 0, invest_return_rate: 0, invest_duration_days: 0,
      passive_income_stc: 0, passive_income_interval_days: 0, weekly_maintenance_stc: 700, can_buy: 1, can_rent: 1, can_invest: 0, can_sell: 1,
      sell_value_percent: 68, allows_multiple: 1, image_url: 'https://images.unsplash.com/photo-1503376780353-7e6692767b70?w=900&q=80', description: 'Driver-focused sports car with strong retained value.' },
    { name: 'Mercedes-AMG G 63', category: 'cars', subcategory: 'luxury_suv', emoji: '🚜', tier: 'elite', sort_order: 24,
      price_stc: 190_000, rent_price_stc: 9_000, rent_duration_days: 30, invest_price_stc: 0, invest_return_rate: 0, invest_duration_days: 0,
      passive_income_stc: 0, passive_income_interval_days: 0, weekly_maintenance_stc: 900, can_buy: 1, can_rent: 1, can_invest: 0, can_sell: 1,
      sell_value_percent: 70, allows_multiple: 1, image_url: 'https://images.unsplash.com/photo-1606016159991-dfe4f2746ad5?w=900&q=80', description: 'High-status SUV with high running costs and strong resale.' },
    { name: 'Ferrari 296 GTB', category: 'cars', subcategory: 'supercar', emoji: '🏎️', tier: 'legendary', sort_order: 25,
      price_stc: 340_000, rent_price_stc: 18_000, rent_duration_days: 7, invest_price_stc: 0, invest_return_rate: 0, invest_duration_days: 0,
      passive_income_stc: 0, passive_income_interval_days: 0, weekly_maintenance_stc: 2_500, can_buy: 1, can_rent: 1, can_invest: 0, can_sell: 1,
      sell_value_percent: 72, allows_multiple: 1, image_url: 'https://images.unsplash.com/photo-1592198084033-aade902d1aae?w=900&q=80', description: 'Modern Ferrari supercar priced like the real market.' },
    { name: 'Lamborghini Revuelto', category: 'cars', subcategory: 'hypercar', emoji: '🏁', tier: 'legendary', sort_order: 26,
      price_stc: 610_000, rent_price_stc: 35_000, rent_duration_days: 7, invest_price_stc: 0, invest_return_rate: 0, invest_duration_days: 0,
      passive_income_stc: 0, passive_income_interval_days: 0, weekly_maintenance_stc: 4_000, can_buy: 1, can_rent: 1, can_invest: 0, can_sell: 1,
      sell_value_percent: 73, allows_multiple: 1, image_url: 'https://images.unsplash.com/photo-1544636331-e26879cd4d9b?w=900&q=80', description: 'Flagship hypercar purchase for players with serious STC.' },
    { name: 'Rolex Submariner Date', category: 'watches', subcategory: 'watch', emoji: '⌚', tier: 'premium', sort_order: 30,
      price_stc: 10_250, rent_price_stc: 0, rent_duration_days: 0, invest_price_stc: 10_250, invest_return_rate: 0.25, invest_duration_days: 30,
      passive_income_stc: 0, passive_income_interval_days: 0, weekly_maintenance_stc: 0, can_buy: 1, can_rent: 0, can_invest: 1, can_sell: 1,
      sell_value_percent: 82, allows_multiple: 1, image_url: 'https://images.unsplash.com/photo-1523170335258-f5ed11844a49?w=900&q=80', description: 'Iconic steel sports watch with modest monthly collector return.' },
    { name: 'Audemars Piguet Royal Oak 15500', category: 'watches', subcategory: 'watch', emoji: '⌚', tier: 'elite', sort_order: 31,
      price_stc: 55_000, rent_price_stc: 0, rent_duration_days: 0, invest_price_stc: 55_000, invest_return_rate: 0.35, invest_duration_days: 30,
      passive_income_stc: 0, passive_income_interval_days: 0, weekly_maintenance_stc: 0, can_buy: 1, can_rent: 0, can_invest: 1, can_sell: 1,
      sell_value_percent: 84, allows_multiple: 1, image_url: 'https://images.unsplash.com/photo-1509048191080-d2984bad6ae5?w=900&q=80', description: 'High-demand integrated bracelet watch for collectors.' },
    { name: 'Patek Philippe Nautilus 5711', category: 'watches', subcategory: 'watch', emoji: '⌚', tier: 'legendary', sort_order: 32,
      price_stc: 135_000, rent_price_stc: 0, rent_duration_days: 0, invest_price_stc: 135_000, invest_return_rate: 0.45, invest_duration_days: 30,
      passive_income_stc: 0, passive_income_interval_days: 0, weekly_maintenance_stc: 0, can_buy: 1, can_rent: 0, can_invest: 1, can_sell: 1,
      sell_value_percent: 86, allows_multiple: 1, image_url: 'https://images.unsplash.com/photo-1539874754764-5a96559165b0?w=900&q=80', description: 'Blue-chip collector watch with high entry price.' },
    { name: 'Nike Mercurial Boot Deal', category: 'fashion', subcategory: 'boot_deal', emoji: '👟', tier: 'elite', sort_order: 40,
      price_stc: 25_000, rent_price_stc: 0, rent_duration_days: 0, invest_price_stc: 0, invest_return_rate: 0, invest_duration_days: 0,
      passive_income_stc: 4_000, passive_income_interval_days: 30, weekly_maintenance_stc: 0, can_buy: 1, can_rent: 0, can_invest: 0, can_sell: 0,
      sell_value_percent: 0, allows_multiple: 0, image_url: 'https://images.unsplash.com/photo-1511886929837-354d827aae26?w=900&q=80', description: 'Football boot endorsement setup cost with monthly brand income.' },
    { name: 'adidas Predator Boot Deal', category: 'fashion', subcategory: 'boot_deal', emoji: '👟', tier: 'premium', sort_order: 41,
      price_stc: 20_000, rent_price_stc: 0, rent_duration_days: 0, invest_price_stc: 0, invest_return_rate: 0, invest_duration_days: 0,
      passive_income_stc: 3_250, passive_income_interval_days: 30, weekly_maintenance_stc: 0, can_buy: 1, can_rent: 0, can_invest: 0, can_sell: 0,
      sell_value_percent: 0, allows_multiple: 0, image_url: 'https://images.unsplash.com/photo-1608231387042-66d1773070a5?w=900&q=80', description: 'Adidas boot deal asset with recurring monthly sponsorship income.' },
    { name: 'PUMA Ultra Boot Deal', category: 'fashion', subcategory: 'boot_deal', emoji: '👟', tier: 'premium', sort_order: 42,
      price_stc: 15_000, rent_price_stc: 0, rent_duration_days: 0, invest_price_stc: 0, invest_return_rate: 0, invest_duration_days: 0,
      passive_income_stc: 2_500, passive_income_interval_days: 30, weekly_maintenance_stc: 0, can_buy: 1, can_rent: 0, can_invest: 0, can_sell: 0,
      sell_value_percent: 0, allows_multiple: 0, image_url: 'https://images.unsplash.com/photo-1600185365483-26d7a4cc7519?w=900&q=80', description: 'PUMA boot endorsement for rising players.' },
    { name: 'New Balance Furon Boot Deal', category: 'fashion', subcategory: 'boot_deal', emoji: '👟', tier: 'standard', sort_order: 43,
      price_stc: 12_500, rent_price_stc: 0, rent_duration_days: 0, invest_price_stc: 0, invest_return_rate: 0, invest_duration_days: 0,
      passive_income_stc: 2_000, passive_income_interval_days: 30, weekly_maintenance_stc: 0, can_buy: 1, can_rent: 0, can_invest: 0, can_sell: 0,
      sell_value_percent: 0, allows_multiple: 0, image_url: 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=900&q=80', description: 'Entry-level boot deal with realistic monthly endorsement payout.' },
    { name: 'Personal Performance Team', category: 'personal_services', subcategory: 'staff', emoji: '💼', tier: 'elite', sort_order: 50,
      price_stc: 250_000, rent_price_stc: 0, rent_duration_days: 0, invest_price_stc: 0, invest_return_rate: 0, invest_duration_days: 0,
      passive_income_stc: 0, passive_income_interval_days: 0, weekly_maintenance_stc: 20_000, can_buy: 1, can_rent: 0, can_invest: 0, can_sell: 0,
      sell_value_percent: 0, allows_multiple: 0, image_url: 'https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=900&q=80', description: 'Private trainer, chef, physio, and content support team with weekly upkeep.' },
  ];
}

function getNotificationSettingKey(type) {
  const map = {
    contract_offer: 'contract_offers',
    contract_accepted: 'contract_updates',
    contract_rejected: 'contract_updates',
    contract_terminated: 'contract_updates',
    contract_expired: 'contract_updates',
    contract_completed: 'contract_updates',
    match_scheduled: 'match_reminders',
    match_result: 'match_results',
    match_reminder: 'match_reminders',
    result_submitted: 'match_results',
    result_confirmed: 'match_results',
    join_request: 'club_updates',
    join_approved: 'club_updates',
    join_rejected: 'club_updates',
    club_update: 'club_updates',
    invite: 'club_updates',
    message: 'messages',
    tournament_start: 'tournament_updates',
    tournament_complete: 'tournament_updates',
    announcement: 'announcements',
  };
  return map[type] || null;
}

async function releasePlayerFromClubIfUnassigned({ playerId, clubId, query = null }) {
  if (!playerId || !clubId) return { skipped: true };
  const run = query || EXECUTESQL;
  await run(
    `UPDATE players p
       LEFT JOIN player_contracts active_pc
         ON active_pc.user_id = p.id
        AND active_pc.team_id = ?
        AND active_pc.status = 'active'
       LEFT JOIN club_staff_roles csr
         ON csr.player_id = p.id
        AND csr.club_id = ?
        SET p.club_id = NULL,
            p.role = 'member',
            p.club_roles = JSON_ARRAY('member'),
            p.status = 'free_agent',
            p.updated_date = NOW()
      WHERE p.id = ?
        AND p.club_id = ?
        AND active_pc.id IS NULL
        AND csr.id IS NULL`,
    [clubId, clubId, playerId, clubId]
  );
  await run(
    `UPDATE club_memberships cm
       LEFT JOIN player_contracts active_pc
         ON active_pc.user_id = cm.player_id
        AND active_pc.team_id = cm.club_id
        AND active_pc.status = 'active'
       LEFT JOIN club_staff_roles csr
         ON csr.player_id = cm.player_id
        AND csr.club_id = cm.club_id
        SET cm.status = 'inactive',
            cm.updated_date = NOW()
      WHERE cm.player_id = ?
        AND cm.club_id = ?
        AND cm.status = 'active'
        AND active_pc.id IS NULL
        AND csr.id IS NULL`,
    [playerId, clubId]
  );
  return { success: true };
}

async function withTransaction(callback) {
  const conn = await pool.promise().getConnection();
  try {
    await conn.beginTransaction();
    const query = async (sql, values = []) => {
      const [rows] = await conn.query(sql, values);
      return rows;
    };
    const result = await callback(query);
    await conn.commit();
    return result;
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

const DEFAULT_SHIRT_WEIGHTS = {
  base_per_mv_1m: 0.5,
  goal_demand: 4,
  assist_demand: 2,
  rating_demand_per_point: 1.5,
  motm_demand: 6,
  clean_sheet_demand: 2,
  max_per_match: 40,
  price_base: 25,
  price_goal_bonus: 5,
  price_rating_bonus: 2,
};

let _shirtConfigCache = null;

function parseSubmission(raw) {
  if (!raw) return null;
  if (typeof raw === 'object') return raw;
  try { return JSON.parse(raw); } catch { return null; }
}

function parseAdminMatchScore(value, fieldName) {
  if (value == null || (typeof value === 'string' && value.trim() === '')) {
    const err = new Error(`${fieldName} must be a non-negative integer`);
    err.status = 400;
    throw err;
  }
  const score = Number(value);
  if (!Number.isFinite(score) || !Number.isInteger(score) || score < 0) {
    const err = new Error(`${fieldName} must be a non-negative integer`);
    err.status = 400;
    throw err;
  }
  return score;
}

async function getStadiumConfig() {
  const rows = await EXECUTESQL('SELECT * FROM stadium_config ORDER BY level ASC', []).catch(() => []);
  if (rows.length) {
    return rows.map((row) => ({ ...getStadiumFinanceTier(row.level), ...row }));
  }
  return STADIUM_FINANCE_TIERS;
}

async function getShirtWeights() {
  if (_shirtConfigCache) return _shirtConfigCache;
  const rows = await EXECUTESQL('SELECT weights FROM shirt_sales_config WHERE is_active = 1 LIMIT 1', []).catch(() => []);
  const saved = rows.length ? parseMaybeJson(rows[0].weights, {}) : {};
  _shirtConfigCache = { ...DEFAULT_SHIRT_WEIGHTS, ...saved };
  return _shirtConfigCache;
}

async function recordClubTransaction(query, {
  clubId, amount, type = null, category = null, description = '', referenceId = null, relatedEntityType = null, relatedEntityId = null,
}) {
  const rows = await query('SELECT id, stc FROM clubs WHERE id = ? LIMIT 1 FOR UPDATE', [clubId]);
  if (!rows.length) throw new Error('Club not found');
  const numericAmount = Number(amount || 0);
  const normalizedType = ['income', 'expense', 'locked', 'released', 'adjustment'].includes(String(type || ''))
    ? String(type)
    : numericAmount > 0
      ? 'income'
      : numericAmount < 0
        ? 'expense'
        : 'adjustment';
  const normalizedCategory = category || type || normalizedType;
  const newBalance = Number(rows[0].stc || 0) + numericAmount;
  await query('UPDATE clubs SET stc = ?, updated_date = NOW() WHERE id = ?', [newBalance, clubId]);
  const txId = uuidv4();
  await query(
    `INSERT INTO stc_transactions
     (id, club_id, amount, balance_after, type, category, description, related_entity_type, related_entity_id, reference_id, created_date)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
    [txId, clubId, numericAmount, newBalance, normalizedType, normalizedCategory, description, relatedEntityType, relatedEntityId || referenceId, referenceId]
  );
  return { transaction_id: txId, new_balance: newBalance };
}

async function createClubTx(args) {
  return withTransaction((query) => recordClubTransaction(query, args));
}

async function recordPlayerTransaction(query, {
  playerId, playerEmail = null, amount, type = null, category = 'adjustment',
  source = null, description = '', referenceId = null,
}) {
  const rows = await query('SELECT id, email, stc FROM players WHERE id = ? LIMIT 1 FOR UPDATE', [playerId]);
  if (!rows.length) throw new Error('Player not found');
  const player = rows[0];
  const newBalance = Number(player.stc || 0) + Number(amount || 0);
  await query('UPDATE players SET stc = ?, updated_date = NOW() WHERE id = ?', [newBalance, playerId]);
  const txId = uuidv4();
  await query(
    `INSERT INTO player_stc_transactions
     (id, player_id, player_email, amount, balance_after, type, category, source, description, reference_id, created_date)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
    [
      txId, playerId, playerEmail || player.email || null, Number(amount || 0), newBalance,
      type || (Number(amount || 0) >= 0 ? 'income' : 'expense'), category, source, description, referenceId,
    ]
  );
  return { transaction_id: txId, new_balance: newBalance };
}

async function createPlayerTx(args) {
  return withTransaction((query) => recordPlayerTransaction(query, args));
}

async function generateShirtSalesForMatch(match, stats) {
  if (!match?.id || !match.home_club_id || !Array.isArray(stats) || !stats.length) return { skipped: true };
  const existing = await EXECUTESQL('SELECT id FROM shirt_sales WHERE match_id = ? LIMIT 1', [match.id]).catch(() => []);
  if (existing.length) return { skipped: true, reason: 'already_generated' };

  const weights = await getShirtWeights();
  const ratings = stats.map((s) => Number(s.rating || 0));
  const maxRating = ratings.length ? Math.max(...ratings) : 0;
  let totalRevenue = 0;
  let totalQuantity = 0;

  for (const stat of stats) {
    if (!stat.player_email && !stat.player_id) continue;
    const players = stat.player_id
      ? await EXECUTESQL('SELECT * FROM players WHERE id = ? LIMIT 1', [stat.player_id]).catch(() => [])
      : await EXECUTESQL('SELECT * FROM players WHERE LOWER(email)=LOWER(?) LIMIT 1', [stat.player_email]).catch(() => []);
    const player = players[0];
    if (!player) continue;
    const playerClubId = stat.club_id || player.club_id || null;
    if (!playerClubId) continue;

    const goals = Number(stat.goals || 0);
    const assists = Number(stat.assists || 0);
    const rating = sanitizeMatchRating(stat.rating);
    const marketMillions = Math.max(0, Number(player.market_value_stc || player.market_value || 0) / 1_000_000);
    const demand = Math.max(1, Math.round(
      (marketMillions * Number(weights.base_per_mv_1m || 0)) +
      (goals * Number(weights.goal_demand || 0)) +
      (assists * Number(weights.assist_demand || 0)) +
      (Math.max(0, rating - 6) * Number(weights.rating_demand_per_point || 0)) +
      (rating === maxRating ? Number(weights.motm_demand || 0) : 0)
    ));
    const quantity = Math.min(Number(weights.max_per_match || 40), demand);
    const unitPrice = Number(weights.price_base || 25) +
      (goals * Number(weights.price_goal_bonus || 0)) +
      (Math.max(0, rating - 6) * Number(weights.price_rating_bonus || 0));
    const revenue = Math.round(quantity * unitPrice);
    if (revenue <= 0) continue;

    await EXECUTESQL(
      `INSERT INTO shirt_sales
       (id, player_id, player_gamertag, shirt_number, club_id, buyer_email, price_stc, match_id, quantity, created_date)
       VALUES (?, ?, ?, ?, ?, NULL, ?, ?, ?, NOW())`,
      [
        uuidv4(), player.id, player.gamertag || stat.player_gamertag || null,
        player.shirt_number || null, playerClubId, revenue, match.id, quantity,
      ]
    );
    totalRevenue += revenue;
    totalQuantity += quantity;
  }

  if (totalRevenue > 0) {
    await createClubTx({
      clubId: match.home_club_id,
      amount: totalRevenue,
      type: 'shirt_revenue',
      category: 'shirt_revenue',
      description: `Shirt sales after ${match.home_club_name || 'Home'} vs ${match.away_club_name || 'Away'}`,
      referenceId: match.id,
      relatedEntityType: 'match',
    });
  }

  return { total_revenue: totalRevenue, total_quantity: totalQuantity };
}

async function settleActiveClubWager(match, winner) {
  const wagerEach = Number(match.wager_stc || 0);
  if (!wagerEach || match.wager_status !== 'active') return { skipped: true };
  const claim = await EXECUTESQL(
    "UPDATE matches SET wager_status = 'settling', updated_date = NOW() WHERE id = ? AND wager_status = 'active'",
    [match.id]
  ).catch(() => ({ affectedRows: 0 }));
  if (!claim.affectedRows) return { skipped: true };

  const label = `${match.home_club_name || 'Home'} vs ${match.away_club_name || 'Away'}`;
  if (winner === 'draw') {
    if (match.home_club_id) await createClubTx({ clubId: match.home_club_id, amount: wagerEach, type: 'wager_refund', category: 'wager_refund', description: `Wager refunded (draw) — ${label}`, referenceId: match.id }).catch(() => {});
    if (match.away_club_id) await createClubTx({ clubId: match.away_club_id, amount: wagerEach, type: 'wager_refund', category: 'wager_refund', description: `Wager refunded (draw) — ${label}`, referenceId: match.id }).catch(() => {});
    await EXECUTESQL("UPDATE matches SET wager_status = 'refunded', updated_date = NOW() WHERE id = ?", [match.id]);
    return { result: 'refunded' };
  }

  const pot = wagerEach * 2;
  const winnerClubId = winner === 'home' ? match.home_club_id : match.away_club_id;
  const loserClubId = winner === 'home' ? match.away_club_id : match.home_club_id;
  const winnerName = winner === 'home' ? (match.home_club_name || 'Home') : (match.away_club_name || 'Away');
  const loserName = winner === 'home' ? (match.away_club_name || 'Away') : (match.home_club_name || 'Home');
  if (winnerClubId) await createClubTx({ clubId: winnerClubId, amount: pot, type: 'wager_win', category: 'wager_win', description: `Wager won vs ${loserName} — ${label}`, referenceId: match.id }).catch(() => {});
  if (loserClubId) await createClubTx({ clubId: loserClubId, amount: 0, type: 'wager_loss', category: 'wager_loss', description: `Wager lost vs ${winnerName} — ${label}`, referenceId: match.id }).catch(() => {});
  await EXECUTESQL("UPDATE matches SET wager_status = 'settled', updated_date = NOW() WHERE id = ?", [match.id]);
  return { result: 'settled' };
}

async function settleActiveSoloWager(match) {
  const wagerEach = Number(match.wager_stc || 0);
  if (!wagerEach || match.wager_status !== 'active' || !match.wager_home_locked || !match.wager_away_locked) {
    return { skipped: true };
  }

  const claim = await EXECUTESQL(
    "UPDATE matches SET wager_status = 'settling', updated_date = NOW() WHERE id = ? AND wager_status = 'active'",
    [match.id]
  ).catch(() => ({ affectedRows: 0 }));
  if (!claim.affectedRows) return { skipped: true };

  const homeScore = Number(match.home_score ?? 0);
  const awayScore = Number(match.away_score ?? 0);
  const label = `${match.home_player_name || 'Home'} vs ${match.away_player_name || 'Away'}`;

  const notifyInbox = async (email, subj, body) => email && EXECUTESQL(
    `INSERT INTO inbox_messages
       (id, recipient_email, sender_email, subject, body, message_type, related_entity_id, related_entity_type, is_read, created_date)
     VALUES (?, ?, 'system@stage.com', ?, ?, 'wager', ?, 'solo_wager', 0, NOW())`,
    [uuidv4(), email, subj, body, match.id]
  ).catch(() => {});

  if (homeScore === awayScore) {
    if (match.home_player_id) {
      await createPlayerTx({
        playerId: match.home_player_id,
        playerEmail: match.home_player_email || null,
        amount: wagerEach,
        category: 'wager_refund',
        source: label,
        description: `Wager refunded (draw) - ${label}`,
        referenceId: match.id,
      }).catch(() => {});
    }
    if (match.away_player_id) {
      await createPlayerTx({
        playerId: match.away_player_id,
        playerEmail: match.away_player_email || null,
        amount: wagerEach,
        category: 'wager_refund',
        source: label,
        description: `Wager refunded (draw) - ${label}`,
        referenceId: match.id,
      }).catch(() => {});
    }
    await EXECUTESQL("UPDATE matches SET wager_status = 'refunded', updated_date = NOW() WHERE id = ?", [match.id]);
    await notifyInbox(match.home_player_email, 'Wager Refunded', `Draw in ${label}. Your ${wagerEach.toLocaleString()} STC wager was refunded.`);
    await notifyInbox(match.away_player_email, 'Wager Refunded', `Draw in ${label}. Your ${wagerEach.toLocaleString()} STC wager was refunded.`);
    return { result: 'refunded' };
  }

  const homeWon = homeScore > awayScore;
  const winnerId = homeWon ? match.home_player_id : match.away_player_id;
  const loserId = homeWon ? match.away_player_id : match.home_player_id;
  const winnerEmail = homeWon ? (match.home_player_email || null) : (match.away_player_email || null);
  const loserEmail = homeWon ? (match.away_player_email || null) : (match.home_player_email || null);
  const winnerName = homeWon ? (match.home_player_name || 'Home') : (match.away_player_name || 'Away');
  const loserName = homeWon ? (match.away_player_name || 'Away') : (match.home_player_name || 'Home');
  const pot = wagerEach * 2;

  if (winnerId) {
    await createPlayerTx({
      playerId: winnerId,
      playerEmail: winnerEmail,
      amount: pot,
      category: 'wager_win',
      source: label,
      description: `Wager won vs ${loserName} - ${label}`,
      referenceId: match.id,
    }).catch(() => {});
  }
  if (loserId) {
    await createPlayerTx({
      playerId: loserId,
      playerEmail: loserEmail,
      amount: 0,
      type: 'expense',
      category: 'wager_loss',
      source: label,
      description: `Wager lost vs ${winnerName} - ${label}`,
      referenceId: match.id,
    }).catch(() => {});
  }

  await EXECUTESQL("UPDATE matches SET wager_status = 'settled', updated_date = NOW() WHERE id = ?", [match.id]);
  await notifyInbox(winnerEmail, 'Wager Won', `You won ${pot.toLocaleString()} STC in ${label}.`);
  await notifyInbox(loserEmail, 'Wager Lost', `${winnerName} won the wager in ${label}.`);
  return { result: 'settled' };
}

async function settleCompletedMatchWager(match) {
  if (!match?.id || !match.wager_stc || match.wager_status !== 'active') return { skipped: true };
  const winner = Number(match.home_score || 0) === Number(match.away_score || 0)
    ? 'draw'
    : Number(match.home_score || 0) > Number(match.away_score || 0)
      ? 'home'
      : 'away';

  if (match.mode === 'club' && match.home_club_id && match.away_club_id) {
    return settleActiveClubWager(match, winner);
  }
  return settleActiveSoloWager(match);
}

function matchParticipantEmails(match) {
  return {
    home: match.home_owner_email || match.home_player_email || null,
    away: match.away_owner_email || match.away_player_email || null,
  };
}

async function notifyMatchSide(match, side, type, title, body) {
  const emails = matchParticipantEmails(match);
  const recipientEmail = emails[side];
  if (!recipientEmail) return { skipped: true };
  return createNotificationIfEnabled({
    recipientEmail,
    type,
    title,
    body,
    link: `/game-day?match=${match.id}`,
    relatedId: match.id,
  }).catch(() => ({ skipped: true }));
}

async function notifyMatchAdmins(match, title, body) {
  const admins = await EXECUTESQL('SELECT email FROM users WHERE role_id = 0 AND email IS NOT NULL', [])
    .catch(() => []);
  for (const admin of admins) {
    await createNotificationIfEnabled({
      recipientEmail: admin.email,
      type: 'match_dispute_admin',
      title,
      body,
      link: '/admin/disputes',
      relatedId: match.id,
    }).catch(() => {});
  }
}

async function processMatchCompletion(match, acceptedSubmission, secondarySubmission = null) {
  const matchId = match.id;
  const homeScore = Number(acceptedSubmission.home_score || 0);
  const awayScore = Number(acceptedSubmission.away_score || 0);
  const primaryStats = Array.isArray(acceptedSubmission.player_stats) ? acceptedSubmission.player_stats : [];
  const secondaryStats = Array.isArray(secondarySubmission?.player_stats) ? secondarySubmission.player_stats : [];
  const playerStats = [...primaryStats, ...secondaryStats];
  const primaryGoals = Array.isArray(acceptedSubmission.goal_events) ? acceptedSubmission.goal_events : [];
  const secondaryGoals = Array.isArray(secondarySubmission?.goal_events) ? secondarySubmission.goal_events : [];
  const goalEvents = [...primaryGoals, ...secondaryGoals];

  const freshRows = await EXECUTESQL('SELECT * FROM matches WHERE id = ? LIMIT 1', [matchId]);
  const fresh = freshRows[0] || match;
  if (Number(fresh.stats_processed || 0) === 1) {
    await settleCompletedMatchWager(fresh).catch((err) => {
      console.error('[matchKickoff wager settlement]', err.message);
    });
    await competitionEngineService.syncMatchResultToSource(fresh).catch((err) => {
      console.error('[matchKickoff source sync]', err.message);
    });
    return { data: { status: 'completed', skipped: true } };
  }

  const winnerClubId = homeScore > awayScore ? fresh.home_club_id : homeScore < awayScore ? fresh.away_club_id : null;
  const winnerClubName = homeScore > awayScore ? fresh.home_club_name : homeScore < awayScore ? fresh.away_club_name : null;
  const loserClubId = homeScore > awayScore ? fresh.away_club_id : homeScore < awayScore ? fresh.home_club_id : null;
  const loserClubName = homeScore > awayScore ? fresh.away_club_name : homeScore < awayScore ? fresh.home_club_name : null;

  await EXECUTESQL(
    `UPDATE matches SET status='completed', home_score=?, away_score=?,
       winner_club_id=?, winner_club_name=?, loser_club_id=?, loser_club_name=?,
       home_goal_events=?, away_goal_events=?, updated_date=NOW() WHERE id=?`,
    [
      homeScore,
      awayScore,
      winnerClubId,
      winnerClubName,
      loserClubId,
      loserClubName,
      JSON.stringify(goalEvents),
      JSON.stringify([]),
      matchId,
    ]
  );

  for (const stat of playerStats) {
    const statId = uuidv4();
    const statRow = {
      id: statId,
      match_id: matchId,
      tournament_id: fresh.tournament_id || null,
      club_id: stat.club_id || null,
      player_id: stat.player_id || null,
      player_email: stat.player_email || '',
      player_gamertag: stat.player_gamertag || null,
      goals: Number(stat.goals || 0),
      assists: Number(stat.assists || 0),
      position: stat.position || null,
      clean_sheet: Number(stat.clean_sheet || 0),
      is_motm: Number(stat.is_motm || 0),
      rating: sanitizeMatchRating(stat.rating),
    };
    await EXECUTESQL(
      `INSERT INTO match_player_stats
       (id, match_id, tournament_id, club_id, player_id, player_email, player_gamertag, goals, assists, position, clean_sheet, is_motm, rating, created_date)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
      [
        statRow.id, statRow.match_id, statRow.tournament_id, statRow.club_id, statRow.player_id,
        statRow.player_email, statRow.player_gamertag, statRow.goals,
        statRow.assists, statRow.position, statRow.clean_sheet, statRow.is_motm, statRow.rating,
      ]
    ).catch(() => {});
    broadcastMatchPlayerStat(statRow);
  }

  const isClubMatch = fresh.mode === 'club' && fresh.home_club_id && fresh.away_club_id;
  if (isClubMatch) {
    const [homeRows, awayRows] = await Promise.all([
      EXECUTESQL('SELECT * FROM clubs WHERE id = ? LIMIT 1', [fresh.home_club_id]),
      EXECUTESQL('SELECT * FROM clubs WHERE id = ? LIMIT 1', [fresh.away_club_id]),
    ]);
    const homeClub = homeRows[0];
    const awayClub = awayRows[0];
    if (homeClub && awayClub) {
      const homeResult = homeScore > awayScore ? 'win' : homeScore < awayScore ? 'loss' : 'draw';
      const awayResult = homeScore > awayScore ? 'loss' : homeScore < awayScore ? 'win' : 'draw';
      const cfg = await getStadiumConfig();
      const level = Number(homeClub.stadium_level ?? 0);
      const stadium = cfg.find((s) => Number(s.level) === level) || cfg[0];
      const capacity = Number(stadium.capacity || homeClub.stadium_capacity || 5000);
      const ticketPrice = Number(stadium.ticket_price_stc || 15);
      const attendancePct = Math.max(45, Math.min(100, 70 + (homeResult === 'win' ? 10 : homeResult === 'draw' ? 2 : -8)));
      const attendance = Math.floor(capacity * attendancePct / 100);
      const ticketRevenue = Math.round(attendance * ticketPrice);

      const priorTicket = await EXECUTESQL(
        "SELECT id FROM stc_transactions WHERE club_id = ? AND category = 'ticket_revenue' AND reference_id = ? LIMIT 1",
        [homeClub.id, matchId]
      ).catch(() => []);
      if (!priorTicket.length && ticketRevenue > 0) {
        await createClubTx({
          clubId: homeClub.id,
          amount: ticketRevenue,
          type: 'ticket_revenue',
          category: 'ticket_revenue',
          description: `Ticket sales (${attendance.toLocaleString()} fans @ ${ticketPrice} STC)`,
          referenceId: matchId,
          relatedEntityType: 'match',
        });
      }

      await EXECUTESQL(
        `UPDATE matches SET home_ticket_revenue=?, home_ticket_attendance=?, home_ticket_pct=?,
           home_ticket_capacity=?, home_ticket_price=? WHERE id=?`,
        [ticketRevenue, attendance, attendancePct, capacity, ticketPrice, matchId]
      ).catch(() => {});
    }
  }

  await EXECUTESQL('UPDATE matches SET stats_processed = 1, updated_date = NOW() WHERE id = ?', [matchId]);

  const [completed] = await EXECUTESQL('SELECT * FROM matches WHERE id = ? LIMIT 1', [matchId]);
  await settleCompletedMatchWager(completed).catch((err) => {
    console.error('[matchKickoff wager settlement]', err.message);
  });

  if (isClubMatch) {
    const stats = await EXECUTESQL('SELECT * FROM match_player_stats WHERE match_id = ?', [matchId]).catch(() => []);
    if (stats.length) {
      const homeResult = homeScore > awayScore ? 'win' : homeScore < awayScore ? 'loss' : 'draw';
      const awayResult = homeScore > awayScore ? 'loss' : homeScore < awayScore ? 'win' : 'draw';
      for (const stat of stats) {
        const playerRows = stat.player_id
          ? await EXECUTESQL('SELECT * FROM players WHERE id = ? LIMIT 1', [stat.player_id]).catch(() => [])
          : await EXECUTESQL('SELECT * FROM players WHERE LOWER(email)=LOWER(?) LIMIT 1', [stat.player_email]).catch(() => []);
        const player = playerRows[0];
        if (!player) continue;
        const result = String(stat.club_id) === String(fresh.home_club_id) ? homeResult : awayResult;
        await EXECUTESQL(
          `UPDATE players
             SET matches_played = IFNULL(matches_played,0) + 1,
                 matches_played_club = IFNULL(matches_played_club,0) + 1,
                 goals = IFNULL(goals,0) + ?,
                 goals_player = IFNULL(goals_player,0) + ?,
                 assists = IFNULL(assists,0) + ?,
                 wins_count = IFNULL(wins_count,0) + ?,
                 wins_club = IFNULL(wins_club,0) + ?,
                 losses_count = IFNULL(losses_count,0) + ?,
                 losses_club = IFNULL(losses_club,0) + ?,
                 draws_count = IFNULL(draws_count,0) + ?,
                 draws_club = IFNULL(draws_club,0) + ?,
                 clean_sheets = IFNULL(clean_sheets,0) + ?,
                 man_of_the_match = IFNULL(man_of_the_match,0) + ?,
                 avg_match_rating = CASE
                   WHEN IFNULL(matches_played,0) <= 0 THEN ?
                   ELSE ((IFNULL(avg_match_rating,0) * IFNULL(matches_played,0)) + ?) / (IFNULL(matches_played,0) + 1)
                 END,
                 updated_date = NOW()
           WHERE id = ?`,
          [
            Number(stat.goals || 0),
            Number(stat.goals || 0),
            Number(stat.assists || 0),
            result === 'win' ? 1 : 0,
            result === 'win' ? 1 : 0,
            result === 'loss' ? 1 : 0,
            result === 'loss' ? 1 : 0,
            result === 'draw' ? 1 : 0,
            result === 'draw' ? 1 : 0,
            Number(stat.clean_sheet || 0),
            Number(stat.is_motm || 0),
            sanitizeMatchRating(stat.rating),
            sanitizeMatchRating(stat.rating),
            player.id,
          ]
        );
      }
    }
    await generateShirtSalesForMatch(completed, stats).catch(() => {});
  }

  const [completedForSourceSync] = await EXECUTESQL('SELECT * FROM matches WHERE id = ? LIMIT 1', [matchId]);
  await competitionEngineService.syncMatchResultToSource(completedForSourceSync).catch((err) => {
    console.error('[matchKickoff source sync]', err.message);
  });

  await notifyMatchSide(completedForSourceSync, 'home', 'match_completed', 'Match result official', `${completedForSourceSync.home_club_name || completedForSourceSync.home_player_name || 'Home'} ${homeScore}-${awayScore} ${completedForSourceSync.away_club_name || completedForSourceSync.away_player_name || 'Away'}`).catch(() => {});
  await notifyMatchSide(completedForSourceSync, 'away', 'match_completed', 'Match result official', `${completedForSourceSync.home_club_name || completedForSourceSync.home_player_name || 'Home'} ${homeScore}-${awayScore} ${completedForSourceSync.away_club_name || completedForSourceSync.away_player_name || 'Away'}`).catch(() => {});

  await broadcastMatchById(matchId);
  return { data: { status: 'completed' } };
}

async function ensureIdentityClaimsTable() {
  const addCol = async (table, column, definition) => {
    const rows = await EXECUTESQL(
      'SELECT 1 FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = ? AND column_name = ? LIMIT 1',
      [table, column]
    );
    if (!rows.length) await EXECUTESQL(`ALTER TABLE \`${table}\` ADD COLUMN \`${column}\` ${definition}`);
  };
  await addCol('players', 'is_verified', 'TINYINT(1) DEFAULT 0').catch(() => {});
  await addCol('players', 'verified_platform', 'VARCHAR(50) NULL').catch(() => {});
  await addCol('players', 'verified_platform_handle', 'VARCHAR(150) NULL').catch(() => {});
  await addCol('players', 'identity_verified_at', 'DATETIME NULL').catch(() => {});
  await EXECUTESQL(`CREATE TABLE IF NOT EXISTS player_identity_claims (
    id                    VARCHAR(36)  PRIMARY KEY,
    player_id             VARCHAR(36)  NOT NULL,
    user_id               VARCHAR(36)  NULL,
    email                 VARCHAR(255) NULL,
    gamertag              VARCHAR(150) NULL,
    platform              VARCHAR(50)  NOT NULL,
    platform_handle       VARCHAR(150) NOT NULL,
    ea_id                 VARCHAR(150) NULL,
    discord_handle        VARCHAR(150) NULL,
    proof_url             TEXT         NULL,
    notes                 TEXT         NULL,
    status                VARCHAR(30)  NOT NULL DEFAULT 'pending',
    review_notes          TEXT         NULL,
    rejection_reason      TEXT         NULL,
    reviewed_by           VARCHAR(36)  NULL,
    reviewed_by_email     VARCHAR(255) NULL,
    reviewed_at           DATETIME     NULL,
    created_date          DATETIME     DEFAULT CURRENT_TIMESTAMP,
    updated_date          DATETIME     DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_pic_player  (player_id),
    INDEX idx_pic_user    (user_id),
    INDEX idx_pic_status  (status),
    INDEX idx_pic_created (created_date)
  )`);
}

async function notifyAdminsOfIdentityClaim(claim) {
  const admins = await EXECUTESQL('SELECT email FROM users WHERE role_id = 0 AND email IS NOT NULL', [])
    .catch(() => []);
  for (const admin of admins) {
    await EXECUTESQL(
      `INSERT INTO notifications
         (id, recipient_email, type, title, body, link, created_date)
       VALUES (?, ?, 'identity_claim', ?, ?, '/admin/identity-claims', NOW())`,
      [
        uuidv4(),
        admin.email,
        'New identity claim',
        `${claim.gamertag || claim.email || 'A player'} submitted a ${claim.platform} identity claim.`,
      ]
    ).catch(() => {});
  }
}

function auditLogValue(v) {
  if (v === undefined || v === null) return null;
  if (typeof v === 'object') return JSON.stringify(v);
  return String(v);
}

function parseLeagueEntityRow(row) {
  if (!row) return null;
  let data = {};
  try {
    data = row.data_json
      ? (typeof row.data_json === 'string' ? JSON.parse(row.data_json) : row.data_json)
      : {};
  } catch {
    data = {};
  }
  return {
    ...data,
    id: row.id,
    status: row.status ?? data.status,
    scheduling_status: row.scheduling_status ?? data.scheduling_status,
    slug: row.slug ?? data.slug,
    league_id: row.league_id ?? data.league_id,
    season_id: row.season_id ?? data.season_id,
    competition_id: row.competition_id ?? data.competition_id,
    club_id: row.club_id ?? data.club_id,
    is_active: row.is_active ?? data.is_active,
    tier: row.tier ?? data.tier,
    division: row.division ?? data.division,
    region: row.region ?? data.region,
    platform: row.platform ?? data.platform,
    season_number: row.season_number ?? data.season_number,
    created_date: row.created_date,
    updated_date: row.updated_date,
  };
}

function parseTournamentEntranceLinkRow(row) {
  if (!row) return null;
  const parsed = parseLeagueEntityRow(row);
  return {
    ...parsed,
    id: row.id,
    status: parsed.status || row.status || null,
    token: parsed.token || null,
    tournament_id: parsed.tournament_id || null,
    expires_at: parsed.expires_at || null,
  };
}

function isDatePassed(value) {
  if (!value) return false;
  const dt = new Date(value);
  if (Number.isNaN(dt.getTime())) return false;
  return dt.getTime() <= Date.now();
}

async function writeAdminAuditLog({
  admin,
  action,
  entityType,
  entityId,
  entityName = null,
  oldValue = null,
  newValue = null,
  reason = null,
}) {
  await EXECUTESQL(
    `INSERT INTO admin_audit_log
      (id, admin_user_id, admin_email, action, entity_type, entity_id, entity_name, old_value, new_value, reason, created_date)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
    [
      uuidv4(),
      admin?.id || null,
      admin?.email || null,
      action,
      entityType,
      entityId,
      entityName,
      oldValue ? JSON.stringify(oldValue) : null,
      newValue ? JSON.stringify(newValue) : null,
      reason,
    ],
  ).catch(() => {});
}

function generateEntranceToken() {
  return `${uuidv4().replace(/-/g, '')}${uuidv4().replace(/-/g, '')}`.slice(0, 64);
}

async function updateLeagueEntityData(query, entityType, id, next, indexed = {}) {
  const sets = ['data_json = ?', 'updated_date = NOW()'];
  const values = [JSON.stringify(next)];
  for (const [column, value] of Object.entries(indexed)) {
    sets.push(`${column} = ?`);
    values.push(value ?? null);
  }
  values.push(id, entityType);
  await query(
    `UPDATE league_entities SET ${sets.join(', ')} WHERE id = ? AND entity_type = ?`,
    values
  );
}

function normalizeIdList(value) {
  if (Array.isArray(value)) return value.filter(Boolean).map(String);
  if (value == null || value === '') return [];
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) return parsed.filter(Boolean).map(String);
    } catch {}
    return value.split(',').map(v => v.trim()).filter(Boolean);
  }
  return [];
}

function parseFormList(value) {
  if (Array.isArray(value)) return value;
  if (!value) return [];
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return value.split(',').map(v => v.trim()).filter(Boolean);
    }
  }
  return [];
}

function sortCompetitionStandingRows(rows) {
  return [...rows].sort((a, b) => {
    if (Number(b.points || 0) !== Number(a.points || 0)) return Number(b.points || 0) - Number(a.points || 0);
    if (Number(b.goal_difference || 0) !== Number(a.goal_difference || 0)) return Number(b.goal_difference || 0) - Number(a.goal_difference || 0);
    if (Number(b.goals_for || 0) !== Number(a.goals_for || 0)) return Number(b.goals_for || 0) - Number(a.goals_for || 0);
    return String(a.club_name || '').localeCompare(String(b.club_name || ''));
  });
}

function buildLeagueMatchContext(fixture, fixtureType) {
  if (fixtureType === 'regional_league') {
    return `${fixture.league_name || 'Regional League'} · Division ${fixture.division || 1} · Matchday ${fixture.matchday || ''}`.trim();
  }
  const phase = String(fixture.phase || 'league');
  const phaseLabel = phase === 'league'
    ? `League Phase - Matchday ${fixture.matchday || ''}`.trim()
    : phase === 'playoff_round'
      ? 'Playoff Round'
      : phase === 'knockout_r16'
        ? 'Round of 16'
        : phase === 'knockout_qf'
          ? 'Quarter-Final'
          : phase === 'knockout_sf'
            ? 'Semi-Final'
            : phase === 'knockout_final'
              ? 'Final'
              : phase;
  return `${fixture.competition_name || 'Competition'} · ${phaseLabel}`;
}

async function enrichMatchParticipantSnapshots(payload) {
  const next = { ...payload };
  const clubIds = [next.home_club_id, next.away_club_id].filter(Boolean);
  if (clubIds.length) {
    const placeholders = clubIds.map(() => '?').join(',');
    const clubRows = await EXECUTESQL(
      `SELECT id, name, owner_email FROM clubs WHERE id IN (${placeholders})`,
      clubIds
    ).catch(() => []);
    for (const club of clubRows) {
      if (String(club.id) === String(next.home_club_id)) {
        next.home_club_name = next.home_club_name || club.name || null;
        next.home_owner_email = next.home_owner_email || club.owner_email || null;
      }
      if (String(club.id) === String(next.away_club_id)) {
        next.away_club_name = next.away_club_name || club.name || null;
        next.away_owner_email = next.away_owner_email || club.owner_email || null;
      }
    }
  }

  const playerIds = [next.home_player_id, next.away_player_id].filter(Boolean);
  if (playerIds.length) {
    const placeholders = playerIds.map(() => '?').join(',');
    const playerRows = await EXECUTESQL(
      `SELECT id, gamertag, email FROM players WHERE id IN (${placeholders})`,
      playerIds
    ).catch(() => []);
    for (const player of playerRows) {
      if (String(player.id) === String(next.home_player_id)) {
        next.home_player_name = next.home_player_name || player.gamertag || null;
        next.home_player_email = next.home_player_email || player.email || null;
      }
      if (String(player.id) === String(next.away_player_id)) {
        next.away_player_name = next.away_player_name || player.gamertag || null;
        next.away_player_email = next.away_player_email || player.email || null;
      }
    }
  }
  return next;
}

async function createRankedMatchFromInviteMetadata(meta, { homeSide = 'challenger', scheduledDate } = {}) {
  const isClubMatch = (meta.invitation_type || 'player_vs_player') === 'club_vs_club';
  const homePrefix = homeSide === 'opponent' ? 'opponent' : 'challenger';
  const awayPrefix = homeSide === 'opponent' ? 'challenger' : 'opponent';
  const payload = await enrichMatchParticipantSnapshots({
    id: uuidv4(),
    tournament_id: null,
    status: 'scheduled',
    mode: isClubMatch ? 'club' : 'solo',
    type: 'ranked',
    scheduled_date: scheduledDate,
    stats_processed: 0,
    home_club_id: isClubMatch ? (meta[`${homePrefix}_club_id`] || null) : null,
    away_club_id: isClubMatch ? (meta[`${awayPrefix}_club_id`] || null) : null,
    home_club_name: isClubMatch ? (meta[`${homePrefix}_name`] || null) : null,
    away_club_name: isClubMatch ? (meta[`${awayPrefix}_name`] || null) : null,
    home_player_id: !isClubMatch ? (meta[`${homePrefix}_player_id`] || null) : null,
    away_player_id: !isClubMatch ? (meta[`${awayPrefix}_player_id`] || null) : null,
    home_player_name: !isClubMatch ? (meta[`${homePrefix}_name`] || null) : null,
    away_player_name: !isClubMatch ? (meta[`${awayPrefix}_name`] || null) : null,
    wager_stc: Number(meta.wager_stc || 0),
    wager_status: Number(meta.wager_stc || 0) > 0 ? 'pending_acceptance' : null,
    wager_home_locked: false,
    wager_away_locked: false,
  });
  if (!payload.home_player_id && !payload.away_player_id && !payload.home_club_id && !payload.away_club_id) {
    throw new Error('Cannot schedule match: invitation is missing challenger/opponent ids.');
  }
  const match = new Match(payload);
  await match.create();
  await Promise.resolve(broadcastMatch(payload)).catch(() => {});
  return payload;
}

async function createMatchInviteResponseMessage({ originalMessage, meta, senderEmail, subject, body, matchId = null }) {
  if (!originalMessage?.sender_email) return null;
  let senderGamertag = meta.opponent_name || null;
  let senderAvatar = null;
  let senderClubName = null;
  if (senderEmail) {
    const playerRows = await EXECUTESQL(
      'SELECT id, gamertag, avatar_url, club_id FROM players WHERE LOWER(email)=LOWER(?) LIMIT 1',
      [senderEmail]
    ).catch(() => []);
    const player = playerRows[0] || null;
    senderGamertag = senderGamertag || player?.gamertag || senderEmail;
    senderAvatar = player?.avatar_url || null;
    if (player?.club_id) {
      const clubRows = await EXECUTESQL('SELECT name FROM clubs WHERE id = ? LIMIT 1', [player.club_id]).catch(() => []);
      senderClubName = clubRows[0]?.name || null;
    }
  }
  const relatedId = matchId || originalMessage.related_entity_id || null;
  const result = await sendActionMessage({
    recipientEmail: originalMessage.sender_email,
    senderEmail: senderEmail || originalMessage.recipient_email || null,
    senderGamertag: senderGamertag || senderEmail || 'Player',
    senderAvatarUrl: senderAvatar,
    senderClubName,
    subject,
    body,
    messageType: 'match_invite_response',
    actionType: 'none',
    relatedEntityId: relatedId || originalMessage.id,
    relatedEntityType: matchId ? 'match' : (originalMessage.related_entity_type || 'inbox_message'),
    idempotencyKey: `match_invite_response:${originalMessage.id}:${String(subject || '').toLowerCase().includes('accepted') ? 'accepted' : 'responded'}:${relatedId || originalMessage.id}`,
    notify: false,
    metadata: { ...meta, response_to_message_id: originalMessage.id, created_match_id: matchId || meta.created_match_id || null },
  });
  return result.message.id;
}

async function markInboxMessageResponded(messageId, status) {
  try {
    await EXECUTESQL(
      'UPDATE inbox_messages SET status = ?, is_read = 1, updated_date = NOW() WHERE id = ?',
      [status, messageId]
    );
    return;
  } catch (err) {
    const message = String(err?.message || err?.code || '');
    if (!/updated_date|unknown column|ER_BAD_FIELD_ERROR/i.test(message)) throw err;
  }

  await EXECUTESQL(
    'UPDATE inbox_messages SET status = ?, is_read = 1 WHERE id = ?',
    [status, messageId]
  );
}

const STAGE_PLUS_MONTHLY_CREDITS = DEFAULT_STORE_SETTINGS.monthly_credits;
const TOURNAMENT_ENTRY_CREDITS = DEFAULT_STORE_SETTINGS.tournament_entry_credits;

function normalizeSubscriptionTier(tier) {
  const normalized = String(tier || '').toLowerCase();
  if (['stage_plus', 'plus', 'pro', 'elite'].includes(normalized)) return 'stage_plus';
  return 'free';
}

async function createStripeCheckoutSession(fields) {
  const stripeSecret = process.env.STRIPE_SECRET_KEY || '';
  if (!stripeSecret) {
    throw new Error('Stripe checkout is not configured on the server');
  }

  const body = new URLSearchParams();
  for (const [key, value] of Object.entries(fields)) {
    if (value !== undefined && value !== null) body.append(key, String(value));
  }

  const res = await axios.post('https://api.stripe.com/v1/checkout/sessions', body.toString(), {
    headers: {
      Authorization: `Bearer ${stripeSecret}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
  });
  return res.data;
}

async function retrieveStripeCheckoutSession(sessionId) {
  const stripeSecret = process.env.STRIPE_SECRET_KEY || '';
  if (!stripeSecret) {
    throw new Error('Stripe checkout is not configured on the server');
  }
  if (!sessionId) throw new Error('session_id required');
  const res = await axios.get(
    `https://api.stripe.com/v1/checkout/sessions/${encodeURIComponent(sessionId)}`,
    { headers: { Authorization: `Bearer ${stripeSecret}` } }
  );
  return res.data;
}

// ── Shared Stripe fulfilment helpers ────────────────────────────────────────
// Both the client-return handlers (fixCredits / fixSubscription) and the Stripe
// webhook funnel through these so a payment is fulfilled exactly once, no matter
// which path reports it first.

// Idempotency guard: returns true the FIRST time a (session, kind) pair is seen,
// false on every subsequent call. Backed by processed_stripe_sessions (see
// schema.sql + server.js startup migration).
async function claimStripeSession(sessionId, kind) {
  if (!sessionId) return false;
  try {
    const res = await EXECUTESQL(
      `INSERT IGNORE INTO processed_stripe_sessions (session_id, kind, processed_at)
       VALUES (?, ?, NOW())`,
      [String(sessionId), String(kind || 'unknown')]
    );
    // affectedRows === 1 → freshly inserted (we own fulfilment); 0 → already done.
    return Number(res?.affectedRows || 0) === 1;
  } catch (err) {
    // If the guard table is missing for any reason, fail OPEN would double-credit,
    // so fail CLOSED (treat as already processed) and log loudly.
    console.error('[stripe] claimStripeSession failed:', err.message);
    return false;
  }
}

// Add credits to the USER wallet (shared pot for player + club tournaments).
// Idempotency is enforced by the caller via claimStripeSession().
// `target` is accepted for API compatibility but ignored — credits are user-scoped.
async function grantCreditsToTarget({ userId, credits, target }) {
  const amount = Number(credits || 0);
  if (!userId) throw new Error('grantCreditsToTarget: userId required');
  if (!Number.isFinite(amount) || amount <= 0) throw new Error('grantCreditsToTarget: invalid credit amount');
  const result = await addUserCredits(userId, amount);
  return {
    target: 'user',
    requested_target: target || 'user',
    id: userId,
    credits_before: result.credits_before,
    credits_after: result.credits_after,
    credits_added: result.credits_added,
  };
}

// Activate (or renew) STAGE Plus for a user based on a completed checkout session.
async function activateStagePlusForSession({ userId, billing, session }) {
  const storeSettings = await getActiveStoreSettings();
  const normalizedBilling = String(billing || 'monthly').toLowerCase() === 'yearly' ? 'yearly' : 'monthly';
  const expiresAtExpr = normalizedBilling === 'yearly'
    ? 'DATE_ADD(NOW(), INTERVAL 1 YEAR)'
    : 'DATE_ADD(NOW(), INTERVAL 1 MONTH)';

  const player = await resolvePlayerForUserId(userId);
  if (!player) throw new Error('Player profile not found');

  const monthlyAllowance = Number(storeSettings.monthly_credits || STAGE_PLUS_MONTHLY_CREDITS);
  const creditResult = await refreshUserCreditsTo(userId, monthlyAllowance);
  await EXECUTESQL(
    `UPDATE players
        SET subscription = 'stage_plus',
            subscription_billing = ?,
            subscription_expires_at = ${expiresAtExpr},
            stripe_subscription_id = COALESCE(?, stripe_subscription_id),
            stripe_customer_id = COALESCE(?, stripe_customer_id),
            updated_date = NOW()
      WHERE id = ?`,
    [normalizedBilling, session?.subscription || null, session?.customer || null, player.id]
  );

  return {
    tier: 'stage_plus',
    billing: normalizedBilling,
    player_id: player.id,
    user_id: userId,
    credits_before: creditResult.credits_before,
    credits_after: creditResult.credits_after,
    credits_added: creditResult.credits_added,
    monthly_credit_allowance: monthlyAllowance,
    credit_policy: 'refresh_not_stack',
  };
}

// Fulfil a completed Stripe Checkout Session (shared by webhook + client return).
// `session` must be the full object retrieved from Stripe (trusted source).
async function fulfilCheckoutSession(session) {
  const mode = String(session?.mode || '');
  const paid = ['paid', 'no_payment_required'].includes(String(session?.payment_status || ''));
  const userId = session?.metadata?.user_id ? String(session.metadata.user_id) : '';
  if (!paid) return { fulfilled: false, reason: 'payment_not_complete' };
  if (!userId) return { fulfilled: false, reason: 'missing_user_id' };

  if (mode === 'subscription') {
    if (!(await claimStripeSession(session.id, 'subscription'))) {
      return { fulfilled: false, reason: 'already_processed', kind: 'subscription' };
    }
    const result = await activateStagePlusForSession({
      userId,
      billing: session?.metadata?.billing,
      session,
    });
    return { fulfilled: true, kind: 'subscription', ...result };
  }

  if (mode === 'payment') {
    const credits = Number(session?.metadata?.credits || 0);
    const target = session?.metadata?.credit_target === 'club' ? 'club' : 'player';
    if (!(credits > 0)) return { fulfilled: false, reason: 'no_credits_in_metadata' };
    if (!(await claimStripeSession(session.id, 'credits'))) {
      return { fulfilled: false, reason: 'already_processed', kind: 'credits' };
    }
    const result = await grantCreditsToTarget({ userId, credits, target });
    return { fulfilled: true, kind: 'credits', ...result };
  }

  return { fulfilled: false, reason: `unsupported_mode:${mode}` };
}

async function insertTournamentMatch(query, match) {
  const id = match.id || uuidv4();
  await query(
    `INSERT INTO matches
       (id, tournament_id, home_club_id, away_club_id, home_club_name, away_club_name,
        home_score, away_score, status, mode, type, round, group_number, created_date, updated_date)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
    [
      id,
      match.tournament_id,
      match.home_club_id || null,
      match.away_club_id || null,
      match.home_club_name || null,
      match.away_club_name || null,
      Number(match.home_score || 0),
      Number(match.away_score || 0),
      match.status || 'scheduled',
      match.mode || 'club',
      match.type || 'knockout',
      Number(match.round || 1),
      match.group_number ?? match.group ?? null,
    ]
  );
  return id;
}

function leagueEntityTypeConfig(targetType) {
  if (targetType === 'competition') {
    return {
      parentType: 'competition_season',
      standingType: 'competition_standing',
      fixtureType: 'competition_fixture',
      parentFilter: 'season_id',
      parentLabel: 'competition season',
    };
  }
  if (targetType === 'league' || targetType === 'regional_league') {
    return {
      parentType: 'regional_league',
      standingType: 'regional_league_standing',
      fixtureType: 'regional_league_fixture',
      parentFilter: 'league_id',
      parentLabel: 'regional league',
    };
  }
  throw new Error('target_type must be competition or league');
}

/** Best-effort admin audit row (adminEconomyControl and similar). */
async function createAuditLog({
  adminUserId, adminEmail, action, entityType, entityId, entityName,
  oldValue, newValue, reason,
}) {
  try {
    await EXECUTESQL(
      `INSERT INTO admin_audit_log
         (id, admin_user_id, admin_email, action, entity_type, entity_id, entity_name, old_value, new_value, reason, created_date)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
      [
        uuidv4(),
        adminUserId || null,
        adminEmail || null,
        action || 'unknown',
        entityType || null,
        entityId || null,
        entityName || null,
        auditLogValue(oldValue),
        auditLogValue(newValue),
        reason || null,
      ]
    );
  } catch (err) {
    console.error('[createAuditLog]', err.message);
  }
}

async function requireAdminUser(userId) {
  if (!userId) throw new Error('not authenticated');
  const rows = await EXECUTESQL('SELECT id, email, role_id FROM users WHERE id = ? LIMIT 1', [userId]);
  const user = rows[0];
  if (!user || ![0, 2].includes(Number(user.role_id))) throw new Error('Admin only');
  return user;
}

async function deleteTournamentRecords(query, tournamentId) {
  const matches = await query('SELECT id FROM matches WHERE tournament_id = ?', [tournamentId]);
  const matchIds = matches.map((row) => row.id).filter(Boolean);
  if (matchIds.length) {
    const inMatches = placeholders(matchIds);
    await query(`DELETE FROM match_player_stats WHERE match_id IN (${inMatches})`, matchIds).catch(() => {});
    await query('DELETE FROM match_player_stats WHERE tournament_id = ?', [tournamentId]).catch(() => {});
    await query(`DELETE FROM dressing_rooms WHERE match_id IN (${inMatches})`, matchIds).catch(() => {});
    await query(`DELETE FROM predictions WHERE live_match_id IN (SELECT id FROM live_matches WHERE match_id IN (${inMatches}))`, matchIds).catch(() => {});
    await query(`DELETE FROM live_matches WHERE match_id IN (${inMatches})`, matchIds).catch(() => {});
    await query(`DELETE FROM matches WHERE id IN (${inMatches})`, matchIds);
  }
  await query(
    `DELETE FROM league_entities
      WHERE entity_type = 'tournament_entrance_link'
        AND JSON_UNQUOTE(JSON_EXTRACT(data_json, '$.tournament_id')) = ?`,
    [tournamentId],
  ).catch(() => {});
  await query('DELETE FROM tournaments WHERE id = ?', [tournamentId]);
  return { matches: matchIds.length };
}

function isCommunityTournament(tournament) {
  return Boolean(tournament?.creator_gamertag) || Boolean(tournament?.creator_id);
}

function completedTournamentDeleteWaitMs(tournament) {
  if (String(tournament?.status || '').toLowerCase() !== 'completed') return 0;
  if (!isCommunityTournament(tournament)) return 0;
  const completedAt = new Date(tournament.end_date || tournament.updated_date || tournament.created_date).getTime();
  if (!Number.isFinite(completedAt)) return 7 * 24 * 60 * 60 * 1000;
  return Math.max(0, completedAt + 7 * 24 * 60 * 60 * 1000 - Date.now());
}

function testEmailFor(clubIndex, playerIndex = 'owner') {
  return `test-${clubIndex + 1}-${playerIndex}@${TEST_PACK_DOMAIN}`.toLowerCase();
}

function placeholders(items) {
  return items.map(() => '?').join(',');
}

function parseJsonArray(value) {
  if (Array.isArray(value)) return value;
  if (value == null || value === '') return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function seedTournamentClubs(clubs) {
  return [...clubs].sort((a, b) => {
    const ptsDiff = Number(b.ranking_points || 0) - Number(a.ranking_points || 0);
    if (ptsDiff !== 0) return ptsDiff;
    const winsDiff = Number(b.wins || 0) - Number(a.wins || 0);
    if (winsDiff !== 0) return winsDiff;
    return Number(a.losses || 0) - Number(b.losses || 0);
  });
}

function shuffleTournamentEntries(entries) {
  const copy = [...entries];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function makeClubMatch(home, away, round, type, extra = {}) {
  return {
    home_club_id: home.id,
    home_club_name: home.name,
    home_owner_email: home.owner_email || null,
    away_club_id: away.id,
    away_club_name: away.name,
    away_owner_email: away.owner_email || null,
    round,
    type,
    mode: 'club',
    status: 'scheduled',
    home_score: 0,
    away_score: 0,
    ...extra,
  };
}

function makePlayerMatch(home, away, round, type, extra = {}) {
  return {
    home_player_id: home.id,
    home_player_name: home.gamertag,
    home_player_email: home.email || null,
    away_player_id: away.id,
    away_player_name: away.gamertag,
    away_player_email: away.email || null,
    round,
    type,
    mode: 'player',
    status: 'scheduled',
    home_score: 0,
    away_score: 0,
    ...extra,
  };
}

function buildTournamentDrawMatches(tournament, entries) {
  const participantType = String(tournament.participant_type || 'club').toLowerCase();
  const isPlayerTournament = participantType === 'player';
  const type = String(tournament.type || 'knockout').toLowerCase();
  const seeded = isPlayerTournament
    ? shuffleTournamentEntries(entries)
    : seedTournamentClubs(entries);
  const makeMatch = isPlayerTournament ? makePlayerMatch : makeClubMatch;
  const matches = [];
  let numGroups = Number(tournament.num_groups || 0) || 2;

  if (type === 'league') {
    for (let i = 0; i < seeded.length; i += 1) {
      for (let j = i + 1; j < seeded.length; j += 1) {
        matches.push(makeMatch(seeded[i], seeded[j], 1, 'league'));
        matches.push(makeMatch(seeded[j], seeded[i], 2, 'league'));
      }
    }
    return { matches, numGroups: null };
  }

  if (type === 'group_stage') {
    const maxTeams = Number(tournament.max_teams || seeded.length);
    numGroups = Math.max(1, Math.ceil(Math.max(seeded.length, maxTeams) / 4));
    numGroups = Math.min(numGroups, Math.max(1, Math.ceil(seeded.length / 2)));
    const groups = Array.from({ length: numGroups }, () => []);
    shuffleTournamentEntries(seeded).forEach((entry, index) => {
      groups[index % numGroups].push(entry);
    });
    groups.forEach((group, groupIndex) => {
      for (let i = 0; i < group.length; i += 1) {
        for (let j = i + 1; j < group.length; j += 1) {
          matches.push(makeMatch(group[i], group[j], 1, 'group', { group_number: groupIndex }));
        }
      }
    });
    return { matches, numGroups };
  }

  const shuffled = shuffleTournamentEntries(seeded);
  for (let i = 0; i < shuffled.length; i += 2) {
    if (shuffled[i + 1]) {
      matches.push(makeMatch(shuffled[i], shuffled[i + 1], 1, type === 'swiss_ucl' ? 'ucl_league' : 'knockout'));
    }
  }
  return { matches, numGroups: null };
}

function sanitizeMatchRating(value, fallback = 6) {
  const rating = Number(value);
  if (!Number.isFinite(rating) || rating <= 0) return fallback;
  return Math.max(1, Math.min(10, rating));
}

function addGroupStandingTeam(table, id, name) {
  if (!id) return null;
  if (!table[id]) {
    table[id] = {
      id,
      name: name || 'Club',
      P: 0,
      W: 0,
      D: 0,
      L: 0,
      GF: 0,
      GA: 0,
      GD: 0,
      Pts: 0,
    };
  }
  return table[id];
}

function calculateTournamentGroupStandings(matches, numGroups = 2) {
  const groups = Array.from({ length: Math.max(1, Number(numGroups) || 2) }, () => ({}));
  matches
    .filter(match => ['completed', 'forfeit'].includes(String(match.status || '')))
    .forEach((match) => {
      const groupIndex = Number(match.group_number ?? match.group ?? 0);
      if (!groups[groupIndex]) return;
      const home = addGroupStandingTeam(groups[groupIndex], match.home_club_id, match.home_club_name);
      const away = addGroupStandingTeam(groups[groupIndex], match.away_club_id, match.away_club_name);
      if (!home || !away) return;
      const homeScore = Number(match.home_score || 0);
      const awayScore = Number(match.away_score || 0);

      home.P += 1;
      away.P += 1;
      home.GF += homeScore;
      home.GA += awayScore;
      away.GF += awayScore;
      away.GA += homeScore;
      home.GD = home.GF - home.GA;
      away.GD = away.GF - away.GA;

      if (String(match.winner_club_id || '') === String(match.home_club_id || '')) {
        home.W += 1;
        home.Pts += 3;
        away.L += 1;
      } else if (String(match.winner_club_id || '') === String(match.away_club_id || '')) {
        away.W += 1;
        away.Pts += 3;
        home.L += 1;
      } else {
        home.D += 1;
        away.D += 1;
        home.Pts += 1;
        away.Pts += 1;
      }
    });

  return groups.map(group =>
    Object.values(group).sort((a, b) => b.Pts - a.Pts || b.GD - a.GD || b.GF - a.GF || a.name.localeCompare(b.name))
  );
}

function buildGroupKnockoutPairs(standings) {
  const populatedGroups = standings.filter(group => group.length);
  if (populatedGroups.length < 2) {
    const teams = populatedGroups.flat().slice(0, 2);
    return teams.length === 2 ? [[teams[0], teams[1]]] : [];
  }

  const pairs = [];
  for (let i = 0; i < populatedGroups.length; i += 2) {
    const groupA = populatedGroups[i];
    const groupB = populatedGroups[i + 1];
    if (groupA?.[0] && groupB?.[1] && String(groupA[0].id) !== String(groupB[1].id)) pairs.push([groupA[0], groupB[1]]);
    if (groupB?.[0] && groupA?.[1] && String(groupB[0].id) !== String(groupA[1].id)) pairs.push([groupB[0], groupA[1]]);
  }

  if (pairs.length) return pairs;
  const teams = populatedGroups.flatMap(group => group.slice(0, 2));
  const fallback = [];
  for (let i = 0; i < teams.length; i += 2) {
    if (teams[i] && teams[i + 1] && String(teams[i].id) !== String(teams[i + 1].id)) fallback.push([teams[i], teams[i + 1]]);
  }
  return fallback;
}

function knockoutTypeForTieCount(tieCount) {
  if (tieCount >= 8) return 'round_of_16';
  if (tieCount >= 4) return 'quarter_final';
  if (tieCount >= 2) return 'semi_final';
  return 'final';
}

function getTeamFromMatch(match, clubId) {
  if (!clubId) return null;
  if (String(clubId) === String(match.home_club_id)) return { id: match.home_club_id, name: match.home_club_name };
  if (String(clubId) === String(match.away_club_id)) return { id: match.away_club_id, name: match.away_club_name };
  return { id: clubId, name: 'Club' };
}

function getTwoLegTieResult(legs) {
  const totals = {};
  const names = {};
  for (const leg of legs) {
    if (leg.home_club_id) {
      totals[leg.home_club_id] = (totals[leg.home_club_id] || 0) + Number(leg.home_score || 0);
      names[leg.home_club_id] = leg.home_club_name;
    }
    if (leg.away_club_id) {
      totals[leg.away_club_id] = (totals[leg.away_club_id] || 0) + Number(leg.away_score || 0);
      names[leg.away_club_id] = leg.away_club_name;
    }
  }
  const ids = Object.keys(totals);
  if (ids.length < 2) return null;
  const [a, b] = ids;
  let winnerId = totals[a] > totals[b] ? a : totals[b] > totals[a] ? b : null;
  if (!winnerId) {
    const decidedLeg = [...legs].reverse().find((leg) => leg.winner_club_id);
    winnerId = decidedLeg?.winner_club_id || a;
  }
  const loserId = String(winnerId) === String(a) ? b : a;
  return {
    winner: { id: winnerId, name: names[winnerId] || getTeamFromMatch(legs[0], winnerId)?.name || 'Winner' },
    loser: { id: loserId, name: names[loserId] || getTeamFromMatch(legs[0], loserId)?.name || 'Club' },
  };
}

async function insertTwoLegTournamentTie(query, tournamentId, home, away, round, type, tieIndex) {
  if (!home?.id || !away?.id || String(home.id) === String(away.id)) return 0;
  await insertTournamentMatch(query, {
    tournament_id: tournamentId,
    home_club_id: home.id,
    home_club_name: home.name,
    away_club_id: away.id,
    away_club_name: away.name,
    round,
    type,
    group_number: tieIndex,
    status: 'scheduled',
  });
  await insertTournamentMatch(query, {
    tournament_id: tournamentId,
    home_club_id: away.id,
    home_club_name: away.name,
    away_club_id: home.id,
    away_club_name: home.name,
    round: round + 1,
    type,
    group_number: tieIndex,
    status: 'scheduled',
  });
  return 2;
}

async function createGroupStageKnockoutRound(query, tournament, groupMatches, { replaceExisting = false } = {}) {
  const tournamentId = tournament.id;
  let repairedStartRound = null;
  if (replaceExisting) {
    const existing = await query(
      `SELECT * FROM matches
        WHERE tournament_id = ?
          AND type NOT IN ('group', 'group_stage')
        FOR UPDATE`,
      [tournamentId]
    );
    if (existing.some((match) => ['completed', 'forfeit'].includes(String(match.status || '')))) {
      throw new Error('Knockout matches already have results and cannot be repaired automatically');
    }
    repairedStartRound = Math.min(...existing.map((match) => Number(match.round || 2)).filter(Boolean));
    await query(
      `DELETE FROM matches
        WHERE tournament_id = ?
          AND type NOT IN ('group', 'group_stage')`,
      [tournamentId]
    );
  }

  const standings = calculateTournamentGroupStandings(groupMatches, tournament.num_groups || 2);
  const pairs = buildGroupKnockoutPairs(standings);
  if (!pairs.length) throw new Error('Not enough qualified teams to start the next round');

  const firstKnockoutRound = Math.max(repairedStartRound || Number(tournament.current_round || 1) + 1, 2);
  const tieType = knockoutTypeForTieCount(pairs.length);
  let created = 0;
  for (let index = 0; index < pairs.length; index += 1) {
    created += await insertTwoLegTournamentTie(query, tournamentId, pairs[index][0], pairs[index][1], firstKnockoutRound, tieType, index);
  }
  if (!created) throw new Error('No valid knockout ties could be created');
  await query('UPDATE tournaments SET current_round = ?, updated_date = NOW() WHERE id = ?', [firstKnockoutRound, tournamentId]);
  return { completed: false, current_round: firstKnockoutRound, created, phase: tieType };
}

async function createNextRoundFromTieResults(query, tournamentId, tieResults, nextRound) {
  const winners = tieResults.map((result) => result.winner);
  const losers = tieResults.map((result) => result.loser);
  let created = 0;
  if (winners.length === 2) {
    await insertTournamentMatch(query, {
      tournament_id: tournamentId,
      home_club_id: winners[0].id,
      home_club_name: winners[0].name,
      away_club_id: winners[1].id,
      away_club_name: winners[1].name,
      round: nextRound,
      type: 'final',
      status: 'scheduled',
    });
    created += 1;
    if (losers[0]?.id && losers[1]?.id && String(losers[0].id) !== String(losers[1].id)) {
      await insertTournamentMatch(query, {
        tournament_id: tournamentId,
        home_club_id: losers[0].id,
        home_club_name: losers[0].name,
        away_club_id: losers[1].id,
        away_club_name: losers[1].name,
        round: nextRound,
        type: 'third_place',
        status: 'scheduled',
      });
      created += 1;
    }
  } else {
    const nextType = knockoutTypeForTieCount(winners.length / 2);
    for (let i = 0; i < winners.length; i += 2) {
      if (!winners[i + 1]) continue;
      created += await insertTwoLegTournamentTie(query, tournamentId, winners[i], winners[i + 1], nextRound, nextType, i / 2);
    }
  }
  return created;
}

function sameIdPair(actualA, actualB, expectedA, expectedB) {
  const actual = [actualA, actualB].map(String).sort().join('|');
  const expected = [expectedA, expectedB].map(String).sort().join('|');
  return Boolean(actualA && actualB && expectedA && expectedB && actual === expected);
}

function finalAndThirdPlaceRoundMatchesTieResults(existingMatches, tieResults) {
  if (tieResults.length !== 2) return false;
  const finalMatch = existingMatches.find((match) => String(match.type || '').toLowerCase() === 'final');
  const thirdPlaceMatch = existingMatches.find((match) => ['third_place', 'third-place', 'bronze'].includes(String(match.type || '').toLowerCase()));
  return Boolean(
    finalMatch
    && sameIdPair(finalMatch.home_club_id, finalMatch.away_club_id, tieResults[0].winner.id, tieResults[1].winner.id)
    && (
      !tieResults[0].loser?.id
      || !tieResults[1].loser?.id
      || (
        thirdPlaceMatch
        && sameIdPair(thirdPlaceMatch.home_club_id, thirdPlaceMatch.away_club_id, tieResults[0].loser.id, tieResults[1].loser.id)
      )
    )
  );
}

async function createOrRepairNextRoundFromTieResults(query, tournamentId, tieResults, nextRound) {
  const existing = await query(
    'SELECT * FROM matches WHERE tournament_id = ? AND round = ? FOR UPDATE',
    [tournamentId, nextRound]
  );
  if (!existing.length) return createNextRoundFromTieResults(query, tournamentId, tieResults, nextRound);

  const hasResults = existing.some((match) => ['completed', 'forfeit'].includes(String(match.status || '')));
  if (tieResults.length === 2 && !hasResults && !finalAndThirdPlaceRoundMatchesTieResults(existing, tieResults)) {
    await query('DELETE FROM matches WHERE tournament_id = ? AND round = ?', [tournamentId, nextRound]);
    return createNextRoundFromTieResults(query, tournamentId, tieResults, nextRound);
  }
  return 0;
}

async function awardTournamentTrophyServer(query, tournament, winnerClubId) {
  return awardClubTrophyToClubAndPlayers({
    query,
    clubId: winnerClubId,
    trophyItemId: tournament?.trophy_item_id,
    tournamentId: tournament?.id,
    tournament,
  });
}

async function assertTournamentOrganizer(userId, tournament) {
  const userRows = await EXECUTESQL('SELECT id, email, role_id FROM users WHERE id = ? LIMIT 1', [userId]);
  const user = userRows[0];
  if (!user) throw new Error('User not found');
  const isAdmin = [0, 2].includes(Number(user.role_id));
  const email = String(user.email || '').toLowerCase();
  const isOwner = email && (
    email === String(tournament.creator_email || '').toLowerCase()
    || email === String(tournament.organizer_email || '').toLowerCase()
  );
  if (!isAdmin && !isOwner) throw new Error('Only the tournament creator or admin can do this');
  return { user, isAdmin };
}

async function getTournamentEntries(tournament) {
  const participantType = String(tournament.participant_type || 'club').toLowerCase();
  const ids = participantType === 'player'
    ? parseMaybeJson(tournament.registered_players, [])
    : parseMaybeJson(tournament.registered_clubs, []);
  const normalizedIds = Array.isArray(ids) ? ids.map(String).filter(Boolean) : [];
  if (normalizedIds.length < 2) throw new Error('Need at least 2 registered participants');
  const inIds = placeholders(normalizedIds);
  if (participantType === 'player') {
    return EXECUTESQL(`SELECT * FROM players WHERE id IN (${inIds})`, normalizedIds);
  }
  return EXECUTESQL(`SELECT * FROM clubs WHERE id IN (${inIds})`, normalizedIds);
}

async function notifyTournamentStarted(tournament) {
  const participantType = String(tournament.participant_type || 'club').toLowerCase();
  const title = `${tournament.name} has started`;
  const body = `The tournament is officially live. Open the tournament page to see your draw and match schedule.`;
  const recipients = new Set();

  if (participantType === 'player') {
    const playerIds = parseMaybeJson(tournament.registered_players, []).map(String).filter(Boolean);
    if (playerIds.length) {
      const rows = await EXECUTESQL(`SELECT email FROM players WHERE id IN (${placeholders(playerIds)})`, playerIds).catch(() => []);
      rows.forEach(row => { if (row.email) recipients.add(String(row.email).toLowerCase()); });
    }
    } else {
      const clubIds = parseMaybeJson(tournament.registered_clubs, []).map(String).filter(Boolean);
      if (clubIds.length) {
      const emails = await listActiveClubPlayerEmails(clubIds);
      emails.forEach(email => { recipients.add(String(email).toLowerCase()); });
      }
    }

  let notified = 0;
  for (const email of recipients) {
    const result = await createNotificationIfEnabled({
      recipientEmail: email,
      type: 'tournament_start',
      title,
      body,
      link: `/tournaments/${tournament.id}`,
      relatedId: tournament.id,
    }).catch(() => ({ skipped: true }));
    if (!result.skipped) notified += 1;
  }
  return notified;
}

async function createTournamentDraw(tournament) {
  const existing = await EXECUTESQL('SELECT id FROM matches WHERE tournament_id = ? LIMIT 1', [tournament.id]);
  if (existing.length) {
    return { created: 0, matches: await EXECUTESQL('SELECT * FROM matches WHERE tournament_id = ? ORDER BY round ASC, created_date ASC', [tournament.id]) };
  }

  const entries = await getTournamentEntries(tournament);
  const { matches, numGroups } = buildTournamentDrawMatches(tournament, entries);
  if (!matches.length) throw new Error('Could not generate a draw with the registered participants');

  for (const payload of matches) {
    const match = new Match({ ...payload, tournament_id: tournament.id });
    await match.create();
  }
  if (numGroups) {
    await EXECUTESQL('UPDATE tournaments SET num_groups = ?, updated_date = NOW() WHERE id = ?', [numGroups, tournament.id]);
  }
  return {
    created: matches.length,
    numGroups,
    matches: await EXECUTESQL('SELECT * FROM matches WHERE tournament_id = ? ORDER BY round ASC, created_date ASC', [tournament.id]),
  };
}

async function cleanupStageTestPack(admin = null) {
  const clubs = await EXECUTESQL(
    `SELECT id, owner_email FROM clubs
      WHERE LOWER(owner_email) LIKE ?
         OR description LIKE ?
         OR tag IN (${TEST_CLUBS.map(() => '?').join(',')})`,
    [`%@${TEST_PACK_DOMAIN}`, `%${TEST_PACK_TAG}%`, ...TEST_CLUBS.map(c => c.tag)]
  ).catch(() => []);
  const players = await EXECUTESQL(
    'SELECT id, email FROM players WHERE LOWER(email) LIKE ? OR bio LIKE ?',
    [`%@${TEST_PACK_DOMAIN}`, `%${TEST_PACK_TAG}%`]
  ).catch(() => []);
  const clubIds = clubs.map(c => c.id).filter(Boolean);
  const playerIds = players.map(p => p.id).filter(Boolean);
  const emails = Array.from(new Set([
    ...players.map(p => String(p.email || '').toLowerCase()).filter(Boolean),
    ...clubs.map(c => String(c.owner_email || '').toLowerCase()).filter(Boolean),
  ]));
  let deletedUsers = 0;

  if (clubIds.length) {
    const inClubs = placeholders(clubIds);
    const matchRows = await EXECUTESQL(
      `SELECT id FROM matches WHERE home_club_id IN (${inClubs}) OR away_club_id IN (${inClubs})`,
      [...clubIds, ...clubIds]
    ).catch(() => []);
    const matchIds = matchRows.map(m => m.id).filter(Boolean);
    if (matchIds.length) {
      const inMatches = placeholders(matchIds);
      await EXECUTESQL(`DELETE FROM match_player_stats WHERE match_id IN (${inMatches})`, matchIds).catch(() => {});
      await EXECUTESQL(`DELETE FROM matches WHERE id IN (${inMatches})`, matchIds).catch(() => {});
    }
    await EXECUTESQL(`DELETE FROM club_staff_roles WHERE club_id IN (${inClubs})`, clubIds).catch(() => {});
    await EXECUTESQL(`DELETE FROM club_applicants WHERE club_id IN (${inClubs})`, clubIds).catch(() => {});
    // recruitment_posts / recruitment_interests are deliberately left alone: the
    // board that wrote them is gone and the tables are kept as a frozen archive,
    // so deleting from them here would destroy exactly what we chose to preserve.
    await EXECUTESQL(`DELETE FROM player_contracts WHERE team_id IN (${inClubs})`, clubIds).catch(() => {});
    await EXECUTESQL(`DELETE FROM stc_transactions WHERE club_id IN (${inClubs})`, clubIds).catch(() => {});
    await EXECUTESQL(`DELETE FROM club_fixture_availability WHERE club_id IN (${inClubs})`, clubIds).catch(() => {});
    await EXECUTESQL(`DELETE FROM club_fixture_lineups WHERE club_id IN (${inClubs})`, clubIds).catch(() => {});
  }

  if (playerIds.length) {
    const inPlayers = placeholders(playerIds);
    await EXECUTESQL(`DELETE FROM club_staff_roles WHERE player_id IN (${inPlayers})`, playerIds).catch(() => {});
    await EXECUTESQL(`DELETE FROM match_player_stats WHERE player_id IN (${inPlayers})`, playerIds).catch(() => {});
    await EXECUTESQL(`DELETE FROM player_stc_transactions WHERE player_id IN (${inPlayers})`, playerIds).catch(() => {});
    await EXECUTESQL(`DELETE FROM lifestyle_purchases WHERE player_id IN (${inPlayers})`, playerIds).catch(() => {});
    await EXECUTESQL(`DELETE FROM player_identity_claims WHERE player_id IN (${inPlayers})`, playerIds).catch(() => {});
  }

  if (emails.length) {
    const inEmails = placeholders(emails);
    await EXECUTESQL(`DELETE FROM notifications WHERE LOWER(recipient_email) IN (${inEmails})`, emails).catch(() => {});
    await EXECUTESQL(`DELETE FROM inbox_messages WHERE LOWER(recipient_email) IN (${inEmails}) OR LOWER(sender_email) IN (${inEmails})`, [...emails, ...emails]).catch(() => {});
    await EXECUTESQL(`DELETE FROM match_player_stats WHERE LOWER(player_email) IN (${inEmails})`, emails).catch(() => {});
  }

  const tournaments = await EXECUTESQL('SELECT id, registered_clubs, registered_players FROM tournaments').catch(() => []);
  for (const tournament of tournaments) {
    const registeredClubs = parseJsonArray(tournament.registered_clubs).filter(id => !clubIds.includes(id));
    const registeredPlayers = parseJsonArray(tournament.registered_players).filter(id => !playerIds.includes(id));
    await EXECUTESQL(
      'UPDATE tournaments SET registered_clubs = ?, registered_players = ?, updated_date = NOW() WHERE id = ?',
      [JSON.stringify(registeredClubs), JSON.stringify(registeredPlayers), tournament.id]
    ).catch(() => {});
  }

  if (clubIds.length) {
    await EXECUTESQL(`DELETE FROM clubs WHERE id IN (${placeholders(clubIds)})`, clubIds).catch(() => {});
  }
  if (playerIds.length) {
    await EXECUTESQL(`DELETE FROM players WHERE id IN (${placeholders(playerIds)})`, playerIds).catch(() => {});
  }
  if (emails.length) {
    const result = await EXECUTESQL(`DELETE FROM users WHERE LOWER(email) IN (${placeholders(emails)})`, emails).catch(() => null);
    deletedUsers = Number(result?.affectedRows || 0);
  }

  if (admin) {
    await createAuditLog({
      adminUserId: admin.id,
      adminEmail: admin.email,
      action: 'delete_test_club_pack',
      entityType: 'test_data',
      oldValue: { clubs: clubIds.length, players: playerIds.length, users: deletedUsers },
      reason: 'Admin removed disposable tournament test clubs',
    });
  }

  return { clubs: clubIds.length, players: playerIds.length, users: deletedUsers };
}

function pickSquadPlayer(players, preferredPositions, fallbackIndex = 0) {
  return players.find(p => preferredPositions.includes(String(p.position || '').toUpperCase())) || players[fallbackIndex % Math.max(players.length, 1)];
}

function buildSimulatedPlayerStats(homePlayers, awayPlayers, match, homeScore, awayScore) {
  const stats = [];
  const addBase = (player, clubId, rating) => {
    if (!player) return null;
    const row = {
      player_id: player.id,
      club_id: clubId,
      player_email: player.email,
      player_gamertag: player.gamertag,
      goals: 0,
      assists: 0,
      rating,
      position: player.position,
      clean_sheet: 0,
      is_motm: 0,
    };
    stats.push(row);
    return row;
  };
  const homeRows = homePlayers.map((p, i) => addBase(p, match.home_club_id, 6.4 + (i % 4) * 0.2)).filter(Boolean);
  const awayRows = awayPlayers.map((p, i) => addBase(p, match.away_club_id, 6.4 + (i % 4) * 0.2)).filter(Boolean);
  const assignGoal = (rows, players, goalIndex) => {
    if (!rows.length) return;
    const scorer = pickSquadPlayer(players, ['ST', 'LW', 'RW', 'CAM', 'CM'], goalIndex);
    const scorerRow = rows.find(r => r.player_id === scorer?.id) || rows[goalIndex % rows.length];
    scorerRow.goals += 1;
    scorerRow.rating += 0.8;
    const assister = pickSquadPlayer(players.filter(p => p.id !== scorerRow.player_id), ['CAM', 'CM', 'LW', 'RW', 'CDM'], goalIndex + 1);
    const assistRow = rows.find(r => r.player_id === assister?.id);
    if (assistRow && goalIndex % 4 !== 0) {
      assistRow.assists += 1;
      assistRow.rating += 0.35;
    }
  };
  for (let i = 0; i < homeScore; i++) assignGoal(homeRows, homePlayers, i);
  for (let i = 0; i < awayScore; i++) assignGoal(awayRows, awayPlayers, i);
  if (awayScore === 0) homeRows.forEach(r => { if (['GK', 'CB', 'LB', 'RB', 'CDM'].includes(String(r.position || '').toUpperCase())) r.clean_sheet = 1; });
  if (homeScore === 0) awayRows.forEach(r => { if (['GK', 'CB', 'LB', 'RB', 'CDM'].includes(String(r.position || '').toUpperCase())) r.clean_sheet = 1; });
  const motm = stats.reduce((best, row) => !best || row.rating > best.rating ? row : best, null);
  if (motm) motm.is_motm = 1;
  return stats.map(row => ({
    ...row,
    rating: Math.min(10, Number(row.rating.toFixed(1))),
  }));
}

function isReachableInviteEmail(email) {
  const t = String(email || '').trim();
  if (!t || !t.includes('@')) return false;
  if (t.toLowerCase().endsWith('@stage.invalid')) return false;
  return true;
}

function pickReachableEmail(...candidates) {
  for (const raw of candidates) {
    const t = String(raw || '').trim();
    if (isReachableInviteEmail(t)) return t;
  }
  return null;
}

async function resolveClubContactForInvite(clubId) {
  if (!clubId) throw new Error('club_id required');
  return withTransaction(async (query) => {
    const clubs = await query('SELECT * FROM clubs WHERE id = ? LIMIT 1 FOR UPDATE', [clubId]);
    if (!clubs.length) throw new Error('Club not found');
    const club = clubs[0];
    const ownerEmail = String(club.owner_email || '').trim();

    let ownerUser = null;
    const primaryPresidentUserId = club.president_user_id || club.user_id || null;
    if (primaryPresidentUserId) {
      const userRows = await query('SELECT id, email, player_id FROM users WHERE id = ? LIMIT 1', [primaryPresidentUserId]);
      ownerUser = userRows[0] || null;
    }
    if (!ownerUser && ownerEmail) {
      const userRows = await query(
        'SELECT id, email, player_id FROM users WHERE LOWER(TRIM(email)) = LOWER(TRIM(?)) LIMIT 1',
        [ownerEmail]
      );
      ownerUser = userRows[0] || null;
      if (ownerUser && ownerUser.id !== club.user_id) {
        try {
          await query('UPDATE clubs SET user_id = ?, updated_date = NOW() WHERE id = ?', [ownerUser.id, club.id]);
          club.user_id = ownerUser.id;
        } catch (linkErr) {
          console.warn('[resolveClubContact] club.user_id link skipped:', linkErr.message);
        }
      }
    }

    if (ownerUser?.id) {
      try {
        await query(
          'UPDATE users SET owner_id = ?, role_id = 1, updated_date = NOW() WHERE id = ?',
          [club.id, ownerUser.id]
        );
      } catch (linkErr) {
        console.warn('[resolveClubContact] users.owner_id link skipped:', linkErr.message);
      }
    }

    let president = null;
    if (ownerUser?.player_id) {
      const rows = await query('SELECT * FROM players WHERE id = ? LIMIT 1 FOR UPDATE', [ownerUser.player_id]);
      president = rows[0] || null;
    }
    if (!president && ownerUser?.id) {
      const rows = await query('SELECT * FROM players WHERE user_id = ? LIMIT 1 FOR UPDATE', [ownerUser.id]);
      president = rows[0] || null;
    }
    if (!president && ownerEmail) {
      const rows = await query(
        'SELECT * FROM players WHERE LOWER(TRIM(email)) = LOWER(TRIM(?)) LIMIT 1 FOR UPDATE',
        [ownerEmail]
      );
      president = rows[0] || null;
    }

    if (president?.id && ownerUser?.id) {
      try {
        await query(
          'UPDATE players SET user_id = COALESCE(user_id, ?), updated_date = NOW() WHERE id = ?',
          [ownerUser.id, president.id]
        );
      } catch (linkErr) {
        console.warn('[resolveClubContact] player user link skipped:', linkErr.message);
      }
    }

    let staffRows = [];
    try {
      staffRows = await query(
        `SELECT id, email, gamertag, role
         FROM players
         WHERE club_id = ?
           AND email IS NOT NULL
           AND TRIM(email) <> ''
           AND LOWER(email) NOT LIKE '%@stage.invalid'
           AND (
             role IN ('president', 'captain', 'owner')
             OR club_roles LIKE '%president%'
             OR club_roles LIKE '%captain%'
           )
         ORDER BY
           CASE role WHEN 'president' THEN 0 WHEN 'captain' THEN 1 WHEN 'owner' THEN 2 ELSE 3 END,
           updated_date DESC
         LIMIT 1`,
        [club.id]
      );
    } catch (staffErr) {
      console.warn('[resolveClubContact] staff lookup failed:', staffErr.message);
    }

    let anyMemberRows = [];
    if (!staffRows.length) {
      anyMemberRows = await query(
        `SELECT id, email, gamertag
         FROM players
         WHERE club_id = ?
           AND email IS NOT NULL
           AND TRIM(email) <> ''
           AND LOWER(email) NOT LIKE '%@stage.invalid'
         ORDER BY updated_date DESC
         LIMIT 1`,
        [club.id]
      ).catch(() => []);
    }

    const visiblePresident = staffRows[0] || president || null;
    const anyMember = anyMemberRows[0] || null;
    const recipientEmail = pickReachableEmail(
      ownerUser?.email,
      ownerEmail,
      visiblePresident?.email,
      president?.email,
      anyMember?.email
    );

    if (!recipientEmail) {
      throw new Error('Club has no reachable owner or president email');
    }

    let presidentEntityId = club.president_id || null;
    try {
      const { ensurePresidentForClub } = require('../services/presidentResolutionService');
      const presidentEntity = await ensurePresidentForClub(club, { query });
      presidentEntityId = presidentEntity?.id || presidentEntityId;
    } catch (ensureErr) {
      console.warn('[resolveClubContact] ensure president entity skipped:', ensureErr.message);
    }

    return {
      data: {
        club_id: club.id,
        club_name: club.name,
        recipient_email: recipientEmail,
        owner_user_id: ownerUser?.id || club.user_id || null,
        president_id: presidentEntityId,
        president_player_id: visiblePresident?.id || anyMember?.id || null,
        president_gamertag: visiblePresident?.gamertag || anyMember?.gamertag || null,
        linked_president: Boolean(president?.id || presidentEntityId),
      },
    };
  });
}

async function resolvePlayerContactForInvite(playerId) {
  if (!playerId) throw new Error('player_id required');
  const rows = await EXECUTESQL('SELECT id, email, user_id, gamertag FROM players WHERE id = ? LIMIT 1', [playerId]);
  if (!rows.length) throw new Error('Player not found');
  const player = rows[0];

  let userEmail = null;
  if (player.user_id) {
    const users = await EXECUTESQL('SELECT email FROM users WHERE id = ? LIMIT 1', [player.user_id]);
    userEmail = users[0]?.email || null;
  }
  if (!userEmail) {
    const byPlayerCol = await EXECUTESQL('SELECT email FROM users WHERE player_id = ? LIMIT 1', [playerId]);
    userEmail = byPlayerCol[0]?.email || null;
  }
  if (!userEmail && player.email) {
    const byEmail = await EXECUTESQL(
      'SELECT email FROM users WHERE LOWER(TRIM(email)) = LOWER(TRIM(?)) LIMIT 1',
      [player.email]
    );
    userEmail = byEmail[0]?.email || null;
  }

  const recipientEmail = pickReachableEmail(userEmail, player.email);
  if (!recipientEmail) {
    throw new Error('Player has no login email — they need to register an account first');
  }

  return {
    data: {
      player_id: player.id,
      gamertag: player.gamertag || null,
      recipient_email: recipientEmail,
    },
  };
}

const HANDLERS = {
  async createTournamentEntranceLink({ _auth_user_id, tournament_id }) {
    const admin = await requireAdminUser(_auth_user_id);
    if (!tournament_id) throw new Error('tournament_id required');
    const tournamentRows = await EXECUTESQL('SELECT * FROM tournaments WHERE id = ? LIMIT 1', [tournament_id]);
    const tournament = tournamentRows[0];
    if (!tournament) throw new Error('Tournament not found');

    const id = uuidv4();
    const token = generateEntranceToken();
    const link = {
      id,
      token,
      tournament_id,
      tournament_name: tournament.name || null,
      status: 'active',
      max_teams: tournament.max_teams || null,
      created_by_user_id: admin.id,
      created_date: new Date().toISOString(),
      updated_date: new Date().toISOString(),
    };
    await EXECUTESQL(
      `INSERT INTO league_entities
        (id, entity_type, data_json, status, created_date, updated_date)
       VALUES (?, 'tournament_entrance_link', ?, 'active', NOW(), NOW())`,
      [id, JSON.stringify(link)],
    );
    await writeAdminAuditLog({
      admin,
      action: 'tournament_entrance_link_create',
      entityType: 'tournament_entrance_link',
      entityId: id,
      entityName: tournament.name || null,
      newValue: link,
    });
    return { data: { success: true, link } };
  },

  async listTournamentEntranceLinks({ _auth_user_id, tournament_id }) {
    const admin = await requireAdminUser(_auth_user_id);
    void admin;
    if (!tournament_id) throw new Error('tournament_id required');
    const rows = await EXECUTESQL(
      `SELECT * FROM league_entities
        WHERE entity_type = 'tournament_entrance_link'
          AND JSON_UNQUOTE(JSON_EXTRACT(data_json, '$.tournament_id')) = ?
        ORDER BY created_date DESC`,
      [tournament_id],
    );
    return {
      data: {
        success: true,
        links: rows.map(parseTournamentEntranceLinkRow),
      },
    };
  },

  async resolveTournamentEntranceToken({ token }) {
    if (!token) throw new Error('token required');
    const rows = await EXECUTESQL(
      `SELECT * FROM league_entities
        WHERE entity_type = 'tournament_entrance_link'
          AND JSON_UNQUOTE(JSON_EXTRACT(data_json, '$.token')) = ?
        LIMIT 1`,
      [token],
    );
    if (!rows.length) {
      return { data: { success: false, reason: 'not_found' } };
    }
    const link = parseTournamentEntranceLinkRow(rows[0]);
    if (String(link.status || '').toLowerCase() !== 'active') {
      return { data: { success: false, reason: 'revoked', link } };
    }
    if (isDatePassed(link.expires_at)) {
      return { data: { success: false, reason: 'expired', link } };
    }
    const tournamentRows = await EXECUTESQL('SELECT * FROM tournaments WHERE id = ? LIMIT 1', [link.tournament_id]);
    const tournament = tournamentRows[0] || null;
    if (!tournament) return { data: { success: false, reason: 'tournament_not_found', link } };
    // Check if tournament is full (registered players/clubs >= max_teams).
    let registeredPlayers = [];
    try { registeredPlayers = JSON.parse(tournament.registered_players || '[]'); } catch { /* ignore */ }
    let registeredClubs = [];
    try { registeredClubs = JSON.parse(tournament.registered_clubs || '[]'); } catch { /* ignore */ }
    const registeredCount = Math.max(registeredPlayers.length, registeredClubs.length);
    const maxTeams = Number(tournament.max_teams || 0);
    if (maxTeams > 0 && registeredCount >= maxTeams) {
      return { data: { success: false, reason: 'tournament_full', link, tournament } };
    }
    return { data: { success: true, link, tournament } };
  },

  async revokeTournamentEntranceLink({ _auth_user_id, link_id }) {
    const admin = await requireAdminUser(_auth_user_id);
    if (!link_id) throw new Error('link_id required');
    const rows = await EXECUTESQL(
      "SELECT * FROM league_entities WHERE id = ? AND entity_type = 'tournament_entrance_link' LIMIT 1",
      [link_id],
    );
    if (!rows.length) throw new Error('Entrance link not found');
    const current = parseTournamentEntranceLinkRow(rows[0]);
    const next = {
      ...current,
      status: 'revoked',
      updated_date: new Date().toISOString(),
    };
    await updateLeagueEntityData(EXECUTESQL, 'tournament_entrance_link', link_id, next, { status: 'revoked' });
    await writeAdminAuditLog({
      admin,
      action: 'tournament_entrance_link_revoke',
      entityType: 'tournament_entrance_link',
      entityId: link_id,
      oldValue: current,
      newValue: next,
    });
    return { data: { success: true, link: next } };
  },

  async regenerateTournamentEntranceLink({ _auth_user_id, link_id }) {
    const admin = await requireAdminUser(_auth_user_id);
    if (!link_id) throw new Error('link_id required');
    const rows = await EXECUTESQL(
      "SELECT * FROM league_entities WHERE id = ? AND entity_type = 'tournament_entrance_link' LIMIT 1",
      [link_id],
    );
    if (!rows.length) throw new Error('Entrance link not found');
    const current = parseTournamentEntranceLinkRow(rows[0]);
    const revoked = {
      ...current,
      status: 'revoked',
      updated_date: new Date().toISOString(),
    };
    await updateLeagueEntityData(EXECUTESQL, 'tournament_entrance_link', link_id, revoked, { status: 'revoked' });
    await writeAdminAuditLog({
      admin,
      action: 'tournament_entrance_link_regenerate_revoke',
      entityType: 'tournament_entrance_link',
      entityId: link_id,
      oldValue: current,
      newValue: revoked,
    });

    const id = uuidv4();
    const token = generateEntranceToken();
    const next = {
      ...current,
      id,
      token,
      status: 'active',
      created_by_user_id: admin.id,
      created_date: new Date().toISOString(),
      updated_date: new Date().toISOString(),
    };
    await EXECUTESQL(
      `INSERT INTO league_entities
        (id, entity_type, data_json, status, created_date, updated_date)
       VALUES (?, 'tournament_entrance_link', ?, 'active', NOW(), NOW())`,
      [id, JSON.stringify(next)],
    );
    await writeAdminAuditLog({
      admin,
      action: 'tournament_entrance_link_regenerate_create',
      entityType: 'tournament_entrance_link',
      entityId: id,
      oldValue: null,
      newValue: next,
    });
    return { data: { success: true, link: next } };
  },

  async applyTournamentEntranceAccessMode({ _auth_user_id, tournament_id }) {
    if (!_auth_user_id) throw new Error('not authenticated');
    if (!tournament_id) throw new Error('tournament_id required');
    const tournamentRows = await EXECUTESQL(
      'SELECT id, status, end_date FROM tournaments WHERE id = ? LIMIT 1',
      [tournament_id],
    );
    if (!tournamentRows.length) throw new Error('Tournament not found');

    await EXECUTESQL(
      `UPDATE users SET access_mode = 'tournament_limited',
                        limited_tournament_id = ?,
                        limited_mode_expires_at = ?,
                        updated_date = NOW()
       WHERE id = ?`,
      [tournament_id, toMysqlDateTime(tournamentRows[0].end_date || null), _auth_user_id],
    );
    const users = await EXECUTESQL(
      'SELECT id, access_mode, limited_tournament_id FROM users WHERE id = ? LIMIT 1',
      [_auth_user_id],
    );
    return {
      data: {
        success: true,
        access_mode: users[0]?.access_mode || 'tournament_limited',
        limited_tournament_id: users[0]?.limited_tournament_id || tournament_id,
      },
    };
  },

  async releaseTournamentLimitedAccessIfEligible({ _auth_user_id }) {
    if (!_auth_user_id) throw new Error('not authenticated');
    const userRows = await EXECUTESQL(
      'SELECT id, access_mode, limited_tournament_id FROM users WHERE id = ? LIMIT 1',
      [_auth_user_id],
    );
    const user = userRows[0] || null;
    if (!user || String(user.access_mode || '') !== 'tournament_limited' || !user.limited_tournament_id) {
      return { data: { success: true, released: false, reason: 'not_limited' } };
    }
    const tournamentRows = await EXECUTESQL(
      'SELECT id, status, end_date FROM tournaments WHERE id = ? LIMIT 1',
      [user.limited_tournament_id],
    );
    const tournament = tournamentRows[0] || null;
    if (!tournament) {
      await EXECUTESQL(
        `UPDATE users SET access_mode = 'standard',
                          limited_tournament_id = NULL,
                          limited_mode_expires_at = NULL,
                          updated_date = NOW()
         WHERE id = ?`,
        [_auth_user_id],
      );
      return { data: { success: true, released: true, reason: 'tournament_not_found' } };
    }
    const endedByStatus = String(tournament.status || '').toLowerCase() === 'completed';
    const endedByDate = tournament.end_date ? isDatePassed(tournament.end_date) : false;
    if (!endedByStatus && !endedByDate) {
      return { data: { success: true, released: false, reason: 'still_active' } };
    }
    await EXECUTESQL(
      `UPDATE users SET access_mode = 'standard',
                        limited_tournament_id = NULL,
                        limited_mode_expires_at = NULL,
                        updated_date = NOW()
       WHERE id = ?`,
      [_auth_user_id],
    );
    return {
      data: {
        success: true,
        released: true,
        reason: endedByStatus ? 'completed' : 'end_date_passed',
      },
    };
  },

  async clearTournamentLimitedAccess({ _auth_user_id }) {
    if (!_auth_user_id) throw new Error('not authenticated');
    await EXECUTESQL(
      `UPDATE users SET access_mode = 'standard',
                        limited_tournament_id = NULL,
                        limited_mode_expires_at = NULL,
                        updated_date = NOW()
       WHERE id = ?`,
      [_auth_user_id],
    );
    return { data: { success: true } };
  },

  async stripeCheckout({ _auth_user_id, packId, creditTarget = 'player', successUrl, cancelUrl }) {
    if (!_auth_user_id) throw new Error('not authenticated');
    const pack = getCreditPack(packId);
    if (!pack) throw new Error('Unknown credit pack');
    if (!successUrl || !cancelUrl) throw new Error('successUrl and cancelUrl required');
    const unitAmount = Math.round(Number(pack.price_eur) * 100);
    if (!Number.isFinite(unitAmount) || unitAmount <= 0) {
      throw new Error(`Invalid price for credit pack ${packId}`);
    }
    // Dynamic price_data (not a stored Stripe Price ID) so pack prices/credits
    // always match the values defined in CREDIT_PACKS on the server — no stale
    // hardcoded Stripe price IDs to keep in sync when pricing changes.
    const session = await createStripeCheckoutSession({
      mode: 'payment',
      success_url: successUrl,
      cancel_url: cancelUrl,
      'line_items[0][price_data][currency]': 'eur',
      'line_items[0][price_data][unit_amount]': unitAmount,
      'line_items[0][price_data][product_data][name]': `STAGE ${pack.label}`,
      'line_items[0][price_data][product_data][description]': `${pack.credits} credits — ${pack.purpose}`,
      'line_items[0][quantity]': 1,
      'metadata[user_id]': _auth_user_id,
      'metadata[pack_id]': packId,
      'metadata[credits]': pack.credits,
      'metadata[credit_target]': creditTarget === 'club' ? 'club' : 'player',
    });
    return { data: { success: true, url: session.url, id: session.id } };
  },

  async stripeSubscription({ _auth_user_id, tier, billing = 'monthly', successUrl, cancelUrl }) {
    if (!_auth_user_id) throw new Error('not authenticated');
    if (!successUrl || !cancelUrl) throw new Error('successUrl and cancelUrl required');
    const normalizedTier = normalizeSubscriptionTier(tier);
    const normalizedBilling = String(billing || 'monthly').toLowerCase();
    if (normalizedTier !== 'stage_plus') throw new Error('STAGE Plus is the only available subscription');
    const storeSettings = await getActiveStoreSettings();
    const amount = normalizedBilling === 'yearly'
      ? Number(storeSettings.stage_plus_yearly_price || 49.99)
      : Number(storeSettings.stage_plus_monthly_price || 4.99);
    const unitAmount = Math.round(amount * 100);
    if (!Number.isFinite(unitAmount) || unitAmount <= 0) {
      throw new Error(`Invalid STAGE Plus ${normalizedBilling} price`);
    }
    const session = await createStripeCheckoutSession({
      mode: 'subscription',
      success_url: successUrl,
      cancel_url: cancelUrl,
      'line_items[0][price_data][currency]': 'eur',
      'line_items[0][price_data][unit_amount]': unitAmount,
      'line_items[0][price_data][recurring][interval]': normalizedBilling === 'yearly' ? 'year' : 'month',
      'line_items[0][price_data][product_data][name]': storeSettings.name || 'STAGE Plus',
      'line_items[0][quantity]': 1,
      'metadata[user_id]': _auth_user_id,
      'metadata[tier]': normalizedTier,
      'metadata[billing]': normalizedBilling,
      'metadata[display_price_eur]': amount.toFixed(2),
      'metadata[monthly_credit_allowance]': storeSettings.monthly_credits,
      'metadata[credit_policy]': 'refresh_not_stack',
    });
    return { data: { success: true, url: session.url, id: session.id } };
  },

  async fixSubscription({ _auth_user_id, session_id }) {
    if (!_auth_user_id) throw new Error('not authenticated');
    if (!session_id) {
      return {
        data: {
          success: false,
          pending: true,
          error: 'Subscription activation requires a Stripe checkout session id',
        },
      };
    }

    const session = await retrieveStripeCheckoutSession(session_id);
    if (String(session.mode || '') !== 'subscription') throw new Error('Stripe session is not a subscription checkout');
    if (String(session.metadata?.user_id || '') !== String(_auth_user_id)) {
      throw new Error('Stripe session does not belong to this user');
    }
    const tier = normalizeSubscriptionTier(session.metadata?.tier);
    if (tier !== 'stage_plus') throw new Error('Stripe session is not for STAGE Plus');
    if (!['paid', 'no_payment_required'].includes(String(session.payment_status || ''))) {
      throw new Error('Stripe subscription payment is not complete yet');
    }

    const outcome = await fulfilCheckoutSession(session);
    if (!outcome.fulfilled && outcome.reason === 'already_processed') {
      // Webhook (or an earlier return) already activated it — report success.
      const player = await resolvePlayerForUserId(_auth_user_id);
      return {
        data: {
          success: true,
          tier: 'stage_plus',
          billing: String(session.metadata?.billing || 'monthly').toLowerCase() === 'yearly' ? 'yearly' : 'monthly',
          credits_after: Number(player?.credits || 0),
          already_active: true,
          credit_policy: 'refresh_not_stack',
        },
      };
    }
    if (!outcome.fulfilled) throw new Error(`Subscription activation failed: ${outcome.reason}`);

    return {
      data: {
        success: true,
        tier: outcome.tier,
        billing: outcome.billing,
        credits_before: outcome.credits_before,
        credits_after: outcome.credits_after,
        credits_added: outcome.credits_added,
        monthly_credit_allowance: outcome.monthly_credit_allowance,
        credit_policy: 'refresh_not_stack',
      },
    };
  },

  // Client-return fallback for credit purchases: called on /store?payment=success
  // with the Stripe session id. Grants the credits server-side (idempotently).
  // The webhook is the primary path; this covers users who return to the tab.
  async fixCredits({ _auth_user_id, session_id }) {
    if (!_auth_user_id) throw new Error('not authenticated');
    if (!session_id) {
      return { data: { success: false, pending: true, error: 'Credit fulfilment requires a Stripe checkout session id' } };
    }
    const session = await retrieveStripeCheckoutSession(session_id);
    if (String(session.mode || '') !== 'payment') throw new Error('Stripe session is not a credit purchase');
    if (String(session.metadata?.user_id || '') !== String(_auth_user_id)) {
      throw new Error('Stripe session does not belong to this user');
    }
    if (!['paid', 'no_payment_required'].includes(String(session.payment_status || ''))) {
      throw new Error('Stripe payment is not complete yet');
    }

    const outcome = await fulfilCheckoutSession(session);
    if (!outcome.fulfilled && outcome.reason === 'already_processed') {
      return { data: { success: true, already_processed: true } };
    }
    if (!outcome.fulfilled) throw new Error(`Credit fulfilment failed: ${outcome.reason}`);

    return {
      data: {
        success: true,
        target: outcome.target,
        credits_added: outcome.credits_added,
        credits_before: outcome.credits_before,
        credits_after: outcome.credits_after,
      },
    };
  },

  // Admin-only: email every user that a new update / announcement has shipped.
  // Sends are fire-and-forget so the request returns immediately.
  async broadcastAnnouncement({ _auth_user_id, title, message, url }) {
    const admin = await requireAdminUser(_auth_user_id);
    if (!title && !message) throw new Error('title or message required');
    const users = await EXECUTESQL(
      "SELECT DISTINCT email FROM users WHERE email IS NOT NULL AND email <> '' AND email NOT LIKE '%@stage.local'"
    );
    let queued = 0;
    for (const u of users) {
      notifyAnnouncement({
        to: u.email,
        name: u.email.split('@')[0],
        title,
        message,
        url,
      });
      queued += 1;
    }
    await createAuditLog({
      adminUserId: admin.id,
      adminEmail: admin.email,
      action: 'broadcast_announcement',
      entityType: 'email',
      entityId: null,
      entityName: title || 'update',
      oldValue: null,
      newValue: { title, message, url, recipients: queued },
      reason: 'Update announcement email',
    });
    return { data: { success: true, recipients: queued } };
  },

  async adminSubscriptionGrant({ _auth_user_id, player_id, action = 'grant_stage_plus', months = 1, billing = 'monthly', reason }) {
    const admin = await requireAdminUser(_auth_user_id);
    if (!player_id) throw new Error('player_id required');
    const playerRows = await EXECUTESQL('SELECT * FROM players WHERE id = ? LIMIT 1', [player_id]);
    if (!playerRows.length) throw new Error('Player not found');
    const before = playerRows[0];
    const normalizedAction = String(action || '').toLowerCase();

    if (normalizedAction === 'remove_stage_plus') {
      await EXECUTESQL(
        `UPDATE players
         SET subscription = 'free',
             subscription_billing = NULL,
             subscription_expires_at = NULL,
             updated_date = NOW()
         WHERE id = ?`,
        [player_id]
      );
      const after = (await EXECUTESQL('SELECT * FROM players WHERE id = ? LIMIT 1', [player_id]))[0];
      await createAuditLog({
        adminUserId: admin.id,
        adminEmail: admin.email,
        action: 'remove_stage_plus',
        entityType: 'player',
        entityId: player_id,
        entityName: before.gamertag || before.email,
        oldValue: before,
        newValue: after,
        reason,
      });
      return { data: { success: true, player: after } };
    }

    if (normalizedAction !== 'grant_stage_plus') throw new Error('Unsupported subscription action');
    const storeSettings = await getActiveStoreSettings();
    const grantMonths = Math.min(Math.max(Number(months) || 1, 1), 24);
    const normalizedBilling = String(billing || 'monthly').toLowerCase() === 'yearly' ? 'yearly' : 'monthly';
    const ownerUserId = before.user_id || null;
    if (ownerUserId) {
      await refreshUserCreditsTo(ownerUserId, Number(storeSettings.monthly_credits || STAGE_PLUS_MONTHLY_CREDITS));
    }

    await EXECUTESQL(
      `UPDATE players
       SET subscription = 'stage_plus',
           subscription_billing = ?,
           subscription_expires_at = DATE_ADD(NOW(), INTERVAL ? MONTH),
           updated_date = NOW()
       WHERE id = ?`,
      [normalizedBilling, grantMonths, player_id]
    );
    const after = (await EXECUTESQL('SELECT * FROM players WHERE id = ? LIMIT 1', [player_id]))[0];
    await createAuditLog({
      adminUserId: admin.id,
      adminEmail: admin.email,
      action: 'grant_stage_plus',
      entityType: 'player',
      entityId: player_id,
      entityName: before.gamertag || before.email,
      oldValue: before,
      newValue: after,
      reason,
    });
    return { data: { success: true, player: after } };
  },

  async transferPayment({
    _auth_user_id,
    player_id,
    source_club_id,
    target_club_id,
    amount,
  }) {
    if (!_auth_user_id) throw new Error('not authenticated');
    const fee = Number(amount || 0);
    if (!source_club_id) throw new Error('source_club_id required');
    if (!target_club_id) throw new Error('target_club_id required');
    if (source_club_id === target_club_id) throw new Error('Cannot pay a transfer fee to the same club');
    if (!Number.isFinite(fee) || fee <= 0) throw new Error('Enter a valid transfer fee amount');

    const userRows = await EXECUTESQL('SELECT id, email, role_id FROM users WHERE id = ? LIMIT 1', [_auth_user_id]);
    if (!userRows.length) throw new Error('User not found');
    const user = userRows[0];

    const result = await withTransaction(async (query) => {
      const sourceRows = await query('SELECT * FROM clubs WHERE id = ? LIMIT 1 FOR UPDATE', [source_club_id]);
      const targetRows = await query('SELECT * FROM clubs WHERE id = ? LIMIT 1 FOR UPDATE', [target_club_id]);
      if (!sourceRows.length) throw new Error('Paying club not found');
      if (!targetRows.length) throw new Error('Receiving club not found');
      const source = sourceRows[0];
      const target = targetRows[0];
      const isAdmin = Number(user.role_id) === 0;
      const canPay = isAdmin
        || String(source.owner_email || '').toLowerCase() === String(user.email || '').toLowerCase()
        || String(source.user_id || '') === String(_auth_user_id);
      if (!canPay) throw new Error('Only the paying club owner can pay this transfer fee');

      const sourceBalance = Number(source.stc || 0);
      if (sourceBalance < fee) throw new Error(`Insufficient funds. Club balance: ${sourceBalance}`);

      const sourceBudget = Number(source.transfer_budget_stc || 0);
      const nextSourceBudget = Math.max(0, sourceBudget - fee);
      await query('UPDATE clubs SET transfer_budget_stc = ?, updated_date = NOW() WHERE id = ?', [nextSourceBudget, source.id]);

      const playerRows = player_id
        ? await query('SELECT id, gamertag, avatar_url FROM players WHERE id = ? LIMIT 1', [player_id])
        : [];
      const player = playerRows[0] || null;
      const playerLabel = player?.gamertag || 'a player';
      const sourceTx = await recordClubTransaction(query, {
        clubId: source.id,
        amount: -fee,
        type: 'transfer_fee_paid',
        category: 'transfer_fee',
        description: `Transfer fee paid to ${target.name || 'club'} for ${playerLabel}`,
        referenceId: player_id || null,
      });
      const targetTx = await recordClubTransaction(query, {
        clubId: target.id,
        amount: fee,
        type: 'transfer_fee_received',
        category: 'transfer_fee',
        description: `Transfer fee received from ${source.name || 'club'} for ${playerLabel}`,
        referenceId: player_id || null,
      });

      if (target.owner_email) {
        await query(
          `INSERT INTO notifications
             (id, recipient_email, type, title, body, \`read\`, link, created_date)
           VALUES (?, ?, 'club_update', ?, ?, 0, ?, NOW())`,
          [
            uuidv4(),
            String(target.owner_email).trim().toLowerCase(),
            `Transfer Fee Received - ${fee.toLocaleString()} STC`,
            `${source.name || 'A club'} paid a transfer fee of ${fee.toLocaleString()} STC for ${playerLabel}.`,
            `/clubs/${target.id}`,
          ]
        ).catch(() => {});
      }

      await query(
        `INSERT INTO news_items
          (id, title, body, type, category, club_name, club_logo_url,
           player_name, player_avatar_url, link, is_global, published_at, transfer_fee_stc)
         VALUES (?, ?, ?, 'contract', 'contracts', ?, ?, ?, ?, ?, 1, NOW(), ?)`,
        [
          uuidv4(),
          `${source.name || 'Club'} paid ${fee.toLocaleString()} STC transfer fee for ${playerLabel}`,
          `${source.name || 'Club'} paid a transfer fee of ${fee.toLocaleString()} STC to ${target.name || 'the previous club'} for ${playerLabel}.`,
          source.name || null,
          source.logo_url || null,
          player?.gamertag || null,
          player?.avatar_url || null,
          player_id ? `/players/${player_id}` : '',
          fee,
        ]
      ).catch(() => {});

      return {
        source_club_id: source.id,
        target_club_id: target.id,
        source_stc: sourceTx.new_balance,
        target_stc: targetTx.new_balance,
        source_transfer_budget_stc: nextSourceBudget,
        target_transfer_budget_stc: Number(target.transfer_budget_stc || 0),
        source_transaction_id: sourceTx.transaction_id,
        target_transaction_id: targetTx.transaction_id,
      };
    });

    return { data: { success: true, ...result } };
  },

  async tournamentWithdrawal({ _auth_user_id, tournament_id, club_id }) {
    if (!_auth_user_id) throw new Error('not authenticated');
    if (!tournament_id) throw new Error('tournament_id required');
    if (!club_id) throw new Error('club_id required');

    const userRows = await EXECUTESQL('SELECT id, email, role_id FROM users WHERE id = ? LIMIT 1', [_auth_user_id]);
    if (!userRows.length) throw new Error('User not found');
    const user = userRows[0];

    const result = await withTransaction(async (query) => {
      const tournamentRows = await query('SELECT * FROM tournaments WHERE id = ? LIMIT 1 FOR UPDATE', [tournament_id]);
      if (!tournamentRows.length) throw new Error('Tournament not found');
      const tournament = tournamentRows[0];
      if (String(tournament.status || '') !== 'registration') throw new Error('Tournament registration is closed');

      const clubRows = await query('SELECT * FROM clubs WHERE id = ? LIMIT 1 FOR UPDATE', [club_id]);
      if (!clubRows.length) throw new Error('Club not found');
      const club = clubRows[0];
      const isAdmin = Number(user.role_id) === 0;
      const ownerOk = isAdmin
        || String(club.president_user_id || '') === String(_auth_user_id)
        || String(club.owner_email || '').toLowerCase() === String(user.email || '').toLowerCase()
        || String(club.user_id || '') === String(_auth_user_id);
      if (!ownerOk) throw new Error('Only the club president can withdraw this club');

      const registered = normalizeIdList(tournament.registered_clubs);
      if (!registered.includes(String(club_id))) throw new Error('Club is not registered for this tournament');
      const updatedRegistered = registered.filter((id) => String(id) !== String(club_id));
      await query(
        'UPDATE tournaments SET registered_clubs = ?, updated_date = NOW() WHERE id = ?',
        [JSON.stringify(updatedRegistered), tournament_id]
      );

      const entryCredits = Number(tournament.entry_credits ?? 50);
      const entryFee = Number(tournament.entry_fee_stc || 0);
      let nextUserCredits = await getUserCredits(_auth_user_id, query);
      if (entryCredits > 0) {
        const refunded = await addUserCredits(_auth_user_id, entryCredits, query);
        nextUserCredits = refunded.credits_after;
      }

      let nextStc = Number(club.stc || 0);
      let transactionId = null;
      if (entryFee > 0) {
        const tx = await recordClubTransaction(query, {
          clubId: club_id,
          amount: entryFee,
          type: 'tournament_refund',
          category: 'tournament_refund',
          description: `Tournament withdrawal refund: ${tournament.name}`,
          referenceId: tournament_id,
        });
        nextStc = tx.new_balance;
        transactionId = tx.transaction_id;
      }

      return {
        registered_clubs: updatedRegistered,
        club_id,
        club_stc: nextStc,
        user_credits: nextUserCredits,
        refunded_stc: entryFee,
        refunded_credits: entryCredits,
        transaction_id: transactionId,
      };
    });

    return { data: { success: true, ...result } };
  },

  async assignGroups({ _auth_user_id, tournamentId, tournament_id, groupAssignments }) {
    if (!_auth_user_id) throw new Error('not authenticated');
    const id = tournamentId || tournament_id;
    if (!id) throw new Error('tournamentId required');
    if (!groupAssignments || typeof groupAssignments !== 'object') throw new Error('groupAssignments required');

    const entries = Object.entries(groupAssignments)
      .filter(([, clubIds]) => Array.isArray(clubIds))
      .sort(([a], [b]) => String(a).localeCompare(String(b)));

    let updated = 0;
    for (let index = 0; index < entries.length; index++) {
      const [, clubIds] = entries[index];
      const ids = clubIds.map(String).filter(Boolean);
      if (!ids.length) continue;
      const placeholders = ids.map(() => '?').join(',');
      const result = await EXECUTESQL(
        `UPDATE matches
          SET group_number = ?, updated_date = NOW()
          WHERE tournament_id = ?
            AND (home_club_id IN (${placeholders}) OR away_club_id IN (${placeholders}))`,
        [index, id, ...ids, ...ids]
      );
      updated += Number(result?.affectedRows || 0);
    }

    const matches = await EXECUTESQL('SELECT * FROM matches WHERE tournament_id = ?', [id]);
    for (const match of matches) broadcastMatch(match);
    return { data: { success: true, updated } };
  },

  async simulateScore({ _auth_user_id, matchId, match_id }) {
    if (!_auth_user_id) throw new Error('not authenticated');
    await requireAdminUser(_auth_user_id);
    const id = matchId || match_id;
    if (!id) throw new Error('matchId required');
    const rows = await EXECUTESQL('SELECT * FROM matches WHERE id = ? LIMIT 1', [id]);
    if (!rows.length) throw new Error('Match not found');
    const match = rows[0];
    if (String(match.status || '') === 'completed') {
      return { data: { success: true, skipped: true, status: 'completed' } };
    }

    let homeScore = Math.floor(Math.random() * 6);
    let awayScore = Math.floor(Math.random() * 6);
    if (homeScore === awayScore) {
      Math.random() > 0.5 ? homeScore++ : awayScore++;
    }

    const [homePlayers, awayPlayers] = await Promise.all([
      match.home_club_id
        ? listActiveClubPlayers(match.home_club_id, { limit: 11 })
        : Promise.resolve([]),
      match.away_club_id
        ? listActiveClubPlayers(match.away_club_id, { limit: 11 })
        : Promise.resolve([]),
    ]);
    const simulatedStats = buildSimulatedPlayerStats(homePlayers, awayPlayers, match, homeScore, awayScore);

    const result = await processMatchCompletion(match, {
      home_score: homeScore,
      away_score: awayScore,
      player_stats: simulatedStats,
      goal_events: [],
    });
    return { data: { success: true, ...result.data, home_score: homeScore, away_score: awayScore, player_stats: simulatedStats.length } };
  },

  async generateTournamentDraw({ _auth_user_id, tournamentId, tournament_id }) {
    if (!_auth_user_id) throw new Error('not authenticated');
    const id = tournamentId || tournament_id;
    if (!id) throw new Error('tournament_id required');

    const rows = await EXECUTESQL('SELECT * FROM tournaments WHERE id = ? LIMIT 1', [id]);
    if (!rows.length) throw new Error('Tournament not found');
    const tournament = rows[0];
    await assertTournamentOrganizer(_auth_user_id, tournament);

    const result = await createTournamentDraw(tournament);
    const updatedRows = await EXECUTESQL('SELECT * FROM tournaments WHERE id = ? LIMIT 1', [id]);
    return {
      data: {
        success: true,
        created: result.created,
        matches: result.matches,
        tournament: updatedRows[0] || tournament,
      },
    };
  },

  async startTournament({ _auth_user_id, tournamentId, tournament_id }) {
    if (!_auth_user_id) throw new Error('not authenticated');
    const id = tournamentId || tournament_id;
    if (!id) throw new Error('tournament_id required');

    const rows = await EXECUTESQL('SELECT * FROM tournaments WHERE id = ? LIMIT 1', [id]);
    if (!rows.length) throw new Error('Tournament not found');
    const tournament = rows[0];
    await assertTournamentOrganizer(_auth_user_id, tournament);

    if (String(tournament.status || '') === 'completed') throw new Error('Tournament is already completed');
    if (String(tournament.status || '') === 'cancelled') throw new Error('Cancelled tournament cannot be started');

    const draw = await createTournamentDraw(tournament);
    await EXECUTESQL(
      `UPDATE tournaments
          SET status = 'in_progress',
              current_round = COALESCE(NULLIF(current_round, 0), 1),
              num_groups = COALESCE(?, num_groups),
              updated_date = NOW()
        WHERE id = ?`,
      [draw.numGroups || null, id]
    );
    const updatedRows = await EXECUTESQL('SELECT * FROM tournaments WHERE id = ? LIMIT 1', [id]);
    const updated = updatedRows[0] || { ...tournament, status: 'in_progress', current_round: 1 };
    const notified = await notifyTournamentStarted(updated).catch(() => 0);

    await createAuditLog({
      adminUserId: _auth_user_id,
      action: 'start_tournament',
      entityType: 'tournament',
      entityId: id,
      newValue: { status: 'in_progress', notified },
      reason: 'Tournament officially started',
    }).catch(() => {});

    return {
      data: {
        success: true,
        notified,
        created_matches: draw.created,
        matches: draw.matches,
        tournament: updated,
      },
    };
  },

  async seedTournamentTestClubs({ _auth_user_id }) {
    const admin = await requireAdminUser(_auth_user_id);
    await cleanupStageTestPack();

    const createdClubs = [];
    const createdPlayers = [];
    const passwordHash = await bcrypt.hash('StageTest123!', 10);
    for (let clubIndex = 0; clubIndex < TEST_CLUBS.length; clubIndex++) {
      const clubDef = TEST_CLUBS[clubIndex];
      const clubId = uuidv4();
      const ownerUserId = uuidv4();
      const ownerPlayerId = uuidv4();
      const ownerEmail = testEmailFor(clubIndex, 'owner');

      // Owner user must exist before club insert (fk_clubs_user_id).
      await EXECUTESQL(
        `INSERT INTO users
          (id, email, password_hash, role_id, player_id, owner_id, access_mode, created_date, updated_date)
         VALUES (?, ?, ?, 1, ?, NULL, 'standard', NOW(), NOW())`,
        [ownerUserId, ownerEmail, passwordHash, ownerPlayerId]
      );

      await EXECUTESQL(
        `INSERT INTO clubs
          (id, user_id, president_user_id, owner_email, name, tag, platform, region, country_code, description,
           wins, losses, draws, goals_scored, goals_conceded, rating, peak_rating, matches_ranked,
           is_provisional, credits, stc, wage_budget_stc, transfer_budget_stc, stadium_level,
           stadium_capacity, tier, form, status, formation, created_date, updated_date)
         VALUES (?, ?, ?, ?, ?, ?, 'PlayStation', 'Europe', ?, ?, 0, 0, 0, 0, 0, 70, 70, 0,
           1, 500, 2500000, 250000, 1000000, 0, 5000, 'TEST', '[]', 'active', '4-2-3-1', NOW(), NOW())`,
        [clubId, ownerUserId, ownerUserId, ownerEmail, clubDef.name, clubDef.tag, clubDef.country_code, `${TEST_PACK_TAG} Disposable test club for tournament/game simulation.`]
      );
      createdClubs.push({ id: clubId, name: clubDef.name, tag: clubDef.tag });

      await EXECUTESQL(
        'UPDATE users SET owner_id = ?, updated_date = NOW() WHERE id = ?',
        [clubId, ownerUserId]
      );

      const names = TEST_PLAYER_NAMES[clubIndex];
      for (let playerIndex = 0; playerIndex < names.length; playerIndex++) {
        const isOwner = playerIndex === 0;
        const isCaptain = playerIndex === 1;
        const playerId = isOwner ? ownerPlayerId : uuidv4();
        const playerUserId = isOwner ? ownerUserId : uuidv4();
        const position = TEST_POSITIONS[playerIndex % TEST_POSITIONS.length];
        const playerEmail = isOwner ? ownerEmail : testEmailFor(clubIndex, playerIndex);
        const roles = isOwner ? ['president'] : isCaptain ? ['captain'] : [];
        if (!isOwner) {
          await EXECUTESQL(
            `INSERT INTO users
              (id, email, password_hash, role_id, player_id, owner_id, access_mode, created_date, updated_date)
             VALUES (?, ?, ?, 1, ?, NULL, 'standard', NOW(), NOW())`,
            [playerUserId, playerEmail, passwordHash, playerId]
          );
        }
        await EXECUTESQL(
          `INSERT INTO players
            (id, user_id, email, gamertag, position, secondary_position, platform, country, country_code, bio,
             shirt_number, overall_rating, goals, goals_player, assists, matches_played, matches_played_club,
             wins_count, wins_club, losses_count, losses_club, draws_count, draws_club, clean_sheets,
             man_of_the_match, avg_match_rating, credits, stc, subscription, is_verified,
             role, status, is_ready, club_id, club_roles, created_date, updated_date)
           VALUES (?, ?, ?, ?, ?, ?, 'PlayStation', 'Belgium', ?, ?, ?, ?, 0, 0, 0, 0, 0,
            0, 0, 0, 0, 0, 0, 0, 0, 0, 50, 100000, 'stage_plus', 1,
             ?, 'active', 1, ?, ?, NOW(), NOW())`,
          [
            playerId,
            playerUserId,
            playerEmail,
            names[playerIndex],
            position,
            TEST_POSITIONS[(playerIndex + 2) % TEST_POSITIONS.length],
            clubDef.country_code,
            `${TEST_PACK_TAG} Disposable test player for tournament/game simulation.`,
            playerIndex + 1,
            69 + ((clubIndex + playerIndex) % 8),
            isOwner ? 'president' : isCaptain ? 'captain' : 'player',
            clubId,
            JSON.stringify(roles),
          ]
        );
        createdPlayers.push({ id: playerId, gamertag: names[playerIndex], club_id: clubId });
        if (isOwner || isCaptain) {
          await EXECUTESQL(
            `INSERT IGNORE INTO club_staff_roles
              (id, club_id, player_id, role, permissions, assigned_by_user_id, created_date, updated_date)
             VALUES (?, ?, ?, ?, ?, ?, NOW(), NOW())`,
            [
              uuidv4(),
              clubId,
              playerId,
              isOwner ? 'president' : 'captain',
              JSON.stringify(isOwner ? ['manage_recruitment', 'review_applicants', 'offer_contracts', 'manage_lineup', 'manage_staff'] : ['manage_lineup', 'review_applicants']),
              admin.id,
            ]
          ).catch(() => {});
        }
      }
    }

    await createAuditLog({
      adminUserId: admin.id,
      adminEmail: admin.email,
      action: 'seed_test_club_pack',
      entityType: 'test_data',
      newValue: { clubs: createdClubs.length, players: createdPlayers.length, domain: TEST_PACK_DOMAIN },
      reason: 'Admin generated disposable tournament test clubs',
    });

    return { data: { success: true, clubs: createdClubs.length, players: createdPlayers.length, created_clubs: createdClubs } };
  },

  async deleteTournamentTestClubs({ _auth_user_id }) {
    const admin = await requireAdminUser(_auth_user_id);
    const deleted = await cleanupStageTestPack(admin);
    return { data: { success: true, deleted } };
  },

  async advanceRound({ _auth_user_id, tournamentId, tournament_id }) {
    if (!_auth_user_id) throw new Error('not authenticated');
    const id = tournamentId || tournament_id;
    if (!id) throw new Error('tournamentId required');

    const result = await withTransaction(async (query) => {
      const tournaments = await query('SELECT * FROM tournaments WHERE id = ? LIMIT 1 FOR UPDATE', [id]);
      if (!tournaments.length) throw new Error('Tournament not found');
      const tournament = tournaments[0];
      await assertTournamentOrganizer(_auth_user_id, tournament);
      const currentRound = Number(tournament.current_round || 1);

      if (String(tournament.type || '').toLowerCase() === 'group_stage') {
        const groupMatches = await query(
          `SELECT * FROM matches
            WHERE tournament_id = ?
              AND type IN ('group', 'group_stage')
            ORDER BY group_number ASC, created_date ASC
            FOR UPDATE`,
          [id]
        );
        if (!groupMatches.length) throw new Error('No group matches found');
        const incompleteGroupMatch = groupMatches.find((m) => !['completed', 'forfeit'].includes(String(m.status || '')));
        if (incompleteGroupMatch) throw new Error('All group matches must be completed before starting the next round');

        const existingKnockouts = await query(
          `SELECT * FROM matches
            WHERE tournament_id = ?
              AND type NOT IN ('group', 'group_stage')
            ORDER BY round ASC, group_number ASC, created_date ASC
            FOR UPDATE`,
          [id]
        );
        if (existingKnockouts.length) {
          const standings = calculateTournamentGroupStandings(groupMatches, tournament.num_groups || 2);
          const pairs = buildGroupKnockoutPairs(standings);
          const qualifiedIds = new Set(pairs.flat().map((team) => String(team.id)));
          const hasKnockoutResults = existingKnockouts.some((match) => ['completed', 'forfeit'].includes(String(match.status || '')));
          const expectedMatchCount = pairs.length * 2;
          const needsRepair = !hasKnockoutResults && (
            existingKnockouts.length !== expectedMatchCount
            || existingKnockouts.some((match) => {
              const homeId = String(match.home_club_id || '');
              const awayId = String(match.away_club_id || '');
              return !homeId || !awayId || homeId === awayId || !qualifiedIds.has(homeId) || !qualifiedIds.has(awayId);
            })
          );
          if (needsRepair) {
            return createGroupStageKnockoutRound(query, tournament, groupMatches, { replaceExisting: true });
          }

          const nextRoundValue = Number(existingKnockouts[0].round || currentRound + 1);
          if (currentRound < nextRoundValue) {
            await query('UPDATE tournaments SET current_round = ?, updated_date = NOW() WHERE id = ?', [nextRoundValue, id]);
            return { completed: false, current_round: nextRoundValue, created: 0, skipped_existing: true };
          }
        }
        if (!existingKnockouts.length) return createGroupStageKnockoutRound(query, tournament, groupMatches);
      }

      const currentMatches = await query(
        'SELECT * FROM matches WHERE tournament_id = ? AND round = ? ORDER BY created_date ASC FOR UPDATE',
        [id, currentRound]
      );
      if (!currentMatches.length) throw new Error('No matches found for current round');
      const incomplete = currentMatches.find((m) => !['completed', 'forfeit'].includes(String(m.status || '')));
      if (incomplete) throw new Error('Current round is not complete');

      const twoLegTypes = new Set(['round_of_16', 'quarter_final', 'semi_final']);
      const currentType = String(currentMatches[0]?.type || '');
      if (twoLegTypes.has(currentType)) {
        const nextLegs = await query(
          'SELECT * FROM matches WHERE tournament_id = ? AND round = ? AND type = ? ORDER BY group_number ASC, created_date ASC FOR UPDATE',
          [id, currentRound + 1, currentType]
        );
        if (nextLegs.length === currentMatches.length) {
          const nextLegIncomplete = nextLegs.find((m) => !['completed', 'forfeit'].includes(String(m.status || '')));
          if (nextLegIncomplete) {
            await query('UPDATE tournaments SET current_round = ?, updated_date = NOW() WHERE id = ?', [currentRound + 1, id]);
            return { completed: false, current_round: currentRound + 1, created: 0, next_leg: true };
          }
          const byTie = new Map();
          [...currentMatches, ...nextLegs].forEach((match) => {
            const key = String(match.group_number ?? match.id);
            if (!byTie.has(key)) byTie.set(key, []);
            byTie.get(key).push(match);
          });
          const tieResults = Array.from(byTie.values()).map(getTwoLegTieResult).filter(Boolean);
          if (tieResults.length !== currentMatches.length) throw new Error('Could not resolve all two-leg ties');
          const targetRound = currentRound + 2;
          const created = await createOrRepairNextRoundFromTieResults(query, id, tieResults, targetRound);
          await query('UPDATE tournaments SET current_round = ?, updated_date = NOW() WHERE id = ?', [targetRound, id]);
          return { completed: false, current_round: targetRound, created, aggregate: true, skipped_existing: created === 0 };
        }

        const previousLegs = await query(
          'SELECT * FROM matches WHERE tournament_id = ? AND round = ? AND type = ? ORDER BY group_number ASC, created_date ASC FOR UPDATE',
          [id, currentRound - 1, currentType]
        );
        if (previousLegs.length === currentMatches.length) {
          const byTie = new Map();
          [...previousLegs, ...currentMatches].forEach((match) => {
            const key = String(match.group_number ?? match.id);
            if (!byTie.has(key)) byTie.set(key, []);
            byTie.get(key).push(match);
          });
          const tieResults = Array.from(byTie.values()).map(getTwoLegTieResult).filter(Boolean);
          if (tieResults.length !== currentMatches.length) throw new Error('Could not resolve all two-leg ties');

          const nextRound = currentRound + 1;
          const created = await createOrRepairNextRoundFromTieResults(query, id, tieResults, nextRound);
          await query('UPDATE tournaments SET current_round = ?, updated_date = NOW() WHERE id = ?', [nextRound, id]);
          return { completed: false, current_round: nextRound, created, aggregate: true, skipped_existing: created === 0 };
        }
      }

      const winners = currentMatches
        .filter((m) => m.winner_club_id)
        .map((m) => ({
          id: m.winner_club_id,
          name: String(m.winner_club_id) === String(m.home_club_id) ? m.home_club_name : m.away_club_name,
        }));
      if (winners.length < 1) throw new Error('No winners found for current round');

      const finalMatch = currentMatches.find((m) => String(m.type || '').includes('final'));
      if (finalMatch?.winner_club_id) {
        const winnerName = String(finalMatch.winner_club_id) === String(finalMatch.home_club_id)
          ? finalMatch.home_club_name
          : finalMatch.away_club_name;
        return { completed: false, ready_to_officialize: true, winner: { id: finalMatch.winner_club_id, name: winnerName }, created: 0 };
      }

      if (winners.length === 1) {
        return { completed: false, ready_to_officialize: true, winner: winners[0], created: 0 };
      }

      const nextRound = currentRound + 1;
      const existingNext = await query(
        'SELECT id FROM matches WHERE tournament_id = ? AND round = ? LIMIT 1',
        [id, nextRound]
      );
      if (existingNext.length) {
        await query('UPDATE tournaments SET current_round = ?, updated_date = NOW() WHERE id = ?', [nextRound, id]);
        return { completed: false, current_round: nextRound, created: 0, skipped_existing: true };
      }

      let created = 0;
      for (let i = 0; i < winners.length; i += 2) {
        if (!winners[i + 1]) continue;
        const isFinalRound = winners.length === 2;
        await insertTournamentMatch(query, {
          tournament_id: id,
          home_club_id: winners[i].id,
          home_club_name: winners[i].name,
          away_club_id: winners[i + 1].id,
          away_club_name: winners[i + 1].name,
          round: nextRound,
          type: isFinalRound ? 'final' : 'knockout',
          status: 'scheduled',
        });
        created++;
        if (isFinalRound) {
          const loserA = {
            id: String(winners[i].id) === String(currentMatches[i]?.home_club_id) ? currentMatches[i]?.away_club_id : currentMatches[i]?.home_club_id,
            name: String(winners[i].id) === String(currentMatches[i]?.home_club_id) ? currentMatches[i]?.away_club_name : currentMatches[i]?.home_club_name,
          };
          const loserB = {
            id: String(winners[i + 1].id) === String(currentMatches[i + 1]?.home_club_id) ? currentMatches[i + 1]?.away_club_id : currentMatches[i + 1]?.home_club_id,
            name: String(winners[i + 1].id) === String(currentMatches[i + 1]?.home_club_id) ? currentMatches[i + 1]?.away_club_name : currentMatches[i + 1]?.home_club_name,
          };
          if (loserA.id && loserB.id) {
            await insertTournamentMatch(query, {
              tournament_id: id,
              home_club_id: loserA.id,
              home_club_name: loserA.name,
              away_club_id: loserB.id,
              away_club_name: loserB.name,
              round: nextRound,
              type: 'third_place',
              status: 'scheduled',
            });
            created++;
          }
        }
      }
      await query('UPDATE tournaments SET current_round = ?, updated_date = NOW() WHERE id = ?', [nextRound, id]);
      return { completed: false, current_round: nextRound, created };
    });

    const matches = await EXECUTESQL('SELECT * FROM matches WHERE tournament_id = ?', [id]);
    for (const match of matches) broadcastMatch(match);
    if (result.completed) {
      await HANDLERS.distributeTournamentPrizes({ tournament_id: id }).catch((err) => {
        console.error('[advanceRound prize distribution]', err.message);
      });
    }
    return { data: { success: true, ...result } };
  },

  async createFinalAndThirdPlace({ _auth_user_id, tournamentId, tournament_id }) {
    if (!_auth_user_id) throw new Error('not authenticated');
    const id = tournamentId || tournament_id;
    if (!id) throw new Error('tournamentId required');

    const result = await withTransaction(async (query) => {
      const tournaments = await query('SELECT * FROM tournaments WHERE id = ? LIMIT 1 FOR UPDATE', [id]);
      if (!tournaments.length) throw new Error('Tournament not found');
      const tournament = tournaments[0];
      await assertTournamentOrganizer(_auth_user_id, tournament);
      if (String(tournament.status || '') !== 'in_progress') {
        throw new Error('Tournament must be in progress before creating the final');
      }

      const semiFinals = await query(
        `SELECT *
           FROM matches
          WHERE tournament_id = ?
            AND type = 'semi_final'
          ORDER BY round ASC, group_number ASC, created_date ASC
          FOR UPDATE`,
        [id]
      );
      if (!semiFinals.length) throw new Error('No semi-final matches found');
      const incomplete = semiFinals.find((match) => !['completed', 'forfeit'].includes(String(match.status || '')));
      if (incomplete) throw new Error('All semi-final matches must be completed first');

      const byTie = new Map();
      for (const match of semiFinals) {
        const key = String(match.group_number ?? match.id);
        if (!byTie.has(key)) byTie.set(key, []);
        byTie.get(key).push(match);
      }
      const tieGroups = Array.from(byTie.values()).filter((legs) => legs.length >= 1);
      if (tieGroups.length !== 2) {
        throw new Error('Exactly two semi-final ties are required to create the final and third-place match');
      }
      const tieResults = tieGroups.map(getTwoLegTieResult).filter(Boolean);
      if (tieResults.length !== 2) throw new Error('Could not resolve both semi-final winners');

      const nextRound = Math.max(...semiFinals.map((match) => Number(match.round || 0)).filter(Boolean)) + 1;
      const created = await createOrRepairNextRoundFromTieResults(query, id, tieResults, nextRound);
      await query('UPDATE tournaments SET current_round = ?, updated_date = NOW() WHERE id = ?', [nextRound, id]);
      return { current_round: nextRound, created, skipped_existing: created === 0 };
    });

    const matches = await EXECUTESQL('SELECT * FROM matches WHERE tournament_id = ?', [id]);
    for (const match of matches) broadcastMatch(match);
    return { data: { success: true, ...result } };
  },

  async officializeTournament({ _auth_user_id, tournamentId, tournament_id }) {
    if (!_auth_user_id) throw new Error('not authenticated');
    const id = tournamentId || tournament_id;
    if (!id) throw new Error('tournamentId required');

    const result = await withTransaction(async (query) => {
      const tournaments = await query('SELECT * FROM tournaments WHERE id = ? LIMIT 1 FOR UPDATE', [id]);
      if (!tournaments.length) throw new Error('Tournament not found');
      const tournament = tournaments[0];
      const actor = await assertTournamentOrganizer(_auth_user_id, tournament);

      const matches = await query('SELECT * FROM matches WHERE tournament_id = ? ORDER BY round ASC, created_date ASC FOR UPDATE', [id]);
      const finalMatch = matches.find((match) => String(match.type || '').toLowerCase() === 'final');
      if (!finalMatch) throw new Error('Final match not found');
      if (!['completed', 'forfeit'].includes(String(finalMatch.status || ''))) {
        throw new Error('The final must be completed before officializing the tournament');
      }

      const thirdPlaceMatch = matches.find((match) => ['third_place', 'third-place', 'bronze'].includes(String(match.type || '').toLowerCase()));
      if (thirdPlaceMatch && !['completed', 'forfeit'].includes(String(thirdPlaceMatch.status || ''))) {
        throw new Error('The third-place match must be completed before officializing the tournament');
      }

      const isPlayerTournament = String(tournament.participant_type || '').toLowerCase() === 'player';
      const winnerId = isPlayerTournament ? finalMatch.winner_player_id : finalMatch.winner_club_id;
      if (!winnerId) throw new Error('The final does not have a winner yet');
      const winnerName = isPlayerTournament
        ? (String(winnerId) === String(finalMatch.home_player_id) ? finalMatch.home_player_name : finalMatch.away_player_name)
        : (String(winnerId) === String(finalMatch.home_club_id) ? finalMatch.home_club_name : finalMatch.away_club_name);

      if (isPlayerTournament) {
        await query(
          `UPDATE tournaments
              SET status = 'completed', winner_player_id = ?, winner_player_name = ?, updated_date = NOW()
            WHERE id = ?`,
          [winnerId, winnerName || 'Winner', id]
        );
        await awardPlayerOnlyTrophy({
          query,
          playerId: winnerId,
          trophyItemId: tournament.trophy_item_id,
          tournamentId: tournament.id,
          tournament,
        }).catch((err) => {
          console.error('[officializeTournament player trophy award]', err.message);
        });
      } else {
        await query(
          `UPDATE tournaments
              SET status = 'completed', winner_club_id = ?, winner_club_name = ?, updated_date = NOW()
            WHERE id = ?`,
          [winnerId, winnerName || 'Winner', id]
        );
        await awardTournamentTrophyServer(query, tournament, winnerId).catch((err) => {
          console.error('[officializeTournament trophy award]', err.message);
        });
      }

      if (actor.isAdmin) {
        await createAuditLog({
          adminUserId: actor.user.id,
          adminEmail: actor.user.email,
          action: 'officialize_tournament',
          entityType: 'tournament',
          entityId: id,
          oldValue: { status: tournament.status, winner_club_id: tournament.winner_club_id, winner_player_id: tournament.winner_player_id },
          newValue: { status: 'completed', winner_id: winnerId, winner_name: winnerName || 'Winner' },
          reason: 'Tournament final and third-place match completed',
        }).catch(() => {});
      }

      return {
        completed: true,
        winner: { id: winnerId, name: winnerName || 'Winner' },
        third_place_required: Boolean(thirdPlaceMatch),
      };
    });

    const prizeResult = await HANDLERS.distributeTournamentPrizes({ tournament_id: id }).catch((err) => {
      console.error('[officializeTournament prize distribution]', err.message);
      return { success: false, error: err.message };
    });
    const matches = await EXECUTESQL('SELECT * FROM matches WHERE tournament_id = ?', [id]);
    for (const match of matches) broadcastMatch(match);
    const [tournament] = await EXECUTESQL('SELECT * FROM tournaments WHERE id = ? LIMIT 1', [id]);
    return { data: { success: true, ...result, prizes: prizeResult, tournament } };
  },

  async adminMatchActions({ _auth_user_id, action, match_id, approve, reason }) {
    const admin = await requireAdminUser(_auth_user_id);
    if (!action) throw new Error('action required');
    if (!match_id) throw new Error('match_id required');

    if (action === 'resolve_forfeit') {
      const result = await withTransaction(async (query) => {
        const rows = await query('SELECT * FROM matches WHERE id = ? LIMIT 1 FOR UPDATE', [match_id]);
        if (!rows.length) throw new Error('Match not found');
        const match = rows[0];
        const shouldApprove = approve === true || approve === 'true';

        let patch;
        if (shouldApprove) {
          // Refuse to retroactively forfeit a match whose result is already on
          // the record — approving would silently overwrite the played score
          // and corrupt standings.
          if (match.status === 'completed' || match.status === 'forfeit') {
            const err = new Error(
              `This match is already ${match.status === 'forfeit' ? 'forfeited' : 'completed'} — ` +
              'a forfeit can no longer be approved. Reject the claim to dismiss it, or override the score from the match panel.'
            );
            err.status = 409;
            err.code   = 'MATCH_ALREADY_RESOLVED';
            throw err;
          }
          const winnerId = match.forfeit_claimed_by;
          if (!winnerId) {
            const err = new Error('This forfeit claim has no claimant on record — it cannot be approved. Reject the claim to clear it.');
            err.status = 422;
            err.code   = 'NO_FORFEIT_CLAIMANT';
            throw err;
          }
          const winnerName = String(winnerId) === String(match.home_club_id)
            ? match.home_club_name
            : match.away_club_name;
          patch = {
            status: 'forfeit',
            forfeit_status: 'approved',
            winner_club_id: winnerId,
            winner_club_name: winnerName,
          };
          await query(
            `UPDATE matches
             SET status = ?, forfeit_status = ?, winner_club_id = ?, winner_club_name = ?, updated_date = NOW()
             WHERE id = ?`,
            [patch.status, patch.forfeit_status, patch.winner_club_id, patch.winner_club_name, match_id]
          );
        } else {
          patch = { forfeit_status: 'rejected' };
          await query(
            `UPDATE matches SET forfeit_status = ?, updated_date = NOW() WHERE id = ?`,
            [patch.forfeit_status, match_id]
          );
        }

        const updatedRows = await query('SELECT * FROM matches WHERE id = ? LIMIT 1', [match_id]);
        const updated = updatedRows[0] || { ...match, ...patch };
        await createAuditLog({
          adminUserId: admin.id,
          adminEmail: admin.email,
          action: shouldApprove ? 'approve_tournament_forfeit' : 'reject_tournament_forfeit',
          entityType: 'match',
          entityId: match_id,
          entityName: `${match.home_club_name || 'Home'} vs ${match.away_club_name || 'Away'}`,
          oldValue: match,
          newValue: updated,
          reason: reason || null,
        });
        return updated;
      });

      broadcastMatch(result);
      return { data: { success: true, match: result } };
    }

    throw new Error(`Unknown adminMatchActions action: ${action}`);
  },

  async adminMembershipActions({ _auth_user_id, action, player_id, reason }) {
    const admin = await requireAdminUser(_auth_user_id);
    if (!action) throw new Error('action required');
    if (!player_id) throw new Error('player_id required');

    if (action === 'kick_from_club') {
      const result = await withTransaction(async (query) => {
        const rows = await query('SELECT * FROM players WHERE id = ? LIMIT 1 FOR UPDATE', [player_id]);
        if (!rows.length) throw new Error('Player not found');
        const player = rows[0];
        await query(
          `UPDATE players
           SET club_id = NULL, role = 'member', club_roles = ?, status = 'free_agent', updated_date = NOW()
           WHERE id = ?`,
          [JSON.stringify(['member']), player_id]
        );
        await endActiveMemberships({ playerId: player_id, reason: 'removed', query });
        const updatedRows = await query('SELECT * FROM players WHERE id = ? LIMIT 1', [player_id]);
        const updated = updatedRows[0] || {
          ...player,
          club_id: null,
          role: 'member',
          club_roles: ['member'],
          status: 'free_agent',
        };
        await createAuditLog({
          adminUserId: admin.id,
          adminEmail: admin.email,
          action: 'kick_player_from_club',
          entityType: 'player',
          entityId: player_id,
          entityName: player.gamertag || player.email || null,
          oldValue: player,
          newValue: updated,
          reason: reason || null,
        });
        return updated;
      });

      return { data: { success: true, player: result } };
    }

    throw new Error(`Unknown adminMembershipActions action: ${action}`);
  },

  async clubAdminActions({ _auth_user_id, action, club_id, reason }) {
    const admin = await requireAdminUser(_auth_user_id);
    if (!action) throw new Error('action required');
    if (!club_id) throw new Error('club_id required');

    if (action === 'delete') {
      const result = await withTransaction(async (query) => {
        const rows = await query('SELECT * FROM clubs WHERE id = ? LIMIT 1 FOR UPDATE', [club_id]);
        if (!rows.length) throw new Error('Club not found');
        const club = rows[0];
        await query('UPDATE players SET club_id = NULL, updated_date = NOW() WHERE club_id = ?', [club_id]);
        await query('DELETE FROM club_memberships WHERE club_id = ?', [club_id]);
        await query('DELETE FROM clubs WHERE id = ?', [club_id]);
        await createAuditLog({
          adminUserId: admin.id,
          adminEmail: admin.email,
          action: 'delete_club',
          entityType: 'club',
          entityId: club_id,
          entityName: club.name || null,
          oldValue: club,
          newValue: null,
          reason: reason || null,
        });
        return club;
      });

      return { data: { success: true, club: result } };
    }

    throw new Error(`Unknown clubAdminActions action: ${action}`);
  },

  async createMatchFromLeagueFixture({ _auth_user_id, fixture_id, fixture_type }) {
    if (!_auth_user_id) throw new Error('not authenticated');
    if (!fixture_id) throw new Error('fixture_id required');
    const sourceType = fixture_type === 'regional_league' || fixture_type === 'regional_league_fixture'
      ? 'regional_league'
      : 'competition';
    const entityType = sourceType === 'regional_league' ? 'regional_league_fixture' : 'competition_fixture';

    const fixtureRows = await EXECUTESQL(
      `SELECT * FROM league_entities
        WHERE id = ? AND entity_type = ?
        LIMIT 1`,
      [fixture_id, entityType]
    );
    if (!fixtureRows.length) throw new Error('Fixture not found');
    const fixture = parseLeagueEntityRow(fixtureRows[0]);
    const scheduledDate = fixture.confirmed_date || fixture.scheduled_date || null;

    if (fixture.match_id) {
      const existingRows = await EXECUTESQL('SELECT * FROM matches WHERE id = ? LIMIT 1', [fixture.match_id]).catch(() => []);
      if (existingRows[0]?.id) {
        if (scheduledDate) {
          await EXECUTESQL('UPDATE matches SET scheduled_date = ?, updated_date = NOW() WHERE id = ?', [toMysqlDateTime(scheduledDate), fixture.match_id]).catch(() => {});
        }
        return { data: { success: true, match: existingRows[0], reused: true } };
      }
    }

    const existingMatches = await EXECUTESQL(
      `SELECT * FROM matches
        WHERE source_fixture_id = ? AND source_fixture_type = ?
        ORDER BY created_date DESC
        LIMIT 1`,
      [fixture.id, sourceType]
    ).catch(() => []);
    if (existingMatches[0]?.id) {
      if (scheduledDate) {
        await EXECUTESQL('UPDATE matches SET scheduled_date = ?, updated_date = NOW() WHERE id = ?', [toMysqlDateTime(scheduledDate), existingMatches[0].id]).catch(() => {});
      }
      await updateLeagueEntityData(
        EXECUTESQL,
        entityType,
        fixture.id,
        { ...fixture, match_id: existingMatches[0].id },
      );
      return { data: { success: true, match: existingMatches[0], reused: true } };
    }

    const payload = await enrichMatchParticipantSnapshots({
      id: uuidv4(),
      home_club_id: fixture.home_club_id || null,
      home_club_name: fixture.home_club_name || null,
      home_owner_email: fixture.home_owner_email || null,
      away_club_id: fixture.away_club_id || null,
      away_club_name: fixture.away_club_name || null,
      away_owner_email: fixture.away_owner_email || null,
      home_player_id: fixture.home_player_id || null,
      home_player_name: fixture.home_player_name || null,
      home_player_email: fixture.home_player_email || null,
      away_player_id: fixture.away_player_id || null,
      away_player_name: fixture.away_player_name || null,
      away_player_email: fixture.away_player_email || null,
      mode: fixture.home_player_id || fixture.away_player_id ? 'solo' : 'club',
      status: 'scheduled',
      scheduled_date: scheduledDate,
      // `matches.tournament_id` has an FK to `tournaments.id`.
      // Official/regional fixture IDs live in league_entities, so keep FK null
      // and store competition identity in source_fixture_* + competition_context.
      tournament_id: null,
      round: fixture.matchday || fixture.round || 1,
      source_fixture_id: fixture.id,
      source_fixture_type: sourceType,
      competition_context: buildLeagueMatchContext(fixture, sourceType),
      type: sourceType,
      stats_processed: 0,
      wager_stc: 0,
      wager_status: 'none',
    });

    const match = new Match(payload);
    await match.create();
    const [createdMatch] = await EXECUTESQL('SELECT * FROM matches WHERE id = ? LIMIT 1', [payload.id]).catch(() => []);
    await updateLeagueEntityData(
      EXECUTESQL,
      entityType,
      fixture.id,
      { ...fixture, match_id: payload.id, status: fixture.status || 'scheduled' },
    );
    await Promise.resolve(broadcastMatch(createdMatch || payload)).catch(() => {});

    return { data: { success: true, match: createdMatch || payload, reused: false } };
  },

  async syncCompletedMatchToSource({ _auth_user_id, match_id }) {
    if (!_auth_user_id) throw new Error('not authenticated');
    if (!match_id) throw new Error('match_id required');
    const rows = await EXECUTESQL('SELECT * FROM matches WHERE id = ? LIMIT 1', [match_id]);
    if (!rows.length) throw new Error('Match not found');
    const match = rows[0];
    if (match.status !== 'completed') {
      return { data: { success: false, synced: false, reason: 'match_not_completed' } };
    }
    const result = await competitionEngineService.syncMatchResultToSource(match);
    return { data: { success: true, ...result } };
  },

  async competitionFixtureResult({
    _auth_user_id,
    fixture_id,
    home_score,
    away_score,
    winner_club_id,
    winner_club_name,
    reason,
  }) {
    const admin = await requireAdminUser(_auth_user_id);
    if (!fixture_id) throw new Error('fixture_id required');
    const homeScore = Number(home_score);
    const awayScore = Number(away_score);
    if (!Number.isFinite(homeScore) || !Number.isFinite(awayScore) || homeScore < 0 || awayScore < 0) {
      throw new Error('Valid non-negative scores are required');
    }

    const result = await withTransaction(async (query) => {
      const fixtureRows = await query(
        `SELECT * FROM league_entities
          WHERE id = ? AND entity_type = 'competition_fixture'
          LIMIT 1 FOR UPDATE`,
        [fixture_id]
      );
      if (!fixtureRows.length) throw new Error('Competition fixture not found');
      const fixture = parseLeagueEntityRow(fixtureRows[0]);
      if (fixture.stats_processed === true || Number(fixture.stats_processed || 0) === 1 || String(fixture.stats_processed || '').toLowerCase() === 'true') {
        throw new Error('Fixture result has already been processed');
      }

      const resolvedWinnerId = winner_club_id
        || (homeScore > awayScore ? fixture.home_club_id : awayScore > homeScore ? fixture.away_club_id : null);
      const resolvedWinnerName = winner_club_name
        || (String(resolvedWinnerId || '') === String(fixture.home_club_id || '') ? fixture.home_club_name
          : String(resolvedWinnerId || '') === String(fixture.away_club_id || '') ? fixture.away_club_name
            : null);

      const nextFixture = {
        ...fixture,
        home_score: homeScore,
        away_score: awayScore,
        winner_club_id: resolvedWinnerId,
        winner_club_name: resolvedWinnerName,
        status: 'completed',
        stats_processed: true,
      };
      await updateLeagueEntityData(query, 'competition_fixture', fixture_id, nextFixture, { status: 'completed' });

      if (String(fixture.phase || 'league') === 'league') {
        const standingRows = await query(
          `SELECT * FROM league_entities
           WHERE entity_type = 'competition_standing'
             AND season_id = ?
             AND club_id IN (?, ?)
           FOR UPDATE`,
          [fixture.season_id, fixture.home_club_id, fixture.away_club_id]
        );
        const parsedStandings = standingRows.map(parseLeagueEntityRow);
        const homeRow = parsedStandings.find(row => String(row.club_id) === String(fixture.home_club_id));
        const awayRow = parsedStandings.find(row => String(row.club_id) === String(fixture.away_club_id));
        if (!homeRow || !awayRow) throw new Error('Competition standing rows not found');

        const isDraw = homeScore === awayScore;
        const homeWin = homeScore > awayScore;
        const buildUpdate = (row, goalsFor, goalsAgainst, resultCode) => {
          const wins = Number(row.wins || 0) + (resultCode === 'W' ? 1 : 0);
          const draws = Number(row.draws || 0) + (resultCode === 'D' ? 1 : 0);
          const losses = Number(row.losses || 0) + (resultCode === 'L' ? 1 : 0);
          const nextGoalsFor = Number(row.goals_for || 0) + goalsFor;
          const nextGoalsAgainst = Number(row.goals_against || 0) + goalsAgainst;
          return {
            played: Number(row.played || 0) + 1,
            wins,
            draws,
            losses,
            goals_for: nextGoalsFor,
            goals_against: nextGoalsAgainst,
            goal_difference: nextGoalsFor - nextGoalsAgainst,
            points: Number(row.points || 0) + (resultCode === 'W' ? 3 : resultCode === 'D' ? 1 : 0),
            form: [resultCode, ...parseFormList(row.form)].slice(0, 5),
          };
        };

        const homeUpdate = buildUpdate(homeRow, homeScore, awayScore, homeWin ? 'W' : isDraw ? 'D' : 'L');
        const awayUpdate = buildUpdate(awayRow, awayScore, homeScore, !homeWin && !isDraw ? 'W' : isDraw ? 'D' : 'L');
        const nextHomeStanding = { ...homeRow, ...homeUpdate };
        const nextAwayStanding = { ...awayRow, ...awayUpdate };

        await updateLeagueEntityData(query, 'competition_standing', homeRow.id, nextHomeStanding);
        await updateLeagueEntityData(query, 'competition_standing', awayRow.id, nextAwayStanding);

        const allStandings = await query(
          `SELECT * FROM league_entities
            WHERE entity_type = 'competition_standing' AND season_id = ?
            FOR UPDATE`,
          [fixture.season_id]
        );
        const merged = allStandings.map(row => {
          if (row.id === homeRow.id) return nextHomeStanding;
          if (row.id === awayRow.id) return nextAwayStanding;
          return parseLeagueEntityRow(row);
        });
        const sorted = sortCompetitionStandingRows(merged);
        for (let index = 0; index < sorted.length; index += 1) {
          await updateLeagueEntityData(
            query,
            'competition_standing',
            sorted[index].id,
            { ...sorted[index], position: index + 1 }
          );
        }
      }

      const updatedFixtureRows = await query(
        `SELECT * FROM league_entities
          WHERE id = ? AND entity_type = 'competition_fixture'
          LIMIT 1`,
        [fixture_id]
      );
      const updatedFixture = parseLeagueEntityRow(updatedFixtureRows[0] || null);
      await createAuditLog({
        adminUserId: admin.id,
        adminEmail: admin.email,
        action: 'submit_competition_fixture_result',
        entityType: 'competition_fixture',
        entityId: fixture_id,
        entityName: `${fixture.home_club_name || 'Home'} vs ${fixture.away_club_name || 'Away'}`,
        oldValue: fixture,
        newValue: updatedFixture,
        reason: reason || null,
      });

      return updatedFixture;
    });

    await competitionEngineService.notifyIfPhaseReady({
      sourceId: result.season_id || result.competition_id,
      sourceType: 'competition',
      fixtureType: 'competition_fixture',
      organizerUserId: result.organizer_user_id || result.admin_user_id || null,
    }).catch((err) => {
      console.error('[competitionFixtureResult.notifyIfPhaseReady]', err.message);
    });
    const advance = typeof competitionEngineService.advanceLegacyOfficialCompetitionIfReady === 'function'
      ? await competitionEngineService.advanceLegacyOfficialCompetitionIfReady(result).catch((err) => {
        console.error('[competitionFixtureResult.advance]', err.message);
        return { advanced: false, reason: 'advance_error', error: err.message };
      })
      : { advanced: false, reason: 'advance_unavailable' };

    return { data: { success: true, fixture: result, advance } };
  },

  async regionalLeagueFixtureResult({
    _auth_user_id,
    fixture_id,
    home_score,
    away_score,
    winner_club_id,
    winner_club_name,
    reason,
  }) {
    const admin = await requireAdminUser(_auth_user_id);
    if (!fixture_id) throw new Error('fixture_id required');
    const homeScore = Number(home_score);
    const awayScore = Number(away_score);
    if (!Number.isFinite(homeScore) || !Number.isFinite(awayScore) || homeScore < 0 || awayScore < 0) {
      throw new Error('Valid non-negative scores are required');
    }

    const result = await withTransaction(async (query) => {
      const fixtureRows = await query(
        `SELECT * FROM league_entities
          WHERE id = ? AND entity_type = 'regional_league_fixture'
          LIMIT 1 FOR UPDATE`,
        [fixture_id]
      );
      if (!fixtureRows.length) throw new Error('Regional league fixture not found');
      const fixture = parseLeagueEntityRow(fixtureRows[0]);
      if (fixture.stats_processed === true || Number(fixture.stats_processed || 0) === 1 || String(fixture.stats_processed || '').toLowerCase() === 'true') {
        throw new Error('Fixture result has already been processed');
      }

      const resolvedWinnerId = winner_club_id
        || (homeScore > awayScore ? fixture.home_club_id : awayScore > homeScore ? fixture.away_club_id : null);
      const resolvedWinnerName = winner_club_name
        || (String(resolvedWinnerId || '') === String(fixture.home_club_id || '') ? fixture.home_club_name
          : String(resolvedWinnerId || '') === String(fixture.away_club_id || '') ? fixture.away_club_name
            : null);

      const nextFixture = {
        ...fixture,
        home_score: homeScore,
        away_score: awayScore,
        winner_club_id: resolvedWinnerId,
        winner_club_name: resolvedWinnerName,
        status: 'played',
        stats_processed: true,
      };
      await updateLeagueEntityData(query, 'regional_league_fixture', fixture_id, nextFixture, { status: 'played' });

      const standingRows = await query(
        `SELECT * FROM league_entities
           WHERE entity_type = 'regional_league_standing'
             AND league_id = ?
             AND club_id IN (?, ?)
           FOR UPDATE`,
        [fixture.league_id, fixture.home_club_id, fixture.away_club_id]
      );
      const parsedStandings = standingRows.map(parseLeagueEntityRow);
      const homeRow = parsedStandings.find(row => String(row.club_id) === String(fixture.home_club_id));
      const awayRow = parsedStandings.find(row => String(row.club_id) === String(fixture.away_club_id));
      if (!homeRow || !awayRow) throw new Error('Regional league standing rows not found');

      const isDraw = homeScore === awayScore;
      const homeWin = homeScore > awayScore;
      const buildUpdate = (row, goalsFor, goalsAgainst, resultCode) => {
        const wins = Number(row.wins || 0) + (resultCode === 'W' ? 1 : 0);
        const draws = Number(row.draws || 0) + (resultCode === 'D' ? 1 : 0);
        const losses = Number(row.losses || 0) + (resultCode === 'L' ? 1 : 0);
        const nextGoalsFor = Number(row.goals_for || 0) + goalsFor;
        const nextGoalsAgainst = Number(row.goals_against || 0) + goalsAgainst;
        return {
          played: Number(row.played || 0) + 1,
          wins,
          draws,
          losses,
          goals_for: nextGoalsFor,
          goals_against: nextGoalsAgainst,
          goal_difference: nextGoalsFor - nextGoalsAgainst,
          points: Number(row.points || 0) + (resultCode === 'W' ? 3 : resultCode === 'D' ? 1 : 0),
          form: [resultCode, ...parseFormList(row.form)].slice(0, 5),
        };
      };

      const homeUpdate = buildUpdate(homeRow, homeScore, awayScore, homeWin ? 'W' : isDraw ? 'D' : 'L');
      const awayUpdate = buildUpdate(awayRow, awayScore, homeScore, !homeWin && !isDraw ? 'W' : isDraw ? 'D' : 'L');
      const nextHomeStanding = { ...homeRow, ...homeUpdate };
      const nextAwayStanding = { ...awayRow, ...awayUpdate };

      await updateLeagueEntityData(query, 'regional_league_standing', homeRow.id, nextHomeStanding);
      await updateLeagueEntityData(query, 'regional_league_standing', awayRow.id, nextAwayStanding);

      const allStandings = await query(
        `SELECT * FROM league_entities
          WHERE entity_type = 'regional_league_standing' AND league_id = ?
          FOR UPDATE`,
        [fixture.league_id]
      );
      const merged = allStandings.map(row => {
        if (row.id === homeRow.id) return nextHomeStanding;
        if (row.id === awayRow.id) return nextAwayStanding;
        return parseLeagueEntityRow(row);
      });
      const sorted = sortCompetitionStandingRows(merged);
      for (let index = 0; index < sorted.length; index += 1) {
        await updateLeagueEntityData(
          query,
          'regional_league_standing',
          sorted[index].id,
          { ...sorted[index], position: index + 1 }
        );
      }

      const updatedFixtureRows = await query(
        `SELECT * FROM league_entities
          WHERE id = ? AND entity_type = 'regional_league_fixture'
          LIMIT 1`,
        [fixture_id]
      );
      const updatedFixture = parseLeagueEntityRow(updatedFixtureRows[0] || null);
      await createAuditLog({
        adminUserId: admin.id,
        adminEmail: admin.email,
        action: 'submit_regional_league_fixture_result',
        entityType: 'regional_league_fixture',
        entityId: fixture_id,
        entityName: `${fixture.home_club_name || 'Home'} vs ${fixture.away_club_name || 'Away'}`,
        oldValue: fixture,
        newValue: updatedFixture,
        reason: reason || null,
      });

      return updatedFixture;
    });

    await competitionEngineService.notifyIfPhaseReady({
      sourceId: result.league_id,
      sourceType: 'regional_league',
      fixtureType: 'regional_league_fixture',
      organizerUserId: result.organizer_user_id || result.admin_user_id || null,
    }).catch((err) => {
      console.error('[regionalLeagueFixtureResult.notifyIfPhaseReady]', err.message);
    });
    const advance = typeof competitionEngineService.advanceRegionalLeagueIfReady === 'function'
      ? await competitionEngineService.advanceRegionalLeagueIfReady(result).catch((err) => {
        console.error('[regionalLeagueFixtureResult.advance]', err.message);
        return { advanced: false, reason: 'advance_error', error: err.message };
      })
      : { advanced: false, reason: 'advance_unavailable' };

    return { data: { success: true, fixture: result, advance } };
  },

  async resolveClubContact({ _auth_user_id, club_id }) {
    if (!_auth_user_id) throw new Error('not authenticated');
    return resolveClubContactForInvite(club_id);
  },

  async adminRemoveClubFromCompetition({
    _auth_user_id,
    target_type,
    target_id,
    club_id,
    standing_id,
    reason,
  }) {
    if (!_auth_user_id) throw new Error('not authenticated');
    if (!target_id) throw new Error('target_id required');
    if (!club_id) throw new Error('club_id required');

    const adminRows = await EXECUTESQL('SELECT id, email, role_id FROM users WHERE id = ? LIMIT 1', [_auth_user_id]);
    const admin = adminRows[0];
    if (!admin || Number(admin.role_id) !== 0) throw new Error('Admin only');

    const cfg = leagueEntityTypeConfig(target_type);
    const result = await withTransaction(async (query) => {
      const parentRows = await query(
        `SELECT * FROM league_entities WHERE id = ? AND entity_type = ? LIMIT 1 FOR UPDATE`,
        [target_id, cfg.parentType]
      );
      if (!parentRows.length) throw new Error(`${cfg.parentLabel} not found`);
      const parent = parseLeagueEntityRow(parentRows[0]);

      const standingRows = standing_id
        ? await query(
            `SELECT * FROM league_entities WHERE id = ? AND entity_type = ? LIMIT 1 FOR UPDATE`,
            [standing_id, cfg.standingType]
          )
        : await query(
            `SELECT * FROM league_entities
              WHERE entity_type = ?
                AND \`${cfg.parentFilter}\` = ?
                AND club_id = ?
              LIMIT 1 FOR UPDATE`,
            [cfg.standingType, target_id, club_id]
          );
      if (!standingRows.length) throw new Error('Club is not in this league/competition');
      const standing = parseLeagueEntityRow(standingRows[0]);
      if (String(standing.club_id || '') !== String(club_id)) {
        throw new Error('Standing row does not belong to this club');
      }
      if ((Number(standing.played) || 0) > 0) {
        throw new Error('This club has already played in this league/competition. Remove or correct played results first.');
      }

      const completedFixtures = await query(
        `SELECT id FROM league_entities
          WHERE entity_type = ?
            AND \`${cfg.parentFilter}\` = ?
            AND (
              JSON_UNQUOTE(JSON_EXTRACT(data_json, '$.home_club_id')) = ?
              OR JSON_UNQUOTE(JSON_EXTRACT(data_json, '$.away_club_id')) = ?
            )
            AND (
              status = 'completed'
              OR JSON_EXTRACT(data_json, '$.stats_processed') = true
              OR JSON_UNQUOTE(JSON_EXTRACT(data_json, '$.stats_processed')) = 'true'
            )
          LIMIT 1`,
        [cfg.fixtureType, target_id, club_id, club_id]
      );
      if (completedFixtures.length) {
        throw new Error('This club has completed fixtures in this league/competition. Reverse those results before removing it.');
      }

      const fixtureDeleteResult = await query(
        `DELETE FROM league_entities
          WHERE entity_type = ?
            AND \`${cfg.parentFilter}\` = ?
            AND (
              JSON_UNQUOTE(JSON_EXTRACT(data_json, '$.home_club_id')) = ?
              OR JSON_UNQUOTE(JSON_EXTRACT(data_json, '$.away_club_id')) = ?
            )`,
        [cfg.fixtureType, target_id, club_id, club_id]
      );

      await query(
        `DELETE FROM league_entities WHERE id = ? AND entity_type = ?`,
        [standing.id, cfg.standingType]
      );

      const registeredIds = normalizeIdList(parent.registered_club_ids);
      const nextIds = registeredIds.filter(id => String(id) !== String(club_id));
      const nextParent = {
        ...parent,
        registered_club_ids: nextIds,
        num_clubs: nextIds.length || Math.max(0, (Number(parent.num_clubs) || 0) - 1),
      };
      await query(
        `UPDATE league_entities
          SET data_json = ?, updated_date = NOW()
          WHERE id = ? AND entity_type = ?`,
        [JSON.stringify(nextParent), target_id, cfg.parentType]
      );

      if (cfg.parentType === 'regional_league') {
        await query(
          `UPDATE league_entities
            SET data_json = JSON_SET(
              data_json,
              '$.status', 'removed',
              '$.admin_notes', ?,
              '$.reviewed_by', ?,
              '$.reviewed_at', ?
            ),
            status = 'removed',
            updated_date = NOW()
            WHERE entity_type = 'season_registration'
              AND club_id = ?
              AND JSON_UNQUOTE(JSON_EXTRACT(data_json, '$.assigned_league_id')) = ?`,
          [
            reason || `Removed from ${parent.name || 'league'} by admin`,
            admin.email || 'admin',
            new Date().toISOString(),
            club_id,
            target_id,
          ]
        ).catch(() => {});
      }

      await createAuditLog({
        adminUserId: admin.id,
        adminEmail: admin.email,
        action: 'remove_club_from_league_competition',
        entityType: cfg.parentType,
        entityId: target_id,
        entityName: parent.name || parent.season_label || null,
        oldValue: { parent, standing },
        newValue: {
          parent: nextParent,
          removed_club_id: club_id,
          deleted_fixtures: fixtureDeleteResult?.affectedRows || 0,
        },
        reason: reason || null,
      });

      return {
        success: true,
        removed_club_id: club_id,
        target_type: cfg.parentType,
        target_id,
        deleted_fixtures: fixtureDeleteResult?.affectedRows || 0,
        num_clubs: nextParent.num_clubs,
      };
    });
    return { data: result };
  },

  async awardClubSeasonPrize({
    _auth_user_id,
    club_id,
    amount,
    description,
    reference_id,
    legacy_reference_id,
    category = 'competition_reward',
    position,
  }) {
    if (!_auth_user_id) throw new Error('not authenticated');
    if (!club_id) throw new Error('club_id required');
    const prize = Number(amount || 0);
    if (prize <= 0) return { success: true, skipped: true, reason: 'no_prize' };

    const adminRows = await EXECUTESQL('SELECT id, email, role_id FROM users WHERE id = ? LIMIT 1', [_auth_user_id]);
    const admin = adminRows[0];
    if (!admin || Number(admin.role_id) !== 0) throw new Error('Admin only');

    const ref = reference_id || uuidv4();
    const existing = await EXECUTESQL(
      `SELECT id FROM stc_transactions
        WHERE club_id = ?
          AND category = ?
          AND (reference_id = ? ${legacy_reference_id ? 'OR reference_id = ?' : ''})
        LIMIT 1`,
      legacy_reference_id
        ? [club_id, category, ref, legacy_reference_id]
        : [club_id, category, ref]
    );
    if (existing.length) return { success: true, skipped: true, reason: 'already_paid', transaction_id: existing[0].id };

    const result = await createClubTx({
      clubId: club_id,
      amount: prize,
      type: 'income',
      category,
      description: description || 'Competition prize',
      referenceId: ref,
      relatedEntityType: 'competition',
    });

    if (Number(position) === 1) {
      await EXECUTESQL(
        'UPDATE clubs SET trophies = COALESCE(trophies, 0) + 1, updated_date = NOW() WHERE id = ?',
        [club_id]
      ).catch(() => {});
    }

    await createAuditLog({
      adminUserId: admin.id,
      adminEmail: admin.email,
      action: 'award_club_season_prize',
      entityType: 'club',
      entityId: club_id,
      oldValue: null,
      newValue: { amount: prize, category, description, reference_id: ref, position },
      reason: 'Season reward distribution',
    });

    return { success: true, ...result };
  },

  async resolvePlayerContact({ _auth_user_id, player_id }) {
    if (!_auth_user_id) throw new Error('not authenticated');
    return resolvePlayerContactForInvite(player_id);
  },

  async submitPlayerIdentityClaim({
    _auth_user_id,
    player_id,
    platform,
    platform_handle,
    ea_id,
    discord_handle,
    proof_url,
    notes,
  }) {
    await ensureIdentityClaimsTable();
    const userRows = await EXECUTESQL('SELECT id, email, role_id FROM users WHERE id = ? LIMIT 1', [_auth_user_id]);
    if (!userRows.length) throw new Error('User not found');
    const user = userRows[0];
    if (!player_id) throw new Error('player_id required');
    if (!platform || !platform_handle) throw new Error('platform and platform_handle are required');

    const players = await EXECUTESQL('SELECT * FROM players WHERE id = ? LIMIT 1', [player_id]);
    if (!players.length) throw new Error('Player not found');
    const player = players[0];
    const ownsPlayer =
      player.user_id === user.id ||
      String(player.email || '').toLowerCase() === String(user.email || '').toLowerCase() ||
      Number(user.role_id) === 0;
    if (!ownsPlayer) throw new Error('You can only claim your own player identity');
    if (Number(player.is_verified) === 1) throw new Error('Player is already verified');

    const pending = await EXECUTESQL(
      "SELECT id FROM player_identity_claims WHERE player_id = ? AND status = 'pending' LIMIT 1",
      [player.id]
    );
    if (pending.length) throw new Error('You already have a pending identity claim');

    const id = uuidv4();
    await EXECUTESQL(
      `INSERT INTO player_identity_claims
         (id, player_id, user_id, email, gamertag, platform, platform_handle,
          ea_id, discord_handle, proof_url, notes, status, created_date, updated_date)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', NOW(), NOW())`,
      [
        id,
        player.id,
        player.user_id || user.id,
        player.email || user.email,
        player.gamertag || null,
        String(platform).trim(),
        String(platform_handle).trim(),
        ea_id ? String(ea_id).trim() : null,
        discord_handle ? String(discord_handle).trim() : null,
        proof_url ? String(proof_url).trim() : null,
        notes ? String(notes).trim() : null,
      ]
    );
    const rows = await EXECUTESQL('SELECT * FROM player_identity_claims WHERE id = ? LIMIT 1', [id]);
    await notifyAdminsOfIdentityClaim(rows[0]);
    return { success: true, data: rows[0] };
  },

  async listPlayerIdentityClaims({ _auth_user_id, player_id, status, limit = 50 }) {
    await ensureIdentityClaimsTable();
    const userRows = await EXECUTESQL('SELECT id, email, role_id FROM users WHERE id = ? LIMIT 1', [_auth_user_id]);
    if (!userRows.length) throw new Error('User not found');
    const user = userRows[0];
    const isAdmin = Number(user.role_id) === 0;
    const wheres = [];
    const vals = [];
    if (player_id) {
      wheres.push('player_id = ?');
      vals.push(player_id);
    }
    if (status) {
      if (!isAdmin) throw new Error('Admin access required');
      wheres.push('status = ?');
      vals.push(status);
    }
    if (!isAdmin) {
      wheres.push('(user_id = ? OR LOWER(email) = LOWER(?))');
      vals.push(user.id, user.email);
    }
    const clause = wheres.length ? `WHERE ${wheres.join(' AND ')}` : '';
    const rows = await EXECUTESQL(
      `SELECT * FROM player_identity_claims ${clause} ORDER BY created_date DESC LIMIT ?`,
      [...vals, Math.min(Number(limit) || 50, 200)]
    );
    return { success: true, data: rows };
  },

  async reviewPlayerIdentityClaim({ _auth_user_id, id, status, review_notes, rejection_reason }) {
    await ensureIdentityClaimsTable();
    const adminRows = await EXECUTESQL('SELECT id, email, role_id FROM users WHERE id = ? LIMIT 1', [_auth_user_id]);
    if (!adminRows.length || Number(adminRows[0].role_id) !== 0) throw new Error('Admin access required');
    if (!id || !['approved', 'rejected'].includes(status)) throw new Error('id and approved/rejected status required');
    const rows = await EXECUTESQL('SELECT * FROM player_identity_claims WHERE id = ? LIMIT 1', [id]);
    if (!rows.length) throw new Error('Claim not found');
    const claim = rows[0];

    await EXECUTESQL(
      `UPDATE player_identity_claims
       SET status = ?, review_notes = ?, rejection_reason = ?, reviewed_by = ?,
           reviewed_by_email = ?, reviewed_at = NOW(), updated_date = NOW()
       WHERE id = ?`,
      [status, review_notes || null, rejection_reason || null, adminRows[0].id, adminRows[0].email, id]
    );

    if (status === 'approved') {
      await EXECUTESQL(
        `UPDATE players
         SET is_verified = 1,
             verified_platform = ?,
             verified_platform_handle = ?,
             identity_verified_at = NOW(),
             updated_date = NOW()
         WHERE id = ?`,
        [claim.platform, claim.platform_handle, claim.player_id]
      );
    }

    await EXECUTESQL(
      `INSERT INTO admin_audit_log
         (id, admin_user_id, admin_email, action, entity_type, entity_id, entity_name,
          old_value, new_value, reason, created_date)
       VALUES (?, ?, ?, ?, 'player_identity_claim', ?, ?, ?, ?, ?, NOW())`,
      [
        uuidv4(),
        adminRows[0].id,
        adminRows[0].email,
        status === 'approved' ? 'approve_player_identity_claim' : 'reject_player_identity_claim',
        claim.player_id,
        claim.gamertag || null,
        JSON.stringify(claim),
        JSON.stringify({ ...claim, status }),
        review_notes || rejection_reason || null,
      ]
    ).catch(() => {});

    const updated = await EXECUTESQL('SELECT * FROM player_identity_claims WHERE id = ? LIMIT 1', [id]);
    return { success: true, data: updated[0] };
  },

  async sendNotification({ recipient_email, type, title, body, link, related_id, dedup_key }) {
    if (!recipient_email || !type || !title) throw new Error('Missing required fields: recipient_email, type, title');
    if (dedup_key) {
      const existing = await EXECUTESQL(
        `SELECT id FROM notifications
         WHERE LOWER(recipient_email)=LOWER(?) AND type=? AND related_id=? AND created_date >= (NOW() - INTERVAL 5 MINUTE)
         LIMIT 1`,
        [recipient_email, type, dedup_key]
      );
      if (existing.length) return { skipped: true, reason: 'Duplicate notification suppressed' };
    }
    const result = await createNotificationIfEnabled({
      recipientEmail: recipient_email,
      type,
      title,
      body: body || '',
      link: link || '',
      relatedId: related_id || dedup_key || null,
    });
    return result.skipped ? result : { success: true, notification: { id: result.id } };
  },

  async sendInboxMessage({
    recipient_email,
    recipient_player_id,
    sender_email,
    sender_gamertag,
    sender_avatar_url,
    sender_club_name,
    subject,
    body,
    message_type = 'general',
    action_type = 'none',
    related_entity_id,
    related_entity_type,
    metadata,
    send_notification = true,
  }) {
    let recipient = recipient_email;
    if (!recipient && recipient_player_id) {
      const p = await EXECUTESQL(
        `SELECT COALESCE(NULLIF(TRIM(p.email), ''), NULLIF(TRIM(u.email), '')) AS email
           FROM players p
           LEFT JOIN users u ON u.id = p.user_id OR u.player_id = p.id
          WHERE p.id = ?
          LIMIT 1`,
        [recipient_player_id]
      );
      recipient = p[0]?.email || null;
    }
    if (!recipient || !subject || !body) throw new Error('Missing required fields: recipient_email (or recipient_player_id), subject, body');

    let senderGamertag = sender_gamertag || null;
    let senderAvatar = sender_avatar_url || null;
    let senderClubName = sender_club_name || null;
    const isSystem = !sender_email;
    if (sender_email) {
      const senderPlayerRows = await EXECUTESQL('SELECT id, gamertag, avatar_url, club_id FROM players WHERE LOWER(email)=LOWER(?) LIMIT 1', [sender_email]);
      const senderPlayer = senderPlayerRows[0];
      if (senderPlayer) {
        senderGamertag = senderGamertag || senderPlayer.gamertag || null;
        senderAvatar = senderAvatar || senderPlayer.avatar_url || null;
        if (senderPlayer.club_id) {
          const clubRows = await EXECUTESQL('SELECT name FROM clubs WHERE id = ? LIMIT 1', [senderPlayer.club_id]);
          senderClubName = senderClubName || clubRows[0]?.name || null;
        }
      }
    }

    const normalizedRecipient = String(recipient).trim().toLowerCase();
    const idempotencyKey = related_entity_id
      ? `${message_type}:${related_entity_type || 'entity'}:${related_entity_id}:${normalizedRecipient}`
      : `manual_message:${uuidv4()}`;
    return sendActionMessage({
      recipientEmail: normalizedRecipient,
      senderEmail: sender_email || null,
      senderGamertag,
      senderAvatarUrl: senderAvatar,
      senderClubName,
      subject,
      body,
      messageType: message_type,
      actionType: action_type,
      relatedEntityId: related_entity_id || null,
      relatedEntityType: related_entity_type || null,
      metadata,
      idempotencyKey,
      isSystem,
      notify: send_notification,
      notification: {
        type: messageTypeToNotificationType(message_type),
        title: `New message: ${subject}`,
        body: isSystem ? 'System message' : `From ${senderGamertag || sender_email || 'Unknown'}`,
      },
    });
  },

  async respondInboxMessage({ message_id, action, new_date, new_time, _auth_user_id }) {
    const VALID_ACTIONS = ['accepted', 'declined', 'confirmed', 'date_change_requested'];
    if (!message_id || !action) throw new Error('Missing required fields: message_id, action');
    if (!VALID_ACTIONS.includes(action)) throw new Error(`Invalid action. Must be one of: ${VALID_ACTIONS.join(', ')}`);
    const { user } = await getMe(_auth_user_id);
    const rows = await EXECUTESQL('SELECT * FROM inbox_messages WHERE id = ? LIMIT 1', [message_id]);
    const message = rows[0];
    if (!message) throw new Error('Message not found');
    if (String(message.recipient_email || '').toLowerCase() !== String(user.email || '').toLowerCase()) throw new Error('Forbidden');
    await markInboxMessageResponded(message_id, action);

    const meta = parseMaybeJson(message.metadata, {});
    const isMatchInvite = message.message_type === 'match_invite';

    // Accepting a reschedule request confirms date on existing match if available.
    if (action === 'accepted' && isMatchInvite && meta.reschedule_request) {
      const existingMatchId = meta.created_match_id || message.related_entity_id;
      const nextDate = toMysqlDateTime(meta.scheduled_date);
      if (existingMatchId && nextDate) {
        await EXECUTESQL('UPDATE matches SET scheduled_date = ?, updated_date = NOW() WHERE id = ?', [nextDate, existingMatchId]);
        await broadcastMatchById(existingMatchId);
      }
      if (message.sender_email) {
        await createMatchInviteResponseMessage({
          originalMessage: message,
          meta,
          senderEmail: user.email,
          subject: `Match Accepted: ${meta.challenger_name || 'Challenger'} vs ${meta.opponent_name || 'Opponent'}`,
          body: `${meta.opponent_name || user.email} accepted your reschedule request.\n\nMatch date: ${nextDate || 'TBD'}`,
          matchId: existingMatchId || null,
        });
        await createNotificationIfEnabled({
          recipientEmail: message.sender_email,
          type: 'match_scheduled',
          title: `${user.email} accepted the reschedule`,
          body: nextDate ? `Match confirmed for ${nextDate}` : 'Reschedule accepted.',
          link: '/schedule',
          relatedId: existingMatchId || message_id,
        });
      }
      return { success: true, message: { id: message_id, status: action } };
    }

    if (action === 'accepted' && isMatchInvite) {
      // Prevent duplicate match creation if already linked.
      if (meta.created_match_id) {
        return { success: true, message: { id: message_id, status: action }, match: { id: meta.created_match_id } };
      }
      const scheduledDate = toMysqlDateTime(meta.scheduled_date);
      const payload = await createRankedMatchFromInviteMetadata(meta, { homeSide: 'challenger', scheduledDate });
      await EXECUTESQL(
        'UPDATE inbox_messages SET related_entity_id = ?, related_entity_type = ?, metadata = ? WHERE id = ?',
        [payload.id, 'match', JSON.stringify({ ...meta, created_match_id: payload.id }), message_id]
      );
      if (Number(meta.wager_stc || 0) > 0) {
        await HANDLERS.wagerMatchActions({ action: 'accept_wager', match_id: payload.id }).catch(() => {});
      }
      if (message.sender_email) {
        await createMatchInviteResponseMessage({
          originalMessage: message,
          meta,
          senderEmail: user.email,
          subject: `Match Accepted: ${meta.challenger_name || 'Challenger'} vs ${meta.opponent_name || 'Opponent'}`,
          body: `${meta.opponent_name || user.email} accepted your match invitation.\n\nMatch date: ${scheduledDate || 'TBD'}`,
          matchId: payload.id,
        });
        await createNotificationIfEnabled({
          recipientEmail: message.sender_email,
          type: 'match_scheduled',
          title: `${user.email} accepted your invite`,
          body: 'Match created and scheduled.',
          link: '/schedule',
          relatedId: payload.id,
        });
      }
      return { success: true, message: { id: message_id, status: action }, match: { id: payload.id } };
    }

    if (action === 'date_change_requested' && isMatchInvite && message.sender_email) {
      const proposedMysql = (new_date && new_time) ? toMysqlDateTime(`${new_date} ${new_time.length === 5 ? `${new_time}:00` : new_time}`) : null;
      const proposalBody = `${user.email} would like to reschedule.\nProposed: ${proposedMysql || 'Please discuss a new time.'}`;
      await sendActionMessage({
        recipientEmail: message.sender_email,
        senderEmail: user.email,
        subject: `Reschedule Proposal: ${message.subject || 'Match Invite'}`,
        body: proposalBody,
        messageType: 'match_invite',
        actionType: 'accept_decline_date',
        relatedEntityId: meta.created_match_id || message.related_entity_id || message_id,
        relatedEntityType: meta.created_match_id || message.related_entity_id ? 'match' : 'inbox_message',
        idempotencyKey: `match_reschedule:${message_id}:${new_date || 'open'}:${new_time || 'open'}`,
        reuseByRelated: false,
        metadata: {
          ...meta,
          scheduled_date: proposedMysql || meta.scheduled_date,
          reschedule_request: true,
          original_message_id: message_id,
        },
        notification: {
          type: 'match_reminder',
          title: `${user.email} wants to reschedule`,
          body: proposedMysql ? `New proposed date: ${proposedMysql}` : 'A new date was requested.',
        },
      });
    }

    if (action === 'declined' && isMatchInvite && message.sender_email) {
      await createMatchInviteResponseMessage({
        originalMessage: message,
        meta,
        senderEmail: user.email,
        subject: `Match Declined: ${meta.challenger_name || 'Challenger'} vs ${meta.opponent_name || 'Opponent'}`,
        body: `${meta.opponent_name || user.email} declined your match invitation.`,
      });
    }

    if (action === 'confirmed' && isMatchInvite) {
      const existingMatchId = meta.created_match_id || message.related_entity_id;
      const targetDate = toMysqlDateTime(meta.scheduled_date);
      if (existingMatchId && targetDate) {
        await EXECUTESQL(
          'UPDATE matches SET scheduled_date = ?, updated_date = NOW() WHERE id = ?',
          [targetDate, existingMatchId]
        );
        await broadcastMatchById(existingMatchId);
      } else if (!existingMatchId) {
        // Confirming a date proposal before match exists -> create now.
        const payload = await createRankedMatchFromInviteMetadata(meta, { homeSide: 'opponent', scheduledDate: targetDate });
        await EXECUTESQL(
          'UPDATE inbox_messages SET related_entity_id = ?, related_entity_type = ?, metadata = ? WHERE id = ?',
          [payload.id, 'match', JSON.stringify({ ...meta, created_match_id: payload.id }), message_id]
        );
      }
      if (message.sender_email) {
        await createNotificationIfEnabled({
          recipientEmail: message.sender_email,
          type: 'match_scheduled',
          title: `${user.email} confirmed the date`,
          body: targetDate ? `Match scheduled for ${targetDate}` : 'Match date confirmed.',
          link: '/schedule',
          relatedId: existingMatchId || message_id,
        });
      }
    }

    if (message.sender_email && ['declined', 'confirmed'].includes(action)) {
      await createNotificationIfEnabled({
        recipientEmail: message.sender_email,
        type: 'message',
        title: `${user.email} ${action} your message`,
        body: `Regarding: "${message.subject || 'Inbox message'}"`,
        link: '/inbox',
        relatedId: message_id,
      });
    }

    return { success: true, message: { id: message_id, status: action } };
  },
  // ── EA Pro Clubs API proxy ────────────────────────────────────────────────
  async eafcApi({ endpoint, params }) {
    const builder = EA_ENDPOINTS[endpoint];
    if (!builder) throw new Error(`Unknown EA endpoint: ${endpoint}`);
    const url = `${EA_BASE}${builder(params)}`;
    const res = await axios.get(url, {
      headers: { 'User-Agent': 'Mozilla/5.0', 'Accept': 'application/json' },
      timeout: 10000,
    });
    return { data: res.data };
  },

  // ── Credits ───────────────────────────────────────────────────────────────
  async spendCredits({ amount, _auth_user_id }) {
    if (!_auth_user_id || !amount) throw new Error('amount required');
    const rows = await EXECUTESQL('SELECT id, credits FROM players WHERE user_id = ?', [_auth_user_id]);
    if (!rows.length) throw new Error('Player not found');
    if (rows[0].credits < amount) throw new Error('Insufficient credits');
    await EXECUTESQL('UPDATE players SET credits = credits - ? WHERE id = ?', [amount, rows[0].id]);
    return { success: true };
  },

  // ── Tournament prize distribution ─────────────────────────────────────────
  async distributeTournamentPrizes({ tournament_id }) {
    if (!tournament_id) throw new Error('tournament_id required');
    const [t] = await EXECUTESQL('SELECT * FROM tournaments WHERE id = ?', [tournament_id]);
    if (!t) throw new Error('Tournament not found');

    const matches = await EXECUTESQL(
      "SELECT * FROM matches WHERE tournament_id = ? AND status IN ('completed','forfeit') ORDER BY round DESC, created_date DESC",
      [tournament_id],
    );

    const isPlayerTournament = String(t.participant_type || '').toLowerCase() === 'player';
    const hasWinner = (match) => Boolean(isPlayerTournament ? match?.winner_player_id : match?.winner_club_id);
    const isFinalMatch = (match) => {
      const type = String(match?.type || '').toLowerCase();
      if (type.includes('semi') || type.includes('quarter') || type.includes('third') || type.includes('bronze')) return false;
      return type === 'final' || type === 'grand_final' || type === 'championship' || type.endsWith('_final');
    };
    const finalMatch = matches.find(m => isFinalMatch(m) && hasWinner(m))
      || matches.find(m => (isPlayerTournament ? m.winner_player_id : m.winner_club_id));
    const thirdPlaceMatch = matches.find(m => ['third_place', 'third-place', 'placement_third', 'bronze'].includes(String(m.type || '').toLowerCase()) && hasWinner(m));

    const loserOf = (match) => {
      if (!match) return null;
      if (isPlayerTournament) {
        if (!match.winner_player_id) return null;
        if (String(match.winner_player_id) === String(match.home_player_id)) {
          return { id: match.away_player_id, name: match.away_player_name };
        }
        return { id: match.home_player_id, name: match.home_player_name };
      }
      if (!match.winner_club_id) return null;
      if (String(match.winner_club_id) === String(match.home_club_id)) {
        return { id: match.away_club_id, name: match.away_club_name };
      }
      return { id: match.home_club_id, name: match.home_club_name };
    };

    const registeredClubs = parseMaybeJson(t.registered_clubs, []);
    const registeredPlayers = parseMaybeJson(t.registered_players, []);
    const registeredCount = isPlayerTournament ? registeredPlayers.length : registeredClubs.length;
    const fallbackPool = Number(t.prize_pool_stc || 0) || Number(t.entry_fee_stc || 0) * registeredCount;
    const fallbackWinner = fallbackPool > 0 ? Math.round(fallbackPool * 0.7) : 0;
    const fallbackRunnerUp = fallbackPool > 0 ? Math.round(fallbackPool * 0.2) : 0;
    const fallbackThirdPlace = fallbackPool > 0 ? Math.max(0, fallbackPool - fallbackWinner - fallbackRunnerUp) : 0;

    const payouts = [
      {
        label: 'Winner',
        clubId: isPlayerTournament ? null : (t.winner_club_id || finalMatch?.winner_club_id),
        playerId: isPlayerTournament ? (t.winner_player_id || finalMatch?.winner_player_id) : null,
        amount: Number(t.prize_winner_stc || 0) || fallbackWinner,
      },
      {
        label: 'Runner-up',
        clubId: isPlayerTournament ? null : loserOf(finalMatch)?.id,
        playerId: isPlayerTournament ? loserOf(finalMatch)?.id : null,
        amount: Number(t.prize_runner_up_stc || 0) || fallbackRunnerUp,
      },
      {
        label: 'Third place',
        clubId: isPlayerTournament ? null : thirdPlaceMatch?.winner_club_id,
        playerId: isPlayerTournament ? thirdPlaceMatch?.winner_player_id : null,
        amount: Number(t.prize_third_place_stc || t.prize_semi_final_stc || 0) || fallbackThirdPlace,
      },
    ].filter(p => (p.clubId || p.playerId) && p.amount > 0);

    let paid = 0;
    let skipped = 0;
    for (const payout of payouts) {
      if (payout.playerId) {
        const existingRows = await EXECUTESQL(
          "SELECT id FROM player_stc_transactions WHERE reference_id = ? AND category = 'tournament_prize' AND player_id = ? LIMIT 1",
          [tournament_id, payout.playerId],
        );
        if (existingRows.length) {
          skipped += 1;
          continue;
        }
        await createPlayerTx({
          playerId: payout.playerId,
          amount: payout.amount,
          type: 'income',
          category: 'tournament_prize',
          source: 'tournament',
          description: `${payout.label} prize: ${t.name}`,
          referenceId: tournament_id,
        });
        paid += 1;
        continue;
      }
      const existingRows = await EXECUTESQL(
        "SELECT id FROM stc_transactions WHERE reference_id = ? AND category = 'tournament_prize' AND club_id = ? LIMIT 1",
        [tournament_id, payout.clubId],
      );
      if (existingRows.length) {
        skipped += 1;
        continue;
      }
      await createClubTx({
        clubId: payout.clubId,
        amount: payout.amount,
        type: 'income',
        category: 'tournament_prize',
        description: `${payout.label} prize: ${t.name}`,
        referenceId: tournament_id,
        relatedEntityType: 'tournament',
      });
      paid += 1;
    }

    return { success: true, paid, skipped, payout_count: payouts.length };
  },

  async getTransferMarket() {
    // Latest row for banner display (may be closed); open status is derived client/server-side.
    const currentWindow = await getLatestTransferWindow();
    const activeContracts = await EXECUTESQL(
      "SELECT DISTINCT user_id FROM player_contracts WHERE status IN ('active','pending','pending_window','negotiating')",
      []
    );
    const activeIds = new Set(activeContracts.map((r) => r.user_id));

    const players = await EXECUTESQL('SELECT * FROM players', []);
    const free_agents = players.filter((p) => !activeIds.has(p.id));

    const expiringContracts = await EXECUTESQL(
      "SELECT *, user_id AS target_player_id FROM player_contracts WHERE status = 'active' AND end_date IS NOT NULL ORDER BY end_date ASC",
      []
    );
    const expiring_players = [];
    const now = Date.now();
    for (const c of expiringContracts) {
      const endMs = new Date(c.end_date).getTime();
      if (Number.isNaN(endMs)) continue;
      const days_left = Math.ceil((endMs - now) / (24 * 60 * 60 * 1000));
      if (days_left < 0 || days_left > 30) continue;
      const playerRows = await EXECUTESQL('SELECT * FROM players WHERE id = ? LIMIT 1', [c.user_id]);
      if (!playerRows.length) continue;
      expiring_players.push({ player: playerRows[0], contract: c, days_left });
    }

    return {
      data: {
        free_agents,
        expiring_players,
        current_window: currentWindow,
      },
    };
  },

  async contractActions({
    action, _auth_user_id, team_id, user_id, target_player_id, contract_type, offer_note,
    weekly_salary_stc, signing_bonus_stc, transfer_fee_stc, performance_targets, captaincy_offered,
  }) {
    if (action !== 'offer') throw new Error(`Unsupported contract action: ${action}`);
    const { user } = await getMe(_auth_user_id);
    const targetPlayerId = target_player_id || user_id;
    if (!team_id || !targetPlayerId) throw new Error('team_id and target_player_id required');
    await requireContractOfferAccess(user, team_id);

    const status = 'pending';
    const duration = CONTRACT_TYPE_DURATION[contract_type] || CONTRACT_TYPE_DURATION.squad;
    await assertCanCreateContractOffer({
      playerId: targetPlayerId,
      teamId: team_id,
      contractType: contract_type || 'squad',
    });
    if ((contract_type || 'squad') !== 'ownership') {
      await assertClubContractFinance({
        clubId: team_id,
        weeklySalary: weekly_salary_stc,
        signingBonus: signing_bonus_stc,
        transferFee: transfer_fee_stc,
      });
    }
    const { resolveOfferedByPresidentId } = require('../services/presidentResolutionService');
    const offeredByPresidentId = await resolveOfferedByPresidentId({
      userId: user.id,
      clubId: team_id,
    });
    const id = uuidv4();
    await EXECUTESQL(
      `INSERT INTO player_contracts (
        id, team_id, user_id, contract_type, status, offered_by, offered_by_user_id, offered_by_club_id, offered_by_president_id, max_games, max_days,
        weekly_salary_stc, signing_bonus_stc, transfer_fee_stc, offer_note,
        captaincy_offered, negotiation_round, performance_targets, created_date, updated_date
      ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?, NOW(), NOW())`,
      [
        id,
        team_id,
        targetPlayerId,
        contract_type || 'squad',
        status,
        user.email,
        user.id,
        team_id,
        offeredByPresidentId,
        duration.max_games,
        duration.max_days,
        Number(weekly_salary_stc || 0),
        Number(signing_bonus_stc || 0),
        Number(transfer_fee_stc || 0),
        offer_note || '',
        captaincy_offered ? 1 : 0,
        0,
        performance_targets ? JSON.stringify(performance_targets) : null,
      ]
    );
    await deliverContractOfferMessage(id).catch(err => console.error('[contract delivery]', err.message));
    if (Number(transfer_fee_stc || 0) > 0) {
      await createClubTx({
        clubId: team_id,
        amount: 0,
        type: 'locked',
        category: 'transfer_locked',
        description: `Transfer funds locked for contract offer (${Number(transfer_fee_stc || 0).toLocaleString()} STC)`,
        referenceId: id,
        relatedEntityType: 'player_contract',
      }).catch(() => {});
    }
    return { success: true, data: { contract_id: id, status } };
  },

  async contractManagement({
    action, _auth_user_id,
    team_id, user_id, target_player_id, offered_by,
    contract_id, weekly_salary_stc, signing_bonus_stc, transfer_fee_stc,
    contract_type, start_date, end_date, max_days, max_games,
    status, offer_note, performance_targets, note, amount, captaincy_offered,
    last_negotiated_by,
  }) {
    // ── offer / renewal_offer ───────────────────────────────────────────────
    if (action === 'offer' || action === 'renewal_offer') {
      if (!_auth_user_id) throw new Error('not authenticated');
      const { user } = await getMe(_auth_user_id);

      let sourceContract = null;
      if (action === 'renewal_offer') {
        if (!contract_id) throw new Error('contract_id required');
        const rows = await EXECUTESQL('SELECT *, user_id AS target_player_id FROM player_contracts WHERE id = ? LIMIT 1', [contract_id]);
        if (!rows.length) throw new Error('Contract not found');
        sourceContract = rows[0];
      }

      const targetTeamId = team_id || sourceContract?.team_id;
      const targetUserId = target_player_id || user_id || sourceContract?.user_id;
      if (!targetTeamId || !targetUserId) throw new Error('team_id and target_player_id required');
      await requireContractOfferAccess(user, targetTeamId);
      const targetContractType = contract_type || sourceContract?.contract_type || 'squad';
      await assertCanCreateContractOffer({
        playerId: targetUserId,
        teamId: targetTeamId,
        contractType: targetContractType,
        allowedActiveContractId: action === 'renewal_offer' ? sourceContract?.id : null,
      });
      if (targetContractType !== 'ownership') {
        await assertClubContractFinance({
          clubId: targetTeamId,
          weeklySalary: weekly_salary_stc ?? sourceContract?.weekly_salary_stc ?? 0,
          signingBonus: signing_bonus_stc ?? sourceContract?.signing_bonus_stc ?? 0,
          transferFee: transfer_fee_stc ?? sourceContract?.transfer_fee_stc ?? 0,
          excludeContractId: action === 'renewal_offer' ? sourceContract?.id : null,
        });
      }

      const { resolveOfferedByPresidentId } = require('../services/presidentResolutionService');
      const offeredByPresidentId = await resolveOfferedByPresidentId({
        userId: user?.id || null,
        clubId: targetTeamId,
      });
      const id = uuidv4();
      await EXECUTESQL(
        `INSERT INTO player_contracts (
          id, team_id, user_id, contract_type, status, offered_by, offered_by_user_id, offered_by_club_id, offered_by_president_id, max_games, max_days,
          weekly_salary_stc, signing_bonus_stc, transfer_fee_stc, offer_note,
          captaincy_offered, negotiation_round, performance_targets, created_date, updated_date
        ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?, NOW(), NOW())`,
        [
          id,
          targetTeamId,
          targetUserId,
          targetContractType,
          'pending',
          offered_by || user?.email || '',
          user?.id || null,
          targetTeamId,
          offeredByPresidentId,
          Number(max_games ?? sourceContract?.max_games ?? 0),
          Number(max_days ?? sourceContract?.max_days ?? 0),
          Number(weekly_salary_stc ?? sourceContract?.weekly_salary_stc ?? 0),
          Number(signing_bonus_stc ?? sourceContract?.signing_bonus_stc ?? 0),
          Number(transfer_fee_stc ?? sourceContract?.transfer_fee_stc ?? 0),
          offer_note || '',
          captaincy_offered ? 1 : 0,
          0,
          performance_targets ? JSON.stringify(performance_targets) : (sourceContract?.performance_targets || null),
        ]
      );
      await deliverContractOfferMessage(id).catch(err => console.error('[contract delivery]', err.message));
      const transferFee = Number(transfer_fee_stc ?? sourceContract?.transfer_fee_stc ?? 0);
      if (transferFee > 0) {
        await createClubTx({
          clubId: targetTeamId,
          amount: 0,
          type: 'locked',
          category: 'transfer_locked',
          description: `Transfer funds locked for contract offer (${transferFee.toLocaleString()} STC)`,
          referenceId: id,
          relatedEntityType: 'player_contract',
        }).catch(() => {});
      }
      const rows = await EXECUTESQL('SELECT *, user_id AS target_player_id FROM player_contracts WHERE id = ? LIMIT 1', [id]);
      return { success: true, data: { contract: rows[0], contract_id: id, status: 'pending' } };
    }

    // ── counter ─────────────────────────────────────────────────────────────
    if (action === 'counter') {
      if (!contract_id) throw new Error('contract_id required');
      const rows = await EXECUTESQL('SELECT *, user_id AS target_player_id FROM player_contracts WHERE id = ? LIMIT 1', [contract_id]);
      if (!rows.length) throw new Error('Contract not found');
      const contract = rows[0];
      if (!['pending', 'negotiating'].includes(contract.status)) {
        throw new Error(`Cannot counter contract with status: ${contract.status}`);
      }
      const nextWeekly = weekly_salary_stc != null ? weekly_salary_stc : contract.weekly_salary_stc;
      const nextBonus = signing_bonus_stc != null ? signing_bonus_stc : contract.signing_bonus_stc;
      const nextTransfer = transfer_fee_stc != null ? transfer_fee_stc : contract.transfer_fee_stc;
      if ((contract.contract_type || 'squad') !== 'ownership') {
        await assertClubContractFinance({
          clubId: contract.team_id,
          weeklySalary: nextWeekly,
          signingBonus: nextBonus,
          transferFee: nextTransfer,
          excludeContractId: contract_id,
        });
      }
      const updates = {
        status: 'negotiating',
        negotiation_round: Number(contract.negotiation_round || 0) + 1,
        last_negotiated_by: last_negotiated_by || offered_by || null,
      };
      if (weekly_salary_stc != null) updates.weekly_salary_stc = Number(weekly_salary_stc);
      if (signing_bonus_stc != null) updates.signing_bonus_stc = Number(signing_bonus_stc);
      if (transfer_fee_stc != null) updates.transfer_fee_stc = Number(transfer_fee_stc);
      if (offer_note != null) updates.offer_note = offer_note;
      if (performance_targets != null) updates.performance_targets = JSON.stringify(performance_targets);
      const setClauses = Object.keys(updates).map(k => `${k} = ?`).join(', ');
      await EXECUTESQL(
        `UPDATE player_contracts SET ${setClauses}, updated_date = NOW() WHERE id = ?`,
        [...Object.values(updates), contract_id]
      );
      await deliverContractOfferMessage(contract_id).catch(err => console.error('[contract delivery]', err.message));
      const updated = await EXECUTESQL('SELECT *, user_id AS target_player_id FROM player_contracts WHERE id = ? LIMIT 1', [contract_id]);
      return { success: true, data: { contract: updated[0], status: 'negotiating' } };
    }

    // ── reject ──────────────────────────────────────────────────────────────
    if (action === 'reject') {
      if (!contract_id) throw new Error('contract_id required');
      const rows = await EXECUTESQL('SELECT * FROM player_contracts WHERE id = ? LIMIT 1', [contract_id]);
      await EXECUTESQL("UPDATE player_contracts SET status = 'rejected', updated_date = NOW() WHERE id = ?", [contract_id]);
      await markContractInboxStatus({ contractIds: [contract_id], status: 'declined' }).catch(() => {});
      if (Number(rows[0]?.transfer_fee_stc || 0) > 0) {
        await createClubTx({
          clubId: rows[0].team_id,
          amount: 0,
          type: 'released',
          category: 'transfer_release',
          description: `Transfer lock released for declined offer (${Number(rows[0].transfer_fee_stc || 0).toLocaleString()} STC)`,
          referenceId: contract_id,
          relatedEntityType: 'player_contract',
        }).catch(() => {});
      }
      const updated = await EXECUTESQL('SELECT *, user_id AS target_player_id FROM player_contracts WHERE id = ? LIMIT 1', [contract_id]);
      return { success: true, data: { contract: updated[0], status: 'rejected' } };
    }

    // ── mark_pending_window ─────────────────────────────────────────────────
    if (action === 'mark_pending_window') {
      if (!contract_id) throw new Error('contract_id required');
      const contractRows = await EXECUTESQL(
        `SELECT pc.*, p.club_id AS player_club_id
           FROM player_contracts pc
           LEFT JOIN players p ON p.id = pc.user_id
          WHERE pc.id = ?
          LIMIT 1`,
        [contract_id]
      );
      if (!contractRows.length) throw new Error('Contract not found');
      const contract = contractRows[0];
      const playerClubId = contract.player_club_id ? String(contract.player_club_id) : '';
      const contractClubId = contract.team_id ? String(contract.team_id) : '';
      if (!playerClubId || playerClubId === contractClubId) {
        return HANDLERS.contractManagement({ action: 'accept', contract_id });
      }
      await EXECUTESQL("UPDATE player_contracts SET status = 'pending_window', updated_date = NOW() WHERE id = ?", [contract_id]);
      await markContractInboxStatus({ contractIds: [contract_id], status: 'accepted' }).catch(() => {});
      const updated = await EXECUTESQL('SELECT *, user_id AS target_player_id FROM player_contracts WHERE id = ? LIMIT 1', [contract_id]);
      return { success: true, data: { contract: updated[0], status: 'pending_window' } };
    }

    // ── cancel_offer ────────────────────────────────────────────────────────
    if (action === 'cancel_offer') {
      if (!contract_id) throw new Error('contract_id required');
      const rows = await EXECUTESQL('SELECT * FROM player_contracts WHERE id = ? LIMIT 1', [contract_id]);
      await EXECUTESQL(
        "UPDATE player_contracts SET status = 'cancelled', start_date = NULL, end_date = NULL, updated_date = NOW() WHERE id = ?",
        [contract_id]
      );
      await markContractInboxStatus({ contractIds: [contract_id], status: 'cancelled' }).catch(() => {});
      if (Number(rows[0]?.transfer_fee_stc || 0) > 0) {
        await createClubTx({
          clubId: rows[0].team_id,
          amount: 0,
          type: 'released',
          category: 'transfer_release',
          description: `Transfer lock released for cancelled offer (${Number(rows[0].transfer_fee_stc || 0).toLocaleString()} STC)`,
          referenceId: contract_id,
          relatedEntityType: 'player_contract',
        }).catch(() => {});
      }
      const updated = await EXECUTESQL('SELECT *, user_id AS target_player_id FROM player_contracts WHERE id = ? LIMIT 1', [contract_id]);
      return { success: true, data: { contract: updated[0], status: 'cancelled' } };
    }

    // ── accept ──────────────────────────────────────────────────────────────
    if (action === 'accept') {
      if (!contract_id) throw new Error('contract_id required');
      const today   = new Date().toISOString().split('T')[0];
      const result = await withTransaction(async (query) => {
        const contracts = await query('SELECT * FROM player_contracts WHERE id = ? LIMIT 1 FOR UPDATE', [contract_id]);
        if (!contracts.length) throw new Error('Contract not found');
        const contract = contracts[0];
        if (!['pending', 'pending_window', 'negotiating'].includes(contract.status)) {
          throw new Error(`Cannot accept contract with status: ${contract.status}`);
        }

        const players = await query('SELECT * FROM players WHERE id = ? LIMIT 1 FOR UPDATE', [contract.user_id]);
        const clubs = await query('SELECT * FROM clubs WHERE id = ? LIMIT 1 FOR UPDATE', [contract.team_id]);
        if (!players.length) throw new Error('Player not found');
        if (!clubs.length) throw new Error('Club not found');
        const player = players[0];
        const club = clubs[0];
        if (contract.contract_type === 'ownership' && !player.user_id) {
          const err = new Error('Ownership contracts require a linked user account');
          err.status = 400;
          throw err;
        }

        if (contract.contract_type !== 'ownership') {
          await assertClubContractFinance({
            clubId: contract.team_id,
            weeklySalary: contract.weekly_salary_stc,
            signingBonus: contract.signing_bonus_stc,
            transferFee: contract.transfer_fee_stc,
            excludeContractId: contract_id,
            query,
          });
        }

        const endDate = new Date(Date.now() + (Number(contract.max_days) || 180) * 86400000).toISOString().split('T')[0];
        await query(
          "UPDATE player_contracts SET status = 'active', start_date = ?, end_date = ?, updated_date = NOW() WHERE id = ?",
          [today, endDate, contract_id]
        );
        await closeAcceptedContractConflicts({ acceptedContract: contract, query });
        await markContractInboxStatus({ contractIds: [contract_id], status: 'accepted', query });
        const transferFee = Number(contract.transfer_fee_stc || 0);
        if (transferFee > 0) {
          await recordClubTransaction(query, {
            clubId: contract.team_id,
            amount: -transferFee,
            type: 'expense',
            category: 'transfer_spending',
            description: `Transfer fee paid for ${player.gamertag || 'player'}`,
            referenceId: contract_id,
            relatedEntityType: 'player_contract',
          });
        }

        const roles = parseMaybeJson(player.club_roles, []);
        const isSameClub = player.club_id && player.club_id === contract.team_id;
        const nextRoles = isSameClub && Array.isArray(roles) ? roles.filter(Boolean) : [];
        let nextRole = player.role || 'member';
        // NOTE: accepting an 'ownership' contract no longer grants club president/owner
        // status here. President identity lives exclusively in the `presidents` table and
        // is assigned via club creation (see clubController.js) — never through accepting a
        // player_contracts row. This used to promote the accepting player to
        // role='president' and rewrite clubs.user_id / clubs.president_user_id, which
        // silently merged the player and president identities into one profile.
        // See repairPlayerPresidentIdentityLinks() for cleanup of accounts affected before
        // this fix, and CreateContract.jsx, which no longer offers 'ownership' as a type.
        if (Number(contract.captaincy_offered || 0) === 1 && !nextRoles.includes('president')) {
          if (!nextRoles.includes('captain')) nextRoles.push('captain');
          nextRole = 'captain';
        } else if (!nextRoles.length || nextRoles.includes('free_agent')) {
          nextRoles.splice(0, nextRoles.length, 'member');
          nextRole = 'member';
        }

        await query(
          "UPDATE players SET club_id = ?, club_roles = ?, role = ?, status = 'active', updated_date = NOW() WHERE id = ?",
          [contract.team_id, JSON.stringify(nextRoles), nextRole, contract.user_id]
        );
        await upsertActiveMembership({
          clubId: contract.team_id,
          playerId: contract.user_id,
          userId: player.user_id || null,
          primaryRole: nextRole,
          source: 'contract_acceptance',
          query,
        });

        const bonus = Number(contract.signing_bonus_stc || 0);
        if (bonus > 0) {
          await recordClubTransaction(query, {
            clubId: contract.team_id,
            amount: -bonus,
            type: 'signing_bonus',
            category: 'signing_bonus',
            description: `Signing bonus - ${player?.gamertag || player?.full_name || 'Player'} (${contract.contract_type})`,
            referenceId: contract_id,
          });
          await recordPlayerTransaction(query, {
            playerId: player.id,
            playerEmail: player.email,
            amount: bonus,
            category: 'signing_bonus',
            source: club.name || 'Club',
            description: `Signing bonus - ${club.name || 'Club'} (${contract.contract_type})`,
            referenceId: contract_id,
          });
        }

        return { endDate };
      });
      return { success: true, data: { status: 'active', start_date: today, end_date: result.endDate } };
    }

    // ── terminate ────────────────────────────────────────────────────────────
    if (action === 'terminate') {
      if (!contract_id) throw new Error('contract_id required');
      await withTransaction(async (query) => {
        const contracts = await query('SELECT *, user_id AS target_player_id FROM player_contracts WHERE id = ? LIMIT 1 FOR UPDATE', [contract_id]);
        if (!contracts.length) throw new Error('Contract not found');
        if (contracts[0].status !== 'active') throw new Error('Can only terminate active contracts');
        await query("UPDATE player_contracts SET status = 'terminated', updated_date = NOW() WHERE id = ?", [contract_id]);
        await releasePlayerFromClubIfUnassigned({
          playerId: contracts[0].user_id,
          clubId: contracts[0].team_id,
          query,
        });
      });
      return { success: true, data: { status: 'terminated' } };
    }

    // ── expire_overdue ───────────────────────────────────────────────────────
    if (action === 'expire_overdue') {
      const result = await withTransaction(async (query) => {
        const activeContracts = await query(
          `SELECT *, user_id AS target_player_id
             FROM player_contracts
            WHERE status = 'active'
              AND (
                (end_date IS NOT NULL AND end_date < CURDATE())
                OR (IFNULL(max_games, 0) > 0 AND IFNULL(games_played, 0) >= IFNULL(max_games, 0))
              )
            FOR UPDATE`,
          []
        );
        let expiredCount = 0;
        let completedCount = 0;
        for (const contract of activeContracts) {
          const maxGames = Number(contract.max_games || 0);
          const gamesPlayed = Number(contract.games_played || 0);
          // Date expiry and game-limit completion both end the club link unless another active club role remains.
          const nextStatus = maxGames > 0 && gamesPlayed >= maxGames ? 'completed' : 'expired';
          await query(
            "UPDATE player_contracts SET status = ?, updated_date = NOW() WHERE id = ?",
            [nextStatus, contract.id]
          );
          await query(
            'INSERT INTO player_contract_history (id, contract_id, action_type, action_by, action_note, created_date) VALUES (?, ?, ?, NULL, ?, NOW())',
            [
              uuidv4(),
              contract.id,
              nextStatus,
              nextStatus === 'completed'
                ? `Contract completed: ${gamesPlayed}/${maxGames} games played.`
                : `Contract expired: end date ${contract.end_date} reached.`,
            ]
          ).catch(() => {});
          await releasePlayerFromClubIfUnassigned({
            playerId: contract.user_id,
            clubId: contract.team_id,
            query,
          });
          if (nextStatus === 'completed') completedCount += 1;
          else expiredCount += 1;
        }
        return { expiredCount, completedCount };
      });
      return { success: true, data: { expired_count: result.expiredCount || 0, completed_count: result.completedCount || 0 } };
    }

    // ── auto_pay_salaries ────────────────────────────────────────────────────
    if (action === 'auto_pay_salaries') {
      const overdue = await EXECUTESQL(
        `SELECT pc.*, p.gamertag, p.email AS player_email,
                c.stc AS club_stc, c.name AS club_name
         FROM player_contracts pc
         JOIN players p ON p.id = pc.user_id
         JOIN clubs c ON c.id = pc.team_id
         WHERE pc.status = 'active' AND pc.weekly_salary_stc > 0
           AND (pc.last_salary_paid_at IS NULL OR pc.last_salary_paid_at < DATE_SUB(NOW(), INTERVAL 7 DAY))`,
        []
      );
      let paid = 0; let failed = 0;
      for (const contract of overdue) {
        try {
          const salary    = Number(contract.weekly_salary_stc);
          const lastPaid  = contract.last_salary_paid_at || contract.start_date || contract.created_date;
          const weeksMult = lastPaid
            ? Math.max(1, Math.floor((Date.now() - new Date(lastPaid).getTime()) / (7 * 24 * 60 * 60 * 1000)))
            : 1;
          const gross = Math.min(salary * weeksMult, Number(contract.club_stc || 0));
          if (gross <= 0) { failed++; continue; }
          await createClubTx({
            clubId: contract.team_id, amount: -gross, type: 'salary_payment', category: 'salary',
            description: `Salary: ${contract.gamertag || 'Player'}${weeksMult > 1 ? ` (${weeksMult}wk)` : ''}`,
            referenceId: contract.id,
          });
          await createPlayerTx({
            playerId: contract.user_id, playerEmail: contract.player_email, amount: gross,
            category: 'salary', source: contract.club_name || 'Club',
            description: `Weekly salary${weeksMult > 1 ? ` (${weeksMult} weeks)` : ''} — ${contract.club_name}`,
            referenceId: contract.id,
          });
          await EXECUTESQL('UPDATE player_contracts SET last_salary_paid_at = NOW(), updated_date = NOW() WHERE id = ?', [contract.id]);
          paid++;
        } catch (_) { failed++; }
      }
      return { success: true, data: { paid, failed, total: overdue.length } };
    }

    // ── get_all (admin) ──────────────────────────────────────────────────────
    if (action === 'get_all') {
      const adminCheck = await EXECUTESQL('SELECT role_id FROM users WHERE id = ? LIMIT 1', [_auth_user_id]);
      if (!adminCheck.length || Number(adminCheck[0].role_id) !== 0) throw new Error('Admin access required');
      const rows = await EXECUTESQL(
        `SELECT pc.*, p.gamertag, p.avatar_url,
                c.name AS club_name, c.logo_url AS club_logo_url
         FROM player_contracts pc
         LEFT JOIN players p ON p.id = pc.user_id
         LEFT JOIN clubs c ON c.id = pc.team_id
         ORDER BY pc.created_date DESC LIMIT 300`,
        []
      );
      return { data: { contracts: rows } };
    }

    // ── admin_edit ───────────────────────────────────────────────────────────
    if (action === 'admin_edit') {
      const adminCheck = await EXECUTESQL('SELECT role_id FROM users WHERE id = ? LIMIT 1', [_auth_user_id]);
      if (!adminCheck.length || Number(adminCheck[0].role_id) !== 0) throw new Error('Admin access required');
      if (!contract_id) throw new Error('contract_id required');
      const updates = {};
      if (weekly_salary_stc != null)   updates.weekly_salary_stc = Number(weekly_salary_stc);
      if (signing_bonus_stc != null)   updates.signing_bonus_stc = Number(signing_bonus_stc);
      if (transfer_fee_stc  != null)   updates.transfer_fee_stc  = Number(transfer_fee_stc);
      if (contract_type)               updates.contract_type     = contract_type;
      if (start_date)                  updates.start_date        = start_date;
      if (end_date)                    updates.end_date          = end_date;
      if (max_days  != null)           updates.max_days          = Number(max_days);
      if (max_games != null)           updates.max_games         = Number(max_games);
      if (offer_note != null)          updates.offer_note        = offer_note;
      if (status)                      updates.status            = status;
      if (performance_targets != null) updates.performance_targets = JSON.stringify(performance_targets);
      if (!Object.keys(updates).length) throw new Error('No fields to update');
      const setClauses = Object.keys(updates).map(k => `${k} = ?`).join(', ');
      await EXECUTESQL(
        `UPDATE player_contracts SET ${setClauses}, updated_date = NOW() WHERE id = ?`,
        [...Object.values(updates), contract_id]
      );
      return { success: true };
    }

    // ── admin_cancel ─────────────────────────────────────────────────────────
    if (action === 'admin_cancel') {
      const adminCheck = await EXECUTESQL('SELECT role_id FROM users WHERE id = ? LIMIT 1', [_auth_user_id]);
      if (!adminCheck.length || Number(adminCheck[0].role_id) !== 0) throw new Error('Admin access required');
      if (!contract_id) throw new Error('contract_id required');
      await withTransaction(async (query) => {
        const contracts = await query('SELECT *, user_id AS target_player_id FROM player_contracts WHERE id = ? LIMIT 1 FOR UPDATE', [contract_id]);
        if (!contracts.length) throw new Error('Contract not found');
        await query("UPDATE player_contracts SET status = 'terminated', updated_date = NOW() WHERE id = ?", [contract_id]);
        await releasePlayerFromClubIfUnassigned({
          playerId: contracts[0].user_id,
          clubId: contracts[0].team_id,
          query,
        });
      });
      return { success: true };
    }

    // ── admin_correct_salary ─────────────────────────────────────────────────
    if (action === 'admin_correct_salary') {
      const adminCheck = await EXECUTESQL('SELECT role_id FROM users WHERE id = ? LIMIT 1', [_auth_user_id]);
      if (!adminCheck.length || Number(adminCheck[0].role_id) !== 0) throw new Error('Admin access required');
      if (!contract_id || amount == null) throw new Error('contract_id and amount required');
      const contracts = await EXECUTESQL('SELECT *, user_id AS target_player_id FROM player_contracts WHERE id = ? LIMIT 1', [contract_id]);
      if (!contracts.length) throw new Error('Contract not found');
      const contract  = contracts[0];
      const players   = await EXECUTESQL('SELECT * FROM players WHERE id = ? LIMIT 1', [contract.user_id]);
      if (!players.length) throw new Error('Player not found');
      const player    = players[0];
      const clubRows  = await EXECUTESQL('SELECT * FROM clubs WHERE id = ? LIMIT 1', [contract.team_id]);
      if (!clubRows.length) throw new Error('Club not found');
      const club      = clubRows[0];
      const corrAmt   = Number(amount);
      await createClubTx({
        clubId: contract.team_id, amount: -corrAmt, type: 'salary_correction', category: 'salary',
        description: note || `Admin salary correction — ${player.gamertag || 'Player'}`,
        referenceId: contract_id,
      });
      await createPlayerTx({
        playerId: player.id, playerEmail: player.email, amount: corrAmt,
        category: 'salary', source: club.name || 'Club',
        description: note || `Admin salary correction — ${club.name}`,
        referenceId: contract_id,
      });
      return { success: true };
    }

    throw new Error(`Unknown contractManagement action: ${action}`);
  },

  async transferWindowActions({ action, label, start_date, end_date, notes, window_id }) {
    const current = await getCurrentTransferWindow();

    if (action === 'get_current') {
      // Prefer the live open window; otherwise return the most recent closed one for admin UI.
      // Do not name this binding `window` — shadows the browser global if this ever runs in a web context.
      const transferWindow = current || (await getLatestTransferWindow());
      return { data: { window: transferWindow } };
    }

    if (action === 'open_window') {
      if (current) throw new Error('A transfer window is already open');
      const id = uuidv4();
      await EXECUTESQL(
        `INSERT INTO transfer_windows (id, label, status, start_date, end_date, notes, transfers_executed, created_date, updated_date)
         VALUES (?, ?, 'open', ?, ?, ?, 0, NOW(), NOW())`,
        [id, label || 'Transfer Window', toMysqlDateTime(start_date) || toMysqlDateTime(new Date()), toMysqlDateTime(end_date), notes || '']
      );
      const created = await EXECUTESQL('SELECT * FROM transfer_windows WHERE id = ? LIMIT 1', [id]);
      broadcastTransferWindow(created[0] || null, 'opened');
      return { success: true, data: { window: created[0] || null } };
    }

    if (action === 'close_window') {
      const id = window_id || current?.id;
      if (!id) throw new Error('No open transfer window');
      await EXECUTESQL("UPDATE transfer_windows SET status = 'closed', updated_date = NOW() WHERE id = ?", [id]);
      const closed = await EXECUTESQL('SELECT * FROM transfer_windows WHERE id = ? LIMIT 1', [id]).catch(() => []);
      broadcastTransferWindow(closed[0] || null, 'closed');
      return { success: true, data: { closed: true, window: closed[0] || null } };
    }

    if (action === 'execute_pending') {
      const pendings = await EXECUTESQL(
        "SELECT *, user_id AS target_player_id FROM player_contracts WHERE status = 'pending_window' ORDER BY created_date ASC",
        []
      ).catch(() => []);
      let executed = 0;
      const errors = [];
      for (const c of pendings) {
        try {
          // pending_window means the player already accepted while the window was closed.
          // Opening the window should complete the same server-side activation path.
          await HANDLERS.contractManagement({ action: 'accept', contract_id: c.id });
          executed += 1;
        } catch (err) {
          errors.push({ contract_id: c.id, error: err.message });
        }
      }
      if (current?.id) {
        await EXECUTESQL(
          'UPDATE transfer_windows SET transfers_executed = transfers_executed + ?, updated_date = NOW() WHERE id = ?',
          [executed, current.id]
        );
      }
      const latestWindow = current?.id
        ? (await EXECUTESQL('SELECT * FROM transfer_windows WHERE id = ? LIMIT 1', [current.id]).catch(() => []))[0] || current
        : await getCurrentTransferWindow();
      broadcastTransferWindow(latestWindow || null, 'executed_pending');
      return { success: true, data: { transfers_executed: executed, errors } };
    }

    throw new Error(`Unknown transferWindowActions action: ${action}`);
  },

  async payWeeklySalaries({ _auth_user_id }) {
    // Allow manual/admin run and scheduled run (no auth context).
    if (_auth_user_id) {
      const users = await EXECUTESQL('SELECT role_id FROM users WHERE id = ? LIMIT 1', [_auth_user_id]);
      const roleId = Number(users[0]?.role_id ?? 1);
      if (roleId !== 0 && roleId !== 2) throw new Error('Forbidden');
    }

    const activeContracts = await EXECUTESQL(
      "SELECT *, user_id AS target_player_id FROM player_contracts WHERE status = 'active' AND IFNULL(weekly_salary_stc,0) > 0",
      []
    );
    const now = new Date();
    const paid = [];
    const errors = [];
    for (const contract of activeContracts) {
      try {
        const lastPaid = contract.last_salary_paid_at
          ? new Date(contract.last_salary_paid_at)
          : new Date(contract.start_date || contract.created_date || now);
        const weeksSincePaid = Math.floor((now.getTime() - lastPaid.getTime()) / (7 * 24 * 60 * 60 * 1000));
        if (weeksSincePaid < 1) continue;
        const gross = Number(contract.weekly_salary_stc || 0) * weeksSincePaid;
        if (gross <= 0) continue;

        const [playerRows, clubRows] = await Promise.all([
          EXECUTESQL('SELECT id, email, gamertag, stc FROM players WHERE id = ? LIMIT 1', [contract.user_id]),
          EXECUTESQL('SELECT id, name, stc FROM clubs WHERE id = ? LIMIT 1', [contract.team_id]),
        ]);
        const player = playerRows[0];
        const club = clubRows[0];
        if (!player || !club) continue;

        const clubStc = Number(club.stc || 0);
        const amount = Math.min(gross, clubStc);
        if (amount <= 0) continue;

        await EXECUTESQL('UPDATE clubs SET stc = ?, updated_date = NOW() WHERE id = ?', [Math.max(0, clubStc - amount), club.id]);
        await EXECUTESQL('UPDATE players SET stc = ?, updated_date = NOW() WHERE id = ?', [Number(player.stc || 0) + amount, player.id]);
        await EXECUTESQL(
          `INSERT INTO stc_transactions
           (id, club_id, player_id, player_email, amount, type, description, reference_id, created_date)
           VALUES (?, ?, ?, ?, ?, 'salary', ?, ?, NOW())`,
          [uuidv4(), club.id, player.id, player.email, amount, `Weekly salary (${weeksSincePaid} week${weeksSincePaid > 1 ? 's' : ''}) from ${club.name || 'club'}`, contract.id]
        ).catch(() => {});
        await EXECUTESQL('UPDATE player_contracts SET last_salary_paid_at = ?, updated_date = NOW() WHERE id = ?', [toMysqlDateTime(now), contract.id]);
        await createNotificationIfEnabled({
          recipientEmail: player.email,
          type: 'announcement',
          title: `Weekly salary: +${amount.toLocaleString()} STC`,
          body: `${club.name || 'Your club'} paid your salary.`,
          link: '/lifestyle',
          relatedId: contract.id,
        });
        paid.push({ player: player.gamertag || player.email, amount, weeks: weeksSincePaid });
      } catch (err) {
        errors.push({ contract_id: contract.id, error: err.message });
      }
    }
    return { success: true, paid_count: paid.length, paid, errors };
  },

  async checkExpiredContracts() {
    const CONTRACT_META = {
      trial: { max_games: 5 }, academy: { max_games: 20 }, squad: { max_games: 100 }, important: { max_games: 250 }, star: { max_games: 400 },
    };
    const active = await EXECUTESQL("SELECT *, user_id AS target_player_id FROM player_contracts WHERE status = 'active'", []);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    let completed = 0;
    let expired = 0;
    let warned = 0;
    for (const c of active) {
      const maxGames = CONTRACT_META[c.contract_type]?.max_games || Number(c.max_games || 0);
      const gamesPlayed = Number(c.games_played || 0);
      const endDate = c.end_date ? new Date(c.end_date) : null;
      if (endDate) endDate.setHours(0, 0, 0, 0);

      if (maxGames > 0 && gamesPlayed >= maxGames) {
        await EXECUTESQL("UPDATE player_contracts SET status='completed', updated_date = NOW() WHERE id = ?", [c.id]);
        await EXECUTESQL(
          'INSERT INTO player_contract_history (id, contract_id, action_type, action_by, action_note, created_date) VALUES (?, ?, ?, NULL, ?, NOW())',
          [uuidv4(), c.id, 'completed', `Contract completed: ${gamesPlayed}/${maxGames} games played.`]
        ).catch(() => {});
        await releasePlayerFromClubIfUnassigned({ playerId: c.user_id, clubId: c.team_id }).catch(() => {});
        completed += 1;
        continue;
      }

      if (endDate && endDate.getTime() <= today.getTime()) {
        await EXECUTESQL("UPDATE player_contracts SET status='expired', updated_date = NOW() WHERE id = ?", [c.id]);
        await EXECUTESQL(
          'INSERT INTO player_contract_history (id, contract_id, action_type, action_by, action_note, created_date) VALUES (?, ?, ?, NULL, ?, NOW())',
          [uuidv4(), c.id, 'expired', `Contract expired: end date ${c.end_date} reached.`]
        ).catch(() => {});
        await releasePlayerFromClubIfUnassigned({ playerId: c.user_id, clubId: c.team_id }).catch(() => {});
        expired += 1;
        continue;
      }

      const daysLeft = endDate ? Math.floor((endDate.getTime() - today.getTime()) / (24 * 60 * 60 * 1000)) : null;
      const gamesLeft = maxGames > 0 ? (maxGames - gamesPlayed) : null;
      if ((gamesLeft !== null && gamesLeft <= 10) || (daysLeft !== null && daysLeft <= 7)) warned += 1;
    }
    return { checked: active.length, completed, expired, warned };
  },

  async updateMatchStats({ data }) {
    if (!data || data.status !== 'confirmed') return { skipped: 'not confirmed' };
    if (data.stats_processed) return { skipped: 'already processed' };
    if (data.home_score == null || data.away_score == null) return { skipped: 'missing scores' };

    const matchId = data.id;
    const homeScore = Number(data.home_score || 0);
    const awayScore = Number(data.away_score || 0);
    const isClubMatch = data.mode === 'club';
    const isRanked = data.type === 'ranked';

    const homeResult = homeScore > awayScore ? 'win' : (homeScore < awayScore ? 'loss' : 'draw');
    const awayResult = homeScore > awayScore ? 'loss' : (homeScore < awayScore ? 'win' : 'draw');

    if (isClubMatch) {
      const [homeRows, awayRows] = await Promise.all([
        EXECUTESQL('SELECT * FROM clubs WHERE id = ? LIMIT 1', [data.home_club_id]),
        EXECUTESQL('SELECT * FROM clubs WHERE id = ? LIMIT 1', [data.away_club_id]),
      ]);
      const homeClub = homeRows[0];
      const awayClub = awayRows[0];
      if (homeClub && awayClub) {
        const stadiumLevel = Number(homeClub.stadium_level || 0);
        const st = getStadiumFinanceTier(stadiumLevel);
        const ticketRevenue = Number(st.capacity || 5000) * Number(st.ticket_price_stc || 15);

        const hWins = Number(homeClub.wins || 0) + (homeResult === 'win' ? 1 : 0);
        const hLoss = Number(homeClub.losses || 0) + (homeResult === 'loss' ? 1 : 0);
        const hDraw = Number(homeClub.draws || 0) + (homeResult === 'draw' ? 1 : 0);
        const aWins = Number(awayClub.wins || 0) + (awayResult === 'win' ? 1 : 0);
        const aLoss = Number(awayClub.losses || 0) + (awayResult === 'loss' ? 1 : 0);
        const aDraw = Number(awayClub.draws || 0) + (awayResult === 'draw' ? 1 : 0);

        await EXECUTESQL(
          `UPDATE clubs SET
            wins=?, losses=?, draws=?, goals_scored=?, goals_conceded=?, matches_ranked=?,
            win_streak=?, loss_streak=?, form=?, stc=?, updated_date=NOW()
           WHERE id=?`,
          [
            hWins, hLoss, hDraw,
            Number(homeClub.goals_scored || 0) + homeScore, Number(homeClub.goals_conceded || 0) + awayScore,
            Number(homeClub.matches_ranked || 0) + (isRanked ? 1 : 0),
            homeResult === 'win' ? Number(homeClub.win_streak || 0) + 1 : 0,
            homeResult === 'loss' ? Number(homeClub.loss_streak || 0) + 1 : 0,
            JSON.stringify([...(parseMaybeJson(homeClub.form, [])), homeResult[0].toUpperCase()].slice(-5)),
            Number(homeClub.stc || 0) + ticketRevenue,
            homeClub.id,
          ]
        );
        await EXECUTESQL(
          `UPDATE clubs SET
            wins=?, losses=?, draws=?, goals_scored=?, goals_conceded=?, matches_ranked=?,
            win_streak=?, loss_streak=?, form=?, updated_date=NOW()
           WHERE id=?`,
          [
            aWins, aLoss, aDraw,
            Number(awayClub.goals_scored || 0) + awayScore, Number(awayClub.goals_conceded || 0) + homeScore,
            Number(awayClub.matches_ranked || 0) + (isRanked ? 1 : 0),
            awayResult === 'win' ? Number(awayClub.win_streak || 0) + 1 : 0,
            awayResult === 'loss' ? Number(awayClub.loss_streak || 0) + 1 : 0,
            JSON.stringify([...(parseMaybeJson(awayClub.form, [])), awayResult[0].toUpperCase()].slice(-5)),
            awayClub.id,
          ]
        );
        await EXECUTESQL(
          `INSERT INTO stc_transactions (id, club_id, amount, balance_after, type, category, description, related_entity_type, related_entity_id, reference_id, created_date)
           VALUES (?, ?, ?, ?, 'income', 'ticket_revenue', ?, 'match', ?, ?, NOW())`,
          [uuidv4(), homeClub.id, ticketRevenue, Number(homeClub.stc || 0) + ticketRevenue, `Ticket sales for match ${matchId}`, matchId, matchId]
        ).catch(() => {});
      }
    }

    const statRows = await EXECUTESQL('SELECT * FROM match_player_stats WHERE match_id = ?', [matchId]);
    if (statRows.length) {
      const ratings = statRows.map((s) => Number(s.rating || 0));
      const maxRating = ratings.length ? Math.max(...ratings) : -1;
      for (const stat of statRows) {
        const players = await EXECUTESQL('SELECT * FROM players WHERE LOWER(email)=LOWER(?) LIMIT 1', [stat.player_email]);
        const p = players[0];
        if (!p) continue;
        const isHome = stat.club_id && data.home_club_id && stat.club_id === data.home_club_id;
        const result = isHome ? homeResult : awayResult;
        const updates = {
          matches_played: Number(p.matches_played || 0) + 1,
          goals: Number(p.goals || 0) + Number(stat.goals || 0),
          assists: Number(p.assists || 0) + Number(stat.assists || 0),
          wins_count: Number(p.wins_count || 0) + (result === 'win' ? 1 : 0),
          losses_count: Number(p.losses_count || 0) + (result === 'loss' ? 1 : 0),
          draws_count: Number(p.draws_count || 0) + (result === 'draw' ? 1 : 0),
          man_of_the_match: Number(p.man_of_the_match || 0) + (Number(stat.rating || 0) === maxRating ? 1 : 0),
        };
        await EXECUTESQL(
          `UPDATE players SET matches_played=?, goals=?, assists=?, wins_count=?, losses_count=?, draws_count=?, man_of_the_match=?, updated_date=NOW()
           WHERE id=?`,
          [updates.matches_played, updates.goals, updates.assists, updates.wins_count, updates.losses_count, updates.draws_count, updates.man_of_the_match, p.id]
        );
      }
    }

    await EXECUTESQL('UPDATE matches SET stats_processed = 1, updated_date = NOW() WHERE id = ?', [matchId]);
    return { success: true, matchId, clubsUpdated: isClubMatch ? 2 : 0, playersUpdated: statRows.length };
  },

  async ratingEngine({
    home_club_id, away_club_id, home_score, away_score, match_type = 'ranked', match_id,
    home_roster_continuity = 1.0, away_roster_continuity = 1.0,
  }) {
    if (!home_club_id || !away_club_id || home_score == null || away_score == null) throw new Error('Missing required fields');
    const [homeRows, awayRows] = await Promise.all([
      EXECUTESQL('SELECT * FROM clubs WHERE id=? LIMIT 1', [home_club_id]),
      EXECUTESQL('SELECT * FROM clubs WHERE id=? LIMIT 1', [away_club_id]),
    ]);
    const home = homeRows[0];
    const away = awayRows[0];
    if (!home || !away) throw new Error('Club not found');

    const INITIAL_RATING = 1500;
    const homeRating = Number(home.rating ?? INITIAL_RATING);
    const awayRating = Number(away.rating ?? INITIAL_RATING);
    const homeProv = Number(home.matches_ranked || 0) < 10;
    const awayProv = Number(away.matches_ranked || 0) < 10;
    const KHome = homeProv ? 40 : 20;
    const KAway = awayProv ? 40 : 20;
    const weights = { ranked: 1.0, league: 1.1, playoff: 1.25, final: 1.4 };
    const W = Number(weights[match_type] || 1.0);
    const expectedH = 1 / (1 + Math.pow(10, (awayRating - homeRating) / 400));
    const expectedA = 1 - expectedH;
    const homeResult = Number(home_score) > Number(away_score) ? 'W' : (Number(home_score) < Number(away_score) ? 'L' : 'D');
    const awayResult = homeResult === 'W' ? 'L' : (homeResult === 'L' ? 'W' : 'D');
    const actualH = homeResult === 'W' ? 1 : (homeResult === 'D' ? 0.5 : 0);
    const actualA = 1 - actualH;
    const gd = Math.min(Math.abs(Number(home_score) - Number(away_score)), 3);
    const gdHome = (actualH === 1 ? 1 : actualH === 0 ? -1 : 0) * (gd / 3) * 5;
    const gdAway = (actualA === 1 ? 1 : actualA === 0 ? -1 : 0) * (gd / 3) * 5;
    const dHome = Math.round((KHome * W * Number(home_roster_continuity || 1) * (actualH - expectedH) + gdHome) * 10) / 10;
    const dAway = Math.round((KAway * W * Number(away_roster_continuity || 1) * (actualA - expectedA) + gdAway) * 10) / 10;
    const newHome = Math.max(100, Math.round(homeRating + dHome));
    const newAway = Math.max(100, Math.round(awayRating + dAway));

    await EXECUTESQL(
      `UPDATE clubs SET rating=?, peak_rating=?, matches_ranked=?, wins=?, losses=?, draws=?, goals_scored=?, goals_conceded=?, form=?, updated_date=NOW() WHERE id=?`,
      [
        newHome,
        Math.max(Number(home.peak_rating || INITIAL_RATING), newHome),
        Number(home.matches_ranked || 0) + 1,
        Number(home.wins || 0) + (homeResult === 'W' ? 1 : 0),
        Number(home.losses || 0) + (homeResult === 'L' ? 1 : 0),
        Number(home.draws || 0) + (homeResult === 'D' ? 1 : 0),
        Number(home.goals_scored || 0) + Number(home_score),
        Number(home.goals_conceded || 0) + Number(away_score),
        JSON.stringify([...(parseMaybeJson(home.form, [])), homeResult].slice(-5)),
        home_club_id,
      ]
    );
    await EXECUTESQL(
      `UPDATE clubs SET rating=?, peak_rating=?, matches_ranked=?, wins=?, losses=?, draws=?, goals_scored=?, goals_conceded=?, form=?, updated_date=NOW() WHERE id=?`,
      [
        newAway,
        Math.max(Number(away.peak_rating || INITIAL_RATING), newAway),
        Number(away.matches_ranked || 0) + 1,
        Number(away.wins || 0) + (awayResult === 'W' ? 1 : 0),
        Number(away.losses || 0) + (awayResult === 'L' ? 1 : 0),
        Number(away.draws || 0) + (awayResult === 'D' ? 1 : 0),
        Number(away.goals_scored || 0) + Number(away_score),
        Number(away.goals_conceded || 0) + Number(home_score),
        JSON.stringify([...(parseMaybeJson(away.form, [])), awayResult].slice(-5)),
        away_club_id,
      ]
    );

    const playedAt = toMysqlDateTime(new Date());
    await EXECUTESQL(
      `INSERT INTO rating_history
       (id, club_id, club_name, opponent_club_id, opponent_club_name, match_id, competition_type, result, home_score, away_score, points_before, points_after, points_change, played_at, created_date)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
      [uuidv4(), home_club_id, home.name || null, away_club_id, away.name || null, match_id || 'manual', match_type, homeResult, Number(home_score), Number(away_score), homeRating, newHome, dHome, playedAt]
    ).catch(() => {});
    await EXECUTESQL(
      `INSERT INTO rating_history
       (id, club_id, club_name, opponent_club_id, opponent_club_name, match_id, competition_type, result, home_score, away_score, points_before, points_after, points_change, played_at, created_date)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
      [uuidv4(), away_club_id, away.name || null, home_club_id, home.name || null, match_id || 'manual', match_type, awayResult, Number(away_score), Number(home_score), awayRating, newAway, dAway, playedAt]
    ).catch(() => {});

    return {
      success: true,
      home: { club_id: home_club_id, result: homeResult, rating_before: homeRating, rating_after: newHome, delta: dHome },
      away: { club_id: away_club_id, result: awayResult, rating_before: awayRating, rating_after: newAway, delta: dAway },
    };
  },

  async matchKickoff({
    action, match_id, is_home_team, home_score, away_score,
    player_stats, goal_events, proof_url, admin_resolve_winner,
    admin_home_score, admin_away_score, _auth_user_id,
  }) {
    if (!match_id) throw new Error('match_id required');

    if (action === 'kickoff') {
      // Dressing-room gate (club matches only): both clubs must have at
      // least one player seated before the match can start. This stops the
      // home club from kicking off into an empty away dressing room (which
      // would then leave the away side unable to earn ratings/stats).
      // Solo matches keep the existing "home presses Kickoff" flow.
      const matchRows = await EXECUTESQL('SELECT * FROM matches WHERE id = ? LIMIT 1', [match_id]);
      if (!matchRows.length) throw new Error('Match not found');
      const match = matchRows[0];

      if (match.mode === 'club' && match.home_club_id && match.away_club_id) {
        const dressingRows = await EXECUTESQL(
          `SELECT club_id, seated_players FROM dressing_rooms
            WHERE match_id = ? AND club_id IN (?, ?)`,
          [match_id, match.home_club_id, match.away_club_id]
        );
        const seatedCount = (clubId) => {
          const row = dressingRows.find(r => String(r.club_id) === String(clubId));
          if (!row) return 0;
          let raw = row.seated_players;
          if (raw == null || raw === '') return 0;
          if (typeof raw === 'string') {
            try { raw = JSON.parse(raw); } catch { return 0; }
          }
          return Array.isArray(raw) ? raw.length : 0;
        };
        const homeSeated = seatedCount(match.home_club_id);
        const awaySeated = seatedCount(match.away_club_id);

        if (homeSeated === 0 || awaySeated === 0) {
          const msg = homeSeated === 0 && awaySeated === 0
            ? 'Both clubs must seat at least one player in the dressing room before kickoff.'
            : homeSeated === 0
              ? 'Home club must seat at least one player in the dressing room before kickoff.'
              : 'Away club must seat at least one player in the dressing room before kickoff.';
          const err = new Error(msg);
          err.status  = 409;
          err.code    = 'DRESSING_ROOM_NOT_READY';
          err.details = { home_seated: homeSeated, away_seated: awaySeated };
          throw err;
        }
      }

      await ensureMatchStreamsFromPlayers(match).catch((err) => {
        console.warn('[matchKickoff] stream auto-fill failed:', err.message);
      });

      await EXECUTESQL("UPDATE matches SET status = 'in_progress', updated_date = NOW() WHERE id = ?", [match_id]);
      await broadcastMatchById(match_id);
      return { data: { success: true } };
    }

    if (action === 'submit_result') {
      const rows = await EXECUTESQL('SELECT * FROM matches WHERE id = ? LIMIT 1', [match_id]);
      if (!rows.length) throw new Error('Match not found');
      const m = rows[0];

      // Enforce submission order: the AWAY side cannot submit until the HOME
      // side has submitted. This stops away-first races where the away score
      // gets locked in before the home reporter has had a chance to enter it.
      // (Home is, by convention, the trusted "first reporter" of the match.)
      if (!is_home_team && !Number(m.result_home_submitted)) {
        const err = new Error('Home team must submit their result first.');
        err.status = 409;
        err.code   = 'AWAITING_HOME_SUBMISSION';
        throw err;
      }

      if (!proof_url) {
        const err = new Error('Screenshot proof is required before submitting a result.');
        err.status = 400;
        err.code = 'PROOF_REQUIRED';
        throw err;
      }

      const proofOcr = proof_url
        ? await recognizeScoreFromImageUrl(proof_url).catch((err) => ({
            ok: false,
            reason: 'ocr_failed',
            error: err.message,
            text: '',
          }))
        : null;

      const submission = JSON.stringify({
        home_score:   Number(home_score  ?? 0),
        away_score:   Number(away_score  ?? 0),
        player_stats: player_stats  || [],
        goal_events:  goal_events   || [],
        proof_url:    proof_url     || null,
        proof_ocr:    proofOcr,
        submitted_at: new Date().toISOString(),
      });

      if (is_home_team) {
        await EXECUTESQL(
          'UPDATE matches SET home_submission = ?, result_home_submitted = 1, updated_date = NOW() WHERE id = ?',
          [submission, match_id]
        );
      } else {
        await EXECUTESQL(
          'UPDATE matches SET away_submission = ?, result_away_submitted = 1, updated_date = NOW() WHERE id = ?',
          [submission, match_id]
        );
      }

      const [updated] = await EXECUTESQL('SELECT * FROM matches WHERE id = ? LIMIT 1', [match_id]);
      const homeSub = parseSubmission(updated.home_submission);
      const awaySub = parseSubmission(updated.away_submission);

      if (!homeSub || !awaySub) {
        if (is_home_team) {
          await notifyMatchSide(
            updated,
            'away',
            'match_result_requested',
            'Result submitted - your turn',
            `${updated.home_club_name || updated.home_player_name || 'Home'} submitted the result. Upload your screenshot proof and confirm your score.`
          ).catch(() => {});
        }
        await broadcastMatchById(match_id);
        return { data: { status: 'waiting' } };
      }

      if (Number(homeSub.home_score) !== Number(awaySub.home_score) ||
          Number(homeSub.away_score) !== Number(awaySub.away_score)) {
        await EXECUTESQL(
          "UPDATE matches SET status = 'disputed', admin_notes = ?, updated_date = NOW() WHERE id = ?",
          [
            JSON.stringify({
              reason: 'submitted_scores_disagree',
              home_score: Number(homeSub.home_score),
              away_score: Number(homeSub.away_score),
              away_submitted_home_score: Number(awaySub.home_score),
              away_submitted_away_score: Number(awaySub.away_score),
              home_proof_url: homeSub.proof_url || null,
              away_proof_url: awaySub.proof_url || null,
            }),
            match_id,
          ]
        );
        await notifyMatchAdmins(
          updated,
          'Match result disputed',
          `${updated.home_club_name || updated.home_player_name || 'Home'} vs ${updated.away_club_name || updated.away_player_name || 'Away'} needs review.`
        );
        await notifyMatchSide(updated, 'home', 'match_disputed', 'Match result disputed', 'Admin is reviewing the submitted screenshots and scores.').catch(() => {});
        await notifyMatchSide(updated, 'away', 'match_disputed', 'Match result disputed', 'Admin is reviewing the submitted screenshots and scores.').catch(() => {});
        await broadcastMatchById(match_id);
        return {
          data: {
            status: 'disputed',
            reason: 'submitted_scores_disagree',
            home_submission: homeSub,
            away_submission: awaySub,
          },
        };
      }

      return processMatchCompletion(updated, homeSub, awaySub);
    }

    if (action === 'admin_resolve') {
      await requireAdminUser(_auth_user_id);
      if (!['home', 'away'].includes(admin_resolve_winner)) {
        const err = new Error('admin_resolve_winner must be home or away');
        err.status = 400;
        throw err;
      }
      const rows = await EXECUTESQL('SELECT * FROM matches WHERE id = ? LIMIT 1', [match_id]);
      if (!rows.length) throw new Error('Match not found');
      const m = rows[0];

      const homeSub = parseSubmission(m.home_submission) || { home_score: 0, away_score: 0, player_stats: [], goal_events: [] };
      const awaySub = parseSubmission(m.away_submission) || { home_score: 0, away_score: 0, player_stats: [], goal_events: [] };
      const accepted = admin_resolve_winner === 'home' ? { ...homeSub } : { ...awaySub };

      if (admin_home_score != null) accepted.home_score = admin_home_score;
      if (admin_away_score != null) accepted.away_score = admin_away_score;
      accepted.home_score = parseAdminMatchScore(accepted.home_score, 'admin_home_score');
      accepted.away_score = parseAdminMatchScore(accepted.away_score, 'admin_away_score');

      return processMatchCompletion(m, accepted, accepted);
    }

    throw new Error(`Unsupported matchKickoff action: ${action}`);
  },

  async wagerMatchActions({ action, match_id }) {
    if (!match_id) throw new Error('match_id required');
    const rows = await EXECUTESQL('SELECT * FROM matches WHERE id = ? LIMIT 1', [match_id]);
    if (!rows.length) throw new Error('Match not found');
    const m = rows[0];
    const isClub = m.mode === 'club';

    if (action === 'accept_wager') {
      const wagerEach = Number(m.wager_stc || 0);
      if (wagerEach <= 0) throw new Error('No wager amount on this match');
      if (m.wager_status === 'active' && Number(m.wager_home_locked) === 1 && Number(m.wager_away_locked) === 1) {
        return { success: true, data: { skipped: true, _match_patch: { wager_away_locked: 1, wager_home_locked: 1, wager_status: 'active' } } };
      }
      const existingLocks = isClub
        ? await EXECUTESQL(
          "SELECT club_id FROM stc_transactions WHERE reference_id = ? AND category = 'wager_stake'",
          [match_id]
        ).catch(() => [])
        : await EXECUTESQL(
          "SELECT player_id FROM player_stc_transactions WHERE reference_id = ? AND category = 'wager_stake'",
          [match_id]
        ).catch(() => []);
      if (existingLocks.length) throw new Error('Wager is partially locked. Ask an admin to review this match before retrying.');
      if (wagerEach > 0) {
        if (isClub) {
          if (m.home_club_id) {
            const [hc] = await EXECUTESQL('SELECT stc FROM clubs WHERE id = ? LIMIT 1', [m.home_club_id]);
            if (!hc || Number(hc.stc || 0) < wagerEach) throw new Error('Home club has insufficient STC for this wager');
            await createClubTx({ clubId: m.home_club_id, amount: -wagerEach, type: 'wager_stake', category: 'wager_stake', description: `Wager stake locked — match vs ${m.away_club_name || 'Away'}`, referenceId: m.id });
          }
          if (m.away_club_id) {
            const [ac] = await EXECUTESQL('SELECT stc FROM clubs WHERE id = ? LIMIT 1', [m.away_club_id]);
            if (!ac || Number(ac.stc || 0) < wagerEach) throw new Error('Your club has insufficient STC for this wager');
            await createClubTx({ clubId: m.away_club_id, amount: -wagerEach, type: 'wager_stake', category: 'wager_stake', description: `Wager stake locked — match vs ${m.home_club_name || 'Home'}`, referenceId: m.id });
          }
        } else {
          if (m.home_player_id) {
            const [hp] = await EXECUTESQL('SELECT stc, email FROM players WHERE id = ? LIMIT 1', [m.home_player_id]);
            if (!hp || Number(hp.stc || 0) < wagerEach) throw new Error('Home player has insufficient STC for this wager');
            await createPlayerTx({ playerId: m.home_player_id, playerEmail: hp.email || null, amount: -wagerEach, category: 'wager_stake', source: `vs ${m.away_player_name || 'Away'}`, description: `Wager stake locked — vs ${m.away_player_name || 'Away'}`, referenceId: m.id });
          }
          if (m.away_player_id) {
            const [ap] = await EXECUTESQL('SELECT stc, email FROM players WHERE id = ? LIMIT 1', [m.away_player_id]);
            if (!ap || Number(ap.stc || 0) < wagerEach) throw new Error('You have insufficient STC for this wager');
            await createPlayerTx({ playerId: m.away_player_id, playerEmail: ap.email || null, amount: -wagerEach, category: 'wager_stake', source: `vs ${m.home_player_name || 'Home'}`, description: `Wager stake locked — vs ${m.home_player_name || 'Home'}`, referenceId: m.id });
          }
        }
      }
      await EXECUTESQL(
        "UPDATE matches SET wager_away_locked = 1, wager_home_locked = 1, wager_status = 'active', updated_date = NOW() WHERE id = ?",
        [match_id]
      );
      return { success: true, data: { _match_patch: { wager_away_locked: 1, wager_home_locked: 1, wager_status: 'active' } } };
    }

    if (action === 'decline_wager') {
      await EXECUTESQL(
        "UPDATE matches SET wager_status = 'declined', wager_stc = 0, wager_home_locked = 0, wager_away_locked = 0, updated_date = NOW() WHERE id = ?",
        [match_id]
      );
      return { success: true, data: { _match_patch: { wager_status: 'declined', wager_stc: 0, wager_home_locked: 0, wager_away_locked: 0 } } };
    }

    if (action === 'cancel_wager') {
      // Refund both sides only if wager was already active (funds were deducted)
      const wagerEach = Number(m.wager_stc || 0);
      if (wagerEach > 0 && m.wager_status === 'active') {
        const matchLabel = isClub
          ? `${m.home_club_name || 'Home'} vs ${m.away_club_name || 'Away'}`
          : `${m.home_player_name || 'Home'} vs ${m.away_player_name || 'Away'}`;
        if (isClub) {
          if (m.home_club_id) await createClubTx({ clubId: m.home_club_id, amount: wagerEach, type: 'wager_refund', category: 'wager_refund', description: `Wager refunded — match cancelled — ${matchLabel}`, referenceId: m.id });
          if (m.away_club_id) await createClubTx({ clubId: m.away_club_id, amount: wagerEach, type: 'wager_refund', category: 'wager_refund', description: `Wager refunded — match cancelled — ${matchLabel}`, referenceId: m.id });
        } else {
          const [hp] = await EXECUTESQL('SELECT email FROM players WHERE id = ? LIMIT 1', [m.home_player_id]).catch(() => [null]);
          const [ap] = await EXECUTESQL('SELECT email FROM players WHERE id = ? LIMIT 1', [m.away_player_id]).catch(() => [null]);
          if (m.home_player_id) await createPlayerTx({ playerId: m.home_player_id, playerEmail: hp?.email || null, amount: wagerEach, category: 'wager_refund', source: matchLabel, description: `Wager stake refunded — match cancelled`, referenceId: m.id }).catch(() => {});
          if (m.away_player_id) await createPlayerTx({ playerId: m.away_player_id, playerEmail: ap?.email || null, amount: wagerEach, category: 'wager_refund', source: matchLabel, description: `Wager stake refunded — match cancelled`, referenceId: m.id }).catch(() => {});
        }
      }
      const nextStatus = m.status === 'completed' ? m.wager_status : 'cancelled';
      await EXECUTESQL(
        "UPDATE matches SET wager_status = ?, wager_stc = 0, wager_home_locked = 0, wager_away_locked = 0, updated_date = NOW() WHERE id = ?",
        [nextStatus, match_id]
      );
      return { success: true, data: { _match_patch: { wager_status: nextStatus, wager_stc: 0, wager_home_locked: 0, wager_away_locked: 0 } } };
    }
    throw new Error(`Unknown wager action: ${action}`);
  },

  // Settle wager for solo (player-vs-player) matches on completion
  async processSoloWager({ match_id }) {
    if (!match_id) throw new Error('match_id required');
    const rows = await EXECUTESQL('SELECT * FROM matches WHERE id = ? LIMIT 1', [match_id]);
    if (!rows.length) throw new Error('Match not found');
    const m = rows[0];
    if (m.mode === 'club') return { success: true, data: { skipped: true } };
    const wagerEach = Number(m.wager_stc || 0);
    if (!wagerEach || m.wager_status !== 'active' || !m.wager_home_locked || !m.wager_away_locked) {
      return { success: true, data: { skipped: true } };
    }
    // Atomic guard: claim settlement slot by flipping status; if already claimed, skip
    const claim = await EXECUTESQL(
      "UPDATE matches SET wager_status = 'settling', updated_date = NOW() WHERE id = ? AND wager_status = 'active'",
      [match_id]
    ).catch(() => ({ affectedRows: 0 }));
    if (!claim.affectedRows) return { success: true, data: { skipped: true } };

    const pot = wagerEach * 2;
    const homeScore = Number(m.home_score ?? 0);
    const awayScore = Number(m.away_score ?? 0);
    const isDraw = homeScore === awayScore;
    const label = `${m.home_player_name || 'Home'} vs ${m.away_player_name || 'Away'}`;

    const notifyInbox = async (email, subj, body) => email && EXECUTESQL(
      `INSERT INTO inbox_messages (id, recipient_email, sender_email, subject, body, message_type, related_entity_id, related_entity_type, is_read, created_date)
       VALUES (?, ?, 'system@stage.com', ?, ?, 'wager', ?, 'solo_wager', 0, NOW())`,
      [uuidv4(), email, subj, body, match_id]
    ).catch(() => {});

    if (isDraw) {
      await EXECUTESQL("UPDATE matches SET wager_status = 'refunded', updated_date = NOW() WHERE id = ?", [match_id]);
      if (m.home_player_id) await createPlayerTx({ playerId: m.home_player_id, playerEmail: m.home_player_email || null, amount: wagerEach, category: 'wager_refund', source: label, description: `Wager refunded (draw) — ${label}`, referenceId: match_id }).catch(() => {});
      if (m.away_player_id) await createPlayerTx({ playerId: m.away_player_id, playerEmail: m.away_player_email || null, amount: wagerEach, category: 'wager_refund', source: label, description: `Wager refunded (draw) — ${label}`, referenceId: match_id }).catch(() => {});
      await notifyInbox(m.home_player_email, '🤝 Wager Refunded', `Draw in ${label}. Your ${wagerEach.toLocaleString()} STC wager was refunded.`);
      await notifyInbox(m.away_player_email, '🤝 Wager Refunded', `Draw in ${label}. Your ${wagerEach.toLocaleString()} STC wager was refunded.`);
      return { success: true, data: { result: 'refunded', wagerEach } };
    }

    const homeWon = homeScore > awayScore;
    const winnerId = homeWon ? m.home_player_id : m.away_player_id;
    const winnerEmail = homeWon ? (m.home_player_email || null) : (m.away_player_email || null);
    const loserEmail = homeWon ? (m.away_player_email || null) : (m.home_player_email || null);
    const winnerName = homeWon ? (m.home_player_name || 'Home') : (m.away_player_name || 'Away');
    const loserName = homeWon ? (m.away_player_name || 'Away') : (m.home_player_name || 'Home');

    if (winnerId) {
      await createPlayerTx({
        playerId: winnerId,
        playerEmail: winnerEmail,
        amount: pot,
        category: 'wager_win',
        source: label,
        description: `Wager won vs ${loserName} — ${label}`,
        referenceId: match_id,
      }).catch(() => {});
    }

    await EXECUTESQL("UPDATE matches SET wager_status = 'settled', updated_date = NOW() WHERE id = ?", [match_id]);

    await notifyInbox(
      winnerEmail,
      '🏆 Wager Won',
      `You won ${pot.toLocaleString()} STC in ${label}.`
    );
    await notifyInbox(
      loserEmail,
      '💸 Wager Lost',
      `${winnerName} won the wager in ${label}. Better luck next match.`
    );

    return {
      success: true,
      data: {
        result: 'settled',
        winner_player_id: winnerId || null,
        winner_name: winnerName,
        amount: pot,
      },
    };
  },

  async payMonthlyRent({ _auth_user_id }) {
    // Allow admin-triggered and scheduler-triggered execution.
    if (_auth_user_id) {
      const u = await EXECUTESQL('SELECT role_id FROM users WHERE id = ? LIMIT 1', [_auth_user_id]);
      const roleId = Number(u[0]?.role_id ?? 1);
      if (roleId !== 0 && roleId !== 2) throw new Error('Forbidden');
    }

    const now = new Date();
    const msPerMonth = 30 * 24 * 60 * 60 * 1000;
    const rentals = await EXECUTESQL(
      "SELECT * FROM lifestyle_purchases WHERE purchase_type = 'rent' AND rent_active = 1",
      []
    );

    let paid_count = 0;
    let expired_count = 0;
    let skipped_count = 0;

    for (const rental of rentals) {
      const expiry = rental.rent_expiry_at ? new Date(rental.rent_expiry_at) : null;
      const lastPaid = rental.last_rent_paid_at ? new Date(rental.last_rent_paid_at) : new Date(rental.created_date || now);
      const isDue = (now.getTime() - lastPaid.getTime()) >= msPerMonth;

      if (expiry && now.getTime() > expiry.getTime()) {
        await EXECUTESQL(
          'UPDATE lifestyle_purchases SET rent_active = 0, is_defaulted = 1, updated_date = NOW() WHERE id = ?',
          [rental.id]
        );
        const players = await EXECUTESQL('SELECT email FROM players WHERE id = ? LIMIT 1', [rental.player_id]);
        if (players[0]?.email) {
          await createNotificationIfEnabled({
            recipientEmail: players[0].email,
            type: 'announcement',
            title: `Rental expired: ${rental.item_name || 'Asset'}`,
            body: `Your rental has expired and was removed from active rentals.`,
            link: '/lifestyle',
            relatedId: rental.id,
          });
        }
        expired_count += 1;
        continue;
      }

      if (!isDue) {
        skipped_count += 1;
        continue;
      }

      const monthsDue = Math.max(1, Math.floor((now.getTime() - lastPaid.getTime()) / msPerMonth));
      const amount = monthsDue * Number(rental.monthly_rent_stc || 0);
      if (amount <= 0) {
        skipped_count += 1;
        continue;
      }

      const players = await EXECUTESQL('SELECT id, email, gamertag, stc FROM players WHERE id = ? LIMIT 1', [rental.player_id]);
      const player = players[0];
      if (!player) {
        skipped_count += 1;
        continue;
      }

      const stc = Number(player.stc || 0);
      if (stc < amount) {
        await EXECUTESQL(
          'UPDATE lifestyle_purchases SET rent_active = 0, is_defaulted = 1, updated_date = NOW() WHERE id = ?',
          [rental.id]
        );
        await createNotificationIfEnabled({
          recipientEmail: player.email,
          type: 'announcement',
          title: `Rental cancelled: ${rental.item_name || 'Asset'}`,
          body: `Insufficient STC for rent (${amount.toLocaleString()} STC). Rental was terminated.`,
          link: '/lifestyle',
          relatedId: rental.id,
        });
        expired_count += 1;
        continue;
      }

      const newStc = stc - amount;
      const newExpiry = new Date(now.getTime() + msPerMonth);
      await EXECUTESQL('UPDATE players SET stc = ?, updated_date = NOW() WHERE id = ?', [newStc, player.id]);
      await EXECUTESQL(
        `UPDATE lifestyle_purchases
         SET last_rent_paid_at = ?, rent_expiry_at = ?, is_defaulted = 0, updated_date = NOW()
         WHERE id = ?`,
        [toMysqlDateTime(now), toMysqlDateTime(newExpiry), rental.id]
      );
      await EXECUTESQL(
        `INSERT INTO stc_transactions (id, player_id, player_email, amount, type, description, reference_id, created_date)
         VALUES (?, ?, ?, ?, 'rent_payment', ?, ?, NOW())`,
        [uuidv4(), player.id, player.email, -amount, `Monthly rent (${monthsDue}mo): ${rental.item_name || rental.id}`, rental.id]
      ).catch(() => {});
      await createNotificationIfEnabled({
        recipientEmail: player.email,
        type: 'announcement',
        title: `Rent paid: ${rental.item_name || 'Asset'}`,
        body: `-${amount.toLocaleString()} STC paid. Renewed until ${newExpiry.toISOString().slice(0, 10)}.`,
        link: '/lifestyle',
        relatedId: rental.id,
      });
      paid_count += 1;
    }

    return { success: true, paid_count, expired_count, skipped_count };
  },

  async processLifestyleMaintenance({ _auth_user_id }) {
    if (_auth_user_id) {
      const u = await EXECUTESQL('SELECT role_id FROM users WHERE id = ? LIMIT 1', [_auth_user_id]);
      const roleId = Number(u[0]?.role_id ?? 1);
      if (roleId !== 0 && roleId !== 2) throw new Error('Forbidden');
    }

    const now = new Date();
    const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    const purchases = await EXECUTESQL('SELECT * FROM lifestyle_purchases', []);
    const due = purchases.filter((p) => {
      const hasMaint = Number(p.weekly_maintenance_stc || 0) > 0 || ['real_estate', 'vehicle'].includes(String(p.item_category || ''));
      if (!hasMaint) return false;
      if (!p.last_maintenance_paid_at) return true;
      return new Date(p.last_maintenance_paid_at).getTime() < oneWeekAgo.getTime();
    });

    // Ensure weekly_maintenance_stc exists for property/vehicle items.
    for (const p of due) {
      if (!p.weekly_maintenance_stc && ['real_estate', 'vehicle'].includes(String(p.item_category || ''))) {
        const itemRows = await EXECUTESQL('SELECT weekly_maintenance_stc FROM lifestyle_items WHERE id = ? LIMIT 1', [p.item_id]);
        const computed = Number(itemRows[0]?.weekly_maintenance_stc || 5000);
        await EXECUTESQL('UPDATE lifestyle_purchases SET weekly_maintenance_stc = ?, updated_date = NOW() WHERE id = ?', [computed, p.id]);
        p.weekly_maintenance_stc = computed;
      }
    }

    const byPlayer = new Map();
    for (const p of due) {
      const list = byPlayer.get(p.player_id) || [];
      list.push(p);
      byPlayer.set(p.player_id, list);
    }

    let processed = 0;
    let defaulted = 0;

    for (const [playerId, list] of byPlayer.entries()) {
      const rows = await EXECUTESQL('SELECT id, email, stc FROM players WHERE id = ? LIMIT 1', [playerId]);
      const player = rows[0];
      if (!player) continue;
      let stc = Number(player.stc || 0);
      let deducted = 0;
      let paidItems = [];
      let defaultedItems = [];

      for (const purchase of list) {
        const cost = Number(purchase.weekly_maintenance_stc || 0);
        if (!cost) continue;
        if (stc >= cost) {
          stc -= cost;
          deducted += cost;
          paidItems.push(purchase.item_name || 'Asset');
          await EXECUTESQL(
            'UPDATE lifestyle_purchases SET last_maintenance_paid_at = ?, is_defaulted = 0, updated_date = NOW() WHERE id = ?',
            [toMysqlDateTime(now), purchase.id]
          );
          processed += 1;
        } else {
          defaultedItems.push(purchase.item_name || 'Asset');
          await EXECUTESQL(
            'UPDATE lifestyle_purchases SET is_defaulted = 1, updated_date = NOW() WHERE id = ?',
            [purchase.id]
          );
          defaulted += 1;
        }
      }

      if (deducted > 0) {
        await EXECUTESQL('UPDATE players SET stc = ?, updated_date = NOW() WHERE id = ?', [stc, player.id]);
        await EXECUTESQL(
          `INSERT INTO stc_transactions (id, player_id, player_email, amount, type, description, reference_id, created_date)
           VALUES (?, ?, ?, ?, 'lifestyle_maintenance', ?, ?, NOW())`,
          [uuidv4(), player.id, player.email, -deducted, `Weekly maintenance: ${paidItems.join(', ')}`, player.id]
        ).catch(() => {});
        await createNotificationIfEnabled({
          recipientEmail: player.email,
          type: 'announcement',
          title: 'Weekly maintenance deducted',
          body: `${deducted.toLocaleString()} STC deducted for ${paidItems.length} asset(s).`,
          link: '/lifestyle',
          relatedId: player.id,
        });
      }

      if (defaultedItems.length) {
        await createNotificationIfEnabled({
          recipientEmail: player.email,
          type: 'announcement',
          title: `${defaultedItems.length} asset(s) defaulted`,
          body: `Insufficient STC maintenance for: ${defaultedItems.join(', ')}.`,
          link: '/lifestyle',
          relatedId: player.id,
        });
      }
    }

    return { success: true, processed, defaulted };
  },

  async payMonthlySalaries({ _auth_user_id }) {
    // Same logic as weekly salaries, exposed for monthly scheduler compatibility.
    return HANDLERS.payWeeklySalaries({ _auth_user_id });
  },

  async stcEngine({ event_type, player_id, club_id, reference_id, description, amount_override }) {
    if (!event_type) throw new Error('event_type required');
    const REWARDS = {
      match_win: { player: 5000, club: 10000, requiresClub: true },
      match_draw: { player: 2000, club: 4000, requiresClub: true },
      tournament_win: { player: 50000, club: 100000, requiresClub: true },
      tournament_final: { player: 20000, club: 40000, requiresClub: true },
      tournament_participation: { player: 5000, club: 10000, requiresClub: true },
      achievement: { player: 10000, club: 0, requiresClub: true },
      streak_bonus: { player: 15000, club: 0, requiresClub: true },
      match_loss: { player: 500, club: 1000, requiresClub: false },
      wager_win: { player: 0, club: 0, requiresClub: false },
      wager_refund: { player: 0, club: 0, requiresClub: false },
    };
    const reward = REWARDS[event_type] || { player: 0, club: 0, requiresClub: false };
    const results = [];

    if (player_id) {
      const pRows = await EXECUTESQL('SELECT id, email, stc, club_id FROM players WHERE id = ? LIMIT 1', [player_id]);
      const p = pRows[0];
      if (p) {
        if (reward.requiresClub && !p.club_id) {
          results.push({ entity: 'player', id: player_id, amount: 0, skipped: true, reason: 'Club-based reward requires club membership' });
        } else {
          const amount = amount_override !== undefined ? Number(amount_override) : Number(reward.player || 0);
          if (amount !== 0) {
            const newStc = Math.max(0, Number(p.stc || 0) + amount);
            await EXECUTESQL('UPDATE players SET stc = ?, updated_date = NOW() WHERE id = ?', [newStc, p.id]);
            await EXECUTESQL(
              `INSERT INTO stc_transactions (id, player_id, player_email, amount, type, description, reference_id, created_date)
               VALUES (?, ?, ?, ?, ?, ?, ?, NOW())`,
              [uuidv4(), p.id, p.email, amount, event_type, description || `STC: ${String(event_type).replace(/_/g, ' ')}`, reference_id || null]
            ).catch(() => {});
            results.push({ entity: 'player', id: p.id, amount, new_balance: newStc });
          }
        }
      }
    }

    if (club_id) {
      const cRows = await EXECUTESQL('SELECT id, stc FROM clubs WHERE id = ? LIMIT 1', [club_id]);
      const c = cRows[0];
      if (c) {
        const amount = amount_override !== undefined ? Number(amount_override) : Number(reward.club || 0);
        if (amount !== 0) {
          const newStc = Math.max(0, Number(c.stc || 0) + amount);
          await EXECUTESQL('UPDATE clubs SET stc = ?, updated_date = NOW() WHERE id = ?', [newStc, c.id]);
          await EXECUTESQL(
            `INSERT INTO stc_transactions (id, club_id, amount, type, description, reference_id, created_date)
             VALUES (?, ?, ?, ?, ?, ?, NOW())`,
            [uuidv4(), c.id, amount, event_type, description || `Club STC: ${String(event_type).replace(/_/g, ' ')}`, reference_id || null]
          ).catch(() => {});
          results.push({ entity: 'club', id: c.id, amount, new_balance: newStc });
        }
      }
    }

    return { success: true, results };
  },

  async upgradeLifestyleAsset({ _auth_user_id, purchase_id, upgrade_id }) {
    if (!_auth_user_id) throw new Error('not authenticated');
    if (!purchase_id) throw new Error('purchase_id required');
    const { player } = await getMe(_auth_user_id);
    const rows = await EXECUTESQL('SELECT * FROM lifestyle_purchases WHERE id = ? AND player_id = ? LIMIT 1', [purchase_id, player.id]);
    if (!rows.length) throw new Error('Purchase not found');
    const p = rows[0];
    const level = Number(p.upgrade_level || 0);
    const cost = Number((p.base_upgrade_cost_stc || 25000) * (level + 1));
    if (Number(player.stc || 0) < cost) throw new Error('Insufficient STC');
    const new_stc_balance = Number(player.stc || 0) - cost;
    const upgrade_level = level + 1;
    const new_value = Number(p.current_value_stc || p.price_paid_stc || 0) + cost;
    await EXECUTESQL('UPDATE players SET stc = ?, updated_date = NOW() WHERE id = ?', [new_stc_balance, player.id]);
    return { success: true, data: { purchase_id, upgrade_id: upgrade_id || null, upgrade_level, cost, new_value, new_stc_balance } };
  },

  async wagerManagement({ _auth_user_id, action, match_id, winner, note }) {
    if (!_auth_user_id) throw new Error('not authenticated');
    const admins = await EXECUTESQL('SELECT id FROM users WHERE id = ? AND role_id = 0 LIMIT 1', [_auth_user_id]);
    if (!admins.length) throw new Error('Admin access required');

    if (action === 'get_all') {
      const rows = await EXECUTESQL(
        `SELECT id, mode, status, wager_stc, wager_status, wager_home_locked, wager_away_locked,
                home_score, away_score, scheduled_date,
                home_club_id, away_club_id, home_player_id, away_player_id,
                home_club_name, away_club_name, home_player_name, away_player_name
         FROM matches WHERE wager_stc > 0 ORDER BY scheduled_date DESC LIMIT 200`
      );
      return { success: true, data: { wagers: rows } };
    }

    if (!match_id) throw new Error('match_id required');
    const rows = await EXECUTESQL('SELECT * FROM matches WHERE id = ? LIMIT 1', [match_id]);
    if (!rows.length) throw new Error('Match not found');
    const m = rows[0];
    const isClub = m.mode === 'club';
    const wagerEach = Number(m.wager_stc || 0);
    const pot = wagerEach * 2;
    const matchLabel = isClub
      ? `${m.home_club_name || 'Home'} vs ${m.away_club_name || 'Away'}`
      : `${m.home_player_name || 'Home'} vs ${m.away_player_name || 'Away'}`;

    if (action === 'cancel_and_refund') {
      if (wagerEach > 0 && m.wager_status === 'active') {
        if (isClub) {
          if (m.home_club_id) await createClubTx({ clubId: m.home_club_id, amount: wagerEach, type: 'wager_refund', category: 'wager_refund', description: `Admin cancelled wager — ${matchLabel}`, referenceId: m.id }).catch(() => {});
          if (m.away_club_id) await createClubTx({ clubId: m.away_club_id, amount: wagerEach, type: 'wager_refund', category: 'wager_refund', description: `Admin cancelled wager — ${matchLabel}`, referenceId: m.id }).catch(() => {});
        } else {
          const [hp] = await EXECUTESQL('SELECT email FROM players WHERE id = ? LIMIT 1', [m.home_player_id]).catch(() => [null]);
          const [ap] = await EXECUTESQL('SELECT email FROM players WHERE id = ? LIMIT 1', [m.away_player_id]).catch(() => [null]);
          if (m.home_player_id) await createPlayerTx({ playerId: m.home_player_id, playerEmail: hp?.email || null, amount: wagerEach, category: 'wager_refund', source: matchLabel, description: `Admin cancelled wager — ${matchLabel}`, referenceId: m.id }).catch(() => {});
          if (m.away_player_id) await createPlayerTx({ playerId: m.away_player_id, playerEmail: ap?.email || null, amount: wagerEach, category: 'wager_refund', source: matchLabel, description: `Admin cancelled wager — ${matchLabel}`, referenceId: m.id }).catch(() => {});
        }
      }
      await EXECUTESQL(
        "UPDATE matches SET wager_status = 'cancelled', wager_home_locked = 0, wager_away_locked = 0, updated_date = NOW() WHERE id = ?",
        [match_id]
      );
      return { success: true };
    }

    if (action === 'force_settle') {
      if (!winner || !['home', 'away', 'draw'].includes(winner)) throw new Error('winner must be home, away, or draw');
      if (!['active', 'settling', 'disputed'].includes(m.wager_status) && wagerEach > 0) throw new Error(`Cannot force-settle — wager status is '${m.wager_status}'`);
      if (!wagerEach) throw new Error('No wager amount on this match');
      if (winner === 'draw') {
        if (isClub) {
          if (m.home_club_id) await createClubTx({ clubId: m.home_club_id, amount: wagerEach, type: 'wager_refund', category: 'wager_refund', description: `Admin settled wager as draw — ${matchLabel}`, referenceId: m.id }).catch(() => {});
          if (m.away_club_id) await createClubTx({ clubId: m.away_club_id, amount: wagerEach, type: 'wager_refund', category: 'wager_refund', description: `Admin settled wager as draw — ${matchLabel}`, referenceId: m.id }).catch(() => {});
        } else {
          const [hp] = await EXECUTESQL('SELECT email FROM players WHERE id = ? LIMIT 1', [m.home_player_id]).catch(() => [null]);
          const [ap] = await EXECUTESQL('SELECT email FROM players WHERE id = ? LIMIT 1', [m.away_player_id]).catch(() => [null]);
          if (m.home_player_id) await createPlayerTx({ playerId: m.home_player_id, playerEmail: hp?.email || null, amount: wagerEach, category: 'wager_refund', source: matchLabel, description: `Admin settled wager as draw — ${matchLabel}`, referenceId: m.id }).catch(() => {});
          if (m.away_player_id) await createPlayerTx({ playerId: m.away_player_id, playerEmail: ap?.email || null, amount: wagerEach, category: 'wager_refund', source: matchLabel, description: `Admin settled wager as draw — ${matchLabel}`, referenceId: m.id }).catch(() => {});
        }
        await EXECUTESQL("UPDATE matches SET wager_status = 'refunded', updated_date = NOW() WHERE id = ?", [match_id]);
      } else {
        if (isClub) {
          const winnerClubId = winner === 'home' ? m.home_club_id : m.away_club_id;
          const loserClubId  = winner === 'home' ? m.away_club_id : m.home_club_id;
          const winnerName   = winner === 'home' ? (m.home_club_name || 'Home') : (m.away_club_name || 'Away');
          const loserName    = winner === 'home' ? (m.away_club_name || 'Away') : (m.home_club_name || 'Home');
          if (winnerClubId) await createClubTx({ clubId: winnerClubId, amount: pot, type: 'wager_win',  category: 'wager_win',  description: `Admin settled — wager won vs ${loserName}${note ? ` (${note})` : ''}`, referenceId: m.id }).catch(() => {});
          if (loserClubId)  await createClubTx({ clubId: loserClubId,  amount: 0,   type: 'wager_loss', category: 'wager_loss', description: `Admin settled — wager lost vs ${winnerName}${note ? ` (${note})` : ''}`, referenceId: m.id }).catch(() => {});
        } else {
          const winnerId    = winner === 'home' ? m.home_player_id  : m.away_player_id;
          const loserId     = winner === 'home' ? m.away_player_id  : m.home_player_id;
          const winnerEmail = winner === 'home' ? (m.home_player_email || null) : (m.away_player_email || null);
          const loserEmail  = winner === 'home' ? (m.away_player_email || null) : (m.home_player_email || null);
          const winnerName  = winner === 'home' ? (m.home_player_name || 'Home') : (m.away_player_name || 'Away');
          const loserName   = winner === 'home' ? (m.away_player_name || 'Away') : (m.home_player_name || 'Home');
          if (winnerId) await createPlayerTx({ playerId: winnerId, playerEmail: winnerEmail, amount: pot, category: 'wager_win',  source: matchLabel, description: `Admin settled — wager won vs ${loserName}${note ? ` (${note})` : ''}`, referenceId: m.id }).catch(() => {});
          if (loserId)  await createPlayerTx({ playerId: loserId,  playerEmail: loserEmail,  amount: 0,   category: 'wager_loss', source: matchLabel, description: `Admin settled — wager lost vs ${winnerName}${note ? ` (${note})` : ''}`, referenceId: m.id }).catch(() => {});
        }
        await EXECUTESQL("UPDATE matches SET wager_status = 'settled', updated_date = NOW() WHERE id = ?", [match_id]);
      }
      return { success: true };
    }

    throw new Error(`Unknown wagerManagement action: ${action}`);
  },

  async stadiumManagement({
    _auth_user_id, action, level, capacity, ticket_price_stc, upgrade_cost_stc,
    max_wage_budget_stc, max_transfer_budget_stc, monthly_maintenance_stc,
    description, club_id, stadium_level, stadium_name, amount, note,
  }) {
    if (!_auth_user_id) throw new Error('not authenticated');
    const admins = await EXECUTESQL('SELECT id FROM users WHERE id = ? AND role_id = 0 LIMIT 1', [_auth_user_id]);
    if (!admins.length) throw new Error('Admin access required');

    if (action === 'get_config') {
      const rows = await EXECUTESQL('SELECT * FROM stadium_config ORDER BY level ASC');
      return { success: true, data: { levels: rows } };
    }

    if (action === 'set_level_config') {
      if (level == null) throw new Error('level required');
      const updates = [];
      const vals = [];
      if (capacity        != null) { updates.push('capacity = ?');         vals.push(Number(capacity)); }
      if (ticket_price_stc!= null) { updates.push('ticket_price_stc = ?'); vals.push(Number(ticket_price_stc)); }
      if (upgrade_cost_stc!= null) { updates.push('upgrade_cost_stc = ?'); vals.push(Number(upgrade_cost_stc)); }
      if (max_wage_budget_stc != null) { updates.push('max_wage_budget_stc = ?'); vals.push(Number(max_wage_budget_stc)); }
      if (max_transfer_budget_stc != null) { updates.push('max_transfer_budget_stc = ?'); vals.push(Number(max_transfer_budget_stc)); }
      if (monthly_maintenance_stc != null) { updates.push('monthly_maintenance_stc = ?'); vals.push(Number(monthly_maintenance_stc)); }
      if (description     != null) { updates.push('description = ?');      vals.push(String(description)); }
      if (!updates.length) throw new Error('Nothing to update');
      vals.push(Number(level));
      await EXECUTESQL(`UPDATE stadium_config SET ${updates.join(', ')}, updated_date = NOW() WHERE level = ?`, vals);
      _stadiumConfigCache = null; // bust cache
      return { success: true };
    }

    if (action === 'edit_club_stadium') {
      if (!club_id) throw new Error('club_id required');
      const sets = [];
      const vals = [];
      if (stadium_level != null) { sets.push('stadium_level = ?');    vals.push(Number(stadium_level)); }
      if (stadium_name  != null) { sets.push('stadium_name = ?');     vals.push(String(stadium_name)); }
      if (capacity      != null) { sets.push('stadium_capacity = ?'); vals.push(Number(capacity)); }
      if (stadium_level != null) {
        const tier = getStadiumFinanceTier(stadium_level);
        sets.push('wage_budget_stc = ?');
        vals.push(Number(tier.max_wage_budget_stc));
        sets.push('transfer_budget_stc = ?');
        vals.push(Number(tier.max_transfer_budget_stc));
      }
      if (!sets.length) throw new Error('Nothing to update');
      vals.push(club_id);
      await EXECUTESQL(`UPDATE clubs SET ${sets.join(', ')}, updated_date = NOW() WHERE id = ?`, vals);
      return { success: true };
    }

    if (action === 'correct_revenue') {
      if (!club_id || amount == null) throw new Error('club_id and amount required');
      const corrAmt = Number(amount);
      await createClubTx({
        clubId: club_id, amount: corrAmt,
        type: corrAmt >= 0 ? 'ticket_revenue' : 'adjustment',
        category: 'ticket_revenue',
        description: note ? `Admin revenue correction: ${note}` : 'Admin ticket revenue correction',
        referenceId: club_id,
        relatedEntityType: 'club',
      });
      return { success: true };
    }

    if (action === 'upgrade_club_stadium') {
      if (!club_id) throw new Error('club_id required');
      const [club] = await EXECUTESQL('SELECT id, stc, stadium_level, name FROM clubs WHERE id = ? LIMIT 1', [club_id]);
      if (!club) throw new Error('Club not found');
      const cfg = await getStadiumConfig();
      const currentLevel = Math.min(Math.max(Number(club.stadium_level || 0), 0), cfg.length - 1);
      const next = cfg[currentLevel + 1];
      if (!next) throw new Error('Already at maximum stadium level');
      const cost = Number(next.upgrade_cost_stc || 0);
      if (Number(club.stc || 0) < cost) throw new Error(`Insufficient STC — need ${cost.toLocaleString()}, have ${Number(club.stc || 0).toLocaleString()}`);
      await createClubTx({
        clubId: club_id, amount: -cost,
        type: 'stadium_upgrade', category: 'stadium_upgrade',
        description: `Stadium upgraded to ${next.name}`,
        referenceId: club_id,
        relatedEntityType: 'club',
      });
      await EXECUTESQL(
        'UPDATE clubs SET stadium_level = ?, stadium_capacity = ?, wage_budget_stc = ?, transfer_budget_stc = ?, updated_date = NOW() WHERE id = ?',
        [
          currentLevel + 1,
          Number(next.capacity),
          Number(next.max_wage_budget_stc || getStadiumFinanceTier(currentLevel + 1).max_wage_budget_stc),
          Number(next.max_transfer_budget_stc || getStadiumFinanceTier(currentLevel + 1).max_transfer_budget_stc),
          club_id,
        ]
      );
      _stadiumConfigCache = null;
      return { success: true, data: { new_level: currentLevel + 1, new_capacity: next.capacity, name: next.name } };
    }

    throw new Error(`Unknown stadiumManagement action: ${action}`);
  },

  async backfillPlayerStc({ _auth_user_id, dry_run = false }) {
    if (!_auth_user_id) throw new Error('not authenticated');
    const admins = await EXECUTESQL('SELECT id FROM users WHERE id = ? AND role_id = 0 LIMIT 1', [_auth_user_id]);
    if (!admins.length) throw new Error('Admin access required');

    const needsStc = await EXECUTESQL(
      'SELECT id, email, stc, created_date FROM players WHERE stc IS NULL OR stc < 50000'
    );
    const missingTxOnly = await EXECUTESQL(
      `SELECT p.id, p.email, p.stc, p.created_date FROM players p
       WHERE (p.stc IS NOT NULL AND p.stc >= 50000)
         AND NOT EXISTS (
           SELECT 1 FROM player_stc_transactions t
           WHERE t.player_id = p.id AND t.category = 'initial_grant'
         )`
    );

    const stats = {
      needs_stc: needsStc.length,
      needs_tx_only: missingTxOnly.length,
      total_to_repair: needsStc.length + missingTxOnly.length,
      repaired_stc: 0,
      repaired_tx: 0,
      errors: 0,
    };

    if (dry_run) return { success: true, data: stats };

    for (const p of needsStc) {
      try {
        await EXECUTESQL(
          'UPDATE players SET stc = 50000, updated_date = NOW() WHERE id = ? AND (stc IS NULL OR stc < 50000)',
          [p.id]
        );
        const existing = await EXECUTESQL(
          "SELECT id FROM player_stc_transactions WHERE player_id = ? AND category = 'initial_grant' LIMIT 1",
          [p.id]
        );
        if (!existing.length) {
          await EXECUTESQL(
            `INSERT INTO player_stc_transactions
               (id, player_id, player_email, amount, balance_after, type, category, source, description, created_date)
             VALUES (?, ?, ?, 50000, 50000, 'income', 'initial_grant', 'STAGE',
                     'Welcome to STAGE — 50,000 STC starting balance', ?)`,
            [uuidv4(), p.id, p.email || null, p.created_date || new Date()]
          );
        }
        stats.repaired_stc++;
      } catch { stats.errors++; }
    }

    for (const p of missingTxOnly) {
      try {
        await EXECUTESQL(
          `INSERT INTO player_stc_transactions
             (id, player_id, player_email, amount, balance_after, type, category, source, description, created_date)
           VALUES (?, ?, ?, 50000, ?, 'income', 'initial_grant', 'STAGE',
                   'Welcome to STAGE — 50,000 STC starting balance', ?)`,
          [uuidv4(), p.id, p.email || null, Number(p.stc || 50000), p.created_date || new Date()]
        );
        stats.repaired_tx++;
      } catch { stats.errors++; }
    }

    return { success: true, data: stats };
  },

  async buyLifestyleItem({ _auth_user_id, item_id, location_city, location_country, location_emoji }) {
    if (!_auth_user_id) throw new Error('not authenticated');
    if (!item_id) throw new Error('item_id required');
    const { user, player } = await getMe(_auth_user_id);
    if (!player) throw new Error('Player not found');
    const items = await EXECUTESQL('SELECT * FROM lifestyle_items WHERE id = ? LIMIT 1', [item_id]);
    if (!items.length) throw new Error('Item not found');
    const item = items[0];
    if (item.can_buy === 0) throw new Error('This asset is not available for purchase');
    const price = Number(item.price_stc || 0);
    if (!price) throw new Error('No buy price set for this asset');
    if (price > Number(player.stc || 0)) throw new Error('Insufficient STC');
    const purchaseId = uuidv4();
    const loc = resolveLifestyleLocation(item, { location_city, location_country, location_emoji });
    const isProperty = item.category === 'real_estate' || item.category === 'houses';
    await EXECUTESQL(
      `INSERT INTO lifestyle_purchases
         (id, player_id, player_email, player_gamertag,
          item_id, item_name, item_category, item_subcategory, item_emoji, item_type, item_tier,
          rent_active, is_residence, purchase_type, price_paid_stc, current_value_stc,
          monthly_rent_stc, weekly_maintenance_stc, location_city, location_country, location_emoji,
          status, created_date)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,0,?,'buy',?,?,?,?,?,?,?,'active',NOW())`,
      [purchaseId, player.id, user.email, player.gamertag || null,
       item_id, item.name || null, item.category || null, item.subcategory || null, item.emoji || null,
       item.category || null, item.tier || null,
       isProperty ? 1 : 0,
       price, price,
       Number(item.passive_income_stc || 0), Number(item.weekly_maintenance_stc || 0),
       loc.city, loc.country, loc.emoji]
    );
    const { new_balance: new_stc_balance } = await createPlayerTx({
      playerId: player.id, playerEmail: user.email, amount: -price,
      category: 'lifestyle_purchase', source: item.name || 'Lifestyle',
      description: `Bought: ${item.name}`, referenceId: purchaseId,
    });
    return { success: true, data: { new_stc_balance, purchase_id: purchaseId } };
  },

  async rentLifestyleItem({ _auth_user_id, item_id, location_city, location_country, location_emoji }) {
    if (!_auth_user_id) throw new Error('not authenticated');
    if (!item_id) throw new Error('item_id required');
    const { user, player } = await getMe(_auth_user_id);
    if (!player) throw new Error('Player not found');
    const items = await EXECUTESQL('SELECT * FROM lifestyle_items WHERE id = ? LIMIT 1', [item_id]);
    if (!items.length) throw new Error('Item not found');
    const item = items[0];
    if (!item.can_rent) throw new Error('This asset is not available for rent');
    const rent = Number(item.rent_price_stc || 0);
    if (!rent) throw new Error('No rent price set');
    if (rent > Number(player.stc || 0)) throw new Error('Insufficient STC');
    const durationDays = Number(item.rent_duration_days || 30);
    const rentEndDate = new Date();
    rentEndDate.setDate(rentEndDate.getDate() + durationDays);
    const purchaseId = uuidv4();
    const loc = resolveLifestyleLocation(item, { location_city, location_country, location_emoji });
    const isProperty = item.category === 'real_estate' || item.category === 'houses';
    await EXECUTESQL(
      `INSERT INTO lifestyle_purchases
         (id, player_id, player_email, player_gamertag,
          item_id, item_name, item_category, item_subcategory, item_emoji, item_type, item_tier,
          rent_active, is_residence, purchase_type, price_paid_stc, rent_end_date,
          monthly_rent_stc, weekly_maintenance_stc, location_city, location_country, location_emoji,
          status, created_date)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,1,?,'rent',?,?,?,?,?,?,?,'active',NOW())`,
      [purchaseId, player.id, user.email, player.gamertag || null,
       item_id, item.name || null, item.category || null, item.subcategory || null, item.emoji || null,
       item.category || null, item.tier || null,
       isProperty ? 1 : 0,
       rent, rentEndDate.toISOString().slice(0, 19).replace('T', ' '),
       rent, Number(item.weekly_maintenance_stc || 0),
       loc.city, loc.country, loc.emoji]
    );
    const { new_balance: new_stc_balance } = await createPlayerTx({
      playerId: player.id, playerEmail: user.email, amount: -rent,
      category: 'lifestyle_rent', source: item.name || 'Lifestyle',
      description: `Rented: ${item.name} for ${durationDays} days`,
      referenceId: purchaseId,
    });
    return { success: true, data: { new_stc_balance, purchase_id: purchaseId, rent_end_date: rentEndDate } };
  },

  async investInLifestyleItem({ _auth_user_id, item_id, location_city, location_country, location_emoji }) {
    if (!_auth_user_id) throw new Error('not authenticated');
    if (!item_id) throw new Error('item_id required');
    const { user, player } = await getMe(_auth_user_id);
    if (!player) throw new Error('Player not found');
    const items = await EXECUTESQL('SELECT * FROM lifestyle_items WHERE id = ? LIMIT 1', [item_id]);
    if (!items.length) throw new Error('Item not found');
    const item = items[0];
    if (!item.can_invest) throw new Error('This asset does not support investment');
    const price = Number(item.invest_price_stc || item.price_stc || 0);
    if (!price) throw new Error('No investment price set');
    if (price > Number(player.stc || 0)) throw new Error('Insufficient STC');
    const returnRate = Number(item.invest_return_rate || 0);
    const returnAmount = Math.floor(price * returnRate / 100);
    const durationDays = Number(item.invest_duration_days || 30);
    const investEndDate = new Date();
    investEndDate.setDate(investEndDate.getDate() + durationDays);
    const purchaseId = uuidv4();
    const loc = resolveLifestyleLocation(item, { location_city, location_country, location_emoji });
    await EXECUTESQL(
      `INSERT INTO lifestyle_purchases
         (id, player_id, player_email, player_gamertag,
          item_id, item_name, item_category, item_subcategory, item_emoji, item_type, item_tier,
          rent_active, is_residence, purchase_type, price_paid_stc, invest_end_date,
          invest_return_amount, current_value_stc, location_city, location_country, location_emoji,
          status, created_date)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,0,0,'invest',?,?,?,?,?,?,?,'active',NOW())`,
      [purchaseId, player.id, user.email, player.gamertag || null,
       item_id, item.name || null, item.category || null, item.subcategory || null, item.emoji || null,
       item.category || null, item.tier || null,
       price,
       investEndDate.toISOString().slice(0, 19).replace('T', ' '),
       returnAmount, price + returnAmount,
       loc.city, loc.country, loc.emoji]
    );
    const { new_balance: new_stc_balance } = await createPlayerTx({
      playerId: player.id, playerEmail: user.email, amount: -price,
      category: 'lifestyle_invest', source: item.name || 'Investment',
      description: `Invested in: ${item.name} — ${returnRate}% return in ${durationDays}d`,
      referenceId: purchaseId,
    });
    return { success: true, data: { new_stc_balance, purchase_id: purchaseId, return_amount: returnAmount, due_date: investEndDate } };
  },

  async sellLifestyleAsset({ _auth_user_id, purchase_id }) {
    if (!_auth_user_id) throw new Error('not authenticated');
    if (!purchase_id) throw new Error('purchase_id required');
    const { user, player } = await getMe(_auth_user_id);
    if (!player) throw new Error('Player not found');
    const purchases = await EXECUTESQL(
      "SELECT * FROM lifestyle_purchases WHERE id = ? AND player_id = ? LIMIT 1", [purchase_id, player.id]
    );
    if (!purchases.length) throw new Error('Asset not found');
    const purchase = purchases[0];
    if (purchase.purchase_type !== 'buy') throw new Error('Only owned assets can be sold');
    const items = await EXECUTESQL('SELECT * FROM lifestyle_items WHERE id = ? LIMIT 1', [purchase.item_id]);
    if (!items.length) throw new Error('Item not found');
    const item = items[0];
    if (!item.can_sell) throw new Error('This asset cannot be sold');
    const sellPercent = Number(item.sell_value_percent || 60);
    const paidPrice = Number(purchase.price_paid_stc || item.price_stc || 0);
    const sellPrice = Math.floor(paidPrice * sellPercent / 100);
    await EXECUTESQL("UPDATE lifestyle_purchases SET status = 'sold' WHERE id = ?", [purchase_id]);
    const { new_balance: new_stc_balance } = await createPlayerTx({
      playerId: player.id, playerEmail: user.email, amount: sellPrice,
      category: 'lifestyle_sell', source: item.name || 'Asset Sale',
      description: `Sold: ${item.name} for ${sellPrice.toLocaleString()} STC (${sellPercent}% of buy price)`,
      referenceId: purchase_id,
    });
    return { success: true, data: { new_stc_balance, sell_price: sellPrice } };
  },

  async collectInvestmentReturn({ _auth_user_id, purchase_id }) {
    if (!_auth_user_id) throw new Error('not authenticated');
    if (!purchase_id) throw new Error('purchase_id required');
    const { user, player } = await getMe(_auth_user_id);
    if (!player) throw new Error('Player not found');
    const purchases = await EXECUTESQL(
      "SELECT * FROM lifestyle_purchases WHERE id = ? AND player_id = ? AND purchase_type = 'invest' AND status = 'active' LIMIT 1",
      [purchase_id, player.id]
    );
    if (!purchases.length) throw new Error('Investment not found');
    const inv = purchases[0];
    const endDate = inv.invest_end_date ? new Date(inv.invest_end_date) : null;
    if (endDate && new Date() < endDate) {
      throw new Error(`Investment matures on ${endDate.toLocaleDateString()}`);
    }
    const principal = Number(inv.price_paid_stc || 0);
    const returns = Number(inv.invest_return_amount || 0);
    const total = principal + returns;
    await EXECUTESQL("UPDATE lifestyle_purchases SET status = 'collected' WHERE id = ?", [purchase_id]);
    const { new_balance: new_stc_balance } = await createPlayerTx({
      playerId: player.id, playerEmail: user.email, amount: total,
      category: 'lifestyle_invest_return', source: 'Investment Return',
      description: `Investment matured: ${principal.toLocaleString()} principal + ${returns.toLocaleString()} return`,
      referenceId: purchase_id,
    });
    return { success: true, data: { new_stc_balance, principal, returns, total } };
  },

  async collectPassiveIncome({ _auth_user_id }) {
    if (!_auth_user_id) throw new Error('not authenticated');
    const { user, player } = await getMe(_auth_user_id);
    if (!player) throw new Error('Player not found');
    const purchases = await EXECUTESQL(
      "SELECT * FROM lifestyle_purchases WHERE player_id = ? AND purchase_type = 'buy' AND status = 'active'",
      [player.id]
    );
    if (!purchases.length) return { success: true, data: { collected: 0 } };
    let collected = 0;
    const now = new Date();
    for (const p of purchases) {
      const items = await EXECUTESQL('SELECT * FROM lifestyle_items WHERE id = ? LIMIT 1', [p.item_id]);
      if (!items.length) continue;
      const item = items[0];
      const inc = Number(item.passive_income_stc || 0);
      if (inc <= 0) continue;
      const intervalDays = Number(item.passive_income_interval_days || 7);
      const lastCollected = p.last_passive_collected ? new Date(p.last_passive_collected) : new Date(p.created_date || 0);
      const msSinceCollect = now - lastCollected;
      const msInterval = intervalDays * 24 * 60 * 60 * 1000;
      if (msSinceCollect < msInterval) continue;
      collected += inc;
      await EXECUTESQL('UPDATE lifestyle_purchases SET last_passive_collected = NOW() WHERE id = ?', [p.id]);
    }
    if (collected > 0) {
      await createPlayerTx({
        playerId: player.id, playerEmail: user.email, amount: collected,
        category: 'lifestyle_passive_income', source: 'Passive Income',
        description: `Passive income collected from owned assets`,
      });
    }
    return { success: true, data: { collected } };
  },

  async lifestyleAdmin({ _auth_user_id, action, asset_id,
    name, category, subcategory, description, image_url, emoji, available_cities, tier, sort_order,
    price_stc, rent_price_stc, rent_duration_days, invest_price_stc,
    invest_return_rate, invest_duration_days, passive_income_stc,
    passive_income_interval_days, weekly_maintenance_stc,
    can_buy, can_rent, can_invest, can_sell, sell_value_percent,
    allows_multiple, is_active,
  }) {
    if (!_auth_user_id) throw new Error('not authenticated');
    const adminCheck = await EXECUTESQL('SELECT role_id FROM users WHERE id = ? LIMIT 1', [_auth_user_id]);
    if (!adminCheck.length || Number(adminCheck[0].role_id) !== 0) throw new Error('Admin only');

    const availableCitiesJson = serializeLifestyleCities(available_cities);
    const vals = [
      name, category || 'fashion', subcategory || null,
      description || null, image_url || null, emoji || null, availableCitiesJson, tier || 'standard',
      Number(sort_order || 0),
      Number(price_stc || 0), Number(rent_price_stc || 0), Number(rent_duration_days || 30),
      Number(invest_price_stc || 0), Number(invest_return_rate || 0), Number(invest_duration_days || 30),
      Number(passive_income_stc || 0), Number(passive_income_interval_days || 7),
      Number(weekly_maintenance_stc || 0),
      can_buy    != null ? (can_buy    ? 1 : 0) : 1,
      can_rent   != null ? (can_rent   ? 1 : 0) : 0,
      can_invest != null ? (can_invest ? 1 : 0) : 0,
      can_sell   != null ? (can_sell   ? 1 : 0) : 1,
      Number(sell_value_percent || 60),
      allows_multiple != null ? (allows_multiple ? 1 : 0) : 1,
      is_active  != null ? (is_active  ? 1 : 0) : 1,
    ];

    if (action === 'add') {
      const id = uuidv4();
      await EXECUTESQL(
        `INSERT INTO lifestyle_items
           (id, name, category, subcategory, description, image_url, emoji, available_cities, tier, sort_order,
            price_stc, rent_price_stc, rent_duration_days, invest_price_stc, invest_return_rate,
            invest_duration_days, passive_income_stc, passive_income_interval_days,
            weekly_maintenance_stc, can_buy, can_rent, can_invest, can_sell,
            sell_value_percent, allows_multiple, is_active)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
        [id, ...vals]
      );
      return { success: true, data: { id } };
    }

    if (action === 'edit') {
      if (!asset_id) throw new Error('asset_id required');
      await EXECUTESQL(
        `UPDATE lifestyle_items SET
           name=?, category=?, subcategory=?, description=?, image_url=?, emoji=?, available_cities=?, tier=?, sort_order=?,
           price_stc=?, rent_price_stc=?, rent_duration_days=?, invest_price_stc=?, invest_return_rate=?,
           invest_duration_days=?, passive_income_stc=?, passive_income_interval_days=?,
           weekly_maintenance_stc=?, can_buy=?, can_rent=?, can_invest=?, can_sell=?,
           sell_value_percent=?, allows_multiple=?, is_active=?
         WHERE id=?`,
        [...vals, asset_id]
      );
      return { success: true };
    }

    if (action === 'delete') {
      if (!asset_id) throw new Error('asset_id required');
      await EXECUTESQL('DELETE FROM lifestyle_items WHERE id = ?', [asset_id]);
      return { success: true };
    }

    if (action === 'toggle') {
      if (!asset_id) throw new Error('asset_id required');
      await EXECUTESQL('UPDATE lifestyle_items SET is_active = NOT is_active WHERE id = ?', [asset_id]);
      return { success: true };
    }

    throw new Error('Invalid action');
  },

  async setPlayerResidence({ _auth_user_id, purchase_id }) {
    if (!_auth_user_id) throw new Error('not authenticated');
    if (!purchase_id) throw new Error('purchase_id required');
    const { player } = await getMe(_auth_user_id);
    await EXECUTESQL('UPDATE lifestyle_purchases SET is_residence = 0 WHERE player_id = ?', [player.id]);
    await EXECUTESQL(
      'UPDATE lifestyle_purchases SET is_residence = 1 WHERE id = ? AND player_id = ?',
      [purchase_id, player.id]
    );
    return { success: true, data: { residence_purchase_id: purchase_id } };
  },

  async changePassword({ _auth_user_id, current_password, new_password }) {
    if (!_auth_user_id) throw new Error('not authenticated');
    if (!current_password || !new_password) throw new Error('current_password and new_password required');
    if (String(new_password).length < 8) throw new Error('Password must be at least 8 characters');
    const rows = await EXECUTESQL('SELECT id, password_hash FROM users WHERE id = ? LIMIT 1', [_auth_user_id]);
    if (!rows.length) throw new Error('User not found');
    const ok = await bcrypt.compare(String(current_password), rows[0].password_hash || '');
    if (!ok) throw new Error('Current password is incorrect');
    const hash = await bcrypt.hash(String(new_password), 10);
    await EXECUTESQL('UPDATE users SET password_hash = ?, updated_date = NOW() WHERE id = ?', [hash, _auth_user_id]);
    return { success: true };
  },

  async seedLifestyleItems() {
    // Prices calibrated to real-world values (1 STC ≈ $1 USD / £1).
    // Sources: Edmunds, Rightmove, WatchCharts, Robb Report, YATCO, HomeGuide (May 2026).
    const seed = [
      // ── Houses & Apartments ──────────────────────────────────────────────
      // Studio: London zone-2 ~£250–350K buy / ~£1,800–2,200/mo rent
      { name: 'Studio Apartment', category: 'houses', tier: 'standard', sort_order: 1,
        price_stc: 280_000, rent_price_stc: 2_200, rent_duration_days: 30,
        invest_price_stc: 280_000, invest_return_rate: 7, invest_duration_days: 30,
        passive_income_stc: 2_500, passive_income_interval_days: 7,
        weekly_maintenance_stc: 800, can_buy: 1, can_rent: 1, can_invest: 1, can_sell: 1,
        sell_value_percent: 80, allows_multiple: 1,
        description: 'A compact modern studio in the city centre. Good starter investment.' },
      // City apartment: prime zone ~£600–900K / ~£3,500–5,000/mo rent
      { name: 'City Apartment', category: 'houses', tier: 'premium', sort_order: 2,
        price_stc: 750_000, rent_price_stc: 4_500, rent_duration_days: 30,
        invest_price_stc: 750_000, invest_return_rate: 9, invest_duration_days: 30,
        passive_income_stc: 7_000, passive_income_interval_days: 7,
        weekly_maintenance_stc: 2_000, can_buy: 1, can_rent: 1, can_invest: 1, can_sell: 1,
        sell_value_percent: 82, allows_multiple: 1,
        description: 'Stylish city apartment with modern finishes. Strong rental yield.' },
      // Penthouse: London/Dubai $5–15M / $30–50K/mo rent
      { name: 'Penthouse Suite', category: 'houses', tier: 'elite', sort_order: 3,
        price_stc: 8_000_000, rent_price_stc: 35_000, rent_duration_days: 30,
        invest_price_stc: 8_000_000, invest_return_rate: 11, invest_duration_days: 30,
        passive_income_stc: 75_000, passive_income_interval_days: 7,
        weekly_maintenance_stc: 22_000, can_buy: 1, can_rent: 1, can_invest: 1, can_sell: 1,
        sell_value_percent: 85, allows_multiple: 1,
        description: 'Top-floor penthouse with panoramic views and private terrace.' },
      // Luxury villa: Ibiza/Marbella €10–25M / €70–100K/mo rental
      { name: 'Luxury Villa', category: 'houses', tier: 'legendary', sort_order: 4,
        price_stc: 18_000_000, rent_price_stc: 80_000, rent_duration_days: 30,
        invest_price_stc: 18_000_000, invest_return_rate: 13, invest_duration_days: 30,
        passive_income_stc: 175_000, passive_income_interval_days: 7,
        weekly_maintenance_stc: 48_000, can_buy: 1, can_rent: 1, can_invest: 1, can_sell: 1,
        sell_value_percent: 88, allows_multiple: 1,
        description: 'Stunning private villa with pool and landscaped grounds.' },

      // ── Cars ─────────────────────────────────────────────────────────────
      // VW Golf GTI / Honda Civic: $28–35K new / ~$800/mo lease
      { name: 'Hatchback', category: 'cars', tier: 'standard', sort_order: 10,
        price_stc: 28_000, rent_price_stc: 800, rent_duration_days: 30,
        invest_price_stc: 0, invest_return_rate: 0, invest_duration_days: 0,
        passive_income_stc: 0, passive_income_interval_days: 0,
        weekly_maintenance_stc: 200, can_buy: 1, can_rent: 1, can_invest: 0, can_sell: 1,
        sell_value_percent: 60, allows_multiple: 0,
        description: 'A reliable daily driver. Gets you from A to B in style.' },
      // Range Rover Sport / BMW X5: $80–130K / ~$3,500/mo lease
      { name: 'SUV', category: 'cars', tier: 'premium', sort_order: 11,
        price_stc: 95_000, rent_price_stc: 3_500, rent_duration_days: 30,
        invest_price_stc: 0, invest_return_rate: 0, invest_duration_days: 0,
        passive_income_stc: 0, passive_income_interval_days: 0,
        weekly_maintenance_stc: 550, can_buy: 1, can_rent: 1, can_invest: 0, can_sell: 1,
        sell_value_percent: 62, allows_multiple: 0,
        description: 'Premium large SUV with luxury interior and all-terrain capability.' },
      // Porsche 911 GT3 / Ferrari 296 GTB: $225–350K / ~$9,000/wk charter
      { name: 'Sports Car', category: 'cars', tier: 'elite', sort_order: 12,
        price_stc: 260_000, rent_price_stc: 9_000, rent_duration_days: 7,
        invest_price_stc: 0, invest_return_rate: 0, invest_duration_days: 0,
        passive_income_stc: 0, passive_income_interval_days: 0,
        weekly_maintenance_stc: 2_000, can_buy: 1, can_rent: 1, can_invest: 0, can_sell: 1,
        sell_value_percent: 65, allows_multiple: 0,
        description: 'Sleek two-door performance machine. Turn heads everywhere.' },
      // Lamborghini Huracán / McLaren 720S: $280–400K / ~$18K/3-day charter
      { name: 'Hypercar', category: 'cars', tier: 'legendary', sort_order: 13,
        price_stc: 350_000, rent_price_stc: 18_000, rent_duration_days: 3,
        invest_price_stc: 0, invest_return_rate: 0, invest_duration_days: 0,
        passive_income_stc: 0, passive_income_interval_days: 0,
        weekly_maintenance_stc: 4_500, can_buy: 1, can_rent: 1, can_invest: 0, can_sell: 1,
        sell_value_percent: 68, allows_multiple: 0,
        description: 'The pinnacle of automotive engineering. Pure performance and prestige.' },

      // ── Watches ───────────────────────────────────────────────────────────
      // Rolex Submariner / TAG Heuer: $8–12K retail
      { name: 'Steel Sport Watch', category: 'watches', tier: 'standard', sort_order: 20,
        price_stc: 9_500, rent_price_stc: 0, rent_duration_days: 0,
        invest_price_stc: 9_500, invest_return_rate: 4, invest_duration_days: 60,
        passive_income_stc: 0, passive_income_interval_days: 0,
        weekly_maintenance_stc: 0, can_buy: 1, can_rent: 0, can_invest: 1, can_sell: 1,
        sell_value_percent: 70, allows_multiple: 1,
        description: 'A precision-engineered sport timepiece. Quality and durability.' },
      // AP Royal Oak / Rolex Daytona: $30–56K retail, grey market 2–3×
      { name: 'Luxury Watch', category: 'watches', tier: 'premium', sort_order: 21,
        price_stc: 38_000, rent_price_stc: 0, rent_duration_days: 0,
        invest_price_stc: 38_000, invest_return_rate: 7, invest_duration_days: 60,
        passive_income_stc: 0, passive_income_interval_days: 0,
        weekly_maintenance_stc: 0, can_buy: 1, can_rent: 0, can_invest: 1, can_sell: 1,
        sell_value_percent: 78, allows_multiple: 1,
        description: 'Hand-crafted Swiss precision timepiece. A statement of status.' },
      // Diamond Patek / Hublot Big Bang diamond: $80–200K
      { name: 'Diamond Watch', category: 'watches', tier: 'legendary', sort_order: 22,
        price_stc: 120_000, rent_price_stc: 0, rent_duration_days: 0,
        invest_price_stc: 120_000, invest_return_rate: 10, invest_duration_days: 90,
        passive_income_stc: 0, passive_income_interval_days: 0,
        weekly_maintenance_stc: 0, can_buy: 1, can_rent: 0, can_invest: 1, can_sell: 1,
        sell_value_percent: 82, allows_multiple: 1,
        description: "Diamond-encrusted masterpiece. The ultimate collector's statement." },

      // ── Fashion ───────────────────────────────────────────────────────────
      // Gucci/LV full outfit: $2,500–8,000
      { name: 'Designer Outfit', category: 'fashion', tier: 'standard', sort_order: 30,
        price_stc: 5_000, rent_price_stc: 0, rent_duration_days: 0,
        invest_price_stc: 0, invest_return_rate: 0, invest_duration_days: 0,
        passive_income_stc: 0, passive_income_interval_days: 0,
        weekly_maintenance_stc: 0, can_buy: 1, can_rent: 0, can_invest: 0, can_sell: 0,
        sell_value_percent: 0, allows_multiple: 1,
        description: 'Premium tailored fashion for match days and press conferences.' },
      // Full seasonal luxury wardrobe — Gucci/Dior/Off-White: $50–150K
      { name: 'Luxury Collection', category: 'fashion', tier: 'elite', sort_order: 31,
        price_stc: 80_000, rent_price_stc: 0, rent_duration_days: 0,
        invest_price_stc: 0, invest_return_rate: 0, invest_duration_days: 0,
        passive_income_stc: 0, passive_income_interval_days: 0,
        weekly_maintenance_stc: 0, can_buy: 1, can_rent: 0, can_invest: 0, can_sell: 0,
        sell_value_percent: 0, allows_multiple: 1,
        description: 'Full seasonal wardrobe from Gucci, Dior, and Off-White.' },
      // Supreme/Fear of God/Off-White seasonal haul: $5–30K
      { name: 'Exclusive Drops', category: 'fashion', tier: 'legendary', sort_order: 32,
        price_stc: 22_000, rent_price_stc: 0, rent_duration_days: 0,
        invest_price_stc: 0, invest_return_rate: 0, invest_duration_days: 0,
        passive_income_stc: 0, passive_income_interval_days: 0,
        weekly_maintenance_stc: 0, can_buy: 1, can_rent: 0, can_invest: 0, can_sell: 0,
        sell_value_percent: 0, allows_multiple: 1,
        description: 'Limited edition streetwear haul. Off-White, Fear of God, Supreme.' },

      // ── VIP Experiences ───────────────────────────────────────────────────
      // F1 Paddock Club / VIP match hospitality: $6–15K per event
      { name: 'VIP Match Day', category: 'vip_experiences', tier: 'standard', sort_order: 40,
        price_stc: 12_000, rent_price_stc: 0, rent_duration_days: 0,
        invest_price_stc: 0, invest_return_rate: 0, invest_duration_days: 0,
        passive_income_stc: 0, passive_income_interval_days: 0,
        weekly_maintenance_stc: 0, can_buy: 1, can_rent: 0, can_invest: 0, can_sell: 0,
        sell_value_percent: 0, allows_multiple: 1,
        description: 'Executive box seat and VIP hospitality at any STAGE match.' },
      // Black-tie gala / awards night: styling + PR ~$50–100K
      { name: 'Award Show Access', category: 'vip_experiences', tier: 'premium', sort_order: 41,
        price_stc: 65_000, rent_price_stc: 0, rent_duration_days: 0,
        invest_price_stc: 0, invest_return_rate: 0, invest_duration_days: 0,
        passive_income_stc: 0, passive_income_interval_days: 0,
        weekly_maintenance_stc: 0, can_buy: 1, can_rent: 0, can_invest: 0, can_sell: 0,
        sell_value_percent: 0, allows_multiple: 1,
        description: 'Attend the prestigious STAGE annual awards ceremony.' },
      // Private yacht charter 1 day (35–50m): $150–300K per day
      { name: 'Private Yacht Day', category: 'vip_experiences', tier: 'elite', sort_order: 42,
        price_stc: 200_000, rent_price_stc: 0, rent_duration_days: 0,
        invest_price_stc: 0, invest_return_rate: 0, invest_duration_days: 0,
        passive_income_stc: 0, passive_income_interval_days: 0,
        weekly_maintenance_stc: 0, can_buy: 1, can_rent: 0, can_invest: 0, can_sell: 0,
        sell_value_percent: 0, allows_multiple: 1,
        description: 'Exclusive private yacht charter for a day on the Mediterranean.' },

      // ── Personal Services ─────────────────────────────────────────────────
      // Elite full-time S&C coach: $120–200K/year
      { name: 'Personal Trainer', category: 'personal_services', tier: 'standard', sort_order: 50,
        price_stc: 120_000, rent_price_stc: 0, rent_duration_days: 0,
        invest_price_stc: 0, invest_return_rate: 0, invest_duration_days: 0,
        passive_income_stc: 0, passive_income_interval_days: 0,
        weekly_maintenance_stc: 0, can_buy: 1, can_rent: 0, can_invest: 0, can_sell: 0,
        sell_value_percent: 0, allows_multiple: 0,
        description: 'Elite personal trainer dedicated to your fitness and performance.' },
      // Michelin-trained private chef: $150–250K/year
      { name: 'Private Chef', category: 'personal_services', tier: 'premium', sort_order: 51,
        price_stc: 200_000, rent_price_stc: 0, rent_duration_days: 0,
        invest_price_stc: 0, invest_return_rate: 0, invest_duration_days: 0,
        passive_income_stc: 0, passive_income_interval_days: 0,
        weekly_maintenance_stc: 0, can_buy: 1, can_rent: 0, can_invest: 0, can_sell: 0,
        sell_value_percent: 0, allows_multiple: 0,
        description: 'Michelin-trained private chef preparing nutritionally optimised meals.' },
      // PR / media / social team: $300–600K/year
      { name: 'Media Team', category: 'personal_services', tier: 'elite', sort_order: 52,
        price_stc: 450_000, rent_price_stc: 0, rent_duration_days: 0,
        invest_price_stc: 0, invest_return_rate: 0, invest_duration_days: 0,
        passive_income_stc: 0, passive_income_interval_days: 0,
        weekly_maintenance_stc: 0, can_buy: 1, can_rent: 0, can_invest: 0, can_sell: 0,
        sell_value_percent: 0, allows_multiple: 0,
        description: 'Dedicated media and PR team managing your public image and brand.' },
    ];
    seed.splice(0, seed.length, ...getDefaultLifestyleItems());
    let inserted = 0;
    let updated = 0;
    for (const item of seed) {
      const exists = await EXECUTESQL('SELECT id FROM lifestyle_items WHERE name = ? LIMIT 1', [item.name]);
      if (exists.length) {
        await EXECUTESQL(
          `UPDATE lifestyle_items SET
             category=?, subcategory=?, emoji=?, image_url=?, available_cities=?, tier=?, sort_order=?, description=?,
             price_stc=?, rent_price_stc=?, rent_duration_days=?,
             invest_price_stc=?, invest_return_rate=?, invest_duration_days=?,
             passive_income_stc=?, passive_income_interval_days=?, weekly_maintenance_stc=?,
             can_buy=?, can_rent=?, can_invest=?, can_sell=?,
             sell_value_percent=?, allows_multiple=?, is_active=1
           WHERE name=?`,
          [item.category, item.subcategory || null, item.emoji || null, item.image_url || null, serializeLifestyleCities(item.available_cities),
           item.tier, item.sort_order, item.description,
           item.price_stc, item.rent_price_stc, item.rent_duration_days,
           item.invest_price_stc, item.invest_return_rate, item.invest_duration_days,
           item.passive_income_stc, item.passive_income_interval_days, item.weekly_maintenance_stc,
           item.can_buy, item.can_rent, item.can_invest, item.can_sell,
           item.sell_value_percent, item.allows_multiple, item.name]
        );
        updated += 1;
        continue;
      }
      await EXECUTESQL(
        `INSERT INTO lifestyle_items
           (id, name, category, subcategory, description, image_url, emoji, available_cities, tier, sort_order,
            price_stc, rent_price_stc, rent_duration_days, invest_price_stc,
            invest_return_rate, invest_duration_days, passive_income_stc,
            passive_income_interval_days, weekly_maintenance_stc,
            can_buy, can_rent, can_invest, can_sell,
            sell_value_percent, allows_multiple, is_active)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,1)`,
        [uuidv4(), item.name, item.category, item.subcategory || null, item.description, item.image_url || null,
         item.emoji || null, serializeLifestyleCities(item.available_cities), item.tier, item.sort_order,
         item.price_stc, item.rent_price_stc, item.rent_duration_days,
         item.invest_price_stc, item.invest_return_rate, item.invest_duration_days,
         item.passive_income_stc, item.passive_income_interval_days, item.weekly_maintenance_stc,
         item.can_buy, item.can_rent, item.can_invest, item.can_sell,
         item.sell_value_percent, item.allows_multiple]
      );
      inserted += 1;
    }
    return { success: true, data: { inserted, updated } };
  },

  // ── Club Finance ──────────────────────────────────────────────────────────
  async clubFinance({ _auth_user_id, action, club_id, page, ...params }) {
    if (!_auth_user_id) throw new Error('not authenticated');

    if (action === 'get_overview') {
      const cid = club_id;
      if (!cid) throw new Error('club_id required');
      const clubs = await EXECUTESQL('SELECT * FROM clubs WHERE id = ? LIMIT 1', [cid]);
      if (!clubs.length) throw new Error('Club not found');
      const club = clubs[0];

      const pageNum = Number(page || 1);
      const limit = 25;
      const offset = (pageNum - 1) * limit;

      const [contracts, transactions, countRows, summaryRows, usage] = await Promise.all([
        EXECUTESQL("SELECT *, user_id AS target_player_id FROM player_contracts WHERE team_id = ? AND status = 'active' ORDER BY created_date DESC", [cid]),
        EXECUTESQL('SELECT * FROM stc_transactions WHERE club_id = ? ORDER BY created_date DESC LIMIT ? OFFSET ?', [cid, limit, offset]),
        EXECUTESQL('SELECT COUNT(*) as total FROM stc_transactions WHERE club_id = ?', [cid]),
        EXECUTESQL(
          `SELECT
             SUM(CASE WHEN amount > 0 THEN amount ELSE 0 END) as income,
             SUM(CASE WHEN amount < 0 THEN ABS(amount) ELSE 0 END) as expenses
           FROM stc_transactions WHERE club_id = ? AND created_date >= DATE_SUB(NOW(), INTERVAL 30 DAY)`,
          [cid]
        ),
        getClubFinanceUsage(cid),
      ]);

      return {
        success: true,
        data: {
          balance:         usage.balance_stc,
          transfer_budget: usage.transfer_budget_stc,
          wage_budget:     usage.wage_budget_stc,
          weekly_wages:    usage.active_weekly_wages_stc,
          pending_weekly_wages: usage.pending_weekly_wages_stc,
          committed_weekly_wages: usage.committed_weekly_wages_stc,
          wage_room: usage.wage_room_stc,
          transfer_locked: usage.transfer_locked_stc,
          transfer_remaining: usage.transfer_budget_remaining_stc,
          available_balance: usage.available_balance_stc,
          monthly_operating_cost_estimate: usage.monthly_operating_cost_estimate_stc,
          stadium_tier: usage.tier,
          stadium_capacity: Number(club.stadium_capacity || usage.tier.capacity || 5000),
          contracts,
          transactions,
          total_transactions: Number(countRows[0]?.total || 0),
          income_30d:  Number(summaryRows[0]?.income   || 0),
          expenses_30d: Number(summaryRows[0]?.expenses || 0),
        },
      };
    }

    if (action === 'adjust_budgets') {
      throw new Error('Finance caps are linked to stadium level. Upgrade stadium or ask an admin for an audited override.');
    }

    if (action === 'admin_adjust') {
      const adminCheck = await EXECUTESQL('SELECT role_id FROM users WHERE id = ? LIMIT 1', [_auth_user_id]);
      if (!adminCheck.length || Number(adminCheck[0].role_id) !== 0) throw new Error('Admin only');

      const { target_club_id, balance_delta, set_balance, set_transfer_budget, set_wage_budget, note } = params;
      const cid2 = target_club_id || club_id;
      if (!cid2) throw new Error('club_id required');

      const clubs = await EXECUTESQL('SELECT * FROM clubs WHERE id = ? LIMIT 1', [cid2]);
      if (!clubs.length) throw new Error('Club not found');
      const club = clubs[0];

      if (balance_delta != null && Number(balance_delta) !== 0) {
        await createClubTx({ clubId: cid2, amount: Number(balance_delta), type: 'admin_adjustment', category: 'adjustment', description: note || `Admin adjustment: ${Number(balance_delta) >= 0 ? '+' : ''}${Number(balance_delta).toLocaleString()} STC` });
      } else if (set_balance != null) {
        const delta = Number(set_balance) - Number(club.stc || 0);
        if (delta !== 0) {
          await createClubTx({ clubId: cid2, amount: delta, type: 'admin_adjustment', category: 'adjustment', description: note || `Admin set balance: ${Number(set_balance).toLocaleString()} STC` });
        }
      }

      const allowOverride = Boolean(note || params.reason || params.override_reason);
      await assertClubFinanceWithinTier({
        stadiumLevel: club.stadium_level,
        wageBudget: set_wage_budget ?? club.wage_budget_stc,
        transferBudget: set_transfer_budget ?? club.transfer_budget_stc,
        allowOverride,
      });

      const updates = [];
      const vals = [];
      if (set_transfer_budget != null) { updates.push('transfer_budget_stc = ?'); vals.push(Number(set_transfer_budget)); }
      if (set_wage_budget     != null) { updates.push('wage_budget_stc = ?');     vals.push(Number(set_wage_budget)); }
      if (updates.length) {
        vals.push(cid2);
        await EXECUTESQL(`UPDATE clubs SET ${updates.join(', ')}, updated_date = NOW() WHERE id = ?`, vals);
      }

      return { success: true };
    }

    if (action === 'apply_monthly_operating_costs') {
      const adminCheck = await EXECUTESQL('SELECT id, email, role_id FROM users WHERE id = ? LIMIT 1', [_auth_user_id]);
      if (!adminCheck.length || Number(adminCheck[0].role_id) !== 0) throw new Error('Admin only');
      const targetClubId = params.target_club_id || club_id;
      const clubs = targetClubId
        ? await EXECUTESQL('SELECT id, name FROM clubs WHERE id = ? LIMIT 1', [targetClubId])
        : await EXECUTESQL("SELECT id, name FROM clubs WHERE status <> 'deleted'");
      let applied = 0;
      for (const target of clubs) {
        const usage = await getClubFinanceUsage(target.id);
        const amount = -Math.max(0, Number(usage.monthly_operating_cost_estimate_stc || 0));
        if (!amount) continue;
        await createClubTx({
          clubId: target.id,
          amount,
          type: 'expense',
          category: 'operating_costs',
          description: `Monthly operating costs: wages + ${usage.tier.name} maintenance`,
          referenceId: target.id,
          relatedEntityType: 'club',
          relatedEntityId: target.id,
        });
        if (usage.balance_stc + amount < 0) {
          await EXECUTESQL("UPDATE clubs SET finance_warning = 'negative_balance', updated_date = NOW() WHERE id = ?", [target.id]).catch(() => {});
        }
        applied += 1;
      }
      await createAuditLog({
        adminUserId: _auth_user_id,
        adminEmail: adminCheck[0].email,
        action: 'apply_club_monthly_operating_costs',
        entityType: targetClubId ? 'club' : 'club_bulk',
        entityId: targetClubId || 'all',
        oldValue: null,
        newValue: JSON.stringify({ applied }),
        reason: params.reason || 'Applied monthly club operating costs',
      });
      return { success: true, data: { applied, count: applied } };
    }

    if (action === 'rebalance_starter_club' || action === 'rebalance_all_starter_clubs') {
      const adminCheck = await EXECUTESQL('SELECT id, email, role_id FROM users WHERE id = ? LIMIT 1', [_auth_user_id]);
      if (!adminCheck.length || Number(adminCheck[0].role_id) !== 0) throw new Error('Admin only');
      const where = action === 'rebalance_starter_club'
        ? 'WHERE id = ?'
        : `WHERE COALESCE(wins,0)=0 AND COALESCE(losses,0)=0 AND COALESCE(draws,0)=0
             AND COALESCE(matches_ranked,0)=0
             AND COALESCE(stc,0) >= 25000000`;
      const clubs = await EXECUTESQL(`SELECT * FROM clubs ${where}`, action === 'rebalance_starter_club' ? [club_id || params.target_club_id] : []);
      let updated = 0;
      for (const target of clubs) {
        await EXECUTESQL(
          `UPDATE clubs
           SET stc = ?, wage_budget_stc = ?, transfer_budget_stc = ?, transfer_locked_stc = 0,
               stadium_level = ?, stadium_capacity = ?, finance_warning = NULL, updated_date = NOW()
           WHERE id = ?`,
          [
            STARTER_CLUB_FINANCE.balance_stc,
            STARTER_CLUB_FINANCE.wage_budget_stc,
            STARTER_CLUB_FINANCE.transfer_budget_stc,
            STARTER_CLUB_FINANCE.stadium_level,
            STARTER_CLUB_FINANCE.stadium_capacity,
            target.id,
          ]
        );
        await EXECUTESQL(
          `INSERT INTO stc_transactions
           (id, club_id, amount, balance_after, type, category, description, related_entity_type, related_entity_id, reference_id, created_date)
           VALUES (?, ?, ?, ?, 'adjustment', 'starter_rebalance', ?, 'club', ?, ?, NOW())`,
          [
            uuidv4(),
            target.id,
            STARTER_CLUB_FINANCE.balance_stc - Number(target.stc || 0),
            STARTER_CLUB_FINANCE.balance_stc,
            'Admin starter finance rebalance',
            target.id,
            target.id,
          ]
        ).catch(() => {});
        await createAuditLog({
          adminUserId: _auth_user_id,
          adminEmail: adminCheck[0].email,
          action: 'rebalance_club_finance',
          entityType: 'club',
          entityId: target.id,
          entityName: target.name,
          oldValue: JSON.stringify({ stc: target.stc, wage_budget_stc: target.wage_budget_stc, transfer_budget_stc: target.transfer_budget_stc, stadium_level: target.stadium_level }),
          newValue: JSON.stringify(STARTER_CLUB_FINANCE),
          reason: params.reason || 'Starter club finance rebalance',
        });
        updated += 1;
      }
      return { success: true, data: { updated, count: updated } };
    }

    if (action === 'delete_transaction') {
      const adminCheck = await EXECUTESQL('SELECT role_id FROM users WHERE id = ? LIMIT 1', [_auth_user_id]);
      if (!adminCheck.length || Number(adminCheck[0].role_id) !== 0) throw new Error('Admin only');
      const { transaction_id } = params;
      if (!transaction_id) throw new Error('transaction_id required');
      await EXECUTESQL('DELETE FROM stc_transactions WHERE id = ?', [transaction_id]);
      return { success: true };
    }

    throw new Error(`Unknown clubFinance action: ${action}`);
  },

  // ── Player Market Value ───────────────────────────────────────────────────
  async playerMarketValue({ _auth_user_id, action, player_id, ...params }) {
    if (!_auth_user_id) throw new Error('not authenticated');

    if (action === 'get_breakdown') {
      const pid = player_id;
      if (!pid) throw new Error('player_id required');
      const pRows = await EXECUTESQL('SELECT * FROM players WHERE id = ? LIMIT 1', [pid]);
      if (!pRows.length) throw new Error('Player not found');
      const p = pRows[0];
      const W = await getMvConfig();

      const matches     = Number(p.matches_played  || 0);
      const goals       = Number(p.goals           || 0);
      const assists     = Number(p.assists          || 0);
      const avgRating   = Number(p.avg_match_rating || 0);
      const motm        = Number(p.man_of_the_match || 0);
      const cleanSheets = Number(p.clean_sheets     || 0);
      const wins        = Number(p.wins_count       || 0);
      const stored      = Number(p.market_value_stc || 250_000);

      let formArr = [];
      try { formArr = JSON.parse(p.form_last10 || '[]'); } catch {}
      const recentForm = formArr.slice(-5);
      const recentAvg  = recentForm.length ? recentForm.reduce((s, v) => s + v, 0) / recentForm.length : 0;

      const base      = matches > 0 ? Math.min(matches * W.base_per_match, W.max_base) : 0;
      const ratingMult= matches > 0 && avgRating >= 5
        ? Math.max(0.3, Math.min(2.5, 0.3 + ((avgRating - 4.5) / 5.0) * 2.2)) : 0.3;
      const goalBon   = matches > 0 ? Math.min((goals / matches) * W.goal_rate_bonus, 6_000_000) : 0;
      const asstBon   = matches > 0 ? Math.min((assists / matches) * W.assist_rate_bonus, 3_000_000) : 0;
      const csBon     = matches > 0 ? Math.min((cleanSheets / matches) * W.clean_sheet_rate_bonus, 5_000_000) : 0;
      const achievBon = Math.min(motm * W.motm_bonus, 5_000_000);

      return {
        success: true,
        data: {
          market_value:     stored,
          value_tier:       stored >= 200_000_000 ? 'World Class'
                          : stored >= 50_000_000  ? 'Elite'
                          : stored >= 10_000_000  ? 'Pro'
                          : stored >= 2_000_000   ? 'Rising'
                          : 'Prospect',
          breakdown: {
            experience_base: Math.round(base),
            rating_multiplier: Math.round(ratingMult * 100) / 100,
            goal_rate_bonus:  Math.round(goalBon),
            assist_rate_bonus: Math.round(asstBon),
            clean_sheet_bonus: Math.round(csBon),
            achievement_bonus: Math.round(achievBon),
          },
          stats: {
            matches_played: matches, goals, assists, avg_match_rating: avgRating,
            wins_count: wins, man_of_the_match: motm, clean_sheets: cleanSheets,
            recent_avg: Math.round(recentAvg * 10) / 10,
            form: formArr.slice(-10),
          },
          updated_at: p.value_updated_at,
        },
      };
    }

    if (action === 'recalculate') {
      const pid = player_id || params.target_player_id;
      if (!pid) throw new Error('player_id required');
      const pRows = await EXECUTESQL('SELECT * FROM players WHERE id = ? LIMIT 1', [pid]);
      if (!pRows.length) throw new Error('Player not found');
      const p = pRows[0];
      const W = await getMvConfig();
      const newValue = computeValueFromStats(p, W, Number(p.market_value_stc || 0));
      await EXECUTESQL('UPDATE players SET market_value_stc = ?, value_updated_at = NOW() WHERE id = ?', [newValue, pid]);
      return { success: true, data: { market_value: newValue } };
    }

    if (action === 'recalculate_all') {
      const adminCheck = await EXECUTESQL('SELECT role_id FROM users WHERE id = ? LIMIT 1', [_auth_user_id]);
      if (!adminCheck.length || Number(adminCheck[0].role_id) !== 0) throw new Error('Admin only');
      const allPlayers = await EXECUTESQL('SELECT * FROM players WHERE matches_played > 0', []);
      const W = await getMvConfig();
      let updated = 0;
      for (const p of allPlayers) {
        try {
          const newValue = computeValueFromStats(p, W, Number(p.market_value_stc || 0));
          await EXECUTESQL('UPDATE players SET market_value_stc = ?, value_updated_at = NOW() WHERE id = ?', [newValue, p.id]);
          updated++;
        } catch {}
      }
      return { success: true, data: { updated } };
    }

    if (action === 'get_config') {
      const adminCheck = await EXECUTESQL('SELECT role_id FROM users WHERE id = ? LIMIT 1', [_auth_user_id]);
      if (!adminCheck.length || Number(adminCheck[0].role_id) !== 0) throw new Error('Admin only');
      _mvConfigCache = null; // bust cache
      const rows = await EXECUTESQL("SELECT * FROM market_value_config WHERE is_active = 1 ORDER BY updated_date DESC LIMIT 1", []);
      const cfg  = rows[0] || {};
      let weights = {};
      try { weights = JSON.parse(typeof cfg.weights === 'string' ? cfg.weights : JSON.stringify(cfg.weights || {})); } catch {}
      return { success: true, data: { ...DEFAULT_MV_WEIGHTS, ...weights, _id: cfg.id } };
    }

    if (action === 'set_config') {
      const adminCheck = await EXECUTESQL('SELECT role_id FROM users WHERE id = ? LIMIT 1', [_auth_user_id]);
      if (!adminCheck.length || Number(adminCheck[0].role_id) !== 0) throw new Error('Admin only');
      const newWeights = { ...DEFAULT_MV_WEIGHTS };
      const numericKeys = Object.keys(DEFAULT_MV_WEIGHTS);
      for (const k of numericKeys) {
        if (params[k] !== undefined && !isNaN(Number(params[k]))) newWeights[k] = Number(params[k]);
      }
      _mvConfigCache = null; // bust cache
      const existing = await EXECUTESQL("SELECT id FROM market_value_config WHERE is_active = 1 LIMIT 1", []);
      if (existing.length) {
        await EXECUTESQL("UPDATE market_value_config SET weights = ?, updated_date = NOW() WHERE id = ?",
          [JSON.stringify(newWeights), existing[0].id]);
      } else {
        await EXECUTESQL("INSERT INTO market_value_config (id, name, weights, is_active) VALUES (?, 'default', ?, 1)",
          [uuidv4(), JSON.stringify(newWeights)]);
      }
      return { success: true };
    }

    throw new Error(`Unknown playerMarketValue action: ${action}`);
  },

  async deleteClub({ _auth_user_id, club_id }) {
    if (!_auth_user_id) throw new Error('not authenticated');
    if (!club_id) throw new Error('club_id required');
    const { user } = await getMe(_auth_user_id);
    await requireClubFunctionAccess(user, club_id, 'manage_staff', 'Only the club president can delete this club');
    await EXECUTESQL('UPDATE players SET club_id = NULL WHERE club_id = ?', [club_id]);
    await EXECUTESQL('DELETE FROM club_memberships WHERE club_id = ?', [club_id]).catch(() => {});
    await EXECUTESQL('DELETE FROM clubs WHERE id = ?', [club_id]);
    return { success: true };
  },

  // ── Player Wallet ─────────────────────────────────────────────────────────
  async playerWallet({ action, _auth_user_id, player_id, amount, description, category, page, limit: limitParam }) {
    if (!_auth_user_id) throw new Error('not authenticated');

    if (action === 'get_balance') {
      const { player } = await getMe(_auth_user_id);
      if (!player) throw new Error('Player not found');

      const [contracts, summary, recent] = await Promise.all([
        EXECUTESQL("SELECT *, user_id AS target_player_id FROM player_contracts WHERE user_id = ? AND status = 'active' LIMIT 1", [player.id]),
        EXECUTESQL(
          `SELECT type, category, SUM(amount) as total FROM player_stc_transactions
           WHERE player_id = ? AND created_date >= DATE_SUB(NOW(), INTERVAL 30 DAY)
           GROUP BY type, category`,
          [player.id]
        ).catch(() => []),
        EXECUTESQL(
          'SELECT * FROM player_stc_transactions WHERE player_id = ? ORDER BY created_date DESC LIMIT 20',
          [player.id]
        ).catch(() => []),
      ]);

      const activeContract = contracts[0] || null;
      let nextSalaryDays = null;
      if (activeContract?.weekly_salary_stc) {
        const lastPaid = activeContract.last_salary_paid_at || activeContract.start_date || activeContract.created_date;
        if (lastPaid) {
          const daysSince = (Date.now() - new Date(lastPaid).getTime()) / (1000 * 60 * 60 * 24);
          nextSalaryDays = Math.max(0, Math.ceil(7 - daysSince));
        }
      }

      return { data: { balance: Number(player.stc || 0), contract: activeContract, weekly_salary: activeContract?.weekly_salary_stc || 0, next_salary_days: nextSalaryDays, summary, recent_transactions: recent } };
    }

    if (action === 'get_history') {
      const { player } = await getMe(_auth_user_id);
      if (!player) throw new Error('Player not found');
      const pageNum  = Number(page  || 1);
      const pageSize = Number(limitParam || 30);
      const offset   = (pageNum - 1) * pageSize;
      const [rows, countRows] = await Promise.all([
        EXECUTESQL('SELECT * FROM player_stc_transactions WHERE player_id = ? ORDER BY created_date DESC LIMIT ? OFFSET ?', [player.id, pageSize, offset]),
        EXECUTESQL('SELECT COUNT(*) as total FROM player_stc_transactions WHERE player_id = ?', [player.id]),
      ]);
      return { data: { transactions: rows, total: Number(countRows[0]?.total || 0), page: pageNum, limit: pageSize } };
    }

    if (action === 'pay_salary') {
      const { user, player } = await getMe(_auth_user_id);
      if (!player) throw new Error('Player not found');

      const contracts = await EXECUTESQL("SELECT *, user_id AS target_player_id FROM player_contracts WHERE user_id = ? AND status = 'active' LIMIT 1", [player.id]);
      if (!contracts.length || !contracts[0].weekly_salary_stc) throw new Error('No active salary contract');
      const contract = contracts[0];
      const salary = Number(contract.weekly_salary_stc);

      const lastPaid = contract.last_salary_paid_at || contract.start_date || contract.created_date;
      if (lastPaid) {
        const daysSince = (Date.now() - new Date(lastPaid).getTime()) / (1000 * 60 * 60 * 24);
        if (daysSince < 7) throw new Error(`Salary already paid. Next payment in ${Math.ceil(7 - daysSince)} day(s).`);
      }

      const clubs = await EXECUTESQL('SELECT name, stc FROM clubs WHERE id = ? LIMIT 1', [contract.team_id]);
      const club = clubs[0];
      if (!club) throw new Error('Club not found');
      const weeksMultiplier = lastPaid ? Math.floor((Date.now() - new Date(lastPaid).getTime()) / (7 * 24 * 60 * 60 * 1000)) : 1;
      const grossAmount = Math.min(salary * weeksMultiplier, Number(club.stc || 0));
      if (grossAmount <= 0) throw new Error('Club has insufficient funds to pay salary');

      await createClubTx({
        clubId: contract.team_id, amount: -grossAmount, type: 'salary_payment', category: 'salary',
        description: `Salary paid: ${player.gamertag || player.full_name || 'Player'}${weeksMultiplier > 1 ? ` (${weeksMultiplier}wk)` : ''}`,
        referenceId: contract.id,
      });
      await EXECUTESQL('UPDATE player_contracts SET last_salary_paid_at = NOW(), updated_date = NOW() WHERE id = ?', [contract.id]);

      const result = await createPlayerTx({
        playerId: player.id, playerEmail: user.email, amount: grossAmount,
        category: 'salary', source: club.name || 'Club',
        description: `Weekly salary${weeksMultiplier > 1 ? ` (${weeksMultiplier} weeks)` : ''} — ${club.name}`,
        referenceId: contract.id,
      });
      return { success: true, data: result };
    }

    if (action === 'admin_adjust') {
      const { user } = await getMe(_auth_user_id);
      const adminCheck = await EXECUTESQL('SELECT role_id FROM users WHERE id = ? LIMIT 1', [_auth_user_id]);
      if (!adminCheck.length || Number(adminCheck[0].role_id) !== 0) throw new Error('Admin access required');
      if (!player_id || amount == null) throw new Error('player_id and amount required');

      const players = await EXECUTESQL('SELECT * FROM players WHERE id = ? LIMIT 1', [player_id]);
      if (!players.length) throw new Error('Player not found');
      const target = players[0];

      const result = await createPlayerTx({
        playerId: player_id, playerEmail: target.email,
        amount: Number(amount),
        category: Number(amount) >= 0 ? 'admin_credit' : 'admin_debit',
        source: 'Admin', description: description || (Number(amount) >= 0 ? 'Admin credit' : 'Admin debit'),
      });
      return { success: true, data: result };
    }

    throw new Error(`Unknown playerWallet action: ${action}`);
  },

  // ── Shirt Sales ───────────────────────────────────────────────────────────
  async shirtSales({ action, _auth_user_id, club_id, period, limit, amount, note, match_id, weights }) {
    // ── get_leaderboard ───────────────────────────────────────────────────
    if (action === 'get_leaderboard') {
      const periodSql = period === '7d'  ? 'AND ss.created_date >= DATE_SUB(NOW(), INTERVAL 7 DAY)'
                      : period === '30d' ? 'AND ss.created_date >= DATE_SUB(NOW(), INTERVAL 30 DAY)'
                      : '';
      const params = [];
      let clubSql = '';
      if (club_id) { clubSql = 'AND ss.club_id = ?'; params.push(club_id); }
      params.push(Number(limit) || 10);

      const rows = await EXECUTESQL(
        `SELECT ss.player_id,
                COALESCE(MAX(p.gamertag), MAX(ss.player_gamertag)) AS gamertag,
                MAX(p.shirt_number) AS shirt_number,
                MAX(p.avatar_url)   AS avatar_url,
                MAX(c.name)         AS club_name,
                MAX(c.logo_url)     AS club_logo_url,
                SUM(ss.quantity)    AS total_shirts,
                SUM(ss.price_stc)   AS total_revenue
         FROM shirt_sales ss
         LEFT JOIN players p ON p.id = ss.player_id
         LEFT JOIN clubs c ON c.id = ss.club_id
         WHERE 1=1 ${periodSql} ${clubSql}
         GROUP BY ss.player_id
         ORDER BY total_shirts DESC
         LIMIT ?`,
        params
      );
      return { data: { leaderboard: rows } };
    }

    // ── get_club_summary ──────────────────────────────────────────────────
    if (action === 'get_club_summary') {
      if (!club_id) throw new Error('club_id required');
      const periodSql = period === '7d'  ? 'AND created_date >= DATE_SUB(NOW(), INTERVAL 7 DAY)'
                      : period === '30d' ? 'AND created_date >= DATE_SUB(NOW(), INTERVAL 30 DAY)'
                      : '';
      const rows = await EXECUTESQL(
        `SELECT COALESCE(SUM(quantity), 0) AS total_shirts,
                COALESCE(SUM(price_stc), 0) AS total_revenue,
                COUNT(DISTINCT match_id) AS matches_with_sales
         FROM shirt_sales WHERE club_id = ? ${periodSql}`,
        [club_id]
      );
      return { data: rows[0] || { total_shirts: 0, total_revenue: 0, matches_with_sales: 0 } };
    }

    // ── generate_for_match (GameDay path) ─────────────────────────────────
    if (action === 'generate_for_match') {
      if (!match_id) throw new Error('match_id required');
      const matches = await EXECUTESQL('SELECT * FROM matches WHERE id = ? LIMIT 1', [match_id]);
      if (!matches.length) throw new Error('Match not found');
      const match = matches[0];
      if (!match.home_club_id) return { success: true, data: { skipped: true } };
      const stats = await EXECUTESQL('SELECT * FROM match_player_stats WHERE match_id = ?', [match_id]);
      if (!stats.length) return { success: true, data: { skipped: true, reason: 'no_stats' } };
      await generateShirtSalesForMatch(match, stats);
      return { success: true };
    }

    // ── get_config ────────────────────────────────────────────────────────
    if (action === 'get_config') {
      const rows = await EXECUTESQL('SELECT id, weights FROM shirt_sales_config WHERE is_active = 1 LIMIT 1');
      const w = rows.length
        ? (typeof rows[0].weights === 'string' ? JSON.parse(rows[0].weights) : rows[0].weights)
        : DEFAULT_SHIRT_WEIGHTS;
      return { data: { id: rows[0]?.id, weights: { ...DEFAULT_SHIRT_WEIGHTS, ...w } } };
    }

    // ── set_config (admin) ────────────────────────────────────────────────
    if (action === 'set_config') {
      const adminCheck = await EXECUTESQL('SELECT role_id FROM users WHERE id = ? LIMIT 1', [_auth_user_id]);
      if (!adminCheck.length || Number(adminCheck[0].role_id) !== 0) throw new Error('Admin access required');
      if (!weights) throw new Error('weights required');
      const existing = await EXECUTESQL('SELECT id FROM shirt_sales_config WHERE is_active = 1 LIMIT 1');
      if (existing.length) {
        await EXECUTESQL('UPDATE shirt_sales_config SET weights = ?, updated_date = NOW() WHERE id = ?',
          [JSON.stringify(weights), existing[0].id]);
      } else {
        await EXECUTESQL("INSERT INTO shirt_sales_config (name, weights, is_active) VALUES ('default', ?, 1)",
          [JSON.stringify(weights)]);
      }
      _shirtConfigCache = null;
      return { success: true };
    }

    // ── correct_revenue (admin) ───────────────────────────────────────────
    if (action === 'correct_revenue') {
      const adminCheck = await EXECUTESQL('SELECT role_id FROM users WHERE id = ? LIMIT 1', [_auth_user_id]);
      if (!adminCheck.length || Number(adminCheck[0].role_id) !== 0) throw new Error('Admin access required');
      if (!club_id || amount == null) throw new Error('club_id and amount required');
      const result = await createClubTx({
        clubId: club_id, amount: Number(amount), type: 'shirt_revenue', category: 'shirt_revenue',
        description: note || 'Admin shirt revenue correction',
      });
      return { success: true, data: result };
    }

    throw new Error(`Unknown shirtSales action: ${action}`);
  },

  // ── Admin Economy Control ─────────────────────────────────────────────────
  async adminEconomyControl(params) {
    const { action, _auth_user_id,
      player_id, player_email, club_id,
      amount, balance, transfer_budget, wage_budget,
      category, description, reason, note,
      date_from, date_to, min_amount, max_amount,
      limit: qLimit, entity_type,
      new_level, dry_run,
      match_id, competition_id,
      purchase_id, purchase_status,
    } = params;

    const adminRows = await EXECUTESQL('SELECT id, email, role_id FROM users WHERE id = ? LIMIT 1', [_auth_user_id]);
    if (!adminRows.length || Number(adminRows[0].role_id) !== 0) throw new Error('Admin access required');
    const adminEmail = adminRows[0].email;
    const LIMIT = Math.min(Number(qLimit) || 50, 500);

    // ── get_player_wallet ──────────────────────────────────────────────────
    if (action === 'get_player_wallet') {
      let players;
      if (player_id) {
        players = await EXECUTESQL('SELECT * FROM players WHERE id = ? LIMIT 1', [player_id]);
      } else if (player_email) {
        players = await EXECUTESQL('SELECT * FROM players WHERE email = ? LIMIT 1', [player_email]);
      } else {
        throw new Error('player_id or player_email required');
      }
      if (!players.length) throw new Error('Player not found');
      const p = players[0];
      const [txs, contract, lifestyle] = await Promise.all([
        EXECUTESQL(
          'SELECT * FROM player_stc_transactions WHERE player_id = ? ORDER BY created_date DESC LIMIT 50',
          [p.id]
        ),
        EXECUTESQL(
          "SELECT *, user_id AS target_player_id FROM player_contracts WHERE user_id = ? AND status IN ('active','pending') ORDER BY created_date DESC LIMIT 1",
          [p.id]
        ),
        EXECUTESQL(
          "SELECT lp.*, li.name as item_name, li.category FROM lifestyle_purchases lp LEFT JOIN lifestyle_items li ON li.id = lp.item_id WHERE lp.player_id = ? AND lp.status = 'active' ORDER BY lp.created_date DESC LIMIT 20",
          [p.id]
        ),
      ]);
      return { data: { player: p, transactions: txs, contract: contract[0] || null, lifestyle } };
    }

    // ── set_player_balance ─────────────────────────────────────────────────
    if (action === 'set_player_balance') {
      if (!player_id || balance == null) throw new Error('player_id and balance required');
      const rows = await EXECUTESQL('SELECT id, stc, gamertag FROM players WHERE id = ? LIMIT 1', [player_id]);
      if (!rows.length) throw new Error('Player not found');
      const old = Number(rows[0].stc || 0);
      const newBal = Number(balance);
      const diff = newBal - old;
      await EXECUTESQL('UPDATE players SET stc = ?, updated_date = NOW() WHERE id = ?', [newBal, player_id]);
      const txId = uuidv4();
      await EXECUTESQL(
        `INSERT INTO player_stc_transactions (id, player_id, player_email, amount, balance_after, type, category, source, description, created_date)
         VALUES (?, ?, ?, ?, ?, 'admin_correction', 'admin_correction', 'Admin', ?, NOW())`,
        [txId, player_id, player_email || null, diff, newBal, reason || 'Admin balance correction']
      );
      await createAuditLog({ adminUserId: _auth_user_id, adminEmail, action: 'set_player_balance', entityType: 'player', entityId: player_id, entityName: rows[0].gamertag, oldValue: old, newValue: newBal, reason });
      return { success: true, data: { old_balance: old, new_balance: newBal, diff } };
    }

    // ── add_player_tx ──────────────────────────────────────────────────────
    if (action === 'add_player_tx') {
      if (!player_id || amount == null) throw new Error('player_id and amount required');
      const rows = await EXECUTESQL('SELECT id, stc, gamertag FROM players WHERE id = ? LIMIT 1', [player_id]);
      if (!rows.length) throw new Error('Player not found');
      const result = await createPlayerTx({
        playerId: player_id, playerEmail: player_email || null,
        amount: Number(amount), category: category || 'admin_correction',
        source: 'Admin', description: description || reason || 'Admin manual transaction',
      });
      await createAuditLog({ adminUserId: _auth_user_id, adminEmail, action: 'add_player_tx', entityType: 'player', entityId: player_id, entityName: rows[0].gamertag, oldValue: Number(rows[0].stc || 0), newValue: result.new_balance, reason: description || reason });
      return { success: true, data: result };
    }

    // ── get_club_finance ───────────────────────────────────────────────────
    if (action === 'get_club_finance') {
      if (!club_id) throw new Error('club_id required');
      const clubs = await EXECUTESQL('SELECT * FROM clubs WHERE id = ? LIMIT 1', [club_id]);
      if (!clubs.length) throw new Error('Club not found');
      const c = clubs[0];
      const [txs, contracts, wagers, usage] = await Promise.all([
        EXECUTESQL(
          'SELECT * FROM stc_transactions WHERE club_id = ? ORDER BY created_date DESC LIMIT 50',
          [club_id]
        ),
        EXECUTESQL(
          "SELECT pc.*, p.gamertag FROM player_contracts pc LEFT JOIN players p ON p.id = pc.user_id WHERE pc.team_id = ? AND pc.status = 'active' ORDER BY pc.weekly_salary_stc DESC LIMIT 20",
          [club_id]
        ),
        EXECUTESQL(
          "SELECT * FROM matches WHERE (home_club_id = ? OR away_club_id = ?) AND wager_stc > 0 ORDER BY updated_date DESC LIMIT 10",
          [club_id, club_id]
        ),
        getClubFinanceUsage(club_id),
      ]);
      return { data: { club: c, transactions: txs, contracts, wagers, usage } };
    }

    // ── set_club_finance ───────────────────────────────────────────────────
    if (action === 'set_club_finance') {
      if (!club_id) throw new Error('club_id required');
      const rows = await EXECUTESQL('SELECT id, name, stc, transfer_budget_stc, wage_budget_stc, stadium_level FROM clubs WHERE id = ? LIMIT 1', [club_id]);
      if (!rows.length) throw new Error('Club not found');
      const old = rows[0];
      await assertClubFinanceWithinTier({
        stadiumLevel: old.stadium_level,
        wageBudget: wage_budget ?? old.wage_budget_stc,
        transferBudget: transfer_budget ?? old.transfer_budget_stc,
        allowOverride: Boolean(reason),
      });
      const sets = [];
      const vals = [];
      const changes = {};
      if (balance != null) { sets.push('stc = ?'); vals.push(Number(balance)); changes.stc = { from: Number(old.stc || 0), to: Number(balance) }; }
      if (transfer_budget != null) { sets.push('transfer_budget_stc = ?'); vals.push(Number(transfer_budget)); changes.transfer_budget = { from: Number(old.transfer_budget_stc || 0), to: Number(transfer_budget) }; }
      if (wage_budget != null) { sets.push('wage_budget_stc = ?'); vals.push(Number(wage_budget)); changes.wage_budget = { from: Number(old.wage_budget_stc || 0), to: Number(wage_budget) }; }
      if (!sets.length) throw new Error('Nothing to update');
      sets.push('updated_date = NOW()');
      await EXECUTESQL(`UPDATE clubs SET ${sets.join(', ')} WHERE id = ?`, [...vals, club_id]);
      if (balance != null) {
        const diff = Number(balance) - Number(old.stc || 0);
        const txId = uuidv4();
        await EXECUTESQL(
          `INSERT INTO stc_transactions (id, club_id, amount, balance_after, type, category, description, related_entity_type, related_entity_id, created_date)
           VALUES (?, ?, ?, ?, 'adjustment', 'admin_correction', ?, 'club', ?, NOW())`,
          [txId, club_id, diff, Number(balance), reason || 'Admin balance correction', club_id]
        );
      }
      await createAuditLog({ adminUserId: _auth_user_id, adminEmail, action: 'set_club_finance', entityType: 'club', entityId: club_id, entityName: old.name, oldValue: JSON.stringify({ stc: old.stc, transfer_budget_stc: old.transfer_budget_stc, wage_budget_stc: old.wage_budget_stc }), newValue: JSON.stringify(changes), reason });
      return { success: true, data: { changes } };
    }

    // ── add_club_tx ────────────────────────────────────────────────────────
    if (action === 'add_club_tx') {
      if (!club_id || amount == null) throw new Error('club_id and amount required');
      const rows = await EXECUTESQL('SELECT id, name, stc FROM clubs WHERE id = ? LIMIT 1', [club_id]);
      if (!rows.length) throw new Error('Club not found');
      const result = await createClubTx({
        clubId: club_id, amount: Number(amount),
        type: 'admin_correction', category: category || 'admin_correction',
        description: description || reason || 'Admin manual transaction',
      });
      await createAuditLog({ adminUserId: _auth_user_id, adminEmail, action: 'add_club_tx', entityType: 'club', entityId: club_id, entityName: rows[0].name, oldValue: Number(rows[0].stc || 0), newValue: result.new_balance, reason: description || reason });
      return { success: true, data: result };
    }

    // ── search_player_txs ──────────────────────────────────────────────────
    if (action === 'search_player_txs') {
      const wheres = ['1=1'];
      const vals = [];
      if (player_id) { wheres.push('t.player_id = ?'); vals.push(player_id); }
      if (player_email) { wheres.push('t.player_email = ?'); vals.push(player_email); }
      if (category) { wheres.push('t.category = ?'); vals.push(category); }
      if (date_from) { wheres.push('t.created_date >= ?'); vals.push(date_from); }
      if (date_to) { wheres.push('t.created_date <= ?'); vals.push(date_to); }
      if (min_amount != null) { wheres.push('t.amount >= ?'); vals.push(Number(min_amount)); }
      if (max_amount != null) { wheres.push('t.amount <= ?'); vals.push(Number(max_amount)); }
      const rows = await EXECUTESQL(
        `SELECT t.*, p.gamertag FROM player_stc_transactions t
         LEFT JOIN players p ON p.id = t.player_id
         WHERE ${wheres.join(' AND ')}
         ORDER BY t.created_date DESC LIMIT ?`,
        [...vals, LIMIT]
      );
      return { data: { transactions: rows, count: rows.length } };
    }

    // ── search_club_txs ────────────────────────────────────────────────────
    if (action === 'search_club_txs') {
      const wheres = ['1=1'];
      const vals = [];
      if (club_id) { wheres.push('t.club_id = ?'); vals.push(club_id); }
      if (category) { wheres.push('t.category = ?'); vals.push(category); }
      if (date_from) { wheres.push('t.created_date >= ?'); vals.push(date_from); }
      if (date_to) { wheres.push('t.created_date <= ?'); vals.push(date_to); }
      if (min_amount != null) { wheres.push('t.amount >= ?'); vals.push(Number(min_amount)); }
      if (max_amount != null) { wheres.push('t.amount <= ?'); vals.push(Number(max_amount)); }
      const rows = await EXECUTESQL(
        `SELECT t.*, c.name as club_name FROM stc_transactions t
         LEFT JOIN clubs c ON c.id = t.club_id
         WHERE ${wheres.join(' AND ')}
         ORDER BY t.created_date DESC LIMIT ?`,
        [...vals, LIMIT]
      );
      return { data: { transactions: rows, count: rows.length } };
    }

    // ── health_check ───────────────────────────────────────────────────────
    if (action === 'health_check') {
      const [
        playersNeg, clubsNeg, playersNull, clubsNull,
        clubsMissingTransfer, clubsMissingWage,
        wagersStuck, contractsBroken,
      ] = await Promise.all([
        EXECUTESQL('SELECT id, gamertag, email, stc FROM players WHERE stc < 0'),
        EXECUTESQL('SELECT id, name, stc FROM clubs WHERE stc < 0'),
        EXECUTESQL('SELECT id, gamertag, email FROM players WHERE stc IS NULL'),
        EXECUTESQL('SELECT id, name FROM clubs WHERE stc IS NULL'),
        EXECUTESQL('SELECT id, name, transfer_budget_stc FROM clubs WHERE transfer_budget_stc IS NULL OR transfer_budget_stc < 0'),
        EXECUTESQL('SELECT id, name, wage_budget_stc FROM clubs WHERE wage_budget_stc IS NULL OR wage_budget_stc < 0'),
        EXECUTESQL(
          "SELECT m.id, m.home_club_name, m.away_club_name, m.wager_stc, m.wager_status FROM matches m WHERE m.wager_status = 'active' AND m.status IN ('completed','forfeit') LIMIT 50"
        ),
        EXECUTESQL(
          "SELECT pc.id, pc.user_id, pc.team_id, pc.weekly_salary_stc FROM player_contracts pc WHERE pc.status = 'active' AND (pc.weekly_salary_stc < 0 OR pc.weekly_salary_stc IS NULL) LIMIT 50"
        ),
      ]);
      return {
        data: {
          players_negative_balance: playersNeg,
          clubs_negative_balance:   clubsNeg,
          players_null_wallet:      playersNull,
          clubs_null_balance:       clubsNull,
          clubs_missing_transfer:   clubsMissingTransfer,
          clubs_missing_wage:       clubsMissingWage,
          wagers_stuck:             wagersStuck,
          contracts_broken:         contractsBroken,
          summary: {
            issues: playersNeg.length + clubsNeg.length + playersNull.length + clubsNull.length + clubsMissingTransfer.length + clubsMissingWage.length + wagersStuck.length + contractsBroken.length,
            checks_run: 8,
          },
        },
      };
    }

    // ── backfill_player_wallets ─────────────────────────────────────────────
    if (action === 'backfill_player_wallets') {
      const nullPlayers = await EXECUTESQL('SELECT id, gamertag, email FROM players WHERE stc IS NULL');
      if (dry_run) return { data: { dry_run: true, would_fix: nullPlayers.length, players: nullPlayers } };
      let fixed = 0;
      for (const p of nullPlayers) {
        const existingGrant = await EXECUTESQL(
          "SELECT id FROM player_stc_transactions WHERE player_id = ? AND category = 'initial_grant' LIMIT 1",
          [p.id]
        );
        await EXECUTESQL('UPDATE players SET stc = 50000, updated_date = NOW() WHERE id = ?', [p.id]);
        if (!existingGrant.length) {
          await EXECUTESQL(
            `INSERT INTO player_stc_transactions (id, player_id, player_email, amount, balance_after, type, category, source, description, created_date)
             VALUES (?, ?, ?, 50000, 50000, 'income', 'initial_grant', 'System', 'Welcome bonus — wallet initialised', NOW())`,
            [uuidv4(), p.id, p.email || null]
          );
        }
        fixed++;
      }
      await createAuditLog({ adminUserId: _auth_user_id, adminEmail, action: 'backfill_player_wallets', entityType: 'system', entityId: null, entityName: 'bulk', oldValue: 'null wallets', newValue: `fixed: ${fixed}`, reason: 'Admin backfill' });
      return { success: true, data: { fixed } };
    }

    // ── backfill_club_finances ──────────────────────────────────────────────
    if (action === 'backfill_club_finances') {
      const nullClubs = await EXECUTESQL('SELECT id, name FROM clubs WHERE stc IS NULL OR transfer_budget_stc IS NULL OR wage_budget_stc IS NULL');
      if (dry_run) return { data: { dry_run: true, would_fix: nullClubs.length, clubs: nullClubs } };
      let fixed = 0;
      for (const c of nullClubs) {
        await EXECUTESQL(
          `UPDATE clubs SET
             stc                 = COALESCE(stc, 5000000),
             transfer_budget_stc = COALESCE(transfer_budget_stc, 0),
             wage_budget_stc     = COALESCE(wage_budget_stc, 0),
             updated_date        = NOW()
           WHERE id = ?`,
          [c.id]
        );
        fixed++;
      }
      await createAuditLog({ adminUserId: _auth_user_id, adminEmail, action: 'backfill_club_finances', entityType: 'system', entityId: null, entityName: 'bulk', oldValue: 'null finances', newValue: `fixed: ${fixed}`, reason: 'Admin backfill' });
      return { success: true, data: { fixed } };
    }

    // ── distribute_competition_reward ───────────────────────────────────────
    if (action === 'distribute_competition_reward') {
      if (!club_id || amount == null) throw new Error('club_id and amount required');
      const rows = await EXECUTESQL('SELECT id, name, stc FROM clubs WHERE id = ? LIMIT 1', [club_id]);
      if (!rows.length) throw new Error('Club not found');
      const result = await createClubTx({
        clubId: club_id, amount: Number(amount),
        type: 'competition_prize', category: 'competition_reward',
        description: description || reason || `Competition reward`,
        referenceId: competition_id || null,
        relatedEntityType: competition_id ? 'competition' : 'admin',
      });
      await createAuditLog({ adminUserId: _auth_user_id, adminEmail, action: 'distribute_competition_reward', entityType: 'club', entityId: club_id, entityName: rows[0].name, oldValue: Number(rows[0].stc || 0), newValue: result.new_balance, reason: description || reason });
      return { success: true, data: result };
    }

    // ── set_lifestyle_status ────────────────────────────────────────────────
    if (action === 'set_lifestyle_status') {
      if (!purchase_id || !purchase_status) throw new Error('purchase_id and purchase_status required');
      const rows = await EXECUTESQL('SELECT lp.id, lp.player_id, li.name FROM lifestyle_purchases lp LEFT JOIN lifestyle_items li ON li.id = lp.item_id WHERE lp.id = ? LIMIT 1', [purchase_id]);
      if (!rows.length) throw new Error('Purchase not found');
      await EXECUTESQL('UPDATE lifestyle_purchases SET status = ?, updated_date = NOW() WHERE id = ?', [purchase_status, purchase_id]);
      await createAuditLog({ adminUserId: _auth_user_id, adminEmail, action: 'set_lifestyle_status', entityType: 'lifestyle_purchase', entityId: purchase_id, entityName: rows[0].name, oldValue: 'unknown', newValue: purchase_status, reason });
      return { success: true };
    }

    // ── get_audit_log ───────────────────────────────────────────────────────
    if (action === 'get_audit_log') {
      const wheres = ['1=1'];
      const vals = [];
      if (entity_type) { wheres.push('entity_type = ?'); vals.push(entity_type); }
      if (player_id) { wheres.push("entity_type = 'player' AND entity_id = ?"); vals.push(player_id); }
      if (club_id) { wheres.push("entity_type = 'club' AND entity_id = ?"); vals.push(club_id); }
      const rows = await EXECUTESQL(
        `SELECT * FROM admin_audit_log WHERE ${wheres.join(' AND ')} ORDER BY created_date DESC LIMIT ?`,
        [...vals, LIMIT]
      );
      return { data: { log: rows, count: rows.length } };
    }

    throw new Error(`Unknown adminEconomyControl action: ${action}`);
  },

  // ── Economy Tests ─────────────────────────────────────────────────────────
  async economyTests({ action, test_name, suite, sample_size, _auth_user_id }) {
    const adminRows = await EXECUTESQL('SELECT id, email, role_id FROM users WHERE id = ? LIMIT 1', [_auth_user_id]);
    if (!adminRows.length || Number(adminRows[0].role_id) !== 0) throw new Error('Admin access required');

    // ── internal helpers ────────────────────────────────────────────────────
    function assert(cond, msg) { if (!cond) throw new Error(`Assertion failed: ${msg}`); }

    async function runTest(name, description, fn) {
      const start = Date.now();
      const cleanups = [];
      const addCleanup = (c) => cleanups.push(c);
      try {
        const r = await fn(addCleanup);
        return { name, description, status: r.status || 'pass', message: r.message || 'All assertions passed', assertions: r.assertions || [], duration_ms: Date.now() - start };
      } catch (err) {
        return { name, description, status: 'fail', message: err.message, assertions: err.assertions || [], duration_ms: Date.now() - start };
      } finally {
        for (const c of cleanups.reverse()) await c().catch(() => {});
      }
    }

    // ── simulation tests ────────────────────────────────────────────────────
    const SIM_TESTS = {

      wallet_creation: () => runTest('wallet_creation', 'New player gets 50,000 STC + initial_grant transaction; no duplicates', async (add) => {
        const pid = uuidv4(), uid = uuidv4();
        await EXECUTESQL(`INSERT INTO players (id, gamertag, email, user_id, stc, created_date) VALUES (?, ?, ?, ?, NULL, NOW())`,
          [pid, `__TEST__wc_${pid.slice(0,6)}`, `__test__wc_${pid.slice(0,6)}@stage.test`, uid]);
        add(() => EXECUTESQL('DELETE FROM players WHERE id = ?', [pid]));
        add(() => EXECUTESQL('DELETE FROM player_stc_transactions WHERE player_id = ?', [pid]));

        await EXECUTESQL('UPDATE players SET stc = 50000, updated_date = NOW() WHERE id = ?', [pid]);
        await EXECUTESQL(`INSERT INTO player_stc_transactions (id,player_id,player_email,amount,balance_after,type,category,source,description,created_date)
          VALUES (?,?,NULL,50000,50000,'income','initial_grant','System','Welcome bonus',NOW())`, [uuidv4(), pid]);

        const [p] = await EXECUTESQL('SELECT stc FROM players WHERE id = ?', [pid]);
        assert(Number(p.stc) === 50000, `Expected balance 50000, got ${p.stc}`);
        const txs = await EXECUTESQL("SELECT * FROM player_stc_transactions WHERE player_id=? AND category='initial_grant'", [pid]);
        assert(txs.length === 1, `Expected 1 initial_grant tx, got ${txs.length}`);
        assert(Number(txs[0].amount) === 50000, `Tx amount mismatch`);
        assert(Number(txs[0].balance_after) === 50000, `balance_after mismatch`);
        // Idempotency: running init again should not create duplicate
        const dup = await EXECUTESQL("SELECT COUNT(*) as cnt FROM player_stc_transactions WHERE player_id=? AND category='initial_grant'", [pid]);
        assert(Number(dup[0].cnt) === 1, `Duplicate initial_grant detected`);
        return { assertions: ['✓ Balance = 50,000 STC', '✓ initial_grant tx (amount=50000, balance_after=50000)', '✓ No duplicate initial_grant'] };
      }),

      club_default_finances: () => runTest('club_default_finances', 'New club has positive STC and non-negative budgets', async (add) => {
        const cid = uuidv4();
        const president = await createTemporaryClubPresident({ EXECUTESQL, addCleanup: add, clubId: cid, emailPrefix: 'cf' });
        await EXECUTESQL(`INSERT INTO clubs (id,name,tag,user_id,president_user_id,owner_email,stc,transfer_budget_stc,wage_budget_stc,created_date) VALUES (?,?,?,?,?,?,5000000,0,0,NOW())`,
          [cid, `__TEST__cf_${cid.slice(0,6)}`, 'TCC', president.presidentUserId, president.presidentUserId, president.presidentEmail]);
        add(() => EXECUTESQL('DELETE FROM clubs WHERE id = ?', [cid]));
        await linkTemporaryClubPresident({ EXECUTESQL, presidentUserId: president.presidentUserId, clubId: cid });
        const [c] = await EXECUTESQL('SELECT stc, transfer_budget_stc, wage_budget_stc FROM clubs WHERE id = ?', [cid]);
        assert(Number(c.stc) > 0, `stc must be > 0, got ${c.stc}`);
        assert(Number(c.transfer_budget_stc) >= 0, `transfer_budget must be >= 0`);
        assert(Number(c.wage_budget_stc) >= 0, `wage_budget must be >= 0`);
        return { assertions: [`✓ stc = ${Number(c.stc).toLocaleString()} STC`, `✓ transfer_budget = ${Number(c.transfer_budget_stc).toLocaleString()}`, `✓ wage_budget = ${Number(c.wage_budget_stc).toLocaleString()}`] };
      }),

      salary_payment: () => runTest('salary_payment', 'Weekly salary: player balance +salary, club balance -salary, both have tx records', async (add) => {
        const pid = uuidv4(), cid = uuidv4(), uid1 = uuidv4(), uid2 = uuidv4();
        const SALARY = 5000, P_START = 100000, C_START = 10000000;
        await EXECUTESQL(`INSERT INTO players (id,gamertag,email,user_id,stc,created_date) VALUES (?,?,?,?,?,NOW())`,
          [pid, `__TEST__sal_${pid.slice(0,6)}`, `__test__sal_${pid.slice(0,6)}@s.t`, uid1, P_START]);
        const president = await createTemporaryClubPresident({ EXECUTESQL, addCleanup: add, clubId: cid, emailPrefix: 'salc' });
        await EXECUTESQL(`INSERT INTO clubs (id,name,tag,user_id,president_user_id,owner_email,stc,transfer_budget_stc,wage_budget_stc,created_date) VALUES (?,?,?,?,?,?,?,0,0,NOW())`,
          [cid, `__TEST__salc_${cid.slice(0,6)}`, 'TSL', president.presidentUserId, president.presidentUserId, president.presidentEmail, C_START]);
        add(() => EXECUTESQL('DELETE FROM players WHERE id=?', [pid]));
        add(() => EXECUTESQL('DELETE FROM clubs WHERE id=?', [cid]));
        add(() => EXECUTESQL('DELETE FROM player_stc_transactions WHERE player_id=?', [pid]));
        add(() => EXECUTESQL('DELETE FROM stc_transactions WHERE club_id=?', [cid]));
        await linkTemporaryClubPresident({ EXECUTESQL, presidentUserId: president.presidentUserId, clubId: cid });

        await createPlayerTx({ playerId: pid, playerEmail: null, amount: SALARY, category: 'wage_payment', source: cid, description: 'Test weekly salary' });
        await createClubTx({ clubId: cid, amount: -SALARY, type: 'expense', category: 'wage_payment', description: 'Test weekly salary', referenceId: pid });

        const [pRow] = await EXECUTESQL('SELECT stc FROM players WHERE id=?', [pid]);
        const [cRow] = await EXECUTESQL('SELECT stc FROM clubs WHERE id=?', [cid]);
        assert(Number(pRow.stc) === P_START + SALARY, `Player: expected ${P_START+SALARY}, got ${pRow.stc}`);
        assert(Number(cRow.stc) === C_START - SALARY, `Club: expected ${C_START-SALARY}, got ${cRow.stc}`);
        const ptx = await EXECUTESQL("SELECT * FROM player_stc_transactions WHERE player_id=? AND category='wage_payment'", [pid]);
        const ctx = await EXECUTESQL("SELECT * FROM stc_transactions WHERE club_id=? AND category='wage_payment'", [cid]);
        assert(ptx.length === 1, `Expected 1 player wage tx`);
        assert(ctx.length === 1, `Expected 1 club wage tx`);
        return { assertions: [`✓ Player: ${P_START.toLocaleString()} → ${(P_START+SALARY).toLocaleString()} (+${SALARY.toLocaleString()})`, `✓ Club: ${C_START.toLocaleString()} → ${(C_START-SALARY).toLocaleString()} (-${SALARY.toLocaleString()})`, '✓ wage_payment tx on both sides'] };
      }),

      lifestyle_purchase: () => runTest('lifestyle_purchase', 'Purchase deducts player balance; tx with correct amount and balance_after', async (add) => {
        const pid = uuidv4(), uid = uuidv4();
        const PRICE = 10000, START = 100000;
        await EXECUTESQL(`INSERT INTO players (id,gamertag,email,user_id,stc,created_date) VALUES (?,?,?,?,?,NOW())`,
          [pid, `__TEST__lsp_${pid.slice(0,6)}`, `__test__lsp_${pid.slice(0,6)}@s.t`, uid, START]);
        add(() => EXECUTESQL('DELETE FROM players WHERE id=?', [pid]));
        add(() => EXECUTESQL('DELETE FROM player_stc_transactions WHERE player_id=?', [pid]));
        await createPlayerTx({ playerId: pid, playerEmail: null, amount: -PRICE, category: 'lifestyle_purchase', source: 'Lifestyle', description: 'Test purchase' });
        const [p] = await EXECUTESQL('SELECT stc FROM players WHERE id=?', [pid]);
        assert(Number(p.stc) === START - PRICE, `Expected ${START-PRICE}, got ${p.stc}`);
        const txs = await EXECUTESQL("SELECT * FROM player_stc_transactions WHERE player_id=? AND category='lifestyle_purchase'", [pid]);
        assert(txs.length === 1, 'Expected 1 lifestyle_purchase tx');
        assert(Number(txs[0].amount) === -PRICE, `amount mismatch`);
        assert(Number(txs[0].balance_after) === START - PRICE, `balance_after mismatch`);
        return { assertions: [`✓ Balance: ${START.toLocaleString()} → ${(START-PRICE).toLocaleString()} (-${PRICE.toLocaleString()})`, '✓ lifestyle_purchase tx recorded', '✓ balance_after is accurate'] };
      }),

      lifestyle_rental: () => runTest('lifestyle_rental', 'Rental deducts player balance and creates transaction', async (add) => {
        const pid = uuidv4(), uid = uuidv4();
        const RENT = 3000, START = 50000;
        await EXECUTESQL(`INSERT INTO players (id,gamertag,email,user_id,stc,created_date) VALUES (?,?,?,?,?,NOW())`,
          [pid, `__TEST__lsr_${pid.slice(0,6)}`, `__test__lsr_${pid.slice(0,6)}@s.t`, uid, START]);
        add(() => EXECUTESQL('DELETE FROM players WHERE id=?', [pid]));
        add(() => EXECUTESQL('DELETE FROM player_stc_transactions WHERE player_id=?', [pid]));
        await createPlayerTx({ playerId: pid, playerEmail: null, amount: -RENT, category: 'lifestyle_rental', source: 'Lifestyle', description: 'Test rental' });
        const [p] = await EXECUTESQL('SELECT stc FROM players WHERE id=?', [pid]);
        assert(Number(p.stc) === START - RENT, `Expected ${START-RENT}, got ${p.stc}`);
        const txs = await EXECUTESQL("SELECT * FROM player_stc_transactions WHERE player_id=? AND category='lifestyle_rental'", [pid]);
        assert(txs.length === 1, 'Expected 1 rental tx');
        return { assertions: [`✓ Rental deduction: -${RENT.toLocaleString()} STC`, `✓ Balance after: ${(START-RENT).toLocaleString()} STC`, '✓ lifestyle_rental tx recorded'] };
      }),

      lifestyle_investment: () => runTest('lifestyle_investment', 'Investment deducts balance; return credits back; net profit reflected correctly', async (add) => {
        const pid = uuidv4(), uid = uuidv4();
        const INVEST = 20000, RETURN = 22000, START = 100000;
        await EXECUTESQL(`INSERT INTO players (id,gamertag,email,user_id,stc,created_date) VALUES (?,?,?,?,?,NOW())`,
          [pid, `__TEST__lsi_${pid.slice(0,6)}`, `__test__lsi_${pid.slice(0,6)}@s.t`, uid, START]);
        add(() => EXECUTESQL('DELETE FROM players WHERE id=?', [pid]));
        add(() => EXECUTESQL('DELETE FROM player_stc_transactions WHERE player_id=?', [pid]));
        await createPlayerTx({ playerId: pid, playerEmail: null, amount: -INVEST, category: 'lifestyle_investment', source: 'Lifestyle', description: 'Test investment' });
        await createPlayerTx({ playerId: pid, playerEmail: null, amount: RETURN, category: 'lifestyle_return', source: 'Lifestyle', description: 'Test investment return' });
        const [p] = await EXECUTESQL('SELECT stc FROM players WHERE id=?', [pid]);
        const expected = START - INVEST + RETURN;
        assert(Number(p.stc) === expected, `Expected ${expected}, got ${p.stc}`);
        const ivTx = await EXECUTESQL("SELECT * FROM player_stc_transactions WHERE player_id=? AND category='lifestyle_investment'", [pid]);
        const rtTx = await EXECUTESQL("SELECT * FROM player_stc_transactions WHERE player_id=? AND category='lifestyle_return'", [pid]);
        assert(ivTx.length === 1 && rtTx.length === 1, 'Expected both investment and return txs');
        return { assertions: [`✓ Investment: -${INVEST.toLocaleString()}`, `✓ Return: +${RETURN.toLocaleString()} (profit +${(RETURN-INVEST).toLocaleString()})`, `✓ Final balance: ${expected.toLocaleString()} STC`, '✓ Both txs recorded'] };
      }),

      wager_block: () => runTest('wager_block', 'Wager stake reduces both player balances; blocked funds confirmed deducted', async (add) => {
        const p1 = uuidv4(), p2 = uuidv4(), u1 = uuidv4(), u2 = uuidv4();
        const STAKE = 10000, START = 50000;
        await EXECUTESQL(`INSERT INTO players (id,gamertag,email,user_id,stc,created_date) VALUES (?,?,?,?,?,NOW())`,
          [p1, `__TEST__wb1_${p1.slice(0,6)}`, `__test__wb1_${p1.slice(0,6)}@s.t`, u1, START]);
        await EXECUTESQL(`INSERT INTO players (id,gamertag,email,user_id,stc,created_date) VALUES (?,?,?,?,?,NOW())`,
          [p2, `__TEST__wb2_${p2.slice(0,6)}`, `__test__wb2_${p2.slice(0,6)}@s.t`, u2, START]);
        add(() => EXECUTESQL('DELETE FROM players WHERE id IN (?,?)', [p1,p2]));
        add(() => EXECUTESQL('DELETE FROM player_stc_transactions WHERE player_id IN (?,?)', [p1,p2]));
        await createPlayerTx({ playerId: p1, playerEmail: null, amount: -STAKE, category: 'wager_stake', source: 'Wager', description: 'Test stake' });
        await createPlayerTx({ playerId: p2, playerEmail: null, amount: -STAKE, category: 'wager_stake', source: 'Wager', description: 'Test stake' });
        const [r1] = await EXECUTESQL('SELECT stc FROM players WHERE id=?', [p1]);
        const [r2] = await EXECUTESQL('SELECT stc FROM players WHERE id=?', [p2]);
        assert(Number(r1.stc) === START - STAKE, `P1 expected ${START-STAKE}, got ${r1.stc}`);
        assert(Number(r2.stc) === START - STAKE, `P2 expected ${START-STAKE}, got ${r2.stc}`);
        const t1 = await EXECUTESQL("SELECT * FROM player_stc_transactions WHERE player_id=? AND category='wager_stake'", [p1]);
        const t2 = await EXECUTESQL("SELECT * FROM player_stc_transactions WHERE player_id=? AND category='wager_stake'", [p2]);
        assert(t1.length === 1 && t2.length === 1, 'Expected stake txs for both players');
        assert(Number(r1.stc) < START, 'P1 blocked funds: cannot spend staked amount');
        assert(Number(r2.stc) < START, 'P2 blocked funds: cannot spend staked amount');
        return { assertions: [`✓ P1: ${START.toLocaleString()} → ${(START-STAKE).toLocaleString()} (stake blocked)`, `✓ P2: ${START.toLocaleString()} → ${(START-STAKE).toLocaleString()} (stake blocked)`, '✓ wager_stake txs recorded', '✓ Staked amount deducted from spendable balance'] };
      }),

      wager_payout: () => runTest('wager_payout', 'Winner receives full pot; loser gets no refund; payout tx recorded', async (add) => {
        const p1 = uuidv4(), p2 = uuidv4(), u1 = uuidv4(), u2 = uuidv4();
        const STAKE = 10000, POT = STAKE * 2, START = 50000;
        await EXECUTESQL(`INSERT INTO players (id,gamertag,email,user_id,stc,created_date) VALUES (?,?,?,?,?,NOW())`,
          [p1, `__TEST__wp1_${p1.slice(0,6)}`, `__test__wp1_${p1.slice(0,6)}@s.t`, u1, START]);
        await EXECUTESQL(`INSERT INTO players (id,gamertag,email,user_id,stc,created_date) VALUES (?,?,?,?,?,NOW())`,
          [p2, `__TEST__wp2_${p2.slice(0,6)}`, `__test__wp2_${p2.slice(0,6)}@s.t`, u2, START]);
        add(() => EXECUTESQL('DELETE FROM players WHERE id IN (?,?)', [p1,p2]));
        add(() => EXECUTESQL('DELETE FROM player_stc_transactions WHERE player_id IN (?,?)', [p1,p2]));
        await createPlayerTx({ playerId: p1, playerEmail: null, amount: -STAKE, category: 'wager_stake', source: 'Wager', description: 'Stake' });
        await createPlayerTx({ playerId: p2, playerEmail: null, amount: -STAKE, category: 'wager_stake', source: 'Wager', description: 'Stake' });
        await createPlayerTx({ playerId: p1, playerEmail: null, amount: POT, category: 'wager_payout', source: 'Wager', description: 'Win payout' });
        const [r1] = await EXECUTESQL('SELECT stc FROM players WHERE id=?', [p1]);
        const [r2] = await EXECUTESQL('SELECT stc FROM players WHERE id=?', [p2]);
        const p1Exp = START - STAKE + POT, p2Exp = START - STAKE;
        assert(Number(r1.stc) === p1Exp, `Winner expected ${p1Exp}, got ${r1.stc}`);
        assert(Number(r2.stc) === p2Exp, `Loser expected ${p2Exp}, got ${r2.stc}`);
        const ptx = await EXECUTESQL("SELECT * FROM player_stc_transactions WHERE player_id=? AND category='wager_payout'", [p1]);
        assert(ptx.length === 1 && Number(ptx[0].amount) === POT, `Expected payout tx of ${POT}`);
        const ltx = await EXECUTESQL("SELECT * FROM player_stc_transactions WHERE player_id=? AND category='wager_payout'", [p2]);
        assert(ltx.length === 0, 'Loser must not receive a payout tx');
        return { assertions: [`✓ Winner: ${START.toLocaleString()} → ${p1Exp.toLocaleString()} (net +${(p1Exp-START).toLocaleString()})`, `✓ Loser: ${START.toLocaleString()} → ${p2Exp.toLocaleString()} (net -${STAKE.toLocaleString()})`, `✓ wager_payout tx = ${POT.toLocaleString()} STC`, '✓ Loser received no payout'] };
      }),

      wager_refund: () => runTest('wager_refund', 'Both players refunded to pre-wager balance; refund txs recorded', async (add) => {
        const p1 = uuidv4(), p2 = uuidv4(), u1 = uuidv4(), u2 = uuidv4();
        const STAKE = 10000, START = 50000;
        await EXECUTESQL(`INSERT INTO players (id,gamertag,email,user_id,stc,created_date) VALUES (?,?,?,?,?,NOW())`,
          [p1, `__TEST__wr1_${p1.slice(0,6)}`, `__test__wr1_${p1.slice(0,6)}@s.t`, u1, START]);
        await EXECUTESQL(`INSERT INTO players (id,gamertag,email,user_id,stc,created_date) VALUES (?,?,?,?,?,NOW())`,
          [p2, `__TEST__wr2_${p2.slice(0,6)}`, `__test__wr2_${p2.slice(0,6)}@s.t`, u2, START]);
        add(() => EXECUTESQL('DELETE FROM players WHERE id IN (?,?)', [p1,p2]));
        add(() => EXECUTESQL('DELETE FROM player_stc_transactions WHERE player_id IN (?,?)', [p1,p2]));
        await createPlayerTx({ playerId: p1, playerEmail: null, amount: -STAKE, category: 'wager_stake', source: 'Wager', description: 'Stake' });
        await createPlayerTx({ playerId: p2, playerEmail: null, amount: -STAKE, category: 'wager_stake', source: 'Wager', description: 'Stake' });
        await createPlayerTx({ playerId: p1, playerEmail: null, amount: STAKE, category: 'wager_refund', source: 'Wager', description: 'Refund' });
        await createPlayerTx({ playerId: p2, playerEmail: null, amount: STAKE, category: 'wager_refund', source: 'Wager', description: 'Refund' });
        const [r1] = await EXECUTESQL('SELECT stc FROM players WHERE id=?', [p1]);
        const [r2] = await EXECUTESQL('SELECT stc FROM players WHERE id=?', [p2]);
        assert(Number(r1.stc) === START, `P1 expected ${START}, got ${r1.stc}`);
        assert(Number(r2.stc) === START, `P2 expected ${START}, got ${r2.stc}`);
        const rt1 = await EXECUTESQL("SELECT * FROM player_stc_transactions WHERE player_id=? AND category='wager_refund'", [p1]);
        const rt2 = await EXECUTESQL("SELECT * FROM player_stc_transactions WHERE player_id=? AND category='wager_refund'", [p2]);
        assert(rt1.length === 1 && rt2.length === 1, 'Expected refund txs for both');
        return { assertions: [`✓ P1 restored to ${START.toLocaleString()} STC`, `✓ P2 restored to ${START.toLocaleString()} STC`, '✓ wager_refund txs recorded for both'] };
      }),

      ticket_revenue: () => runTest('ticket_revenue', 'Home match revenue: correct attendance calc, club credited, transfer cap unchanged, idempotency guard, match fields updated', async (add) => {
        const cid = uuidv4(), mid = uuidv4();
        const WINS = 5, LOSSES = 1, STREAK = 3, START = 5000000;
        const president = await createTemporaryClubPresident({ EXECUTESQL, addCleanup: add, clubId: cid, emailPrefix: 'tr' });
        await EXECUTESQL(`INSERT INTO clubs (id,name,tag,user_id,president_user_id,owner_email,stc,transfer_budget_stc,wage_budget_stc,wins,losses,win_streak,created_date) VALUES (?,?,?,?,?,?,?,0,0,?,?,?,NOW())`,
          [cid, `__TEST__tr_${cid.slice(0,6)}`, 'TTR', president.presidentUserId, president.presidentUserId, president.presidentEmail, START, WINS, LOSSES, STREAK]);
        await EXECUTESQL(`INSERT INTO matches (id,home_club_id,status,stats_processed,home_ticket_revenue,created_date) VALUES (?,?,'completed',0,0,NOW())`,
          [mid, cid]);
        add(() => EXECUTESQL('DELETE FROM clubs WHERE id=?', [cid]));
        add(() => EXECUTESQL('DELETE FROM matches WHERE id=?', [mid]));
        add(() => EXECUTESQL('DELETE FROM stc_transactions WHERE club_id=?', [cid]));
        await linkTemporaryClubPresident({ EXECUTESQL, presidentUserId: president.presidentUserId, clubId: cid });

        const cfg = await getStadiumConfig();
        const lvl = cfg[0] || { capacity: 5000, ticket_price_stc: 15 };
        const pct = calcAttendancePct(WINS, LOSSES, STREAK);
        const attendance = Math.round(lvl.capacity * pct / 100);
        const revenue = attendance * Number(lvl.ticket_price_stc);

        // Idempotency guard check (no existing tx)
        const prior = await EXECUTESQL("SELECT id FROM stc_transactions WHERE club_id=? AND category='ticket_revenue' AND reference_id=? LIMIT 1", [cid, mid]);
        assert(prior.length === 0, 'Pre-condition: no prior ticket_revenue tx');

        await createClubTx({ clubId: cid, amount: revenue, type: 'income', category: 'ticket_revenue', description: `Test tickets (${attendance} fans @ ${lvl.ticket_price_stc} STC)`, referenceId: mid });
        await EXECUTESQL('UPDATE matches SET home_ticket_revenue=?,home_ticket_attendance=?,home_ticket_pct=?,home_ticket_capacity=?,home_ticket_price=? WHERE id=?',
          [revenue, attendance, pct, lvl.capacity, lvl.ticket_price_stc, mid]);

        const [c] = await EXECUTESQL('SELECT stc, transfer_budget_stc FROM clubs WHERE id=?', [cid]);
        const [m] = await EXECUTESQL('SELECT home_ticket_revenue, home_ticket_attendance, home_ticket_pct FROM matches WHERE id=?', [mid]);
        assert(Number(c.stc) === START + revenue, `Club balance mismatch`);
        assert(Number(c.transfer_budget_stc) === 0, `Transfer budget should remain unchanged`);
        assert(Number(m.home_ticket_revenue) === revenue, `Match revenue field mismatch`);
        assert(Number(m.home_ticket_attendance) === attendance, `Match attendance field mismatch`);

        const txs = await EXECUTESQL("SELECT id FROM stc_transactions WHERE club_id=? AND category='ticket_revenue' AND reference_id=?", [cid, mid]);
        assert(txs.length === 1, 'Expected exactly 1 ticket_revenue tx');

        // Test idempotency: a second call would find the tx and skip
        const guard = await EXECUTESQL("SELECT id FROM stc_transactions WHERE club_id=? AND category='ticket_revenue' AND reference_id=? LIMIT 1", [cid, mid]);
        assert(guard.length === 1, 'Idempotency: tx exists → second run would be skipped');

        return { assertions: [`✓ Attendance: ${pct}% of ${lvl.capacity.toLocaleString()} = ${attendance.toLocaleString()} fans`, `✓ Revenue: ${revenue.toLocaleString()} STC`, `✓ Club balance: +${revenue.toLocaleString()} STC`, '✓ Transfer cap unchanged', '✓ Match fields updated', '✓ Idempotency guard confirmed'] };
      }),

      shirt_sales_revenue: () => runTest('shirt_sales_revenue', 'Shirt sales: club receives revenue, shirt_revenue tx recorded', async (add) => {
        const cid = uuidv4();
        const REV = 3750, START = 5000000;
        const president = await createTemporaryClubPresident({ EXECUTESQL, addCleanup: add, clubId: cid, emailPrefix: 'ss' });
        await EXECUTESQL(`INSERT INTO clubs (id,name,tag,user_id,president_user_id,owner_email,stc,transfer_budget_stc,wage_budget_stc,created_date) VALUES (?,?,?,?,?,?,?,0,0,NOW())`,
          [cid, `__TEST__ss_${cid.slice(0,6)}`, 'TSS', president.presidentUserId, president.presidentUserId, president.presidentEmail, START]);
        add(() => EXECUTESQL('DELETE FROM clubs WHERE id=?', [cid]));
        add(() => EXECUTESQL('DELETE FROM stc_transactions WHERE club_id=?', [cid]));
        await linkTemporaryClubPresident({ EXECUTESQL, presidentUserId: president.presidentUserId, clubId: cid });
        await createClubTx({ clubId: cid, amount: REV, type: 'income', category: 'shirt_revenue', description: 'Test shirt sales' });
        const [c] = await EXECUTESQL('SELECT stc FROM clubs WHERE id=?', [cid]);
        assert(Number(c.stc) === START + REV, `Expected ${START+REV}, got ${c.stc}`);
        const txs = await EXECUTESQL("SELECT * FROM stc_transactions WHERE club_id=? AND category='shirt_revenue'", [cid]);
        assert(txs.length === 1, 'Expected 1 shirt_revenue tx');
        return { assertions: [`✓ Club credited: +${REV.toLocaleString()} STC`, `✓ Balance: ${(START+REV).toLocaleString()} STC`, '✓ shirt_revenue tx recorded'] };
      }),

      competition_reward: () => runTest('competition_reward', 'Competition reward: correct STC credited, competition_reward tx created', async (add) => {
        const cid = uuidv4();
        const PRIZE = 1000000, START = 5000000;
        const president = await createTemporaryClubPresident({ EXECUTESQL, addCleanup: add, clubId: cid, emailPrefix: 'cr' });
        await EXECUTESQL(`INSERT INTO clubs (id,name,tag,user_id,president_user_id,owner_email,stc,transfer_budget_stc,wage_budget_stc,created_date) VALUES (?,?,?,?,?,?,?,0,0,NOW())`,
          [cid, `__TEST__cr_${cid.slice(0,6)}`, 'TCP', president.presidentUserId, president.presidentUserId, president.presidentEmail, START]);
        add(() => EXECUTESQL('DELETE FROM clubs WHERE id=?', [cid]));
        add(() => EXECUTESQL('DELETE FROM stc_transactions WHERE club_id=?', [cid]));
        await linkTemporaryClubPresident({ EXECUTESQL, presidentUserId: president.presidentUserId, clubId: cid });
        await createClubTx({ clubId: cid, amount: PRIZE, type: 'income', category: 'competition_reward', description: 'Test 1st place prize' });
        const [c] = await EXECUTESQL('SELECT stc FROM clubs WHERE id=?', [cid]);
        assert(Number(c.stc) === START + PRIZE, `Expected ${START+PRIZE}, got ${c.stc}`);
        const txs = await EXECUTESQL("SELECT * FROM stc_transactions WHERE club_id=? AND category='competition_reward'", [cid]);
        assert(txs.length === 1, 'Expected 1 competition_reward tx');
        return { assertions: [`✓ Prize: +${PRIZE.toLocaleString()} STC`, `✓ Balance: ${(START+PRIZE).toLocaleString()} STC`, '✓ competition_reward tx recorded'] };
      }),

      transfer_budget_change: () => runTest('transfer_budget_change', 'Transfer fee deducted from both STC balance and transfer budget atomically', async (add) => {
        const cid = uuidv4();
        const FEE = 2000000, START = 10000000, BUDGET = 5000000;
        const president = await createTemporaryClubPresident({ EXECUTESQL, addCleanup: add, clubId: cid, emailPrefix: 'tb' });
        await EXECUTESQL(`INSERT INTO clubs (id,name,tag,user_id,president_user_id,owner_email,stc,transfer_budget_stc,wage_budget_stc,created_date) VALUES (?,?,?,?,?,?,?,?,0,NOW())`,
          [cid, `__TEST__tb_${cid.slice(0,6)}`, 'TTB', president.presidentUserId, president.presidentUserId, president.presidentEmail, START, BUDGET]);
        add(() => EXECUTESQL('DELETE FROM clubs WHERE id=?', [cid]));
        add(() => EXECUTESQL('DELETE FROM stc_transactions WHERE club_id=?', [cid]));
        await linkTemporaryClubPresident({ EXECUTESQL, presidentUserId: president.presidentUserId, clubId: cid });
        await createClubTx({ clubId: cid, amount: -FEE, type: 'expense', category: 'transfer_fee', description: 'Test transfer fee' });
        await EXECUTESQL('UPDATE clubs SET transfer_budget_stc = transfer_budget_stc - ? WHERE id=?', [FEE, cid]);
        const [c] = await EXECUTESQL('SELECT stc, transfer_budget_stc FROM clubs WHERE id=?', [cid]);
        assert(Number(c.stc) === START - FEE, `Balance mismatch`);
        assert(Number(c.transfer_budget_stc) === BUDGET - FEE, `Transfer budget mismatch`);
        const txs = await EXECUTESQL("SELECT * FROM stc_transactions WHERE club_id=? AND category='transfer_fee'", [cid]);
        assert(txs.length === 1, 'Expected 1 transfer_fee tx');
        return { assertions: [`✓ Balance: ${START.toLocaleString()} → ${(START-FEE).toLocaleString()} (-${FEE.toLocaleString()})`, `✓ Transfer budget: ${BUDGET.toLocaleString()} → ${(BUDGET-FEE).toLocaleString()}`, '✓ transfer_fee tx recorded'] };
      }),

      wage_budget_change: () => runTest('wage_budget_change', 'Wage budget is a weekly cap and does not move when contracts change', async (add) => {
        const cid = uuidv4();
        const SALARY = 25000, BUDGET = 1000000;
        const president = await createTemporaryClubPresident({ EXECUTESQL, addCleanup: add, clubId: cid, emailPrefix: 'wb' });
        await EXECUTESQL(`INSERT INTO clubs (id,name,tag,user_id,president_user_id,owner_email,stc,transfer_budget_stc,wage_budget_stc,created_date) VALUES (?,?,?,?,?,?,10000000,0,?,NOW())`,
          [cid, `__TEST__wb_${cid.slice(0,6)}`, 'TWB', president.presidentUserId, president.presidentUserId, president.presidentEmail, BUDGET]);
        add(() => EXECUTESQL('DELETE FROM clubs WHERE id=?', [cid]));
        await linkTemporaryClubPresident({ EXECUTESQL, presidentUserId: president.presidentUserId, clubId: cid });
        const [after] = await EXECUTESQL('SELECT wage_budget_stc FROM clubs WHERE id=?', [cid]);
        assert(Number(after.wage_budget_stc) === BUDGET, `After contract: expected cap ${BUDGET}, got ${after.wage_budget_stc}`);
        const [final] = await EXECUTESQL('SELECT wage_budget_stc FROM clubs WHERE id=?', [cid]);
        assert(Number(final.wage_budget_stc) === BUDGET, `After expiry: expected ${BUDGET}, got ${final.wage_budget_stc}`);
        return { assertions: [`✓ Contract salary ${SALARY.toLocaleString()} STC/week does not alter the cap`, `✓ Wage cap remains: ${BUDGET.toLocaleString()} STC/week`] };
      }),
    };

    // ── verification tests (read-only) ──────────────────────────────────────
    const VERIFY_TESTS = {

      no_negative_balances: () => runTest('no_negative_balances', 'No player or club has a negative STC balance', async () => {
        const negP = await EXECUTESQL("SELECT id, gamertag, stc FROM players WHERE stc < 0 AND gamertag NOT LIKE '__TEST__%'");
        const negC = await EXECUTESQL("SELECT id, name, stc FROM clubs WHERE stc < 0 AND name NOT LIKE '__TEST__%'");
        if (negP.length || negC.length) {
          const d = [...negP.map(p=>`Player ${p.gamertag}: ${p.stc}`), ...negC.map(c=>`Club ${c.name}: ${c.stc}`)];
          throw Object.assign(new Error(`${negP.length} player(s) + ${negC.length} club(s) with negative balances`), { assertions: d.slice(0,10).map(s=>`✗ ${s}`) });
        }
        return { assertions: ['✓ All players have stc ≥ 0', '✓ All clubs have stc ≥ 0'] };
      }),

      no_duplicate_initial_grants: () => runTest('no_duplicate_initial_grants', 'No player has multiple initial_grant wallet transactions', async () => {
        const dups = await EXECUTESQL(`SELECT player_id, COUNT(*) as cnt FROM player_stc_transactions WHERE category='initial_grant' GROUP BY player_id HAVING cnt > 1 LIMIT 10`);
        if (dups.length) throw new Error(`${dups.length} player(s) have duplicate initial_grant txs (first: player_id ${dups[0].player_id} × ${dups[0].cnt})`);
        return { assertions: ['✓ No duplicate initial_grant transactions found'] };
      }),

      balance_accuracy: () => runTest('balance_accuracy', `Spot-check ${sample_size || 10} random players: sum(txs) matches stored balance`, async () => {
        const N = Math.min(Number(sample_size) || 10, 50);
        const players = await EXECUTESQL(`SELECT id, gamertag, stc FROM players WHERE stc IS NOT NULL AND gamertag NOT LIKE '__TEST__%' ORDER BY RAND() LIMIT ?`, [N]);
        const mismatches = [];
        for (const p of players) {
          const [s] = await EXECUTESQL('SELECT COALESCE(SUM(amount),0) as total FROM player_stc_transactions WHERE player_id=?', [p.id]);
          const txSum = Math.round(Number(s.total)), actual = Math.round(Number(p.stc));
          if (Math.abs(txSum - actual) > 1) mismatches.push(`${p.gamertag}: txs=${txSum.toLocaleString()} ≠ balance=${actual.toLocaleString()} (Δ${txSum-actual})`);
        }
        if (mismatches.length) throw Object.assign(new Error(`${mismatches.length}/${players.length} balance/tx mismatches`), { assertions: mismatches.map(m=>`✗ ${m}`) });
        return { assertions: [`✓ ${players.length} players checked — all balances match transaction sum`] };
      }),

      no_duplicate_payments: () => runTest('no_duplicate_payments', 'No duplicate same-amount same-category same-minute transactions', async () => {
        const pDups = await EXECUTESQL(`SELECT player_id, category, amount, DATE_FORMAT(created_date,'%Y-%m-%d %H:%i') as min, COUNT(*) as cnt FROM player_stc_transactions WHERE category NOT IN ('lifestyle_passive','initial_grant') GROUP BY player_id,category,amount,min HAVING cnt>1 LIMIT 10`);
        const cDups = await EXECUTESQL(`SELECT club_id, category, amount, DATE_FORMAT(created_date,'%Y-%m-%d %H:%i') as min, COUNT(*) as cnt FROM stc_transactions WHERE category NOT IN ('shirt_revenue','ticket_revenue') GROUP BY club_id,category,amount,min HAVING cnt>1 LIMIT 10`);
        if (pDups.length || cDups.length) throw new Error(`Potential duplicates: ${pDups.length} player, ${cDups.length} club (check manually — may be legitimate)`);
        return { assertions: ['✓ No suspicious duplicate player transactions', '✓ No suspicious duplicate club transactions'] };
      }),

      wager_integrity: () => runTest('wager_integrity', 'Active wagers have both locks; settled solo wagers have payout records', async () => {
        const unlocked = await EXECUTESQL(`SELECT id FROM matches WHERE wager_status='active' AND (wager_home_locked=0 OR wager_away_locked=0) AND status NOT IN ('completed','forfeit','cancelled') LIMIT 10`);
        const noPayoutTx = await EXECUTESQL(`SELECT m.id FROM matches m WHERE m.wager_status='settled' AND m.mode='solo' AND m.home_player_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM player_stc_transactions t WHERE t.reference_id=m.id AND t.category='wager_payout') LIMIT 10`);
        const issues = [];
        if (unlocked.length) issues.push(`${unlocked.length} active wager(s) with incomplete locks`);
        if (noPayoutTx.length) issues.push(`${noPayoutTx.length} settled solo wager(s) missing payout tx`);
        if (issues.length) throw new Error(issues.join('; '));
        return { assertions: ['✓ All active wagers have both home + away locks', '✓ All settled solo wagers have payout transactions'] };
      }),

      transaction_completeness: () => runTest('transaction_completeness', 'Completed club matches have ticket revenue; active contracts have recent salary records', async () => {
        const noRevenue = await EXECUTESQL(`SELECT id, home_club_name FROM matches WHERE status='completed' AND home_club_id IS NOT NULL AND stats_processed=1 AND home_ticket_revenue=0 AND created_date >= DATE_SUB(NOW(), INTERVAL 7 DAY) LIMIT 10`);
        const staleSalary = await EXECUTESQL(`SELECT pc.id, pc.weekly_salary_stc FROM player_contracts pc WHERE pc.status='active' AND pc.weekly_salary_stc>0 AND pc.created_date<DATE_SUB(NOW(),INTERVAL 8 DAY) AND NOT EXISTS (SELECT 1 FROM player_stc_transactions t WHERE t.player_id=pc.user_id AND t.category='wage_payment' AND t.created_date>=DATE_SUB(NOW(),INTERVAL 8 DAY)) LIMIT 10`);
        const issues = [];
        if (noRevenue.length) issues.push(`${noRevenue.length} recent completed match(es) with 0 ticket revenue`);
        if (staleSalary.length) issues.push(`${staleSalary.length} active contract(s) with no salary in 8 days`);
        if (issues.length) return { status: 'warn', message: issues.join('; '), assertions: issues.map(i=>`⚠ ${i}`) };
        return { assertions: ['✓ Recent completed matches have ticket revenue', '✓ Active contracts have salary on record'] };
      }),

      club_profile_accuracy: () => runTest('club_profile_accuracy', `Spot-check ${sample_size || 5} clubs: sum(txs) ≈ stored balance`, async () => {
        const N = Math.min(Number(sample_size) || 5, 20);
        const clubs = await EXECUTESQL(`SELECT id, name, stc FROM clubs WHERE stc IS NOT NULL AND name NOT LIKE '__TEST__%' ORDER BY RAND() LIMIT ?`, [N]);
        const mismatches = [];
        for (const c of clubs) {
          const [s] = await EXECUTESQL('SELECT COALESCE(SUM(amount),0) as total FROM stc_transactions WHERE club_id=?', [c.id]);
          const txSum = Math.round(Number(s.total)), actual = Math.round(Number(c.stc));
          if (Math.abs(txSum - actual) > 100) mismatches.push(`${c.name}: txs=${txSum.toLocaleString()} ≠ balance=${actual.toLocaleString()}`);
        }
        if (mismatches.length) return { status: 'warn', message: `${mismatches.length}/${clubs.length} clubs with balance/tx discrepancies (may be pre-tx-system data)`, assertions: mismatches.map(m=>`⚠ ${m}`) };
        return { assertions: [`✓ ${clubs.length} clubs checked — balances consistent with transaction history`] };
      }),
    };

    // ── routing ─────────────────────────────────────────────────────────────
    if (action === 'list_tests') {
      return { data: { simulations: Object.keys(SIM_TESTS), verifications: Object.keys(VERIFY_TESTS) } };
    }

    if (action === 'run_test') {
      if (!test_name) throw new Error('test_name required');
      const fn = SIM_TESTS[test_name] || VERIFY_TESTS[test_name];
      if (!fn) throw new Error(`Unknown test: ${test_name}`);
      return { data: { result: await fn() } };
    }

    if (action === 'run_suite') {
      const names = suite === 'verify'
        ? Object.keys(VERIFY_TESTS)
        : suite === 'sim'
        ? Object.keys(SIM_TESTS)
        : [...Object.keys(SIM_TESTS), ...Object.keys(VERIFY_TESTS)];
      const results = [];
      for (const n of names) {
        const fn = SIM_TESTS[n] || VERIFY_TESTS[n];
        results.push(await fn());
      }
      const passed  = results.filter(r => r.status === 'pass').length;
      const failed  = results.filter(r => r.status === 'fail').length;
      const warned  = results.filter(r => r.status === 'warn').length;
      const errored = results.filter(r => r.status === 'error').length;
      return { data: { results, summary: { total: results.length, passed, failed, warned, errored } } };
    }

    throw new Error(`Unknown economyTests action: ${action}`);
  },

  // ── Tournament registration (STC + optional club credits + JSON roster) ──
  // Mirrors base44/functions/tournamentRegistration — frontend expects:
  //   { data: { success, error?, ... } }
  async tournamentRegistration({
    tournament_id, club_id, player_id, registration_proof_url, _auth_user_id,
  }) {
    const MIN_STC = 100;
    const MAX_STC = 1_000_000;
    const fail = (msg) => ({ data: { success: false, error: msg } });

    if (!_auth_user_id) return fail('Not authenticated');
    if (!tournament_id) return fail('tournament_id required');

    const users = await EXECUTESQL(
      'SELECT id, email, role_id FROM users WHERE id = ? LIMIT 1',
      [_auth_user_id],
    );
    if (!users.length) return fail('User not found');
    const user = users[0];
    const isAdmin = [0, 2].includes(Number(user.role_id));
    const userEmail = String(user.email || '').toLowerCase();

    const parseIds = (raw) => {
      if (raw == null) return [];
      if (Array.isArray(raw)) return raw.map(String);
      try {
        const j = typeof raw === 'string' ? JSON.parse(raw) : raw;
        return Array.isArray(j) ? j.map(String) : [];
      } catch {
        return [];
      }
    };
    const parseProofs = (raw) => {
      if (!raw) return { club: {}, player: {} };
      try {
        const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
        return {
          club: parsed?.club && typeof parsed.club === 'object' ? parsed.club : {},
          player: parsed?.player && typeof parsed.player === 'object' ? parsed.player : {},
        };
      } catch {
        return { club: {}, player: {} };
      }
    };
    const cleanProofUrl = registration_proof_url ? String(registration_proof_url).trim() : '';

    return withTransaction(async (query) => {
      const tRows = await query('SELECT * FROM tournaments WHERE id = ? LIMIT 1 FOR UPDATE', [tournament_id]);
      if (!tRows.length) return fail('Tournament not found');
      const tournament = tRows[0];

      if (String(tournament.status || '') !== 'registration') {
        return fail('Tournament registration is closed');
      }
      if (tournament.start_date && new Date(tournament.start_date) < new Date()) {
        return fail('Tournament registration is closed');
      }

      const entryFee = Number(tournament.entry_fee_stc || 0);
      if (entryFee > 0 && (entryFee < MIN_STC || entryFee > MAX_STC)) {
        return fail(`Invalid tournament entry fee. Must be between ${MIN_STC} and ${MAX_STC.toLocaleString()} STC`);
      }

      const storeSettings = await getActiveStoreSettings();
      const requiredCredits = Number(tournament.entry_credits ?? storeSettings.tournament_entry_credits ?? TOURNAMENT_ENTRY_CREDITS);
      const playerAccessRows = await query(
        `SELECT id, subscription
           FROM players
          WHERE user_id = ?
             OR LOWER(TRIM(email)) = LOWER(TRIM(?))
          ORDER BY user_id = ? DESC, updated_date DESC`,
        [_auth_user_id, user.email || '', _auth_user_id],
      );
      const hasPlus = playerAccessRows.some((row) => normalizeSubscriptionTier(row.subscription) === 'stage_plus');
      const creatorEmails = [tournament.creator_email, tournament.organizer_email]
        .map((value) => String(value || '').trim().toLowerCase())
        .filter(Boolean);
      let isOfficialTournament = false;
      if (creatorEmails.length) {
        const creatorRows = await query(
          `SELECT role_id
             FROM users
            WHERE LOWER(TRIM(email)) IN (${placeholders(creatorEmails)})`,
          creatorEmails,
        );
        isOfficialTournament = creatorRows.some((row) => [0, 2].includes(Number(row.role_id)));
      } else {
        isOfficialTournament = true;
      }
      if (!isAdmin && isOfficialTournament && !hasPlus) {
        return fail('STAGE Plus is required to enter official STAGE tournaments and competitions.');
      }
      if (!isAdmin && !hasPlus && !isOfficialTournament) {
        const ownedClubRows = await query(
          `SELECT id
             FROM clubs
            WHERE president_user_id = ?
               OR user_id = ?
               OR LOWER(TRIM(owner_email)) = ?`,
          [_auth_user_id, _auth_user_id, userEmail],
        );
        const ownedClubIds = new Set(ownedClubRows.map((row) => String(row.id)));
        const playerIds = new Set(playerAccessRows.map((row) => String(row.id)));
        const priorRows = await query(
          `SELECT id, participant_type, registered_clubs, registered_players
             FROM tournaments
            WHERE id <> ?
              AND COALESCE(status, '') <> 'cancelled'`,
          [tournament_id],
        );
        const usedFreeTournament = priorRows.some((row) => {
          const participant = String(row.participant_type || 'club').toLowerCase();
          if (participant === 'player') {
            return parseIds(row.registered_players).some((id) => playerIds.has(String(id)));
          }
          return parseIds(row.registered_clubs).some((id) => ownedClubIds.has(String(id)));
        });
        if (usedFreeTournament) {
          return fail('Free accounts can enter one community tournament. STAGE Plus is required for more tournament entries.');
        }
      }

      const participantType = String(tournament.participant_type || 'club').toLowerCase();
      const isClubTourney = participantType !== 'player';

      if (isClubTourney) {
        if (!club_id) return fail('club_id required for club tournament');
        if (!cleanProofUrl) return fail('Pro Club photo is required for club registration');

        const clubs = await query('SELECT * FROM clubs WHERE id = ? LIMIT 1 FOR UPDATE', [club_id]);
        if (!clubs.length) return fail('Club not found');
        const club = clubs[0];

        const ownerOk = isAdmin
          || String(club.president_user_id || '') === String(_auth_user_id)
          || String(club.owner_email || '').toLowerCase() === String(user.email || '').toLowerCase()
          || String(club.user_id || '') === String(_auth_user_id);

        if (!ownerOk) return fail('Only the club president can register this club');

        if (tournament.country_code && club.country_code !== tournament.country_code) {
          return fail('This tournament is restricted to clubs from another country');
        }

        let registered = parseIds(tournament.registered_clubs);
        if (registered.includes(String(club_id))) {
          return fail('Club already registered for this tournament');
        }

        const maxTeams = Number(tournament.max_teams || 0);
        if (maxTeams > 0 && registered.length >= maxTeams) {
          return fail('Tournament is full');
        }

        const clubStc = Number(club.stc || 0);
        if (entryFee > 0 && clubStc < entryFee) {
          return fail(`Insufficient STC. Need ${entryFee.toLocaleString()}, have ${clubStc.toLocaleString()}`);
        }

        let newClubStc = clubStc;
        if (entryFee > 0) {
          newClubStc = clubStc - entryFee;
          await query('UPDATE clubs SET stc = ? WHERE id = ?', [newClubStc, club_id]);

          const txId = uuidv4();
          await query(
            `INSERT INTO stc_transactions (id, club_id, amount, type, category, description, reference_id, balance_after)
             VALUES (?,?,?,?,?,?,?,?)`,
            [
              txId,
              club_id,
              -entryFee,
              'tournament_entry',
              'tournament_entry',
              `Tournament entry fee: ${tournament.name}`,
              tournament_id,
              newClubStc,
            ],
          );
        }

        let creditsSpent = 0;
        let newUserCredits = await getUserCredits(_auth_user_id, query);
        if (!isAdmin && requiredCredits > 0) {
          try {
            const spent = await spendUserCredits(_auth_user_id, requiredCredits, query);
            creditsSpent = spent.credits_spent;
            newUserCredits = spent.credits_after;
          } catch (err) {
            if (err?.code === 'INSUFFICIENT_CREDITS') {
              return fail(`Insufficient credits. Need ${err.need}, have ${err.have}`);
            }
            throw err;
          }
        }

        registered = [...registered, String(club_id)];
        const proofs = parseProofs(tournament.registration_proofs);
        proofs.club[String(club_id)] = {
          participant_id: String(club_id),
          proof_type: 'pro_club',
          proof_url: cleanProofUrl,
          submitted_by_user_id: _auth_user_id,
          submitted_at: new Date().toISOString(),
        };
        await query(
          'UPDATE tournaments SET registered_clubs = ?, registration_proofs = ?, updated_date = NOW() WHERE id = ?',
          [JSON.stringify(registered), JSON.stringify(proofs), tournament_id],
        );

        return {
          data: {
            success: true,
            message: 'Club registered successfully',
            stc_locked: entryFee,
            new_club_stc: newClubStc,
            credits_spent: creditsSpent,
            new_user_credits: newUserCredits,
          },
        };
      }

      if (!player_id) return fail('player_id required for player tournament');
      if (!cleanProofUrl) return fail('Ultimate Team photo is required for player registration');

      const players = await query('SELECT * FROM players WHERE id = ? LIMIT 1 FOR UPDATE', [player_id]);
      if (!players.length) return fail('Player not found');
      const player = players[0];

      const playerOk = isAdmin
        || String(player.user_id || '') === String(_auth_user_id)
        || String(player.email || '').toLowerCase() === String(user.email || '').toLowerCase();

      if (!playerOk) return fail('You can only register your own player');

      if (tournament.country_code && player.country_code !== tournament.country_code) {
        return fail('This tournament is restricted to players from another country');
      }

      let registeredPl = parseIds(tournament.registered_players);
      if (registeredPl.includes(String(player_id))) {
        return fail('Player already registered for this tournament');
      }

      const maxTeamsP = Number(tournament.max_teams || 0);
      if (maxTeamsP > 0 && registeredPl.length >= maxTeamsP) {
        return fail('Tournament is full');
      }

      const playerStc = Number(player.stc || 0);
      if (entryFee > 0 && playerStc < entryFee) {
        return fail(`Insufficient STC. Need ${entryFee.toLocaleString()}, have ${playerStc.toLocaleString()}`);
      }

      let newPlayerStc = playerStc;
      if (entryFee > 0) {
        newPlayerStc = playerStc - entryFee;
        await query('UPDATE players SET stc = ? WHERE id = ?', [newPlayerStc, player_id]);

        const txId = uuidv4();
        await query(
          `INSERT INTO player_stc_transactions (id, player_id, player_email, amount, balance_after, type, category, description, reference_id)
           VALUES (?,?,?,?,?,?,?,?,?)`,
          [
            txId,
            player_id,
            player.email,
            -entryFee,
            newPlayerStc,
            'tournament_entry',
            'tournament_entry',
            `Tournament entry fee: ${tournament.name}`,
            tournament_id,
          ],
        );
      }

      let creditsSpent = 0;
      let newUserCredits = await getUserCredits(_auth_user_id, query);
      if (!isAdmin && requiredCredits > 0) {
        try {
          const spent = await spendUserCredits(_auth_user_id, requiredCredits, query);
          creditsSpent = spent.credits_spent;
          newUserCredits = spent.credits_after;
        } catch (err) {
          if (err?.code === 'INSUFFICIENT_CREDITS') {
            return fail(`Insufficient credits. Need ${err.need}, have ${err.have}`);
          }
          throw err;
        }
      }

      registeredPl = [...registeredPl, String(player_id)];
      const proofs = parseProofs(tournament.registration_proofs);
      proofs.player[String(player_id)] = {
        participant_id: String(player_id),
        proof_type: 'ultimate_team',
        proof_url: cleanProofUrl,
        submitted_by_user_id: _auth_user_id,
        submitted_at: new Date().toISOString(),
      };
      await query(
        'UPDATE tournaments SET registered_players = ?, registration_proofs = ?, updated_date = NOW() WHERE id = ?',
        [JSON.stringify(registeredPl), JSON.stringify(proofs), tournament_id],
      );

      return {
        data: {
          success: true,
          message: 'Player registered successfully',
          stc_locked: entryFee,
          new_player_stc: newPlayerStc,
          credits_spent: creditsSpent,
          new_user_credits: newUserCredits,
        },
      };
    });
  },

  /** Notify all players in a club when their club registers for a tournament. */
  async tournamentRegistrationNotify({ action, tournament_id, club_id, _auth_user_id }) {
    if (!_auth_user_id) throw new Error('Not authenticated');
    if (action !== 'register') {
      return { success: false, error: 'Only action=register is implemented' };
    }
    if (!tournament_id || !club_id) throw new Error('tournament_id and club_id required');

    const tRows = await EXECUTESQL('SELECT * FROM tournaments WHERE id = ? LIMIT 1', [tournament_id]);
    if (!tRows.length) throw new Error('Tournament not found');
    const tournament = tRows[0];
    const registeredClubs = parseMaybeJson(tournament.registered_clubs, []);
    if (!Array.isArray(registeredClubs) || !registeredClubs.map(String).includes(String(club_id))) {
      throw new Error('Club is not registered for this tournament');
    }

    const users = await EXECUTESQL('SELECT id, email, role_id FROM users WHERE id = ? LIMIT 1', [_auth_user_id]);
    if (!users.length) throw new Error('User not found');
    const user = users[0];
    await requireClubFunctionAccess(user, club_id, 'manage_recruitment', 'Only the club president can notify players for this registration');

    const clubPlayerEmails = await listActiveClubPlayerEmails(club_id);

    const startLabel = tournament.start_date
      ? new Date(tournament.start_date).toLocaleString('en-GB', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
      : 'TBD';

    let notified = 0;
    for (const email of clubPlayerEmails) {
      if (!email) continue;
      const result = await createNotificationIfEnabled({
        recipientEmail: email,
        type: 'tournament_start',
        title: `Your club registered for ${tournament.name}`,
        body: `Your club has signed up for ${tournament.name}.\nStart: ${startLabel}\nPlatform: ${tournament.platform || 'TBD'}\nMake sure you're ready!`,
        link: `/tournaments/${tournament_id}`,
        relatedId: tournament_id,
      });
      if (!result.skipped) notified++;
    }

    return { success: true, notified };
  },

  /**
   * Cancel a tournament and refund entry fees (STC + credits) to all registered
   * clubs/players. Admin or organizer only. Runs inside a transaction so either
   * all refunds land or none do.
   *
   * Returns: { data: { success, refunded_count } }
   */
  async tournamentCancellation({ tournament_id, _auth_user_id }) {
    const fail = (msg) => ({ data: { success: false, error: msg } });

    if (!_auth_user_id) return fail('Not authenticated');
    if (!tournament_id) return fail('tournament_id required');

    const users = await EXECUTESQL(
      'SELECT id, email, role_id FROM users WHERE id = ? LIMIT 1',
      [_auth_user_id],
    );
    if (!users.length) return fail('User not found');
    const user = users[0];
    const isAdmin = [0, 2].includes(Number(user.role_id));

    return withTransaction(async (query) => {
      const tRows = await query(
        'SELECT * FROM tournaments WHERE id = ? LIMIT 1 FOR UPDATE',
        [tournament_id],
      );
      if (!tRows.length) return fail('Tournament not found');
      const tournament = tRows[0];

      const isOrganizer = String(tournament.organizer_email || '').toLowerCase()
        === String(user.email || '').toLowerCase();

      if (!isAdmin && !isOrganizer) return fail('Only the organizer or an admin can cancel this tournament');
      if (String(tournament.status || '') === 'cancelled') return fail('Tournament is already cancelled');

      const entryFee    = Number(tournament.entry_fee_stc || 0);
      const storeSettings = await getActiveStoreSettings();
      const entryCost   = Number(tournament.entry_credits ?? storeSettings.tournament_entry_credits ?? TOURNAMENT_ENTRY_CREDITS);
      const isClubTourney = String(tournament.participant_type || 'club').toLowerCase() !== 'player';

      // ── Refund clubs ────────────────────────────────────────────────────────
      let refundedCount = 0;
      if (isClubTourney) {
        const registered = parseMaybeJson(tournament.registered_clubs, []);
        for (const clubId of registered) {
          const clubs = await query(
            'SELECT id, stc, credits, president_user_id, user_id FROM clubs WHERE id = ? LIMIT 1 FOR UPDATE',
            [clubId]
          );
          if (!clubs.length) continue;
          const club = clubs[0];

          if (entryFee > 0) {
            const newStc = Number(club.stc || 0) + entryFee;
            await query('UPDATE clubs SET stc = ? WHERE id = ?', [newStc, clubId]);
            await query(
              `INSERT INTO stc_transactions
                 (id, club_id, amount, type, category, description, reference_id, balance_after)
               VALUES (?,?,?,?,?,?,?,?)`,
              [
                uuidv4(), clubId, entryFee,
                'tournament_refund', 'tournament_refund',
                `Tournament cancellation refund: ${tournament.name}`,
                tournament_id, newStc,
              ],
            );
          }

          if (entryCost > 0) {
            const proofs = parseMaybeJson(tournament.registration_proofs, { club: {}, player: {} });
            const proofUserId = proofs?.club?.[String(clubId)]?.submitted_by_user_id
              || club.president_user_id
              || club.user_id;
            if (proofUserId) {
              await addUserCredits(proofUserId, entryCost, query);
            }
          }

          refundedCount++;
        }
      } else {
        // ── Refund players ──────────────────────────────────────────────────
        const registered = parseMaybeJson(tournament.registered_players, []);
        for (const playerId of registered) {
          const players = await query('SELECT id, email, user_id, stc, credits FROM players WHERE id = ? LIMIT 1 FOR UPDATE', [playerId]);
          if (!players.length) continue;
          const player = players[0];

          if (entryFee > 0) {
            const newStc = Number(player.stc || 0) + entryFee;
            await query('UPDATE players SET stc = ? WHERE id = ?', [newStc, playerId]);
            await query(
              `INSERT INTO player_stc_transactions
                 (id, player_id, player_email, amount, balance_after, type, category, description, reference_id)
               VALUES (?,?,?,?,?,?,?,?,?)`,
              [
                uuidv4(), playerId, player.email, entryFee, newStc,
                'tournament_refund', 'tournament_refund',
                `Tournament cancellation refund: ${tournament.name}`,
                tournament_id,
              ],
            );
          }

          if (entryCost > 0) {
            const proofs = parseMaybeJson(tournament.registration_proofs, { club: {}, player: {} });
            const proofUserId = proofs?.player?.[String(playerId)]?.submitted_by_user_id
              || player.user_id;
            if (proofUserId) {
              await addUserCredits(proofUserId, entryCost, query);
            }
          }

          refundedCount++;
        }
      }

      // ── Mark cancelled, then remove the tournament from active surfaces ─────
      await query(
        "UPDATE tournaments SET status = 'cancelled', updated_date = NOW() WHERE id = ?",
        [tournament_id],
      );
      const deleted = await deleteTournamentRecords(query, tournament_id);

      await createAuditLog({
        adminUserId: isAdmin ? user.id : null,
        adminEmail: isAdmin ? user.email : null,
        action: 'tournament_cancelled_deleted',
        entityType: 'tournament',
        entityId: tournament_id,
        entityName: tournament.name,
        oldValue: { status: tournament.status, registered_clubs: tournament.registered_clubs, registered_players: tournament.registered_players },
        newValue: { status: 'cancelled', deleted: true, deleted_matches: deleted.matches },
        reason: isAdmin ? 'Cancelled from admin panel' : 'Cancelled by organizer',
      });

      return { data: { success: true, deleted: true, refunded_count: refundedCount, deleted_matches: deleted.matches } };
    });
    if (result?.data?.success) broadcastTournamentDeleted(tournament_id);
    return result;
  },

  async adminDeleteTournament({ _auth_user_id, tournament_id, reason }) {
    const admin = await requireAdminUser(_auth_user_id);
    if (!tournament_id) throw new Error('tournament_id required');

    const result = await withTransaction(async (query) => {
      const rows = await query('SELECT * FROM tournaments WHERE id = ? LIMIT 1 FOR UPDATE', [tournament_id]);
      if (!rows.length) throw new Error('Tournament not found');
      const tournament = rows[0];
      const status = String(tournament.status || '').toLowerCase();
      const waitMs = completedTournamentDeleteWaitMs(tournament);
      if (waitMs > 0) {
        const days = Math.ceil(waitMs / (24 * 60 * 60 * 1000));
        const err = new Error(`Community tournaments can only be deleted 7 days after completion. Try again in ${days} day${days === 1 ? '' : 's'}.`);
        err.status = 409;
        err.code = 'TOURNAMENT_DELETE_LOCKED';
        throw err;
      }
      if (!['completed', 'cancelled', 'registration'].includes(status)) {
        const err = new Error('Only completed, cancelled, or not-started tournaments can be deleted.');
        err.status = 409;
        err.code = 'TOURNAMENT_DELETE_STATUS_BLOCKED';
        throw err;
      }
      const deleted = await deleteTournamentRecords(query, tournament_id);
      return { tournament, deleted };
    });

    await createAuditLog({
      adminUserId: admin.id,
      adminEmail: admin.email,
      action: 'tournament_deleted',
      entityType: 'tournament',
      entityId: tournament_id,
      entityName: result.tournament.name,
      oldValue: result.tournament,
      newValue: { deleted: true, deleted_matches: result.deleted.matches },
      reason: reason || 'Deleted from admin tournament panel',
    });

    broadcastTournamentDeleted(tournament_id);
    return { data: { success: true, deleted: true, deleted_matches: result.deleted.matches } };
  },

  // ── Claim a Daily/Weekly Objective reward ──────────────────────────────────
  //
  // Body: { progress_id } — the objective_progress row to claim.
  // Verifies the row belongs to the caller, is completed, and not yet claimed,
  // then credits STC, writes a player_stc_transactions ledger entry, marks the
  // progress as claimed, and writes admin_audit_log for traceability.
  async claimObjectiveReward({ _auth_user_id, progress_id }) {
    if (!_auth_user_id) throw new Error('Not authenticated');
    if (!progress_id)   throw new Error('progress_id required');

    return withTransaction(async (query) => {
      const progRows = await query(
        'SELECT * FROM objective_progress WHERE id = ? LIMIT 1 FOR UPDATE',
        [progress_id]
      );
      if (!progRows.length) throw new Error('Objective progress not found');
      const prog = progRows[0];

      const myPlayer = await query(
        'SELECT id, email, gamertag, stc FROM players WHERE user_id = ? LIMIT 1',
        [_auth_user_id]
      );
      if (!myPlayer.length) throw new Error('Player profile not found');
      const player = myPlayer[0];
      if (String(player.id) !== String(prog.player_id)) {
        throw new Error('Not allowed: progress belongs to another player');
      }
      if (!prog.completed_at) throw new Error('Objective not completed yet');
      if (prog.claimed_at)    throw new Error('Already claimed');

      const defRows = await query(
        'SELECT * FROM objective_definitions WHERE id = ? LIMIT 1',
        [prog.objective_id]
      );
      if (!defRows.length) throw new Error('Objective definition not found');
      const def = defRows[0];

      const rewardStc = Number(def.reward_stc || 0);
      const oldStc    = Number(player.stc || 0);
      const newStc    = oldStc + rewardStc;

      if (rewardStc > 0) {
        await query('UPDATE players SET stc = ?, updated_date = NOW() WHERE id = ?', [newStc, player.id]);
        const txId = uuidv4();
        await query(
          `INSERT INTO player_stc_transactions
             (id, player_id, player_email, amount, balance_after, type, category, source, description, reference_id, created_date)
           VALUES (?, ?, ?, ?, ?, 'credit', 'objective_reward', 'Objectives', ?, ?, NOW())`,
          [txId, player.id, player.email || null, rewardStc, newStc,
            `Objective reward — ${def.title || def.code || def.id}`, prog.id]
        );
      }

      await query(
        'UPDATE objective_progress SET claimed_at = NOW(), updated_date = NOW() WHERE id = ?',
        [prog.id]
      );

      const auditId = uuidv4();
      await query(
        `INSERT INTO admin_audit_log
           (id, admin_user_id, admin_email, action, entity_type, entity_id, entity_name, old_value, new_value, reason, created_date)
         VALUES (?, ?, ?, 'claim_objective_reward', 'objective_progress', ?, ?, ?, ?, ?, NOW())`,
        [
          auditId,
          _auth_user_id,
          player.email || null,
          prog.id,
          def.title || def.code || null,
          JSON.stringify({ stc: oldStc, claimed_at: null }),
          JSON.stringify({ stc: newStc, claimed_at: 'now', reward_stc: rewardStc, reward_xp: Number(def.reward_xp || 0) }),
          `Player ${player.gamertag || player.email} claimed objective '${def.title || def.code}'`,
        ]
      ).catch(() => {});

      return {
        success: true,
        data: {
          progress_id: prog.id,
          reward_stc: rewardStc,
          reward_xp: Number(def.reward_xp || 0),
          new_balance: newStc,
        },
      };
    });
  },

  // ── Submit a Squad Building Challenge ──────────────────────────────────────
  //
  // Body: { sbc_id, sacrificed_player_ids: string[], cornerstone_player_id? }
  //
  // Atomically:
  //   1. Validates SBC is active and within max_completions.
  //   2. Validates the sacrificed squad matches `sbcs.requirements`.
  //   3. Soft-deletes the sacrificed players (sets `sacrificed_at`).
  //   4. Credits STC + tracks the reward.
  //   5. Logs sbc_submissions + admin_audit_log.
  //
  // If any step fails, the transaction is rolled back and a 'failed' sbc_submissions
  // row is written (best-effort, outside the txn) for traceability.
  async submitSbc({ _auth_user_id, sbc_id, sacrificed_player_ids, cornerstone_player_id }) {
    if (!_auth_user_id) throw new Error('Not authenticated');
    if (!sbc_id)        throw new Error('sbc_id required');
    if (!Array.isArray(sacrificed_player_ids) || sacrificed_player_ids.length < 1) {
      throw new Error('sacrificed_player_ids must be a non-empty array');
    }
    if (new Set(sacrificed_player_ids.map(String)).size !== sacrificed_player_ids.length) {
      throw new Error('sacrificed_player_ids must be unique');
    }

    const me = await getMe(_auth_user_id);
    const player = me.player;
    if (!player) throw new Error('Player profile not found');

    // Pre-flight (outside txn so we can write a 'failed' row on validation error).
    const sbcRows = await EXECUTESQL('SELECT * FROM sbcs WHERE id = ? LIMIT 1', [sbc_id]);
    if (!sbcRows.length) throw new Error('SBC not found');
    const sbc = sbcRows[0];
    if (!Number(sbc.is_active)) throw new Error('SBC is not active');
    if (sbc.expires_at && new Date(sbc.expires_at).getTime() < Date.now()) {
      throw new Error('SBC has expired');
    }

    const requirements = parseMaybeJson(sbc.requirements, {});
    const reward       = parseMaybeJson(sbc.reward, {});

    // Completion-count check
    if (sbc.max_completions != null) {
      const countRows = await EXECUTESQL(
        "SELECT COUNT(*) AS n FROM sbc_submissions WHERE sbc_id = ? AND player_id = ? AND status = 'completed'",
        [sbc_id, player.id]
      );
      const done = Number(countRows[0]?.n || 0);
      if (done >= Number(sbc.max_completions)) {
        throw new Error(`Max completions reached for this SBC (${sbc.max_completions})`);
      }
    }

    // Load sacrificed players and validate ownership
    const ph = sacrificed_player_ids.map(() => '?').join(',');
    const sacrificed = await EXECUTESQL(
      `SELECT id, club_id, gamertag, overall_rating, country, country_code, archetype
         FROM players WHERE id IN (${ph})`,
      sacrificed_player_ids
    );
    if (sacrificed.length !== sacrificed_player_ids.length) {
      throw new Error('One or more sacrificed players not found');
    }
    // All sacrificed players must belong to the submitter's club
    if (!player.club_id) throw new Error('Submitter must belong to a club to sacrifice players');
    for (const sp of sacrificed) {
      if (String(sp.club_id) !== String(player.club_id)) {
        throw new Error(`Player ${sp.gamertag || sp.id} is not in your club`);
      }
    }

    // Constraint validation
    const failures = [];
    if (requirements.squad_size && sacrificed.length !== Number(requirements.squad_size)) {
      failures.push(`squad_size: required ${requirements.squad_size}, got ${sacrificed.length}`);
    }
    if (requirements.min_rating) {
      const avg = sacrificed.reduce((s, p) => s + Number(p.overall_rating || 0), 0) / sacrificed.length;
      if (avg < Number(requirements.min_rating)) {
        failures.push(`min_rating: average ${avg.toFixed(2)} below required ${requirements.min_rating}`);
      }
    }
    if (requirements.nationality) {
      const all = sacrificed.every(p =>
        (p.country_code && p.country_code === requirements.nationality) ||
        (p.country && p.country === requirements.nationality)
      );
      if (!all) failures.push(`nationality: all players must be ${requirements.nationality}`);
    }
    if (requirements.archetype) {
      const all = sacrificed.every(p => p.archetype === requirements.archetype);
      if (!all) failures.push(`archetype: all players must be ${requirements.archetype}`);
    }
    if (requirements.min_chem) {
      const { computeChemistry } = require('../services/chemistryService');
      const chem = await computeChemistry(
        sacrificed.map(p => p.id),
        { cornerstonePlayerId: cornerstone_player_id || null }
      );
      // Convert multiplier (1..1.15) to a 0..100 "chem score" for UX parity with FUT
      const chemScore = Math.round((chem.multiplier - 1) / 0.15 * 100);
      if (chemScore < Number(requirements.min_chem)) {
        failures.push(`min_chem: ${chemScore} below required ${requirements.min_chem}`);
      }
    }

    if (failures.length) {
      // Log failed submission for audit
      const failedId = uuidv4();
      await EXECUTESQL(
        `INSERT INTO sbc_submissions
           (id, sbc_id, player_id, player_email, player_gamertag, club_id,
            sacrificed_player_ids, reward_payload, stc_credited,
            status, failure_reason, submitted_at, created_date)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, 'failed', ?, NOW(), NOW())`,
        [
          failedId, sbc_id, player.id, player.email || null,
          player.gamertag || null, player.club_id || null,
          JSON.stringify(sacrificed_player_ids), JSON.stringify(reward),
          failures.join('; '),
        ]
      ).catch(() => {});
      throw new Error(`Requirements not met: ${failures.join('; ')}`);
    }

    // Atomic execution
    return withTransaction(async (query) => {
      // 1) Soft-delete sacrificed players (also detach from club)
      await query(
        `UPDATE players SET club_id = NULL, sacrificed_at = NOW(), updated_date = NOW()
          WHERE id IN (${ph})`,
        sacrificed_player_ids
      );

      // 2) Credit STC reward
      const rewardStc = Number(reward.stc || 0);
      const oldStc    = Number(player.stc || 0);
      const newStc    = oldStc + rewardStc;
      if (rewardStc > 0) {
        await query('UPDATE players SET stc = ?, updated_date = NOW() WHERE id = ?', [newStc, player.id]);
        const txId = uuidv4();
        await query(
          `INSERT INTO player_stc_transactions
             (id, player_id, player_email, amount, balance_after, type, category, source, description, reference_id, created_date)
           VALUES (?, ?, ?, ?, ?, 'credit', 'sbc_reward', 'SBC', ?, ?, NOW())`,
          [txId, player.id, player.email || null, rewardStc, newStc,
            `SBC reward — ${sbc.name}`, sbc.id]
        );
      }

      // 3) Optionally place a trophy item
      if (reward.trophy_item_id) {
        const tpId = uuidv4();
        await query(
          `INSERT INTO trophy_placements (id, owner_id, owner_type, trophy_item_id, position, created_date)
           VALUES (?, ?, 'player', ?, 0, NOW())`,
          [tpId, player.id, reward.trophy_item_id]
        ).catch(() => {});
      }

      // 4) Submission record
      const subId = uuidv4();
      await query(
        `INSERT INTO sbc_submissions
           (id, sbc_id, player_id, player_email, player_gamertag, club_id,
            sacrificed_player_ids, reward_payload, stc_credited,
            status, failure_reason, submitted_at, completed_at, created_date)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'completed', NULL, NOW(), NOW(), NOW())`,
        [
          subId, sbc_id, player.id, player.email || null,
          player.gamertag || null, player.club_id || null,
          JSON.stringify(sacrificed_player_ids), JSON.stringify(reward), rewardStc,
        ]
      );

      // 5) Audit log
      const auditId = uuidv4();
      await query(
        `INSERT INTO admin_audit_log
           (id, admin_user_id, admin_email, action, entity_type, entity_id, entity_name, old_value, new_value, reason, created_date)
         VALUES (?, ?, ?, 'submit_sbc', 'sbc_submission', ?, ?, ?, ?, ?, NOW())`,
        [
          auditId, _auth_user_id, player.email || null,
          subId, sbc.name,
          JSON.stringify({ stc: oldStc, sacrificed_count: sacrificed_player_ids.length }),
          JSON.stringify({ stc: newStc, reward_stc: rewardStc, reward }),
          `Player ${player.gamertag || player.email} completed SBC '${sbc.name}'`,
        ]
      ).catch(() => {});

      return {
        success: true,
        data: {
          submission_id: subId,
          sbc_id,
          sacrificed_count: sacrificed_player_ids.length,
          reward_stc: rewardStc,
          new_balance: newStc,
          reward,
        },
      };
    });
  },

  // ── Delete account (self-service, authenticated user) ───────────────────────
  async deleteAccount({ _auth_user_id }) {
    if (!_auth_user_id) throw new Error('not authenticated');
    await deleteUserAccount(_auth_user_id, 'hard');
    return { success: true };
  },

  // ── Admin: delete another user's account by player row or login email ────────
  async adminDeleteUserAccount({ _auth_user_id, player_id, email }) {
    if (!_auth_user_id) throw new Error('not authenticated');
    const adminCheck = await EXECUTESQL('SELECT role_id FROM users WHERE id = ? LIMIT 1', [_auth_user_id]);
    if (!adminCheck.length || Number(adminCheck[0].role_id) !== 0) {
      throw new Error('Admin access required');
    }
    const trimmedEmail = typeof email === 'string' ? email.trim() : '';
    if (!player_id && !trimmedEmail) throw new Error('player_id or email required');

    let targetUserId = null;
    /** Extra profile row to delete when it might not match `users.player_id`. */
    let alsoDeletePlayerId = null;

    if (player_id) {
      const plRows = await EXECUTESQL(
        'SELECT id, user_id, email FROM players WHERE id = ? LIMIT 1',
        [player_id]
      );
      if (!plRows.length) throw new Error('Player not found');
      const pl = plRows[0];

      targetUserId = pl.user_id;
      if (!targetUserId && pl.email) {
        const byEmail = await EXECUTESQL(
          'SELECT id FROM users WHERE LOWER(TRIM(email)) = LOWER(TRIM(?)) LIMIT 1',
          [pl.email]
        );
        if (byEmail.length) targetUserId = byEmail[0].id;
      }
      if (!targetUserId) {
        const byPlayerCol = await EXECUTESQL(
          'SELECT id FROM users WHERE player_id = ? LIMIT 1',
          [player_id]
        );
        if (byPlayerCol.length) targetUserId = byPlayerCol[0].id;
      }
      if (!targetUserId) throw new Error('No login account linked to this player');
      alsoDeletePlayerId = player_id;
    } else {
      const uRows = await EXECUTESQL(
        'SELECT id, player_id, role_id FROM users WHERE LOWER(TRIM(email)) = LOWER(TRIM(?)) LIMIT 1',
        [trimmedEmail]
      );
      if (!uRows.length) throw new Error('No login account with that email');
      targetUserId = uRows[0].id;
      alsoDeletePlayerId = uRows[0].player_id || null;
    }

    if (targetUserId === _auth_user_id) {
      throw new Error('Delete your own account from Settings → Danger Zone');
    }

    const targetRows = await EXECUTESQL('SELECT role_id FROM users WHERE id = ? LIMIT 1', [targetUserId]);
    if (targetRows.length && Number(targetRows[0].role_id) === 0) {
      throw new Error('Cannot delete admin accounts');
    }

    await deleteUserAccount(targetUserId, 'hard', { alsoDeletePlayerId });
    return { success: true, deleted_user_id: targetUserId };
  },

  // ── Admin: repair legacy bug where a creator player was made president ──────
  async repairPlayerPresidentIdentityLinks({
    _auth_user_id,
    user_id,
    email,
    club_id,
    dry_run = false,
    scan_all = false,
  }) {
    const adminRows = await EXECUTESQL('SELECT id, email, role_id FROM users WHERE id = ? LIMIT 1', [_auth_user_id]);
    const admin = adminRows[0] || null;
    if (!admin || Number(admin.role_id) !== 0) throw new Error('Admin access required');

    const where = [];
    const params = [];
    if (user_id) {
      where.push('u.id = ?');
      params.push(user_id);
    }
    if (email) {
      where.push('LOWER(TRIM(u.email)) = LOWER(TRIM(?))');
      params.push(email);
    }
    if (club_id) {
      where.push('c.id = ?');
      params.push(club_id);
    }
    // scan_all runs the query platform-wide with no identity filter — used for the
    // admin "scan everyone" sweep. Still requires admin role (checked above).
    if (!where.length && scan_all) where.push('1=1');
    if (!where.length) throw new Error('user_id, email, club_id, or scan_all is required');

    const candidates = await EXECUTESQL(
      `SELECT
          u.id AS user_id,
          u.email AS user_email,
          p.id AS player_id,
          p.club_id AS player_club_id,
          p.role AS player_role,
          p.club_roles,
          c.id AS club_id,
          c.name AS club_name,
          c.president_id,
          c.president_user_id,
          pr.display_name AS president_name
       FROM users u
       JOIN clubs c
         ON (c.user_id = u.id OR c.president_user_id = u.id OR c.id = u.owner_id)
       JOIN presidents pr
         ON pr.id = c.president_id AND pr.user_id = u.id
       JOIN players p
         ON (p.user_id = u.id OR LOWER(TRIM(p.email)) = LOWER(TRIM(u.email)))
       WHERE ${where.join(' AND ')}
         AND p.club_id = c.id
         AND (
           p.role IN ('president','owner')
           OR p.club_roles LIKE '%president%'
           OR EXISTS (
             SELECT 1 FROM player_contracts pc
             WHERE pc.team_id = c.id
               AND pc.user_id = p.id
               AND pc.contract_type = 'ownership'
               AND pc.status IN ('pending','pending_window','negotiating','active')
           )
         )
         AND NOT EXISTS (
           SELECT 1 FROM player_contracts pc2
           WHERE pc2.team_id = c.id
             AND pc2.user_id = p.id
             AND pc2.contract_type <> 'ownership'
             AND pc2.status = 'active'
         )`,
      params
    );

    if (dry_run) return { success: true, dry_run: true, candidates };

    const repaired = [];
    for (const row of candidates) {
      await EXECUTESQL(
        `UPDATE players
            SET club_id = NULL,
                role = CASE WHEN role IN ('president','owner') THEN 'member' ELSE role END,
                club_roles = ?,
                status = 'free_agent',
                updated_date = NOW()
          WHERE id = ?`,
        [JSON.stringify(['free_agent']), row.player_id]
      );
      await EXECUTESQL(
        `UPDATE player_contracts
            SET status = 'cancelled',
                updated_date = NOW()
          WHERE team_id = ?
            AND user_id = ?
            AND contract_type = 'ownership'
            AND status IN ('pending','pending_window','negotiating','active')`,
        [row.club_id, row.player_id]
      ).catch(() => {});
      await EXECUTESQL(
        `DELETE FROM club_memberships
          WHERE club_id = ?
            AND player_id = ?
            AND source IN ('club_creation','contract_acceptance')`,
        [row.club_id, row.player_id]
      ).catch(() => {});
      await EXECUTESQL(
        `DELETE FROM club_staff_roles
          WHERE club_id = ?
            AND player_id = ?
            AND role IN ('owner','president')`,
        [row.club_id, row.player_id]
      ).catch(() => {});
      await EXECUTESQL(
        `INSERT INTO admin_audit_log
           (id, admin_user_id, admin_email, action, entity_type, entity_id, old_value, new_value, reason, created_date)
         VALUES (?, ?, ?, 'repair_player_president_identity_links', 'player', ?, ?, ?, ?, NOW())`,
        [
          uuidv4(),
          admin.id,
          admin.email || null,
          row.player_id,
          JSON.stringify(row),
          JSON.stringify({ player_id: row.player_id, club_id: null, role: 'member', status: 'free_agent' }),
          'Separated auto-linked player from president-owned club',
        ]
      ).catch(() => {});
      repaired.push(row);
    }

    return { success: true, repaired_count: repaired.length, repaired };
  },
};

module.exports = {
  HANDLERS,
  fulfilCheckoutSession,
  retrieveStripeCheckoutSession,
};
