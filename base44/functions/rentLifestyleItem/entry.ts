/**
 * rentLifestyleItem — player rents an item (real estate or vehicle).
 * Deducts first month's rent immediately.
 * Body: { item_id, location_city?, location_country?, location_emoji? }
 *
 * Rules:
 * - Player cannot rent the same item if they already have an active rental of it
 * - Player CAN own AND rent different instances (for multi-ownership items)
 * - First month's rent deducted immediately
 * - Sets rent_expiry_at = 30 days from now
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { item_id, location_city, location_country, location_emoji } = await req.json();
    if (!item_id) return Response.json({ error: 'item_id required' }, { status: 400 });

    const players = await base44.entities.Player.filter({ email: user.email });
    const player = players[0];
    if (!player) return Response.json({ error: 'Player not found' }, { status: 404 });

    const items = await base44.asServiceRole.entities.LifestyleItem.filter({ id: item_id });
    const item = items[0];
    if (!item) return Response.json({ error: 'Item not found' }, { status: 404 });
    if (!item.can_rent || !item.rent_price_stc) {
      return Response.json({ error: 'Item is not rentable' }, { status: 400 });
    }

    // Check: no existing active rental for this exact item
    const existing = await base44.entities.LifestylePurchase.filter({ player_id: player.id, item_id });
    const activeRental = existing.find(p => p.purchase_type === 'rent' && p.rent_active !== false);
    if (activeRental) {
      return Response.json({ error: 'You already have an active rental for this item' }, { status: 409 });
    }

    const rentCost = item.rent_price_stc;
    if ((player.stc || 0) < rentCost) {
      return Response.json({
        error: `Insufficient STC. Need ${rentCost.toLocaleString()} STC for first month's rent.`,
        required: rentCost,
        balance: player.stc || 0,
      }, { status: 400 });
    }

    const now = new Date();
    const expiryDate = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

    const newStc = (player.stc || 0) - rentCost;
    await base44.asServiceRole.entities.Player.update(player.id, { stc: newStc });

    // Renting a real_estate property makes it the player's residence — clear old one
    if (item.category === 'real_estate') {
      const existingResidences = await base44.entities.LifestylePurchase.filter({ player_id: player.id, is_residence: true });
      for (const r of existingResidences) {
        await base44.asServiceRole.entities.LifestylePurchase.update(r.id, { is_residence: false });
      }
    }

    const purchase = await base44.asServiceRole.entities.LifestylePurchase.create({
      player_id: player.id,
      player_email: player.email,
      player_gamertag: player.gamertag,
      item_id,
      item_name: item.name,
      item_category: item.category,
      item_subcategory: item.subcategory || '',
      item_emoji: item.emoji || '',
      item_tier: item.tier || 'starter',
      price_paid_stc: rentCost,
      purchase_type: 'rent',
      is_residence: item.category === 'real_estate',
      monthly_rent_stc: rentCost,
      last_rent_paid_at: now.toISOString(),
      rent_active: true,
      rent_expiry_at: expiryDate.toISOString(),
      location_city: location_city || '',
      location_country: location_country || '',
      location_emoji: location_emoji || '',
      current_value_stc: 0,
      upgrade_level: 0,
      upgrade_slots: [],
      is_defaulted: false,
    });

    await base44.asServiceRole.entities.STCTransaction.create({
      player_id: player.id,
      player_email: player.email,
      amount: -rentCost,
      type: 'rent_payment',
      description: `First month rent: ${item.name}${location_city ? ` (${location_city})` : ''}`,
      reference_id: purchase.id,
    });

    await base44.asServiceRole.entities.Notification.create({
      recipient_email: player.email,
      type: 'announcement',
      title: `Now renting: ${item.name}`,
      body: `${rentCost.toLocaleString()} STC/month. Rental expires ${expiryDate.toLocaleDateString('en-GB')}.`,
      link: '/lifestyle',
      read: false,
    });

    return Response.json({ success: true, new_stc_balance: newStc, purchase_id: purchase.id, expires_at: expiryDate.toISOString() });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});