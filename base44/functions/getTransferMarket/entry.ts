/**
 * getTransferMarket — returns players available on the transfer market.
 *
 * Returns:
 *   - free_agents: players with no club
 *   - expiring_contracts: players whose active contracts end within 14 days
 *   - available_players: players who have explicitly flagged themselves as open to offers
 *   - current_window: current transfer window state
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const [allPlayers, allContracts, windows] = await Promise.all([
      base44.asServiceRole.entities.Player.list("-updated_date", 200),
      base44.asServiceRole.entities.PlayerContract.filter({ status: "active" }),
      base44.asServiceRole.entities.TransferWindow.list("-created_date", 1),
    ]);

    const currentWindow = windows[0] || null;

    // Free agents — no club_id
    const freeAgents = allPlayers.filter(p => !p.club_id);

    // Expiring contracts — active contracts ending within 14 days
    const now = Date.now();
    const expiringContracts = allContracts.filter(c => {
      if (!c.end_date) return false;
      const daysLeft = (new Date(c.end_date).getTime() - now) / (1000 * 60 * 60 * 24);
      return daysLeft >= 0 && daysLeft <= 14;
    });

    // Enrich expiring contracts with player info
    const playerMap = Object.fromEntries(allPlayers.map(p => [p.id, p]));
    const expiringPlayers = expiringContracts.map(c => ({
      player: playerMap[c.user_id] || null,
      contract: c,
      days_left: Math.ceil((new Date(c.end_date).getTime() - now) / (1000 * 60 * 60 * 24)),
    })).filter(e => e.player);

    return Response.json({
      success: true,
      free_agents: freeAgents,
      expiring_players: expiringPlayers,
      current_window: currentWindow,
    });

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});