/**
 * Collect passive income from owned lifestyle items (real estate, etc.)
 * POST body: {} — uses authenticated user
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const players = await base44.entities.Player.filter({ email: user.email }, null, 1);
    const player = players[0];
    if (!player) return Response.json({ error: 'Player not found' }, { status: 404 });

    // Get all their purchases
    const purchases = await base44.entities.LifestylePurchase.filter({ player_id: player.id });
    if (purchases.length === 0) return Response.json({ collected: 0, message: 'No items owned' });

    // Get item details
    const now = new Date();
    let totalCollected = 0;
    const collected = [];

    for (const purchase of purchases) {
      const items = await base44.asServiceRole.entities.LifestyleItem.filter({ id: purchase.item_id }, null, 1);
      const item = items[0];
      if (!item || !item.passive_income_stc || item.passive_income_interval_days <= 0) continue;

      const lastCollected = purchase.last_passive_collected_at
        ? new Date(purchase.last_passive_collected_at)
        : new Date(purchase.created_date);

      const daysSince = (now - lastCollected) / (1000 * 60 * 60 * 24);
      if (daysSince < item.passive_income_interval_days) continue;

      const cycles = Math.floor(daysSince / item.passive_income_interval_days);
      const earned = cycles * item.passive_income_stc;

      // Update last collected
      await base44.asServiceRole.entities.LifestylePurchase.update(purchase.id, {
        last_passive_collected_at: now.toISOString(),
      });

      totalCollected += earned;
      collected.push({ item_name: item.name, earned });
    }

    if (totalCollected > 0) {
      const newStc = (player.stc || 0) + totalCollected;
      await base44.asServiceRole.entities.Player.update(player.id, { stc: newStc });

      await base44.asServiceRole.entities.STCTransaction.create({
        player_id: player.id,
        player_email: player.email,
        amount: totalCollected,
        type: 'passive_income',
        description: `Passive income from ${collected.length} propert${collected.length === 1 ? 'y' : 'ies'}`,
      });
    }

    return Response.json({ success: true, collected: totalCollected, items: collected });
  } catch (error) {
    console.error('collectPassiveIncome error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});