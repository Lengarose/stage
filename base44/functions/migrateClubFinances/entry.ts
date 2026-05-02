/**
 * migrateClubFinances — one-time migration to fix existing clubs with incorrect starting balances.
 * Clubs with stc < 100,000 (clearly wrong) get corrected to 8,000,000.
 * Also reseeds lifestyle items with correct pricing.
 * Admin only.
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

const CORRECT_STC = 8_000_000;
const CORRECT_WAGE_BUDGET = 2_000_000;
const CORRECT_TRANSFER_BUDGET = 20_000_000;

const LIFESTYLE_ITEMS = [
  { name: "Apartment",       category: "real_estate", subcategory: "apartment",  description: "A modern city apartment. Generates passive STC income.",                  price_stc: 500_000,    rent_price_stc: 8_000,   can_rent: true,  passive_income_stc: 2_000,  passive_income_interval_days: 3, emoji: "🏠", tier: "starter",  sort_order: 1,  is_active: true },
  { name: "City House",      category: "real_estate", subcategory: "house",      description: "A spacious house in a sought-after neighbourhood.",                        price_stc: 1_500_000,  rent_price_stc: 25_000,  can_rent: true,  passive_income_stc: 8_000,  passive_income_interval_days: 3, emoji: "🏡", tier: "mid",      sort_order: 2,  is_active: true },
  { name: "Airbnb Property", category: "real_estate", subcategory: "airbnb",     description: "Investment property generating consistent rental income.",                 price_stc: 3_000_000,  rent_price_stc: 40_000,  can_rent: true,  passive_income_stc: 15_000, passive_income_interval_days: 2, emoji: "🛎️", tier: "premium",  sort_order: 3,  is_active: true },
  { name: "Penthouse",       category: "real_estate", subcategory: "penthouse",  description: "Top-floor penthouse with panoramic city views and private terrace.",       price_stc: 5_000_000,  rent_price_stc: 60_000,  can_rent: true,  passive_income_stc: 20_000, passive_income_interval_days: 3, emoji: "🌆", tier: "elite",    sort_order: 4,  is_active: true },
  { name: "Luxury Villa",    category: "real_estate", subcategory: "mansion",    description: "Stunning villa with private pool and landscaped garden.",                  price_stc: 12_000_000, rent_price_stc: 120_000, can_rent: true,  passive_income_stc: 40_000, passive_income_interval_days: 3, emoji: "🏰", tier: "luxury",   sort_order: 5,  is_active: true },
  { name: "Hatchback",   category: "vehicle", subcategory: "basic car",  description: "A reliable and practical daily driver.",                               price_stc: 30_000,     rent_price_stc: 2_000,  can_rent: true,  passive_income_stc: 0, passive_income_interval_days: 0, emoji: "🚗", tier: "starter",  sort_order: 10, is_active: true },
  { name: "Luxury Bike", category: "vehicle", subcategory: "bike",       description: "High-performance motorcycle. Speed and style on two wheels.",          price_stc: 50_000,     rent_price_stc: 3_500,  can_rent: true,  passive_income_stc: 0, passive_income_interval_days: 0, emoji: "🏍️", tier: "mid",      sort_order: 11, is_active: true },
  { name: "SUV",         category: "vehicle", subcategory: "suv",        description: "Premium large SUV with all-terrain capability and luxury interior.",   price_stc: 100_000,    rent_price_stc: 7_000,  can_rent: true,  passive_income_stc: 0, passive_income_interval_days: 0, emoji: "🚙", tier: "mid",      sort_order: 12, is_active: true },
  { name: "Sports Car",  category: "vehicle", subcategory: "sports car", description: "Sleek two-door performance car. Turn heads everywhere you go.",        price_stc: 350_000,    rent_price_stc: 20_000, can_rent: true,  passive_income_stc: 0, passive_income_interval_days: 0, emoji: "🏎️", tier: "premium",  sort_order: 13, is_active: true },
  { name: "Supercar",    category: "vehicle", subcategory: "supercar",   description: "The pinnacle of automotive engineering. Pure performance.",            price_stc: 1_500_000,  rent_price_stc: 80_000, can_rent: true,  passive_income_stc: 0, passive_income_interval_days: 0, emoji: "⚡", tier: "elite",    sort_order: 14, is_active: true },
  { name: "Designer Outfit",         category: "clothing", subcategory: "designer",      description: "Premium tailored fashion for match days and press conferences.",  price_stc: 15_000,  rent_price_stc: 0, can_rent: false, passive_income_stc: 0, passive_income_interval_days: 0, emoji: "👔", tier: "starter", sort_order: 20, is_active: true },
  { name: "Custom Boots",            category: "clothing", subcategory: "designer",      description: "Bespoke football boots crafted to your specification.",           price_stc: 40_000,  rent_price_stc: 0, can_rent: false, passive_income_stc: 0, passive_income_interval_days: 0, emoji: "👟", tier: "mid",     sort_order: 21, is_active: true },
  { name: "Luxury Brand Collection", category: "clothing", subcategory: "luxury brands", description: "Full wardrobe from prestigious fictional luxury houses.",          price_stc: 200_000, rent_price_stc: 0, can_rent: false, passive_income_stc: 0, passive_income_interval_days: 0, emoji: "👜", tier: "premium", sort_order: 22, is_active: true },
  { name: "Exclusive Drops",         category: "clothing", subcategory: "exclusive",     description: "Ultra-rare limited edition streetwear. Only for the elite.",      price_stc: 750_000, rent_price_stc: 0, can_rent: false, passive_income_stc: 0, passive_income_interval_days: 0, emoji: "💎", tier: "luxury",  sort_order: 23, is_active: true },
  { name: "Pet Dog",      category: "extras", subcategory: "pets",         description: "A loyal companion. Man's best friend.",                     price_stc: 5_000,      rent_price_stc: 0, can_rent: false, passive_income_stc: 0, passive_income_interval_days: 0, emoji: "🐕", tier: "starter", sort_order: 30, is_active: true },
  { name: "Luxury Watch", category: "extras", subcategory: "luxury items", description: "Hand-crafted precision timepiece. A statement of status.",  price_stc: 80_000,     rent_price_stc: 0, can_rent: false, passive_income_stc: 0, passive_income_interval_days: 0, emoji: "⌚", tier: "mid",     sort_order: 31, is_active: true },
  { name: "Private Jet",  category: "extras", subcategory: "private jet",  description: "On-demand private aviation. Fly anywhere, any time.",        price_stc: 40_000_000, rent_price_stc: 0, can_rent: false, passive_income_stc: 0, passive_income_interval_days: 0, emoji: "✈️", tier: "elite",   sort_order: 32, is_active: true },
  { name: "Yacht",        category: "extras", subcategory: "yacht",        description: "Ocean-going luxury yacht. Navigate the seas in pure style.", price_stc: 60_000_000, rent_price_stc: 0, can_rent: false, passive_income_stc: 0, passive_income_interval_days: 0, emoji: "🛥️", tier: "elite",   sort_order: 33, is_active: true },
  { name: "Home Gym",       category: "lifestyle", subcategory: "house upgrade", description: "Professional-grade training facility at home.",           price_stc: 75_000,  rent_price_stc: 0, can_rent: false, passive_income_stc: 0, passive_income_interval_days: 0, emoji: "🏋️", tier: "mid",     sort_order: 40, is_active: true },
  { name: "Swimming Pool",  category: "lifestyle", subcategory: "pool",          description: "Install a private pool at your property.",               price_stc: 250_000, rent_price_stc: 0, can_rent: false, passive_income_stc: 0, passive_income_interval_days: 0, emoji: "🏊", tier: "premium", sort_order: 41, is_active: true },
  { name: "Personal Coach", category: "lifestyle", subcategory: "career",        description: "Private performance coach for elite-level development.", price_stc: 500_000, rent_price_stc: 0, can_rent: false, passive_income_stc: 0, passive_income_interval_days: 0, emoji: "🧠", tier: "premium", sort_order: 42, is_active: true },
  { name: "VIP Party",            category: "event", subcategory: "party",      description: "Host an exclusive private event. Social status max.",     price_stc: 100_000,   rent_price_stc: 0, can_rent: false, passive_income_stc: 0, passive_income_interval_days: 0, emoji: "🎉", tier: "mid",     sort_order: 50, is_active: true },
  { name: "Award Show",           category: "event", subcategory: "award",      description: "Attend the prestigious STAGE annual awards gala.",         price_stc: 500_000,   rent_price_stc: 0, can_rent: false, passive_income_stc: 0, passive_income_interval_days: 0, emoji: "🏆", tier: "premium", sort_order: 51, is_active: true },
  { name: "Exclusive Experience", category: "event", subcategory: "experience", description: "A once-in-a-lifetime private VIP experience.",             price_stc: 2_000_000, rent_price_stc: 0, can_rent: false, passive_income_stc: 0, passive_income_interval_days: 0, emoji: "🌟", tier: "luxury",  sort_order: 52, is_active: true },
  { name: "Youth Foundation Donation", category: "charity", subcategory: "donation", description: "Support youth football development programmes.",     price_stc: 50_000,    rent_price_stc: 0, can_rent: false, passive_income_stc: 0, passive_income_interval_days: 0, emoji: "⚽", tier: "starter", sort_order: 60, is_active: true },
  { name: "Scholarship Fund",          category: "charity", subcategory: "donation", description: "Give talented young players a chance to succeed.",   price_stc: 200_000,   rent_price_stc: 0, can_rent: false, passive_income_stc: 0, passive_income_interval_days: 0, emoji: "🎓", tier: "mid",     sort_order: 61, is_active: true },
  { name: "Community Centre",          category: "charity", subcategory: "donation", description: "Fund a community football centre for local players.", price_stc: 1_000_000, rent_price_stc: 0, can_rent: false, passive_income_stc: 0, passive_income_interval_days: 0, emoji: "🏟️", tier: "premium", sort_order: 62, is_active: true },
];

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (user?.role !== 'admin') return Response.json({ error: 'Forbidden' }, { status: 403 });

    const body = await req.json().catch(() => ({}));
    const results = { clubs_fixed: [], lifestyle_reseeded: false };

    // ── 1. Fix clubs with broken starting balance ─────────────────────────
    if (body.fix_clubs !== false) {
      const allClubs = await base44.asServiceRole.entities.Club.list(null, 500);
      for (const club of allClubs) {
        const needsStcFix = (club.stc || 0) < 100_000; // clearly wrong value
        const needsWageFix = (club.wage_budget_stc || 0) < 100_000;
        const needsTransferFix = (club.transfer_budget_stc || 0) < 100_000;

        if (needsStcFix || needsWageFix || needsTransferFix) {
          const update = {};
          if (needsStcFix) update.stc = CORRECT_STC;
          if (needsWageFix) update.wage_budget_stc = CORRECT_WAGE_BUDGET;
          if (needsTransferFix) update.transfer_budget_stc = CORRECT_TRANSFER_BUDGET;

          await base44.asServiceRole.entities.Club.update(club.id, update);
          results.clubs_fixed.push({ id: club.id, name: club.name, update });
        }
      }
    }

    // ── 2. Reseed lifestyle items with correct pricing ────────────────────
    if (body.fix_lifestyle !== false) {
      const existing = await base44.asServiceRole.entities.LifestyleItem.list(null, 200);
      if (existing.length > 0) {
        await Promise.all(existing.map(item => base44.asServiceRole.entities.LifestyleItem.delete(item.id)));
      }
      await base44.asServiceRole.entities.LifestyleItem.bulkCreate(LIFESTYLE_ITEMS);
      results.lifestyle_reseeded = true;
      results.lifestyle_count = LIFESTYLE_ITEMS.length;
    }

    return Response.json({
      success: true,
      ...results,
      summary: `Fixed ${results.clubs_fixed.length} clubs. Lifestyle items reseeded: ${results.lifestyle_reseeded}`,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});