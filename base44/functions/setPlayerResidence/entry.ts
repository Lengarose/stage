/**
 * setPlayerResidence — mark a LifestylePurchase as the player's active residence.
 * Clears is_residence on all other properties owned by this player first.
 * Body: { purchase_id }
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { purchase_id } = await req.json();
    if (!purchase_id) return Response.json({ error: 'purchase_id required' }, { status: 400 });

    const players = await base44.entities.Player.filter({ email: user.email });
    const player = players[0];
    if (!player) return Response.json({ error: 'Player not found' }, { status: 404 });

    // Verify ownership
    const purchases = await base44.asServiceRole.entities.LifestylePurchase.filter({ id: purchase_id });
    const purchase = purchases[0];
    if (!purchase) return Response.json({ error: 'Purchase not found' }, { status: 404 });
    if (purchase.player_id !== player.id) return Response.json({ error: 'Forbidden' }, { status: 403 });
    if (purchase.item_category !== 'real_estate') return Response.json({ error: 'Only properties can be a residence' }, { status: 400 });

    // Clear all other residences for this player
    const existing = await base44.asServiceRole.entities.LifestylePurchase.filter({ player_id: player.id, is_residence: true });
    for (const r of existing) {
      if (r.id !== purchase_id) {
        await base44.asServiceRole.entities.LifestylePurchase.update(r.id, { is_residence: false });
      }
    }

    // Set new residence
    await base44.asServiceRole.entities.LifestylePurchase.update(purchase_id, { is_residence: true });

    return Response.json({ success: true, purchase_id });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});