// Lifestyle item catalog — prices match backend seedLifestyleItems exactly (millions-scale economy)
export const LIFESTYLE_CATEGORIES = [
  { id: "real_estate", label: "Real Estate", emoji: "🏠" },
  { id: "vehicle", label: "Vehicles", emoji: "🚗" },
  { id: "clothing", label: "Clothing", emoji: "👕" },
  { id: "extras", label: "Extras", emoji: "🐾" },
  { id: "lifestyle", label: "Lifestyle", emoji: "🏊" },
  { id: "event", label: "Events", emoji: "🎉" },
  { id: "charity", label: "Charity", emoji: "💚" },
];

export const LIFESTYLE_TIER_STYLES = {
  starter:  { label: "Starter",  color: "text-slate-300",  bg: "bg-white/10 border-white/20" },
  mid:      { label: "Mid",      color: "text-primary",    bg: "bg-primary/10 border-primary/20" },
  premium:  { label: "Premium",  color: "text-purple-400", bg: "bg-purple-500/10 border-purple-500/20" },
  luxury:   { label: "Luxury",   color: "text-warning",    bg: "bg-warning/10 border-warning/20" },
  elite:    { label: "Elite",    color: "text-red-400",    bg: "bg-red-500/10 border-red-500/20" },
};

// Default catalog — realistic millions-scale economy (matching real football player wealth)
// These prices must stay in sync with functions/seedLifestyleItems and functions/migrateClubFinances
// ── ECONOMY SCALE ────────────────────────────────────────────────────────────
// Property buy price:  500K → 50M STC (millions scale)
// Vehicle buy price:   250K → 8M STC
// Rent:                ~4–5% of buy price per month
// Passive income:      ~0.5–1% of buy price per cycle (3 days)
// Maintenance:         calculated dynamically per tier in lib/lifestyleUpgrades.js
export const DEFAULT_LIFESTYLE_ITEMS = [
  // ── Real Estate ──────────────────────────────────────────────────────────
  { name: "Apartment",       category: "real_estate", subcategory: "apartment",  description: "A modern city apartment. Generates passive STC income.",                    price_stc: 2_000_000,   rent_price_stc: 80_000,   can_rent: true,  passive_income_stc: 15_000,  passive_income_interval_days: 3, weekly_maintenance_stc: 10_000,  tier: "starter",  sort_order: 1,  allows_multiple: true },
  { name: "City House",      category: "real_estate", subcategory: "house",      description: "A spacious house in a sought-after neighbourhood.",                          price_stc: 5_000_000,   rent_price_stc: 200_000,  can_rent: true,  passive_income_stc: 40_000,  passive_income_interval_days: 3, weekly_maintenance_stc: 25_000,  tier: "mid",      sort_order: 2,  allows_multiple: true },
  { name: "Airbnb Property", category: "real_estate", subcategory: "airbnb",     description: "Investment property generating consistent rental income.",                   price_stc: 8_000_000,   rent_price_stc: 320_000,  can_rent: true,  passive_income_stc: 80_000,  passive_income_interval_days: 2, weekly_maintenance_stc: 40_000,  tier: "premium",  sort_order: 3,  allows_multiple: true },
  { name: "Penthouse",       category: "real_estate", subcategory: "penthouse",  description: "Top-floor penthouse with panoramic city views and private terrace.",         price_stc: 18_000_000,  rent_price_stc: 700_000,  can_rent: true,  passive_income_stc: 150_000, passive_income_interval_days: 3, weekly_maintenance_stc: 90_000,  tier: "luxury",   sort_order: 4,  allows_multiple: true },
  { name: "Luxury Villa",    category: "real_estate", subcategory: "mansion",    description: "Stunning villa with private pool and landscaped garden.",                    price_stc: 50_000_000,  rent_price_stc: 2_000_000, can_rent: true, passive_income_stc: 500_000, passive_income_interval_days: 3, weekly_maintenance_stc: 250_000, tier: "elite",    sort_order: 5,  allows_multiple: true },

  // ── Vehicles ─────────────────────────────────────────────────────────────
  { name: "Hatchback",   category: "vehicle", subcategory: "basic car",  description: "A reliable and practical daily driver.",                               price_stc: 250_000,    rent_price_stc: 10_000,  can_rent: true, passive_income_stc: 0, passive_income_interval_days: 0, weekly_maintenance_stc: 3_000,   tier: "starter",  sort_order: 10, allows_multiple: true, is_rentable_vehicle: true },
  { name: "Luxury Bike", category: "vehicle", subcategory: "bike",       description: "High-performance motorcycle. Speed and style on two wheels.",          price_stc: 400_000,    rent_price_stc: 15_000,  can_rent: true, passive_income_stc: 0, passive_income_interval_days: 0, weekly_maintenance_stc: 5_000,   tier: "mid",      sort_order: 11, allows_multiple: true, is_rentable_vehicle: true },
  { name: "SUV",         category: "vehicle", subcategory: "suv",        description: "Premium large SUV with all-terrain capability and luxury interior.",   price_stc: 800_000,    rent_price_stc: 30_000,  can_rent: true, passive_income_stc: 0, passive_income_interval_days: 0, weekly_maintenance_stc: 8_000,   tier: "mid",      sort_order: 12, allows_multiple: true, is_rentable_vehicle: true },
  { name: "Sports Car",  category: "vehicle", subcategory: "sports car", description: "Sleek two-door performance car. Turn heads everywhere you go.",        price_stc: 2_000_000,  rent_price_stc: 80_000,  can_rent: true, passive_income_stc: 0, passive_income_interval_days: 0, weekly_maintenance_stc: 20_000,  tier: "premium",  sort_order: 13, allows_multiple: true, is_rentable_vehicle: true },
  { name: "Supercar",    category: "vehicle", subcategory: "supercar",   description: "The pinnacle of automotive engineering. Pure performance.",            price_stc: 8_000_000,  rent_price_stc: 320_000, can_rent: true, passive_income_stc: 0, passive_income_interval_days: 0, weekly_maintenance_stc: 80_000,  tier: "elite",    sort_order: 14, allows_multiple: true, is_rentable_vehicle: true },

  // ── Clothing ─────────────────────────────────────────────────────────────
  { name: "Designer Outfit",         category: "clothing", subcategory: "designer",      description: "Premium tailored fashion for match days and press conferences.",  price_stc: 150_000,    rent_price_stc: 0, can_rent: false, passive_income_stc: 0, passive_income_interval_days: 0, weekly_maintenance_stc: 0, tier: "starter", sort_order: 20 },
  { name: "Custom Boots",            category: "clothing", subcategory: "designer",      description: "Bespoke football boots crafted to your specification. Fans purchase exclusive versions.",           price_stc: 400_000,    rent_price_stc: 0, can_rent: false, passive_income_stc: 45_000, passive_income_interval_days: 2, weekly_maintenance_stc: 0, tier: "mid",     sort_order: 21 },
  { name: "Luxury Brand Collection", category: "clothing", subcategory: "luxury brands", description: "Full wardrobe from prestigious fictional luxury houses.",          price_stc: 2_000_000,  rent_price_stc: 0, can_rent: false, passive_income_stc: 0, passive_income_interval_days: 0, weekly_maintenance_stc: 0, tier: "premium", sort_order: 22 },
  { name: "Exclusive Drops",         category: "clothing", subcategory: "exclusive",     description: "Ultra-rare limited edition streetwear. Only for the elite.",      price_stc: 8_000_000,  rent_price_stc: 0, can_rent: false, passive_income_stc: 0, passive_income_interval_days: 0, weekly_maintenance_stc: 0, tier: "luxury",  sort_order: 23 },

  // ── Extras ───────────────────────────────────────────────────────────────
  { name: "Pet Dog",      category: "extras", subcategory: "pets",         description: "A loyal companion. Man's best friend.",                     price_stc: 50_000,       rent_price_stc: 0, can_rent: false, passive_income_stc: 0, passive_income_interval_days: 0, weekly_maintenance_stc: 0,       tier: "starter", sort_order: 30 },
  { name: "Luxury Watch", category: "extras", subcategory: "luxury items", description: "Hand-crafted precision timepiece. A statement of status.",  price_stc: 1_000_000,    rent_price_stc: 0, can_rent: false, passive_income_stc: 0, passive_income_interval_days: 0, weekly_maintenance_stc: 0,       tier: "mid",     sort_order: 31, allows_multiple: true },
  { name: "Private Jet",  category: "extras", subcategory: "private jet",  description: "On-demand private aviation. Fly anywhere, any time.",        price_stc: 80_000_000,   rent_price_stc: 3_000_000, can_rent: true, passive_income_stc: 0, passive_income_interval_days: 0, weekly_maintenance_stc: 400_000, tier: "elite",   sort_order: 32, allows_multiple: false, is_rentable_vehicle: true },
  { name: "Yacht",        category: "extras", subcategory: "yacht",        description: "Ocean-going luxury yacht. Navigate the seas in pure style.", price_stc: 120_000_000,  rent_price_stc: 5_000_000, can_rent: true, passive_income_stc: 0, passive_income_interval_days: 0, weekly_maintenance_stc: 600_000, tier: "elite",   sort_order: 33, allows_multiple: false, is_rentable_vehicle: true },

  // ── Lifestyle ────────────────────────────────────────────────────────────
  { name: "Home Gym",       category: "lifestyle", subcategory: "house upgrade", description: "Professional-grade training facility at home.",           price_stc: 500_000,   rent_price_stc: 0, can_rent: false, passive_income_stc: 0, passive_income_interval_days: 0, weekly_maintenance_stc: 0, tier: "mid",     sort_order: 40 },
  { name: "Swimming Pool",  category: "lifestyle", subcategory: "pool",          description: "Install a private pool at your property.",               price_stc: 1_500_000, rent_price_stc: 0, can_rent: false, passive_income_stc: 0, passive_income_interval_days: 0, weekly_maintenance_stc: 0, tier: "premium", sort_order: 41 },
  { name: "Personal Coach", category: "lifestyle", subcategory: "career",        description: "Private performance coach for elite-level development.", price_stc: 3_000_000, rent_price_stc: 0, can_rent: false, passive_income_stc: 0, passive_income_interval_days: 0, weekly_maintenance_stc: 0, tier: "premium", sort_order: 42 },

  // ── Events ───────────────────────────────────────────────────────────────
  { name: "VIP Party",            category: "event", subcategory: "party",      description: "Host an exclusive private event. Social status max.",     price_stc: 800_000,    rent_price_stc: 0, can_rent: false, passive_income_stc: 0, passive_income_interval_days: 0, weekly_maintenance_stc: 0, tier: "mid",     sort_order: 50 },
  { name: "Award Show",           category: "event", subcategory: "award",      description: "Attend the prestigious STAGE annual awards gala.",         price_stc: 3_000_000,  rent_price_stc: 0, can_rent: false, passive_income_stc: 0, passive_income_interval_days: 0, weekly_maintenance_stc: 0, tier: "premium", sort_order: 51 },
  { name: "Exclusive Experience", category: "event", subcategory: "experience", description: "A once-in-a-lifetime private VIP experience.",             price_stc: 10_000_000, rent_price_stc: 0, can_rent: false, passive_income_stc: 0, passive_income_interval_days: 0, weekly_maintenance_stc: 0, tier: "luxury",  sort_order: 52 },

  // ── Charity ──────────────────────────────────────────────────────────────
  { name: "Youth Foundation Donation", category: "charity", subcategory: "donation", description: "Support youth football development programmes.",     price_stc: 500_000,   rent_price_stc: 0, can_rent: false, passive_income_stc: 0, passive_income_interval_days: 0, weekly_maintenance_stc: 0, tier: "starter", sort_order: 60 },
  { name: "Scholarship Fund",          category: "charity", subcategory: "donation", description: "Give talented young players a chance to succeed.",   price_stc: 2_000_000, rent_price_stc: 0, can_rent: false, passive_income_stc: 0, passive_income_interval_days: 0, weekly_maintenance_stc: 0, tier: "mid",     sort_order: 61 },
  { name: "Community Centre",          category: "charity", subcategory: "donation", description: "Fund a community football centre for local players.", price_stc: 8_000_000, rent_price_stc: 0, can_rent: false, passive_income_stc: 0, passive_income_interval_days: 0, weekly_maintenance_stc: 0, tier: "premium", sort_order: 62 },
];