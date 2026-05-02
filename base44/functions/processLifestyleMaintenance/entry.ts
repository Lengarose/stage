/**
 * processLifestyleMaintenance — runs weekly via automation.
 * Deducts maintenance from all players with assets.
 * If player can't afford → marks asset is_defaulted=true (blocks upgrades, flagged in UI).
 * Admin can also trigger manually.
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

const TIER_ORDER = ["starter", "mid", "premium", "luxury", "elite"];
function tierIndex(t) { return TIER_ORDER.indexOf(t || "starter"); }

const PROPERTY_MAINT_LINES = [
  { weeklyFraction: 0.0008, minTier: null },      // upkeep
  { weeklyFraction: 0.0012, minTier: null },      // tax
  { weeklyFraction: 0.0015, minTier: "premium" }, // staff
  { weeklyFraction: 0.0006, minTier: null },      // insurance
  { weeklyFraction: 0.0010, minTier: "luxury" },  // security
];

const VEHICLE_MAINT_LINES = [
  { weeklyFraction: 0.0015, minTier: null },      // service
  { weeklyFraction: 0.0010, minTier: null },      // insurance
  { weeklyFraction: 0.0005, minTier: null },      // fuel
  { weeklyFraction: 0.0008, minTier: "premium" }, // storage
];

function calcWeeklyMaint(basePrice, category, tier) {
  const lines = category === "vehicle" ? VEHICLE_MAINT_LINES : PROPERTY_MAINT_LINES;
  const ti = tierIndex(tier);
  const raw = lines
    .filter(l => !l.minTier || ti >= tierIndex(l.minTier))
    .reduce((s, l) => s + basePrice * l.weeklyFraction, 0);
  return Math.max(5_000, Math.round(raw / 5_000) * 5_000);
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    // Allow admin manual trigger
    let adminEmail = null;
    try {
      const user = await base44.auth.me();
      if (user && user.role !== 'admin') {
        return Response.json({ error: 'Forbidden' }, { status: 403 });
      }
      adminEmail = user?.email || null;
    } catch {
      // unauthenticated = scheduled system call — allowed
    }

    const now = new Date();
    const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    // Get all purchases that need maintenance checked
    const allPurchases = await base44.asServiceRole.entities.LifestylePurchase.list();
    const due = allPurchases.filter(p => {
      const hasMaint = (p.weekly_maintenance_stc || 0) > 0 || ["real_estate", "vehicle"].includes(p.item_category);
      if (!hasMaint) return false;
      if (!p.last_maintenance_paid_at) return true;
      return new Date(p.last_maintenance_paid_at) < oneWeekAgo;
    });

    // For any asset without weekly_maintenance_stc set, calculate and set it now
    const itemCache = {};
    for (const p of due) {
      if (!p.weekly_maintenance_stc && ["real_estate", "vehicle"].includes(p.item_category)) {
        if (!itemCache[p.item_id]) {
          const arr = await base44.asServiceRole.entities.LifestyleItem.filter({ id: p.item_id });
          itemCache[p.item_id] = arr[0];
        }
        const item = itemCache[p.item_id];
        if (item) {
          const maint = item.weekly_maintenance_stc || calcWeeklyMaint(p.price_paid_stc, p.item_category, p.item_tier || "starter");
          p.weekly_maintenance_stc = maint;
          await base44.asServiceRole.entities.LifestylePurchase.update(p.id, { weekly_maintenance_stc: maint });
        }
      }
    }

    // Group by player
    const byPlayer = {};
    for (const p of due) {
      if (!(p.player_id in byPlayer)) byPlayer[p.player_id] = [];
      byPlayer[p.player_id].push(p);
    }

    let totalProcessed = 0;
    let totalDefaulted = 0;

    for (const [playerId, playerPurchases] of Object.entries(byPlayer)) {
      const playerArr = await base44.asServiceRole.entities.Player.filter({ id: playerId });
      const player = playerArr[0];
      if (!player) continue;

      let stc = player.stc || 0;
      let totalDeducted = 0;
      const defaultedItems = [];
      const paidItems = [];

      for (const purchase of playerPurchases) {
        const cost = purchase.weekly_maintenance_stc || 0;
        if (!cost) continue;

        if (stc >= cost) {
          stc -= cost;
          totalDeducted += cost;
          paidItems.push(purchase.item_name || "Asset");
          await base44.asServiceRole.entities.LifestylePurchase.update(purchase.id, {
            last_maintenance_paid_at: now.toISOString(),
            is_defaulted: false,
          });
          totalProcessed++;
        } else {
          // Can't afford — default the asset
          defaultedItems.push(purchase.item_name || "Asset");
          await base44.asServiceRole.entities.LifestylePurchase.update(purchase.id, {
            is_defaulted: true,
          });
          totalDefaulted++;
        }
      }

      if (totalDeducted > 0) {
        await base44.asServiceRole.entities.Player.update(playerId, { stc });
        await base44.asServiceRole.entities.STCTransaction.create({
          player_id: playerId,
          player_email: player.email,
          amount: -totalDeducted,
          type: 'lifestyle_maintenance',
          description: `Weekly maintenance: ${paidItems.join(", ")}`,
          reference_id: playerId,
        });
        await base44.asServiceRole.entities.Notification.create({
          recipient_email: player.email,
          type: 'announcement',
          title: `🏠 Weekly maintenance deducted`,
          body: `${totalDeducted.toLocaleString()} STC deducted for asset maintenance across ${paidItems.length} asset(s). Open Lifestyle to view your portfolio.`,
          link: '/lifestyle',
          read: false,
        });
      }

      if (defaultedItems.length > 0) {
        await base44.asServiceRole.entities.Notification.create({
          recipient_email: player.email,
          type: 'announcement',
          title: `⚠️ ${defaultedItems.length} asset(s) defaulted — insufficient STC`,
          body: `You couldn't afford maintenance on: ${defaultedItems.join(", ")}. Defaulted assets cannot be upgraded and are flagged in your portfolio. Top up your STC to restore them on the next maintenance cycle.`,
          link: '/lifestyle',
          read: false,
        });
      }
    }

    return Response.json({ success: true, processed: totalProcessed, defaulted: totalDefaulted });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});