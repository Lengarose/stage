import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

// Matchday revenue per stadium level and result (STC)
// Level 0 = Pro Stadium, Level 1 = Elite Ground, Level 2 = Iconic Arena
const MATCHDAY_REVENUE = [
  // [win, draw, loss]
  { home: [500_000, 300_000, 150_000], away: [150_000, 80_000, 40_000] },   // Pro Stadium
  { home: [1_500_000, 900_000, 400_000], away: [400_000, 220_000, 100_000] }, // Elite Ground
  { home: [4_000_000, 2_500_000, 1_200_000], away: [1_000_000, 600_000, 300_000] }, // Iconic Arena
];

function getMatchdayRevenue(stadiumLevel, result, isHome) {
  const lvl = Math.min(Math.max(stadiumLevel || 0, 0), MATCHDAY_REVENUE.length - 1);
  const table = MATCHDAY_REVENUE[lvl];
  const idx = result === "win" ? 0 : result === "draw" ? 1 : 2;
  return isHome ? table.home[idx] : table.away[idx];
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json();

    const matchId = body?.data?.id || body?.event?.entity_id;
    if (!matchId) return Response.json({ error: "No match ID" }, { status: 400 });

    const matchArr = await base44.asServiceRole.entities.LiveMatch.filter({ id: matchId }, null, 1);
    const match = matchArr[0];
    if (!match || match.status !== "confirmed") {
      return Response.json({ skipped: true, reason: "Match not confirmed" });
    }
    if (match.stats_processed) {
      return Response.json({ skipped: true, reason: "Stats already processed" });
    }
    await base44.asServiceRole.entities.LiveMatch.update(matchId, { stats_processed: true });

    const homeScore = match.home_score || 0;
    const awayScore = match.away_score || 0;
    const homeWon = homeScore > awayScore;
    const awayWon = awayScore > homeScore;
    const isDraw = homeScore === awayScore;
    const homeResult = homeWon ? "win" : isDraw ? "draw" : "loss";
    const awayResult = awayWon ? "win" : isDraw ? "draw" : "loss";
    const isClubMatch = match.mode === "club";
    const isSoloMatch = match.mode === "solo";
    const isRanked = match.type === "ranked";
    const isTournament = match.type === "tournament";

    // Tally goals/assists per email from events
    const events = await base44.asServiceRole.entities.LiveMatchEvent.filter({ live_match_id: matchId });
    const goalsMap = {};
    for (const ev of events) {
      if (ev.scorer_email && !ev.is_own_goal) {
        if (!goalsMap[ev.scorer_email]) goalsMap[ev.scorer_email] = { goals: 0, assists: 0 };
        goalsMap[ev.scorer_email].goals += 1;
      }
      if (ev.assist_email) {
        if (!goalsMap[ev.assist_email]) goalsMap[ev.assist_email] = { goals: 0, assists: 0 };
        goalsMap[ev.assist_email].assists += 1;
      }
    }

    // Get clubs and players
    const [homeClubArr, awayClubArr, homePlayers, awayPlayers] = await Promise.all([
      base44.asServiceRole.entities.Club.filter({ id: match.home_club_id }, null, 1),
      base44.asServiceRole.entities.Club.filter({ id: match.away_club_id }, null, 1),
      base44.asServiceRole.entities.Player.filter({ club_id: match.home_club_id }),
      base44.asServiceRole.entities.Player.filter({ club_id: match.away_club_id }),
    ]);
    const homeClub = homeClubArr[0];
    const awayClub = awayClubArr[0];

    // ── Matchday Revenue ─────────────────────────────────────────────────────
    // Award on ALL match types (friendly, ranked, tournament) as long as it's a club match
    const awardMatchdayRevenue = async (club, result, isHome) => {
      if (!club) return;
      const revenue = getMatchdayRevenue(club.stadium_level || 0, result, isHome);
      const newStc = (club.stc || 0) + revenue;
      await base44.asServiceRole.entities.Club.update(club.id, { stc: newStc });
      await base44.asServiceRole.entities.STCTransaction.create({
        club_id: club.id,
        amount: revenue,
        type: "matchday_revenue",
        description: `Matchday revenue (${isHome ? "home" : "away"} ${result}) — ${["Pro Stadium","Elite Ground","Iconic Arena"][Math.min(club.stadium_level||0,2)]}`,
        reference_id: matchId,
      });
    };

    if (isClubMatch) {
      await Promise.all([
        awardMatchdayRevenue(homeClub, homeResult, true),
        awardMatchdayRevenue(awayClub, awayResult, false),
      ]);
    }

    // Update club W/D/L stats
    const updateClubStats = async (club, result, goalsFor, goalsAgainst) => {
      if (!club) return;
      const update = {
        goals_scored: (club.goals_scored || 0) + goalsFor,
        goals_conceded: (club.goals_conceded || 0) + goalsAgainst,
      };
      if (isClubMatch) {
        update.wins = (club.wins || 0) + (result === 'win' ? 1 : 0);
        update.losses = (club.losses || 0) + (result === 'loss' ? 1 : 0);
        update.draws = (club.draws || 0) + (result === 'draw' ? 1 : 0);
        const resultLetter = result === 'win' ? 'W' : result === 'loss' ? 'L' : 'D';
        update.form = [...(club.form || []), resultLetter].slice(-5);
        if (result === 'win') {
          update.win_streak = (club.win_streak || 0) + 1;
          update.loss_streak = 0;
        } else if (result === 'loss') {
          update.loss_streak = (club.loss_streak || 0) + 1;
          update.win_streak = 0;
        } else {
          update.win_streak = 0;
          update.loss_streak = 0;
        }
        update.matches_ranked = (club.matches_ranked || 0) + 1;
        update.is_provisional = update.matches_ranked < 10;
        update.last_ranked_match_date = new Date().toISOString();
      }
      await base44.asServiceRole.entities.Club.update(club.id, update);
    };

    await Promise.all([
      updateClubStats(homeClub, homeResult, homeScore, awayScore),
      updateClubStats(awayClub, awayResult, awayScore, homeScore),
    ]);

    // ELO update — ranked matches only
    if (isRanked && homeClub && awayClub) {
      const K = 32;
      const rH = homeClub.rating || 1000;
      const rA = awayClub.rating || 1000;
      const expectedH = 1 / (1 + Math.pow(10, (rA - rH) / 400));
      const actualH = homeWon ? 1 : isDraw ? 0.5 : 0;
      const newRH = Math.round(rH + K * (actualH - expectedH));
      const newRA = Math.round(rA + K * ((1 - actualH) - (1 - expectedH)));
      await Promise.all([
        base44.asServiceRole.entities.Club.update(homeClub.id, { rating: newRH, peak_rating: Math.max(homeClub.peak_rating || 1500, newRH) }),
        base44.asServiceRole.entities.Club.update(awayClub.id, { rating: newRA, peak_rating: Math.max(awayClub.peak_rating || 1500, newRA) }),
      ]);
    }

    // Contract games_played tracking
    const isOfficialClubMatch = isClubMatch && (isRanked || isTournament);
    if (isOfficialClubMatch) {
      const allPlayers = [...homePlayers, ...awayPlayers];
      await Promise.all(allPlayers.map(async (player) => {
        const activeContracts = await base44.asServiceRole.entities.PlayerContract.filter({ user_id: player.id, status: "active" });
        for (const contract of activeContracts) {
          if (contract.team_id !== match.home_club_id && contract.team_id !== match.away_club_id) continue;
          const newGames = (contract.games_played || 0) + 1;
          const meta = CONTRACT_TYPE_META[contract.contract_type];
          if (!meta) continue;
          if (newGames >= meta.max_games) {
            await base44.asServiceRole.entities.PlayerContract.update(contract.id, { games_played: newGames, status: "completed" });
            await base44.asServiceRole.entities.PlayerContractHistory.create({
              contract_id: contract.id,
              action_type: "completed",
              action_note: `Contract completed after ${newGames}/${meta.max_games} games.`,
            });
          } else {
            await base44.asServiceRole.entities.PlayerContract.update(contract.id, { games_played: newGames });
          }
        }
      }));
    }

    // Player stats update
    const updatePlayer = async (player, result, clubId) => {
      const stats = goalsMap[player.email];
      const oppGoals = clubId === match.home_club_id ? awayScore : homeScore;
      const updateData = { matches_played: (player.matches_played || 0) + 1 };

      if (stats?.goals > 0) updateData.goals = (player.goals || 0) + stats.goals;
      if (stats?.assists > 0) updateData.assists = (player.assists || 0) + stats.assists;

      if (isClubMatch) {
        updateData.matches_played_club = (player.matches_played_club || 0) + 1;
        if (result === "win") {
          updateData.wins_club = (player.wins_club || 0) + 1;
          updateData.wins_count = (player.wins_count || 0) + 1;
        } else if (result === "loss") {
          updateData.losses_club = (player.losses_club || 0) + 1;
          updateData.losses_count = (player.losses_count || 0) + 1;
        } else {
          updateData.draws_club = (player.draws_club || 0) + 1;
          updateData.draws_count = (player.draws_count || 0) + 1;
        }
      } else if (isSoloMatch) {
        if (result === "win") updateData.wins_count = (player.wins_count || 0) + 1;
        else if (result === "loss") updateData.losses_count = (player.losses_count || 0) + 1;
        else updateData.draws_count = (player.draws_count || 0) + 1;
      }

      if (['GK', 'CB', 'LB', 'RB'].includes(player.position) && oppGoals === 0) {
        updateData.clean_sheets = (player.clean_sheets || 0) + 1;
      }

      await base44.asServiceRole.entities.Player.update(player.id, updateData);
    };

    await Promise.all([
      ...homePlayers.map(p => updatePlayer(p, homeResult, match.home_club_id)),
      ...awayPlayers.map(p => updatePlayer(p, awayResult, match.away_club_id)),
    ]);

    return Response.json({
      success: true,
      matchday_revenue: isClubMatch ? {
        home: getMatchdayRevenue(homeClub?.stadium_level || 0, homeResult, true),
        away: getMatchdayRevenue(awayClub?.stadium_level || 0, awayResult, false),
      } : null,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});

const CONTRACT_TYPE_META = {
  trial:     { max_games: 5   },
  academy:   { max_games: 20  },
  squad:     { max_games: 100 },
  important: { max_games: 250 },
  star:      { max_games: 400 },
};