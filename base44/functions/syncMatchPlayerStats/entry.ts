import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const payload = await req.json();

  const matchData = payload?.data || payload;
  const matchId = matchData?.id || payload?.event?.entity_id;

  if (!matchId) {
    return Response.json({ error: 'No match ID provided' }, { status: 400 });
  }

  // Fetch the match
  const matches = await base44.asServiceRole.entities.Match.filter({ id: matchId });
  const match = matches[0];

  if (!match) {
    return Response.json({ error: 'Match not found' }, { status: 404 });
  }

  // Only process club-mode matches that are completed/confirmed and not yet processed
  if (match.participant_type === 'player' || match.mode === 'solo') {
    return Response.json({ skipped: 'Not a club match' });
  }

  if (!['completed', 'confirmed'].includes(match.status)) {
    return Response.json({ skipped: `Status is ${match.status}` });
  }

  // Idempotency guard — only process once
  if (match.stats_processed) {
    return Response.json({ skipped: 'Stats already processed' });
  }

  // Mark as processed immediately to prevent duplicate runs
  await base44.asServiceRole.entities.Match.update(matchId, { stats_processed: true });

  // Fetch all MatchPlayerStats for this match
  const stats = await base44.asServiceRole.entities.MatchPlayerStat.filter({ match_id: matchId });

  if (stats.length === 0) {
    return Response.json({ skipped: 'No player stats found for this match' });
  }

  const homeClubId = match.home_club_id;
  const awayClubId = match.away_club_id;
  const homeScore = match.home_score || 0;
  const awayScore = match.away_score || 0;

  const homeWon = homeScore > awayScore;
  const awayWon = awayScore > homeScore;
  const isDraw = homeScore === awayScore;

  // Batch-fetch all players by club (much more efficient than per-email lookups)
  const [homePlayers, awayPlayers] = await Promise.all([
    base44.asServiceRole.entities.Player.filter({ club_id: homeClubId }),
    base44.asServiceRole.entities.Player.filter({ club_id: awayClubId }),
  ]);
  const allPlayers = [...homePlayers, ...awayPlayers];
  const playerByEmail = Object.fromEntries(allPlayers.map(p => [p.email, p]));

  const updates = [];

  await Promise.all(stats.map(async (stat) => {
    const email = stat.player_email;
    if (!email) return;

    const player = playerByEmail[email];
    if (!player) return;

    const isHome = stat.club_id === homeClubId;
    const won = isHome ? homeWon : awayWon;
    const lost = isHome ? awayWon : homeWon;
    const draw = isDraw;

    const currentMatches = player.matches_played || 0;
    const newMatches = currentMatches + 1;

    // Recalculate avg_match_rating
    const currentRating = player.avg_match_rating || 6;
    const newRating = currentMatches > 0
      ? Math.round(((currentRating * currentMatches) + (stat.rating || 6)) / newMatches * 10) / 10
      : (stat.rating || 6);

    await base44.asServiceRole.entities.Player.update(player.id, {
      goals: (player.goals || 0) + (stat.goals || 0),
      assists: (player.assists || 0) + (stat.assists || 0),
      matches_played: newMatches,
      matches_played_club: (player.matches_played_club || 0) + 1,
      wins_count: (player.wins_count || 0) + (won ? 1 : 0),
      losses_count: (player.losses_count || 0) + (lost ? 1 : 0),
      draws_count: (player.draws_count || 0) + (draw ? 1 : 0),
      wins_club: (player.wins_club || 0) + (won ? 1 : 0),
      losses_club: (player.losses_club || 0) + (lost ? 1 : 0),
      draws_club: (player.draws_club || 0) + (draw ? 1 : 0),
      avg_match_rating: newRating,
    });

    updates.push({ gamertag: stat.player_gamertag, goals: stat.goals, assists: stat.assists });
  }));

  return Response.json({ success: true, updated: updates.length, players: updates });
});