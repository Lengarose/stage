/**
 * distributeTournamentPrizes — Auto-distribute tournament prize pool on completion.
 *
 * Called when a tournament is marked as complete.
 * Prize pool = sum of all STC entry fees.
 * Distribution: 80% to 1st place, 20% to 2nd place.
 *
 * POST body: { tournament_id }
 */

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);

  const user = await base44.auth.me();
  if (!user || user.role !== 'admin') {
    return Response.json({ error: 'Admin only' }, { status: 403 });
  }

  const body = await req.json();
  const { tournament_id } = body;

  if (!tournament_id) {
    return Response.json({ error: 'tournament_id required' }, { status: 400 });
  }

  // Fetch tournament
  const tournaments = await base44.asServiceRole.entities.Tournament.filter({ id: tournament_id });
  const tournament = tournaments[0];
  if (!tournament) {
    return Response.json({ error: 'Tournament not found' }, { status: 404 });
  }

  if (tournament.status !== 'completed') {
    return Response.json({ error: 'Tournament is not completed' }, { status: 400 });
  }

  if (!tournament.winner_club_id && !tournament.winner_player_id) {
    return Response.json({ error: 'No tournament winner determined' }, { status: 400 });
  }

  const entryFeeSTC = tournament.entry_fee_stc || 0;
  if (entryFeeSTC === 0) {
    return Response.json({ success: true, message: 'No STC entry fee, no prizes to distribute' });
  }

  // Calculate pool: entry_fee × number of registered participants
  const isPlayerTournament = tournament.participant_type === 'player';
  const registeredCount = isPlayerTournament
    ? (tournament.registered_players || []).length
    : (tournament.registered_clubs || []).length;

  if (registeredCount === 0) {
    return Response.json({ success: true, message: 'No participants registered' });
  }

  const totalPrizePool = entryFeeSTC * registeredCount;
  const firstPlacePrize = Math.floor(totalPrizePool * 0.80);
  const secondPlacePrize = Math.floor(totalPrizePool * 0.20);

  console.log(`Tournament ${tournament.name}: Pool=${totalPrizePool}, 1st=${firstPlacePrize}, 2nd=${secondPlacePrize}`);

  // Award 1st place — allocate prize pool (100% balance + 10% transfer + 5% wage)
  if (tournament.winner_club_id) {
    const clubs = await base44.asServiceRole.entities.Club.filter({ id: tournament.winner_club_id });
    const club = clubs[0];
    if (club) {
      const prizeAllocation = {
        balance: firstPlacePrize,
        transfer_budget: Math.floor(firstPlacePrize * 0.10),
        wage_budget: Math.floor(firstPlacePrize * 0.05),
      };
      await base44.asServiceRole.entities.Club.update(club.id, {
        stc: (club.stc || 0) + prizeAllocation.balance,
        transfer_budget_stc: (club.transfer_budget_stc || 0) + prizeAllocation.transfer_budget,
        wage_budget_stc: (club.wage_budget_stc || 0) + prizeAllocation.wage_budget,
      });
      await base44.asServiceRole.entities.STCTransaction.create({
        club_id: club.id,
        amount: firstPlacePrize,
        type: 'tournament_win',
        description: `Tournament 1st place (80% of ${totalPrizePool.toLocaleString()} STC): Balance +${prizeAllocation.balance}, Transfer +${prizeAllocation.transfer_budget}, Wage +${prizeAllocation.wage_budget}`,
        reference_id: tournament_id,
      });
      console.log(`✓ Club ${club.name} awarded ${firstPlacePrize} STC for 1st place (+ budgets)`);
    }
  } else if (tournament.winner_player_id) {
    const players = await base44.asServiceRole.entities.Player.filter({ id: tournament.winner_player_id });
    const player = players[0];
    if (player) {
      const newStc = (player.stc || 0) + firstPlacePrize;
      await base44.asServiceRole.entities.Player.update(player.id, { stc: newStc });
      await base44.asServiceRole.entities.STCTransaction.create({
        player_id: player.id,
        player_email: player.email,
        amount: firstPlacePrize,
        type: 'tournament_win',
        description: `Tournament 1st place (80% of ${totalPrizePool.toLocaleString()} STC pool): ${tournament.name}`,
        reference_id: tournament_id,
      });
      console.log(`✓ Player ${player.gamertag} awarded ${firstPlacePrize} STC for 1st place`);
    }
  }

  // Award 2nd place (runner-up) — determine from final match
  const matches = await base44.asServiceRole.entities.Match.filter({ tournament_id });
  if (matches.length > 0) {
    // Get the final/highest round match
    const maxRound = Math.max(...matches.map(m => m.round));
    const finalMatch = matches.find(m => m.round === maxRound && m.status === 'completed');

    if (finalMatch && finalMatch.loser_club_id) {
      const clubs = await base44.asServiceRole.entities.Club.filter({ id: finalMatch.loser_club_id });
      const club = clubs[0];
      if (club) {
        const prizeAllocation = {
          balance: secondPlacePrize,
          transfer_budget: Math.floor(secondPlacePrize * 0.10),
          wage_budget: Math.floor(secondPlacePrize * 0.05),
        };
        await base44.asServiceRole.entities.Club.update(club.id, {
          stc: (club.stc || 0) + prizeAllocation.balance,
          transfer_budget_stc: (club.transfer_budget_stc || 0) + prizeAllocation.transfer_budget,
          wage_budget_stc: (club.wage_budget_stc || 0) + prizeAllocation.wage_budget,
        });
        await base44.asServiceRole.entities.STCTransaction.create({
          club_id: club.id,
          amount: secondPlacePrize,
          type: 'tournament_final',
          description: `Tournament 2nd place (20% of ${totalPrizePool.toLocaleString()} STC): Balance +${prizeAllocation.balance}, Transfer +${prizeAllocation.transfer_budget}, Wage +${prizeAllocation.wage_budget}`,
          reference_id: tournament_id,
        });
        console.log(`✓ Club ${club.name} awarded ${secondPlacePrize} STC for 2nd place (+ budgets)`);
      }
    } else if (finalMatch && finalMatch.loser_player_id) {
      const players = await base44.asServiceRole.entities.Player.filter({ id: finalMatch.loser_player_id });
      const player = players[0];
      if (player) {
        const newStc = (player.stc || 0) + secondPlacePrize;
        await base44.asServiceRole.entities.Player.update(player.id, { stc: newStc });
        await base44.asServiceRole.entities.STCTransaction.create({
          player_id: player.id,
          player_email: player.email,
          amount: secondPlacePrize,
          type: 'tournament_final',
          description: `Tournament 2nd place (20% of ${totalPrizePool.toLocaleString()} STC pool): ${tournament.name}`,
          reference_id: tournament_id,
        });
        console.log(`✓ Player ${player.gamertag} awarded ${secondPlacePrize} STC for 2nd place`);
      }
    }
  }

  // Mark tournament as prizes distributed
  await base44.asServiceRole.entities.Tournament.update(tournament_id, {
    prize_pool_stc: totalPrizePool,
    prize_winner_stc: firstPlacePrize,
    prize_runner_up_stc: secondPlacePrize,
  });

  return Response.json({
    success: true,
    pool: totalPrizePool,
    first_place: firstPlacePrize,
    second_place: secondPlacePrize,
  });
});