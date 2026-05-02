import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

// Handles all legitimate credit spending from the frontend (store purchases, AI generation, tournament entry)
// Uses service role to bypass field-level RLS on credits/subscription fields

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { amount, target, item_id, item_name, item_type, new_subscription } = await req.json();

    if (!amount || amount <= 0) return Response.json({ error: 'Invalid amount' }, { status: 400 });

    const players = await base44.asServiceRole.entities.Player.filter({ email: user.email }, null, 1);
    const player = players[0];
    if (!player) return Response.json({ error: 'Player profile not found' }, { status: 404 });

    if (target === 'club') {
      if (!player.club_id) return Response.json({ error: 'Not in a club' }, { status: 400 });
      const clubs = await base44.asServiceRole.entities.Club.filter({ id: player.club_id }, null, 1);
      const club = clubs[0];
      if (!club) return Response.json({ error: 'Club not found' }, { status: 404 });
      const newCredits = (club.credits || 0) - amount;
      if (newCredits < 0) return Response.json({ error: 'Not enough club credits' }, { status: 400 });
      await base44.asServiceRole.entities.Club.update(club.id, { credits: newCredits });
      return Response.json({ success: true, new_balance: newCredits, target: 'club' });
    } else {
      const newCredits = (player.credits || 0) - amount;
      if (newCredits < 0) return Response.json({ error: 'Not enough credits' }, { status: 400 });
      const updateData = { credits: newCredits };
      if (new_subscription) updateData.subscription = new_subscription;
      await base44.asServiceRole.entities.Player.update(player.id, updateData);

      // Record the purchase if it's a store item
      if (item_id && item_type) {
        await base44.asServiceRole.entities.UserPurchase.create({
          buyer_email: user.email,
          item_id,
          item_name: item_name || item_id,
          item_type,
          price_paid: amount,
        });
      }

      return Response.json({ success: true, new_balance: newCredits, target: 'player' });
    }
  } catch (error) {
    console.error('spendCredits error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});