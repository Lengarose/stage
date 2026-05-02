import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const { tournamentId } = await req.json();

    const tournaments = await base44.asServiceRole.entities.Tournament.filter({ id: tournamentId }, null, 1);
    const tournament = tournaments[0];
    if (!tournament) {
      return Response.json({ error: 'Tournament not found' }, { status: 404 });
    }

    const matches = await base44.asServiceRole.entities.Match.filter({ tournament_id: tournamentId });
    const currentRoundMatches = matches.filter(m => m.round === tournament.current_round);

    // Allow advancing if matches are completed OR forfeited
    const allCompleted = currentRoundMatches.every(m => ['completed', 'forfeit'].includes(m.status));
    if (!allCompleted) {
      return Response.json({
        error: 'Not all matches in current round are completed',
        completed: currentRoundMatches.filter(m => ['completed', 'forfeit'].includes(m.status)).length,
        total: currentRoundMatches.length,
      }, { status: 400 });
    }

    // Check if next round already exists
    const nextRoundMatches = matches.filter(m => m.round === tournament.current_round + 1);
    if (nextRoundMatches.length > 0) {
      return Response.json({ message: 'Next round already exists', nextRound: tournament.current_round + 1 });
    }

    let newMatches = [];
    const tType = tournament.type;

    if (tType === 'knockout' || tType === 'double_elimination') {
      const winners = currentRoundMatches
        .filter(m => m.winner_club_id)
        .map(m => ({
          id: m.winner_club_id,
          name: m.winner_club_id === m.home_club_id ? m.home_club_name : m.away_club_name,
        }));

      // Notify eliminated clubs
      const loserClubIds = currentRoundMatches
        .filter(m => m.loser_club_id || m.winner_club_id)
        .map(m => m.loser_club_id || (m.winner_club_id === m.home_club_id ? m.away_club_id : m.home_club_id))
        .filter(Boolean);

      for (const clubId of loserClubIds) {
        const players = await base44.asServiceRole.entities.Player.filter({ club_id: clubId });
        await Promise.all(players.map(p =>
          base44.asServiceRole.entities.Notification.create({
            recipient_email: p.email,
            type: 'tournament_complete',
            title: '❌ Eliminated from Tournament',
            body: `Your club has been eliminated from ${tournament.name}. Better luck next time!`,
            link: `/tournaments/${tournamentId}`,
            related_id: tournamentId,
            read: false,
          })
        ));
      }

      if (winners.length === 1) {
        // Tournament complete — crown champion
        await base44.asServiceRole.entities.Tournament.update(tournamentId, {
          status: 'completed',
          winner_club_id: winners[0].id,
          winner_club_name: winners[0].name,
        });

        // Note: win_credits are awarded by the awardTournamentWinCredits automation
        // which triggers on Tournament status -> 'completed'. Do NOT award here to avoid duplicates.

        // Notify winner club players
        const winnerPlayers = await base44.asServiceRole.entities.Player.filter({ club_id: winners[0].id });
        await Promise.all(winnerPlayers.map(p =>
          base44.asServiceRole.entities.Notification.create({
            recipient_email: p.email,
            type: 'tournament_complete',
            title: `🏆 ${winners[0].name} wins ${tournament.name}!`,
            body: `Congratulations! Your club is the tournament champion! ${winCredits > 0 ? `${winCredits} credits awarded.` : ''}`,
            link: `/tournaments/${tournamentId}`,
            related_id: tournamentId,
            read: false,
          })
        ));

        return Response.json({ message: 'Tournament completed', champion: winners[0].id });
      }

      // Pair winners for next round
      for (let i = 0; i < winners.length; i += 2) {
        if (i + 1 < winners.length) {
          newMatches.push({
            tournament_id: tournamentId,
            home_club_id: winners[i].id,
            home_club_name: winners[i].name,
            away_club_id: winners[i + 1].id,
            away_club_name: winners[i + 1].name,
            round: tournament.current_round + 1,
            type: 'knockout',
            status: 'scheduled',
            home_score: 0,
            away_score: 0,
          });
        } else {
          // Bye — odd number of winners
          newMatches.push({
            tournament_id: tournamentId,
            home_club_id: winners[i].id,
            home_club_name: winners[i].name,
            away_club_id: 'bye',
            away_club_name: 'BYE',
            round: tournament.current_round + 1,
            type: 'knockout',
            status: 'completed',
            home_score: 1,
            away_score: 0,
            winner_club_id: winners[i].id,
            winner_club_name: winners[i].name,
          });
        }
      }
    } else if (tType === 'group_stage' || tType === 'league') {
      return Response.json({ message: 'Group stage/league tournaments use standings; no next round to generate' });
    }

    // Create next round matches
    for (const m of newMatches) {
      await base44.asServiceRole.entities.Match.create(m);
    }

    // Update tournament round
    await base44.asServiceRole.entities.Tournament.update(tournamentId, {
      current_round: tournament.current_round + 1,
    });

    // Notify all participants about new round bracket
    const allClubIds = [...new Set(newMatches.flatMap(m => [m.home_club_id, m.away_club_id]).filter(id => id !== 'bye'))];
    for (const clubId of allClubIds) {
      const players = await base44.asServiceRole.entities.Player.filter({ club_id: clubId });
      await Promise.all(players.map(p =>
        base44.asServiceRole.entities.Notification.create({
          recipient_email: p.email,
          type: 'match_scheduled',
          title: `📋 Round ${tournament.current_round + 1} bracket published`,
          body: `${tournament.name} — Check your next match in the tournament bracket.`,
          link: `/tournaments/${tournamentId}`,
          related_id: tournamentId,
          read: false,
        })
      ));
    }

    return Response.json({
      success: true,
      newRound: tournament.current_round + 1,
      matchesCreated: newMatches.length,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});