import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me();
  if (user?.role !== 'admin') return Response.json({ error: 'Forbidden' }, { status: 403 });

  const { tournamentId } = await req.json();

  const matches = await base44.asServiceRole.entities.Match.filter({ tournament_id: tournamentId });
  const incomplete = matches.filter(m => m.status !== 'completed');
  if (incomplete.length > 0) {
    return Response.json({ error: `${incomplete.length} matches still not completed` }, { status: 400 });
  }

  // Compute standings
  const standings = {};
  for (const m of matches) {
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
    if (hs > as_) {
      standings[m.home_club_id].pts += 3;
    } else if (hs === as_) {
      standings[m.home_club_id].pts += 1;
      standings[m.away_club_id].pts += 1;
    } else {
      standings[m.away_club_id].pts += 3;
    }
  }

  const sorted = Object.values(standings).sort((a, b) => {
    if (b.pts !== a.pts) return b.pts - a.pts;
    if ((b.gf - b.ga) !== (a.gf - a.ga)) return (b.gf - b.ga) - (a.gf - a.ga);
    return b.gf - a.gf;
  });

  const winner = sorted[0];
  const runnerUp = sorted[1];

  const tournament = (await base44.asServiceRole.entities.Tournament.filter({ id: tournamentId }))[0];

  await base44.asServiceRole.entities.Tournament.update(tournamentId, {
    status: 'completed',
    winner_club_id: winner.clubId,
    winner_club_name: winner.clubName,
  });

  // Award trophy + credits to winner
  const winnerClubs = await base44.asServiceRole.entities.Club.filter({ id: winner.clubId });
  if (winnerClubs.length > 0) {
    const club = winnerClubs[0];
    const winCredits = tournament?.win_credits ?? 150;
    await base44.asServiceRole.entities.Club.update(winner.clubId, {
      trophies: (club.trophies || 0) + 1,
      credits: (club.credits || 0) + winCredits,
    });
  }

  // ── Pay STC Prize Pool ────────────────────────────────────────────────────
  // Helper to pay STC prize to a club
  async function payPrize(clubId, amount, label) {
    if (!clubId || !amount || amount <= 0) return;
    const clubArr = await base44.asServiceRole.entities.Club.filter({ id: clubId });
    const club = clubArr[0];
    if (!club) return;
    await base44.asServiceRole.entities.Club.update(clubId, { stc: (club.stc || 0) + amount });
    await base44.asServiceRole.entities.STCTransaction.create({
      club_id: clubId,
      amount,
      type: 'tournament_prize',
      description: `${label} — ${tournament?.name || 'Tournament'}`,
      reference_id: tournamentId,
    });
    // Notify club owner
    if (club.owner_email) {
      await base44.asServiceRole.entities.Notification.create({
        recipient_email: club.owner_email,
        type: 'tournament_complete',
        title: `🏆 Prize money: +${amount.toLocaleString()} STC`,
        body: `${label} in ${tournament?.name || 'Tournament'}.`,
        link: `/clubs/${clubId}`,
        read: false,
      });
    }
  }

  if (tournament) {
    await payPrize(winner.clubId, tournament.prize_winner_stc, '🥇 Winner');
    if (runnerUp) await payPrize(runnerUp.clubId, tournament.prize_runner_up_stc, '🥈 Runner-Up');

    // Semi-finalists: 3rd & 4th place
    if (tournament.prize_semi_final_stc > 0 && sorted.length >= 4) {
      await payPrize(sorted[2]?.clubId, tournament.prize_semi_final_stc, '🥉 Semi-Final');
      await payPrize(sorted[3]?.clubId, tournament.prize_semi_final_stc, '🥉 Semi-Final');
    }

    // Participation prizes for all others
    if (tournament.prize_participation_stc > 0) {
      const participantIds = sorted.slice(2).map(s => s.clubId);
      for (const cid of participantIds) {
        await payPrize(cid, tournament.prize_participation_stc, '🎖️ Participation');
      }
    }
  }

  return Response.json({ success: true, winner: winner.clubName, standings: sorted });
});