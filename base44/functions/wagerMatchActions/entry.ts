/**
 * wagerMatchActions — STC betting for PvP/Club matches.
 *
 * Actions:
 *   create_wager  — challenger locks their STC, sends invite with wager attached
 *   accept_wager  — opponent locks their STC, match becomes ready to play
 *   cancel_wager  — only before match starts (status=scheduled), refunds both sides
 *   payout_wager  — internal (called by matchKickoff on finalizeMatch), sends pot to winner
 *
 * Rules:
 *   - Min bet: 10,000 STC
 *   - Max bet: 10,000,000 STC
 *   - Funds locked immediately on create/accept
 *   - Cannot cancel once match is in_progress
 *   - Draws: full refund to both sides
 *   - No house fee (winner takes full pot)
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

const MIN_BET = 10_000;
const MAX_BET = 10_000_000;

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { action, match_id, wager_stc } = body;

    if (!action || !match_id) {
      return Response.json({ error: 'action and match_id required' }, { status: 400 });
    }

    const players = await base44.entities.Player.filter({ email: user.email });
    const player = players[0];
    if (!player) return Response.json({ error: 'Player profile not found' }, { status: 403 });

    let match;
    try {
      match = await base44.asServiceRole.entities.Match.get(match_id);
    } catch {
      return Response.json({ error: 'Match not found' }, { status: 404 });
    }
    if (!match) return Response.json({ error: 'Match not found' }, { status: 404 });

    // ─── CREATE WAGER ──────────────────────────────────────────────────────────
    if (action === 'create_wager') {
      if (!wager_stc || typeof wager_stc !== 'number') {
        return Response.json({ error: 'wager_stc required' }, { status: 400 });
      }
      if (wager_stc < MIN_BET) {
        return Response.json({ error: `Minimum bet is ${MIN_BET.toLocaleString()} STC` }, { status: 400 });
      }
      if (wager_stc > MAX_BET) {
        return Response.json({ error: `Maximum bet is ${MAX_BET.toLocaleString()} STC` }, { status: 400 });
      }
      if (match.status !== 'scheduled') {
        return Response.json({ error: 'Match must be scheduled to set a wager' }, { status: 400 });
      }
      if (match.wager_stc > 0) {
        return Response.json({ error: 'Wager already set for this match' }, { status: 400 });
      }

      // Verify this player is home side
      const isClubMatch = match.mode === 'club';
      const isHomeSide = isClubMatch
        ? match.home_club_id === player.club_id
        : match.home_player_id === player.id;
      if (!isHomeSide) {
        return Response.json({ error: 'Only the home side can initiate a wager' }, { status: 403 });
      }

      const balance = player.stc || 0;
      if (balance < wager_stc) {
        return Response.json({ error: `Insufficient STC. Need ${wager_stc.toLocaleString()}, have ${balance.toLocaleString()}` }, { status: 400 });
      }

      // Lock funds from challenger
      const newBalance = balance - wager_stc;
      await base44.asServiceRole.entities.Player.update(player.id, { stc: newBalance });

      // Mark match with wager details
      await base44.asServiceRole.entities.Match.update(match_id, {
        wager_stc,
        wager_home_locked: true,
        wager_away_locked: false,
        wager_status: 'pending_acceptance',
        wager_home_player_id: player.id,
      });

      // STC transaction log
      await base44.asServiceRole.entities.STCTransaction.create({
        player_id: player.id,
        player_email: player.email,
        amount: -wager_stc,
        type: 'wager_lock',
        description: `Wager locked for match vs ${match.away_club_name || match.away_player_name || 'Opponent'}`,
        reference_id: match_id,
      });

      return Response.json({ success: true, new_stc_balance: newBalance, wager_stc });
    }

    // ─── ACCEPT WAGER ──────────────────────────────────────────────────────────
    if (action === 'accept_wager') {
      if (!match.wager_stc || match.wager_stc <= 0) {
        return Response.json({ error: 'No wager on this match' }, { status: 400 });
      }
      if (match.wager_status !== 'pending_acceptance') {
        return Response.json({ error: 'Wager is not pending acceptance' }, { status: 400 });
      }
      if (match.status !== 'scheduled') {
        return Response.json({ error: 'Match must be scheduled to accept wager' }, { status: 400 });
      }

      // Verify this player is away side
      const isClubMatch = match.mode === 'club';
      const isAwaySide = isClubMatch
        ? match.away_club_id === player.club_id
        : match.away_player_id === player.id;
      if (!isAwaySide) {
        return Response.json({ error: 'Only the away side can accept the wager' }, { status: 403 });
      }

      const balance = player.stc || 0;
      if (balance < match.wager_stc) {
        return Response.json({ error: `Insufficient STC. Need ${match.wager_stc.toLocaleString()}, have ${balance.toLocaleString()}` }, { status: 400 });
      }

      const newBalance = balance - match.wager_stc;
      await base44.asServiceRole.entities.Player.update(player.id, { stc: newBalance });

      await base44.asServiceRole.entities.Match.update(match_id, {
        wager_away_locked: true,
        wager_status: 'active',
        wager_away_player_id: player.id,
      });

      await base44.asServiceRole.entities.STCTransaction.create({
        player_id: player.id,
        player_email: player.email,
        amount: -match.wager_stc,
        type: 'wager_lock',
        description: `Wager locked for match vs ${match.home_club_name || match.home_player_name || 'Opponent'}`,
        reference_id: match_id,
      });

      // Notify home side that wager was accepted
      const homePlayer = match.wager_home_player_id
        ? (await base44.asServiceRole.entities.Player.filter({ id: match.wager_home_player_id }))[0]
        : null;
      if (homePlayer) {
        await base44.asServiceRole.entities.Notification.create({
          recipient_email: homePlayer.email,
          type: 'announcement',
          title: `Wager accepted! ${match.wager_stc.toLocaleString()} STC locked`,
          body: `${player.gamertag} accepted the wager. Both funds are locked. Good luck!`,
          link: '/game-day',
          read: false,
        });
      }

      return Response.json({ success: true, new_stc_balance: newBalance });
    }

    // ─── DECLINE WAGER (opponent declines — refund home side) ─────────────────
    if (action === 'decline_wager') {
      if (!match.wager_stc || match.wager_status !== 'pending_acceptance') {
        return Response.json({ error: 'No pending wager to decline' }, { status: 400 });
      }

      const isClubMatch = match.mode === 'club';
      const isAwaySide = isClubMatch
        ? match.away_club_id === player.club_id
        : match.away_player_id === player.id;
      if (!isAwaySide) {
        return Response.json({ error: 'Only the away side can decline the wager' }, { status: 403 });
      }

      // Refund home side
      if (match.wager_home_player_id) {
        const homePlayers = await base44.asServiceRole.entities.Player.filter({ id: match.wager_home_player_id });
        const homePlayer = homePlayers[0];
        if (homePlayer) {
          await base44.asServiceRole.entities.Player.update(homePlayer.id, { stc: (homePlayer.stc || 0) + match.wager_stc });
          await base44.asServiceRole.entities.STCTransaction.create({
            player_id: homePlayer.id,
            player_email: homePlayer.email,
            amount: match.wager_stc,
            type: 'wager_refund',
            description: `Wager declined by opponent — refunded`,
            reference_id: match_id,
          });
        }
      }

      await base44.asServiceRole.entities.Match.update(match_id, {
        wager_status: 'declined',
        wager_stc: 0,
        wager_home_locked: false,
      });

      return Response.json({ success: true });
    }

    // ─── CANCEL WAGER (before match starts, home side only) ───────────────────
    if (action === 'cancel_wager') {
      if (match.status === 'in_progress') {
        return Response.json({ error: 'Cannot cancel wager once match is in progress' }, { status: 400 });
      }
      if (!match.wager_stc || !['pending_acceptance', 'active'].includes(match.wager_status)) {
        return Response.json({ error: 'No active wager to cancel' }, { status: 400 });
      }

      const isClubMatch = match.mode === 'club';
      const isHomeSide = isClubMatch
        ? match.home_club_id === player.club_id
        : match.home_player_id === player.id;
      if (!isHomeSide) {
        return Response.json({ error: 'Only the home side can cancel the wager' }, { status: 403 });
      }

      // Refund home player
      const newBalance = (player.stc || 0) + match.wager_stc;
      await base44.asServiceRole.entities.Player.update(player.id, { stc: newBalance });
      await base44.asServiceRole.entities.STCTransaction.create({
        player_id: player.id,
        player_email: player.email,
        amount: match.wager_stc,
        type: 'wager_refund',
        description: `Wager cancelled — refunded`,
        reference_id: match_id,
      });

      // Refund away player if already locked
      if (match.wager_away_locked && match.wager_away_player_id) {
        const awayPlayers = await base44.asServiceRole.entities.Player.filter({ id: match.wager_away_player_id });
        const awayPlayer = awayPlayers[0];
        if (awayPlayer) {
          await base44.asServiceRole.entities.Player.update(awayPlayer.id, { stc: (awayPlayer.stc || 0) + match.wager_stc });
          await base44.asServiceRole.entities.STCTransaction.create({
            player_id: awayPlayer.id,
            player_email: awayPlayer.email,
            amount: match.wager_stc,
            type: 'wager_refund',
            description: `Wager cancelled by home side — refunded`,
            reference_id: match_id,
          });
        }
      }

      await base44.asServiceRole.entities.Match.update(match_id, {
        wager_status: 'cancelled',
        wager_stc: 0,
        wager_home_locked: false,
        wager_away_locked: false,
      });

      return Response.json({ success: true, new_stc_balance: newBalance });
    }

    // ─── PAYOUT WAGER (called internally after match finalizes) ───────────────
    if (action === 'payout_wager') {
      // Only callable by admin or system (service role check)
      if (user.role !== 'admin') {
        return Response.json({ error: 'Admin only' }, { status: 403 });
      }

      if (!match.wager_stc || match.wager_status !== 'active') {
        return Response.json({ success: true, message: 'No active wager to pay out' });
      }

      const { winner_player_id, winner_club_id, home_score, away_score } = match;
      const pot = match.wager_stc * 2;
      const isDraw = home_score === away_score;

      if (isDraw) {
        // Full refund to both sides
        const refundTargets = [
          match.wager_home_player_id,
          match.wager_away_player_id,
        ].filter(Boolean);
        for (const pid of refundTargets) {
          const pArr = await base44.asServiceRole.entities.Player.filter({ id: pid });
          const p = pArr[0];
          if (p) {
            await base44.asServiceRole.entities.Player.update(p.id, { stc: (p.stc || 0) + match.wager_stc });
            await base44.asServiceRole.entities.STCTransaction.create({
              player_id: p.id,
              player_email: p.email,
              amount: match.wager_stc,
              type: 'wager_refund',
              description: `Match drawn — wager refunded`,
              reference_id: match_id,
            });
          }
        }
        await base44.asServiceRole.entities.Match.update(match_id, { wager_status: 'refunded' });
        return Response.json({ success: true, outcome: 'draw_refund' });
      }

      // Pay winner
      const winnerId = winner_player_id;
      if (!winnerId && winner_club_id) {
        // Club match wager — allocate to club balance + transfer + wage budgets
        const winnerClubs = await base44.asServiceRole.entities.Club.filter({ id: winner_club_id });
        const winnerClub = winnerClubs[0];
        if (winnerClub) {
          const wagerAllocation = {
            balance: pot,
            transfer_budget: Math.floor(pot * 0.10),
            wage_budget: Math.floor(pot * 0.05),
          };
          await base44.asServiceRole.entities.Club.update(winnerClub.id, {
            stc: (winnerClub.stc || 0) + wagerAllocation.balance,
            transfer_budget_stc: (winnerClub.transfer_budget_stc || 0) + wagerAllocation.transfer_budget,
            wage_budget_stc: (winnerClub.wage_budget_stc || 0) + wagerAllocation.wage_budget,
          });
          await base44.asServiceRole.entities.STCTransaction.create({
            club_id: winnerClub.id,
            amount: pot,
            type: 'wager_win',
            description: `Wager won! Balance +${wagerAllocation.balance}, Transfer +${wagerAllocation.transfer_budget}, Wage +${wagerAllocation.wage_budget}`,
            reference_id: match_id,
          });
        }
        await base44.asServiceRole.entities.Match.update(match_id, { wager_status: 'settled' });
        return Response.json({ success: true, outcome: 'club_wager_paid', pot, winner_club_id });
      }

      if (!winnerId) {
        // Solo player match but no winner_player_id — error
        return Response.json({ error: 'No winner determined for wager payout' }, { status: 400 });
      }

      const winnerArr = await base44.asServiceRole.entities.Player.filter({ id: winnerId });
      const winner = winnerArr[0];
      if (winner) {
        await base44.asServiceRole.entities.Player.update(winner.id, { stc: (winner.stc || 0) + pot });
        await base44.asServiceRole.entities.STCTransaction.create({
          player_id: winner.id,
          player_email: winner.email,
          amount: pot,
          type: 'wager_win',
          description: `Wager won! Full pot from match`,
          reference_id: match_id,
        });
        await base44.asServiceRole.entities.Notification.create({
          recipient_email: winner.email,
          type: 'announcement',
          title: `🏆 You won the wager! +${pot.toLocaleString()} STC`,
          body: `Congratulations! The ${pot.toLocaleString()} STC pot has been credited to your account.`,
          link: '/lifestyle',
          read: false,
        });
      }

      // Notify loser & log wager loss
      const loserId = match.wager_home_player_id === winnerId
        ? match.wager_away_player_id
        : match.wager_home_player_id;
      if (loserId) {
        const loserArr = await base44.asServiceRole.entities.Player.filter({ id: loserId });
        const loser = loserArr[0];
        if (loser) {
          const winnerName = winner?.gamertag || 'opponent';
          await base44.asServiceRole.entities.STCTransaction.create({
            player_id: loser.id,
            player_email: loser.email,
            amount: -match.wager_stc,
            type: 'wager_loss',
            description: `Wager lost against ${winnerName}`,
            reference_id: match_id,
          });
          await base44.asServiceRole.entities.Notification.create({
            recipient_email: loser.email,
            type: 'announcement',
            title: `You lost the wager (-${match.wager_stc.toLocaleString()} STC)`,
            body: `Better luck next time. Your ${match.wager_stc.toLocaleString()} STC wager was claimed by ${winnerName}.`,
            link: '/lifestyle',
            read: false,
          });
        }
      }

      await base44.asServiceRole.entities.Match.update(match_id, { wager_status: 'settled' });
      return Response.json({ success: true, outcome: 'paid_out', pot, winner_id: winnerId });
    }

    return Response.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});