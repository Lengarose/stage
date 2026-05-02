import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (user?.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    // Get all Follow records
    const follows = await base44.asServiceRole.entities.Follow.list('', 1000);
    
    let updatedCount = 0;
    let skippedCount = 0;

    for (const follow of follows) {
      // Skip if already has player_id
      if (follow.follower_player_id) {
        skippedCount++;
        continue;
      }

      // Find player by email
      const players = await base44.asServiceRole.entities.Player.filter({
        email: follow.follower_email
      });

      if (players.length > 0) {
        // Update follow with player_id
        await base44.asServiceRole.entities.Follow.update(follow.id, {
          follower_player_id: players[0].id
        });
        updatedCount++;
      }
    }

    return Response.json({
      success: true,
      updated: updatedCount,
      skipped: skippedCount,
      total: follows.length
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});