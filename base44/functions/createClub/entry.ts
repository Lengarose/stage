/**
 * Creates a club and links the founding player to it (service role, bypasses Player RLS).
 * POST body: { clubData, playerId }
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { clubData, playerId } = await req.json();
    if (!clubData || !playerId) return Response.json({ error: 'clubData and playerId required' }, { status: 400 });

    // Create the club
    const newClub = await base44.asServiceRole.entities.Club.create({
      ...clubData,
      owner_email: user.email,
      wins: 0, losses: 0, draws: 0, goals_scored: 0, goals_conceded: 0,
      rating: 1000, peak_rating: 1000, matches_ranked: 0, is_provisional: true,
      trophies: 0, achievements: [], status: "active", credits: 0,
      stc: 10_000_000,
      wage_budget_stc: 1_000_000,
      transfer_budget_stc: 5_000_000,
      stadium_level: 0, stadium_capacity: 20000,
      tier: "Silver", form: [], win_streak: 0, loss_streak: 0,
    });

    // Update player using service role (bypasses RLS email check)
    await base44.asServiceRole.entities.Player.update(playerId, {
      club_id: newClub.id,
      role: "captain",
      club_roles: ["president", "captain"],
      status: "active",
    });

    // Create founding ownership contract (best-effort)
    try {
      await base44.asServiceRole.entities.PlayerContract.create({
        team_id: newClub.id,
        user_id: playerId,
        offered_by: playerId,
        contract_type: "ownership",
        max_games: 999,
        max_days: 3650,
        games_played: 0,
        status: "active",
        start_date: new Date().toISOString().split("T")[0],
        salary_per_game_stc: 0,
        signing_bonus_stc: 0,
        transfer_fee_stc: 0,
      });
    } catch (contractErr) {
      console.warn("Contract creation failed (non-fatal):", contractErr.message);
    }

    return Response.json({ success: true, club: newClub });
  } catch (error) {
    console.error('createClub error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});