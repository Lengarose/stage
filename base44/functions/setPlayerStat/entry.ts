import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const { tournamentId, clubId, playerEmail, playerGamertag, goals, rating } = await req.json();

    // Find the match for this tournament and club
    const matches = await base44.asServiceRole.entities.Match.filter({
      tournament_id: tournamentId,
    });

    const matchForClub = matches.find(m => m.home_club_id === clubId || m.away_club_id === clubId);
    if (!matchForClub) {
      return Response.json({ error: 'No match found for this club in tournament' }, { status: 404 });
    }

    // Check if stat already exists
    const existing = await base44.asServiceRole.entities.MatchPlayerStat.filter({
      tournament_id: tournamentId,
      match_id: matchForClub.id,
      player_email: playerEmail,
    });

    if (existing.length > 0) {
      // Update existing
      await base44.asServiceRole.entities.MatchPlayerStat.update(existing[0].id, {
        goals: goals || 0,
        rating: parseFloat(rating) || 6.0,
      });
      return Response.json({ success: true, id: existing[0].id, action: 'updated' });
    } else {
      // Create new
      const stat = await base44.asServiceRole.entities.MatchPlayerStat.create({
        tournament_id: tournamentId,
        match_id: matchForClub.id,
        club_id: clubId,
        player_email: playerEmail,
        player_gamertag: playerGamertag || playerEmail,
        goals: goals || 0,
        rating: parseFloat(rating) || 6.0,
      });
      return Response.json({ success: true, id: stat.id, action: 'created' });
    }
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});