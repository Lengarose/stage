import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (user?.role !== 'admin') return Response.json({ error: 'Forbidden' }, { status: 403 });

    const { player_email, tier, billing } = await req.json();

    if (!player_email || !tier || !billing) {
      return Response.json({ error: 'Missing player_email, tier, or billing' }, { status: 400 });
    }

    const players = await base44.asServiceRole.entities.Player.filter({ email: player_email }, null, 1);
    const player = players[0];
    if (!player) return Response.json({ error: 'Player not found for email: ' + player_email }, { status: 404 });

    const monthlyCredits = tier === 'elite' ? 300 : tier === 'pro' ? 100 : 0;
    const expiresAt = new Date(Date.now() + (billing === 'yearly' ? 365 : 30) * 24 * 60 * 60 * 1000).toISOString();

    await base44.asServiceRole.entities.Player.update(player.id, {
      subscription: tier,
      subscription_expires_at: expiresAt,
      subscription_billing: billing,
      credits: (player.credits || 0) + monthlyCredits,
    });

    return Response.json({
      success: true,
      player_id: player.id,
      gamertag: player.gamertag,
      subscription: tier,
      subscription_billing: billing,
      subscription_expires_at: expiresAt,
      credits_added: monthlyCredits,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});