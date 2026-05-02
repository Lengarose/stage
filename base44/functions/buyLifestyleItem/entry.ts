/**
 * Buy a lifestyle item with STC.
 * POST body: { item_id, location_city?, location_country?, location_emoji?, custom_name? }
 * Multiple ownership supported for items with allows_multiple=true.
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { item_id, location_city, location_country, location_emoji, custom_name, purchase_intent } = await req.json();
    // purchase_intent: "buy_live" | "invest" (default: "invest")
    const resolvedIntent = purchase_intent === "buy_live" ? "buy_live" : "invest";
    if (!item_id) return Response.json({ error: 'item_id required' }, { status: 400 });

    const players = await base44.entities.Player.filter({ email: user.email }, null, 1);
    const player = players[0];
    if (!player) return Response.json({ error: 'Player profile not found' }, { status: 404 });

    const items = await base44.asServiceRole.entities.LifestyleItem.filter({ id: item_id }, null, 1);
    const item = items[0];
    if (!item) return Response.json({ error: 'Item not found' }, { status: 404 });
    if (!item.is_active) return Response.json({ error: 'Item not available' }, { status: 400 });

    // Only block duplicates if allows_multiple is false
    if (!item.allows_multiple) {
      const existing = await base44.entities.LifestylePurchase.filter({ player_id: player.id, item_id }, null, 1);
      if (existing[0]) return Response.json({ error: 'Already owned' }, { status: 400 });
    }

    // Location price multiplier (passed from frontend)
    const locationMultiplier = location_city ? 1.0 : 1.0; // frontend handles visual, base price is used
    const finalPrice = item.price_stc;

    const currentStc = player.stc || 0;
    if (currentStc < finalPrice) {
      return Response.json({ error: 'Insufficient STC', required: finalPrice, balance: currentStc }, { status: 400 });
    }

    const newStc = currentStc - finalPrice;
    await base44.asServiceRole.entities.Player.update(player.id, { stc: newStc });

    // If buying to live, clear any existing residence flag on other properties
    if (resolvedIntent === "buy_live") {
      const existingResidences = await base44.entities.LifestylePurchase.filter({ player_id: player.id, is_residence: true });
      for (const r of existingResidences) {
        await base44.asServiceRole.entities.LifestylePurchase.update(r.id, { is_residence: false });
      }
    }

    const purchase = await base44.entities.LifestylePurchase.create({
      player_id: player.id,
      player_email: player.email,
      player_gamertag: player.gamertag,
      item_id,
      item_name: custom_name || item.name,
      item_category: item.category,
      item_subcategory: item.subcategory || '',
      item_emoji: item.emoji || '',
      item_tier: item.tier || 'starter',
      price_paid_stc: finalPrice,
      current_value_stc: finalPrice,
      purchase_type: resolvedIntent,
      is_residence: resolvedIntent === "buy_live",
      upgrade_level: 0,
      upgrade_slots: [],
      location_city: location_city || '',
      location_country: location_country || '',
      location_emoji: location_emoji || '',
      custom_name: custom_name || '',
      weekly_maintenance_stc: item.weekly_maintenance_stc || 0,
      is_defaulted: false,
    });

    await base44.asServiceRole.entities.STCTransaction.create({
      player_id: player.id,
      player_email: player.email,
      amount: -finalPrice,
      type: 'lifestyle_purchase',
      description: `Bought: ${item.name}${location_city ? ` (${location_city})` : ''}`,
      reference_id: item_id,
    });

    return Response.json({ success: true, new_stc_balance: newStc, item_name: item.name, purchase_id: purchase.id, purchase_type: resolvedIntent });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});