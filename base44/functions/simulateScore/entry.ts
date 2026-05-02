import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me();
  if (user?.role !== 'admin') return Response.json({ error: 'Forbidden' }, { status: 403 });

  const { matchId, tournamentId } = await req.json();

  const matches = await base44.asServiceRole.entities.Match.filter({ id: matchId });
  const match = matches[0];
  if (!match) return Response.json({ error: 'Match not found' }, { status: 404 });

  const homeScore = Math.floor(Math.random() * 6);
  const awayScore = Math.floor(Math.random() * 6);
  const winnerId = homeScore > awayScore ? match.home_club_id : awayScore > homeScore ? match.away_club_id : null;
  const winnerName = homeScore > awayScore ? match.home_club_name : awayScore > homeScore ? match.away_club_name : null;
  const loserId = homeScore < awayScore ? match.home_club_id : awayScore < homeScore ? match.away_club_id : null;
  const loserName = homeScore < awayScore ? match.home_club_name : awayScore < homeScore ? match.away_club_name : null;

  await base44.asServiceRole.entities.Match.update(match.id, {
    home_score: homeScore,
    away_score: awayScore,
    winner_club_id: winnerId,
    winner_club_name: winnerName,
    loser_club_id: loserId,
    loser_club_name: loserName,
    status: 'completed',
  });

  return Response.json({ success: true, homeScore, awayScore });
});