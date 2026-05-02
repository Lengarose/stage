import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const { data } = await req.json();

    // Guard: Only process confirmed matches with valid scores
    if (data.status !== 'confirmed') {
      return Response.json({ skipped: 'not confirmed' });
    }

    if (data.stats_processed) {
      return Response.json({ skipped: 'already processed' });
    }

    if (data.home_score == null || data.away_score == null) {
      return Response.json({ skipped: 'missing scores' });
    }

    const matchId = data.id;
    const homeScore = data.home_score || 0;
    const awayScore = data.away_score || 0;
    const isClubMatch = data.mode === 'club';
    const isSoloMatch = data.mode === 'solo';
    const isRanked = data.type === 'ranked';
    const isTournament = data.type === 'tournament';

    // Determine result
    const homeWon = homeScore > awayScore;
    const awayWon = awayScore > homeScore;
    const isDraw = homeScore === awayScore;
    const homeResult = homeWon ? 'win' : (awayWon ? 'loss' : 'draw');
    const awayResult = homeWon ? 'loss' : (awayWon ? 'win' : 'draw');

    // === CLUB STATS UPDATE (only if club match) ===
    let challengeId = null;
    if (isClubMatch) {
      const homeClubId = data.home_club_id;
      const awayClubId = data.away_club_id;

      const [homeClub, awayClub] = await Promise.all([
        base44.asServiceRole.entities.Club.get(homeClubId),
        base44.asServiceRole.entities.Club.get(awayClubId)
      ]);

      if (!homeClub || !awayClub) {
        throw new Error('Club not found');
      }

      // Calculate ticket revenue for home club
      // Formula: Capacity × Ticket Price per home match
      const stadiumLevel = homeClub.stadium_level || 0;
      const stadiumLevels = [
        { capacity: 20_000, ticket_price: 40 },
        { capacity: 45_000, ticket_price: 55 },
        { capacity: 80_000, ticket_price: 75 },
      ];
      const stadium = stadiumLevels[Math.min(Math.max(stadiumLevel, 0), 2)];
      const ticketRevenue = stadium.capacity * stadium.ticket_price;

      // Update home club — allocate ticket revenue (100% balance + 10% transfer + 5% wage)
      const ticketAllocation = {
        balance: ticketRevenue,
        transfer_budget: Math.floor(ticketRevenue * 0.10),
        wage_budget: Math.floor(ticketRevenue * 0.05),
      };
      const homeUpdates = {
        goals_scored: (homeClub.goals_scored || 0) + homeScore,
        goals_conceded: (homeClub.goals_conceded || 0) + awayScore,
        last_ranked_match_date: new Date().toISOString(),
        stc: (homeClub.stc || 0) + ticketAllocation.balance,
        transfer_budget_stc: (homeClub.transfer_budget_stc || 0) + ticketAllocation.transfer_budget,
        wage_budget_stc: (homeClub.wage_budget_stc || 0) + ticketAllocation.wage_budget,
      };

      if (isRanked || isTournament) {
        homeUpdates.matches_ranked = (homeClub.matches_ranked || 0) + 1;
      }

      // Result
      if (homeResult === 'win') {
        homeUpdates.wins = (homeClub.wins || 0) + 1;
        homeUpdates.win_streak = (homeClub.win_streak || 0) + 1;
        homeUpdates.loss_streak = 0;
      } else if (homeResult === 'loss') {
        homeUpdates.losses = (homeClub.losses || 0) + 1;
        homeUpdates.loss_streak = (homeClub.loss_streak || 0) + 1;
        homeUpdates.win_streak = 0;
      } else {
        homeUpdates.draws = (homeClub.draws || 0) + 1;
        homeUpdates.win_streak = 0;
        homeUpdates.loss_streak = 0;
      }

      // Form
      homeUpdates.form = [...(homeClub.form || []), homeResult[0].toUpperCase()].slice(-5);

      // ELO rating (only ranked)
      if (isRanked) {
        const eloData = calculateElo(
          homeClub.rating || 1500,
          awayClub.rating || 1500,
          homeResult
        );
        homeUpdates.rating = Math.max(800, eloData.newRating);
        if (homeUpdates.rating > (homeClub.peak_rating || 1500)) {
          homeUpdates.peak_rating = homeUpdates.rating;
        }
      }

      // Provisional
      if ((homeUpdates.matches_ranked || homeClub.matches_ranked) >= 10) {
        homeUpdates.is_provisional = false;
      }

      // Update away club (no ticket revenue for away matches)
      const awayUpdates = {
        goals_scored: (awayClub.goals_scored || 0) + awayScore,
        goals_conceded: (awayClub.goals_conceded || 0) + homeScore,
        last_ranked_match_date: new Date().toISOString()
      };

      if (isRanked || isTournament) {
        awayUpdates.matches_ranked = (awayClub.matches_ranked || 0) + 1;
      }

      if (awayResult === 'win') {
        awayUpdates.wins = (awayClub.wins || 0) + 1;
        awayUpdates.win_streak = (awayClub.win_streak || 0) + 1;
        awayUpdates.loss_streak = 0;
      } else if (awayResult === 'loss') {
        awayUpdates.losses = (awayClub.losses || 0) + 1;
        awayUpdates.loss_streak = (awayClub.loss_streak || 0) + 1;
        awayUpdates.win_streak = 0;
      } else {
        awayUpdates.draws = (awayClub.draws || 0) + 1;
        awayUpdates.win_streak = 0;
        awayUpdates.loss_streak = 0;
      }

      awayUpdates.form = [...(awayClub.form || []), awayResult[0].toUpperCase()].slice(-5);

      if (isRanked) {
        const eloData = calculateElo(
          awayClub.rating || 1500,
          homeClub.rating || 1500,
          awayResult
        );
        awayUpdates.rating = Math.max(800, eloData.newRating);
        if (awayUpdates.rating > (awayClub.peak_rating || 1500)) {
          awayUpdates.peak_rating = awayUpdates.rating;
        }
      }

      if ((awayUpdates.matches_ranked || awayClub.matches_ranked) >= 10) {
        awayUpdates.is_provisional = false;
      }

      // Update clubs
      await Promise.all([
        base44.asServiceRole.entities.Club.update(homeClubId, homeUpdates),
        base44.asServiceRole.entities.Club.update(awayClubId, awayUpdates)
      ]);

      // Record ticket revenue transaction
      await base44.asServiceRole.entities.STCTransaction.create({
        club_id: homeClubId,
        amount: ticketRevenue,
        type: 'ticket_revenue',
        description: `Ticket sales: ${ticketRevenue.toLocaleString()} → Balance +${ticketAllocation.balance}, Transfer +${ticketAllocation.transfer_budget}, Wage +${ticketAllocation.wage_budget}`,
        reference_id: matchId,
      });

      // === WAGER SYSTEM (ranked club matches) ===
      if (isRanked) {
        const challenges = await base44.asServiceRole.entities.Challenge.filter({
          live_match_id: matchId
        }, '', 1);

        if (challenges.length > 0) {
          const challenge = challenges[0];
          challengeId = challenge.id;

          if (challenge.challenger_wager_paid && challenge.opponent_wager_paid) {
            const wagerAmount = challenge.wager_credits || 0;

            if (homeResult === 'win') {
              // Home wins: credit to home, debit from away
              await base44.asServiceRole.entities.Club.update(homeClubId, {
                credits: (homeClub.credits || 0) + wagerAmount * 2
              });
            } else if (awayResult === 'win') {
              // Away wins: credit to away, debit from home
              await base44.asServiceRole.entities.Club.update(awayClubId, {
                credits: (awayClub.credits || 0) + wagerAmount * 2
              });
            } else {
              // Draw: refund both
              await Promise.all([
                base44.asServiceRole.entities.Club.update(homeClubId, {
                  credits: (homeClub.credits || 0) + wagerAmount
                }),
                base44.asServiceRole.entities.Club.update(awayClubId, {
                  credits: (awayClub.credits || 0) + wagerAmount
                })
              ]);
            }

            // Update challenge
            const winnerClubId = homeResult === 'win' ? homeClubId : (awayResult === 'win' ? awayClubId : null);
            await base44.asServiceRole.entities.Challenge.update(challenge.id, {
              status: 'completed',
              home_score: homeScore,
              away_score: awayScore,
              winner_club_id: winnerClubId
            });
          }
        }
      }
    }

    // === PLAYER STATS UPDATE ===
    const playerStats = await base44.asServiceRole.entities.MatchPlayerStat.filter({
      match_id: matchId
    }, '-created_date', 1000);

    if (playerStats.length === 0) {
      // No MatchPlayerStat records — still mark as processed and return
      await base44.asServiceRole.entities.Match.update(matchId, { stats_processed: true });
      return Response.json({ success: true, matchId, skipped: 'no player stats', clubsUpdated: isClubMatch ? 2 : 0 });
    }

    // Fetch players
    const playerIds = playerStats.map(s => s.player_email);
    const players = await Promise.all(
      playerIds.map(email => base44.asServiceRole.entities.Player.filter({ email }, '', 1).then(r => r[0]))
    );

    // Find MOTM (highest rating)
    const motmStat = playerStats.reduce((max, stat) => {
      return (stat.rating || 0) > (max.rating || 0) ? stat : max;
    }, {});

    // Update each player
    const playerUpdatePromises = playerStats.map(async (stat, idx) => {
      const player = players[idx];
      if (!player) return;

      const isPlayerHome = stat.club_id === data.home_club_id;
      const playerResult = isPlayerHome ? homeResult : awayResult;

      const playerUpdates = {
        matches_played: (player.matches_played || 0) + 1,
        goals: (player.goals || 0) + (stat.goals || 0),
        assists: (player.assists || 0) + (stat.assists || 0)
      };

      // Club-specific stats
      if (isClubMatch) {
        playerUpdates.matches_played_club = (player.matches_played_club || 0) + 1;

        if (playerResult === 'win') {
          playerUpdates.wins_club = (player.wins_club || 0) + 1;
          playerUpdates.wins_count = (player.wins_count || 0) + 1;
        } else if (playerResult === 'loss') {
          playerUpdates.losses_club = (player.losses_club || 0) + 1;
          playerUpdates.losses_count = (player.losses_count || 0) + 1;
        } else {
          playerUpdates.draws_club = (player.draws_club || 0) + 1;
          playerUpdates.draws_count = (player.draws_count || 0) + 1;
        }
      } else if (isSoloMatch) {
        // Solo stats (no club suffix)
        if (playerResult === 'win') {
          playerUpdates.wins_count = (player.wins_count || 0) + 1;
        } else if (playerResult === 'loss') {
          playerUpdates.losses_count = (player.losses_count || 0) + 1;
        } else {
          playerUpdates.draws_count = (player.draws_count || 0) + 1;
        }
      }

      // Clean sheets
      const opponentScore = isPlayerHome ? awayScore : homeScore;
      if (opponentScore === 0 && ['GK', 'CB', 'LB', 'RB'].includes(player.position)) {
        playerUpdates.clean_sheets = (player.clean_sheets || 0) + 1;
      }

      // MOTM
      if (stat.id === motmStat.id) {
        playerUpdates.man_of_the_match = (player.man_of_the_match || 0) + 1;
      }

      return base44.asServiceRole.entities.Player.update(player.id, playerUpdates);
    });

    await Promise.all(playerUpdatePromises);

    // Mark match as processed
    await base44.asServiceRole.entities.Match.update(matchId, { stats_processed: true });

    return Response.json({
      success: true,
      matchId,
      mode: data.mode,
      type: data.type,
      clubsUpdated: isClubMatch ? 2 : 0,
      playersUpdated: playerStats.length,
      challengeId
    });
  } catch (error) {
    console.error('Stats update error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});

function calculateElo(rating, opponentRating, result) {
  const K = 32;
  const expected = 1 / (1 + Math.pow(10, (opponentRating - rating) / 400));
  const actual = result === 'win' ? 1 : (result === 'draw' ? 0.5 : 0);
  const newRating = rating + K * (actual - expected);
  return { newRating: Math.round(newRating) };
}