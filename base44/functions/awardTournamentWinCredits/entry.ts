import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json();

    const tournamentId = body?.event?.entity_id || body?.data?.id;
    if (!tournamentId) {
      return Response.json({ error: 'No tournament ID provided' }, { status: 400 });
    }

    const tournaments = await base44.asServiceRole.entities.Tournament.filter({ id: tournamentId });
    const tournament = tournaments[0];

    if (!tournament || tournament.status !== 'completed') {
      return Response.json({ skipped: true, reason: 'Not completed or no winner' });
    }

    const winCredits = tournament.win_credits ?? 150;
    const isPlayerTournament = tournament.participant_type === 'player';

    // Idempotency guard
    if (tournament.win_credits_awarded) {
      return Response.json({ skipped: true, reason: 'Credits already awarded' });
    }

    let winnerName = 'Unknown';
    let newCredits = 0;

    if (isPlayerTournament && tournament.winner_player_id) {
      const players = await base44.asServiceRole.entities.Player.filter({ id: tournament.winner_player_id });
      const winnerPlayer = players[0];
      if (!winnerPlayer) return Response.json({ error: 'Winner player not found' }, { status: 404 });
      newCredits = (winnerPlayer.credits || 0) + winCredits;
      await base44.asServiceRole.entities.Player.update(tournament.winner_player_id, { credits: newCredits });
      winnerName = winnerPlayer.gamertag;
    } else if (!isPlayerTournament && tournament.winner_club_id) {
      const clubs = await base44.asServiceRole.entities.Club.filter({ id: tournament.winner_club_id });
      const winnerClub = clubs[0];
      if (!winnerClub) return Response.json({ error: 'Winner club not found' }, { status: 404 });
      newCredits = (winnerClub.credits || 0) + winCredits;
      await base44.asServiceRole.entities.Club.update(tournament.winner_club_id, {
        credits: newCredits,
        trophies: (winnerClub.trophies || 0) + 1,
      });
      winnerName = winnerClub.name;
    } else {
      return Response.json({ skipped: true, reason: 'No winner set yet' });
    }

    await base44.asServiceRole.entities.Tournament.update(tournamentId, { win_credits_awarded: true });

    return Response.json({
      success: true,
      winner: winnerName,
      credits_awarded: winCredits,
      new_balance: newCredits,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});