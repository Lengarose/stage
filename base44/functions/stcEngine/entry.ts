/**
 * STC Engine — award STC to players/clubs based on events.
 * Call this from match completion, tournament logic, etc.
 *
 * POST body: { event_type, player_id?, club_id?, reference_id?, metadata? }
 *
 * event_type values:
 *   match_win | match_draw | match_loss
 *   tournament_win | tournament_final | tournament_participation
 *   achievement | salary | signing_bonus | transfer_fee
 *   passive_income | charity_donation | streak_bonus | admin_grant
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

// STC reward table — scaled for millions-economy with realistic player contract economy
// Players have default 0 STC (earn via play). Clubs start at 8M.
// Player contracts: ~40K-80K/month. Match rewards scale accordingly:
//   - Single match win: 5K (modest, ~0.06-0.12 months salary)
//   - Tournament wins: bulk of earning comes from large tournaments
// Main income: contracts + wagering, not matches alone.
//
// CLUB-BASED REWARDS (require player to be in a club):
//   match_win, match_draw, tournament_win, tournament_final,
//   tournament_participation, achievement, streak_bonus, passive_income
//
// PvP/INDIVIDUAL REWARDS (no club required):
//   match_loss (shows in history for context), wager_win, wager_refund
const STC_REWARDS = {
  // Club-based (require club membership)
  match_win:                 { player:   5_000,   club:   10_000,  requiresClub: true },
  match_draw:                { player:   2_000,   club:    4_000,  requiresClub: true },
  tournament_win:            { player:  50_000,   club:  100_000,  requiresClub: true },
  tournament_final:          { player:  20_000,   club:   40_000,  requiresClub: true },
  tournament_participation:  { player:   5_000,   club:   10_000,  requiresClub: true },
  achievement:               { player:  10_000,   club:         0, requiresClub: true },
  streak_bonus:              { player:  15_000,   club:         0, requiresClub: true },
  // PvP/Individual (no club required)
  match_loss:                { player:     500,   club:    1_000,  requiresClub: false },
  wager_win:                 { player:       0,   club:         0, requiresClub: false }, // pot handled separately
  wager_refund:              { player:       0,   club:         0, requiresClub: false },
};

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { event_type, player_id, club_id, reference_id, description, amount_override } = body;

    if (!event_type) return Response.json({ error: 'event_type required' }, { status: 400 });

    const results = [];

    // ─── Award to Player ───────────────────────────────────────────────────
    if (player_id) {
      const players = await base44.asServiceRole.entities.Player.filter({ id: player_id }, null, 1);
      const player = players[0];
      if (player) {
        const reward = STC_REWARDS[event_type];
        
        // Club-based rewards require club membership
        if (reward?.requiresClub && !player.club_id) {
          results.push({
            entity: 'player',
            id: player_id,
            amount: 0,
            reason: 'Club-based reward requires club membership',
            skipped: true
          });
        } else {
          let amount = amount_override;
          if (amount === undefined) {
            amount = reward?.player ?? 0;
          }

          if (amount !== 0) {
            const newStc = Math.max(0, (player.stc || 0) + amount);
            await base44.asServiceRole.entities.Player.update(player_id, { stc: newStc });

            await base44.asServiceRole.entities.STCTransaction.create({
              player_id,
              player_email: player.email,
              amount,
              type: event_type,
              description: description || `STC: ${event_type.replace(/_/g, ' ')}`,
              reference_id: reference_id || '',
            });

            results.push({ entity: 'player', id: player_id, amount, new_balance: newStc });
          }
        }
      }
    }

    // ─── Award to Club ─────────────────────────────────────────────────────
    if (club_id) {
      const clubs = await base44.asServiceRole.entities.Club.filter({ id: club_id }, null, 1);
      const club = clubs[0];
      if (club) {
        let amount = amount_override;
        if (amount === undefined) {
          amount = STC_REWARDS[event_type]?.club ?? 0;
        }

        if (amount !== 0) {
          const newStc = Math.max(0, (club.stc || 0) + amount);
          await base44.asServiceRole.entities.Club.update(club_id, { stc: newStc });

          await base44.asServiceRole.entities.STCTransaction.create({
            club_id,
            amount,
            type: event_type,
            description: description || `Club STC: ${event_type.replace(/_/g, ' ')}`,
            reference_id: reference_id || '',
          });

          results.push({ entity: 'club', id: club_id, amount, new_balance: newStc });
        }
      }
    }

    return Response.json({ success: true, results });
  } catch (error) {
    console.error('stcEngine error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});