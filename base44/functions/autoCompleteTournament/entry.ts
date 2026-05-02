import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const body = await req.json();
  const match = body.data;
  if (!match?.tournament_id) return Response.json({ skipped: 'no tournament_id' });

  const tournament = (await base44.asServiceRole.entities.Tournament.filter({ id: match.tournament_id }))[0];
  if (!tournament || tournament.status !== 'in_progress') return Response.json({ skipped: 'not in_progress' });

  // Check all matches are completed
  const allMatches = await base44.asServiceRole.entities.Match.filter({ tournament_id: match.tournament_id });
  const incomplete = allMatches.filter(m => m.status !== 'completed');
  if (incomplete.length > 0) return Response.json({ skipped: `${incomplete.length} matches remaining` });

  // Compute standings (works for league; for knockout just use winner_club_id of last match)
  const standings = {};
  for (const m of allMatches) {
    for (const [clubId, clubName] of [[m.home_club_id, m.home_club_name], [m.away_club_id, m.away_club_name]]) {
      if (!clubId) continue;
      if (!standings[clubId]) standings[clubId] = { clubId, clubName, pts: 0, gf: 0, ga: 0 };
    }
    if (!m.home_club_id || !m.away_club_id) continue;
    const hs = m.home_score ?? 0;
    const as_ = m.away_score ?? 0;
    standings[m.home_club_id].gf += hs;
    standings[m.home_club_id].ga += as_;
    standings[m.away_club_id].gf += as_;
    standings[m.away_club_id].ga += hs;
    if (hs > as_) { standings[m.home_club_id].pts += 3; }
    else if (hs === as_) { standings[m.home_club_id].pts += 1; standings[m.away_club_id].pts += 1; }
    else { standings[m.away_club_id].pts += 3; }
  }

  const sorted = Object.values(standings).sort((a, b) => {
    if (b.pts !== a.pts) return b.pts - a.pts;
    if ((b.gf - b.ga) !== (a.gf - a.ga)) return (b.gf - b.ga) - (a.gf - a.ga);
    return b.gf - a.gf;
  });
  const winner = sorted[0];

  await base44.asServiceRole.entities.Tournament.update(match.tournament_id, {
    status: 'completed',
    winner_club_id: winner.clubId,
    winner_club_name: winner.clubName,
  });

  // Award trophy + credits
  const clubs = await base44.asServiceRole.entities.Club.filter({ id: winner.clubId });
  if (clubs.length > 0) {
    const club = clubs[0];
    const winCredits = tournament.win_credits ?? 150;
    await base44.asServiceRole.entities.Club.update(winner.clubId, {
      trophies: (club.trophies || 0) + 1,
      credits: (club.credits || 0) + winCredits,
    });
  }

  return Response.json({ completed: true, winner: winner.clubName });
});