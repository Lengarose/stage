/**
 * matchKickoff — handles Kickoff, Full Time submission, and dispute resolution.
 *
 * Actions:
 *   kickoff        → HOME club/player only. Sets status to "in_progress". Notifies away team/player.
 *   submit_result  → Either side submits score + stats. If both match → completed. If not → disputed.
 *   resolve_dispute → Admin only. Forces final score.
 */

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);

  const user = await base44.auth.me();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { match_id, action, home_score, away_score, player_stats, final_home_score, final_away_score, proof_url, video_url } = body;

  if (!match_id || !action) {
    return Response.json({ error: "match_id and action are required" }, { status: 400 });
  }

  let match;
  try {
    match = await base44.asServiceRole.entities.Match.get(match_id);
  } catch {
    return Response.json({ error: "Match not found" }, { status: 404 });
  }
  if (!match) return Response.json({ error: "Match not found" }, { status: 404 });

  const players = await base44.asServiceRole.entities.Player.filter({ email: user.email });
  const myPlayer = players?.[0];
  if (!myPlayer) return Response.json({ error: "Player profile not found" }, { status: 403 });

  const isClubMatch = match.mode === "club";
  const isHomeClub = isClubMatch && match.home_club_id && match.home_club_id === myPlayer.club_id;
  const isAwayClub = isClubMatch && match.away_club_id && match.away_club_id === myPlayer.club_id;
  const isHomePlayer = !isClubMatch && match.home_player_id === myPlayer.id;
  const isAwayPlayer = !isClubMatch && match.away_player_id === myPlayer.id;
  const isInMatch = isHomeClub || isAwayClub || isHomePlayer || isAwayPlayer;

  if (!isInMatch && action !== "resolve_dispute") {
    return Response.json({ error: "Not authorized for this match" }, { status: 403 });
  }

  const matchLabel = `${match.home_club_name || match.home_player_name || "Home"} vs ${match.away_club_name || match.away_player_name || "Away"}`;

  // ─── Helper: get away player emails ──────────────────────────────────────────
  async function getAwayEmails() {
    const emails = [];
    if (match.away_club_id) {
      const ap = await base44.asServiceRole.entities.Player.filter({ club_id: match.away_club_id });
      ap.forEach(p => emails.push(p.email));
    } else if (match.away_player_id) {
      const ap = await base44.asServiceRole.entities.Player.filter({ id: match.away_player_id });
      if (ap[0]) emails.push(ap[0].email);
    }
    return emails;
  }

  async function getAllMatchEmails() {
    const emails = new Set();
    if (match.home_club_id) {
      const hp = await base44.asServiceRole.entities.Player.filter({ club_id: match.home_club_id });
      hp.forEach(p => emails.add(p.email));
    } else if (match.home_player_id) {
      const hp = await base44.asServiceRole.entities.Player.filter({ id: match.home_player_id });
      if (hp[0]) emails.add(hp[0].email);
    }
    if (match.away_club_id) {
      const ap = await base44.asServiceRole.entities.Player.filter({ club_id: match.away_club_id });
      ap.forEach(p => emails.add(p.email));
    } else if (match.away_player_id) {
      const ap = await base44.asServiceRole.entities.Player.filter({ id: match.away_player_id });
      if (ap[0]) emails.add(ap[0].email);
    }
    return [...emails];
  }

  // ─── KICKOFF (home only) ──────────────────────────────────────────────────────
  if (action === "kickoff") {
    if (!isHomeClub && !isHomePlayer) {
      return Response.json({ error: "Only the home team/player can kick off" }, { status: 403 });
    }
    if (match.status !== "scheduled") {
      return Response.json({ error: "Match is not in scheduled state" }, { status: 400 });
    }

    await base44.asServiceRole.entities.Match.update(match_id, { status: "in_progress" });

    // Notify away side
    const awayEmails = await getAwayEmails();
    for (const email of awayEmails) {
      await base44.asServiceRole.entities.Notification.create({
        recipient_email: email,
        type: "match_result",
        title: `Match has started: ${matchLabel}`,
        body: "The home team has kicked off. Good luck!",
        link: "/game-day",
        read: false,
      });
    }

    return Response.json({ success: true, status: "in_progress" });
  }

  // ─── SUBMIT RESULT (both sides submit independently) ─────────────────────────
  if (action === "submit_result") {
    if (match.status !== "in_progress") {
      return Response.json({ error: "Match is not in progress" }, { status: 400 });
    }
    if (home_score === undefined || away_score === undefined) {
      return Response.json({ error: "home_score and away_score are required" }, { status: 400 });
    }

    const hScore = Number(home_score);
    const aScore = Number(away_score);
    const scoreStr = `${hScore}-${aScore}`;
    const submitterSide = (isHomeClub || isHomePlayer) ? "home" : "away";

    // Record this submission
    const updateFields = {};
    if (submitterSide === "home") {
      updateFields.result_home_submitted = true;
      updateFields.home_submitted_score = scoreStr;
    } else {
      updateFields.result_away_submitted = true;
      updateFields.away_submitted_score = scoreStr;
    }

    const existingNotes = safeParseJSON(match.notes || "{}");
    const statsKey = submitterSide === "home" ? "home_player_stats" : "away_player_stats";
    existingNotes[statsKey] = player_stats || [];
    updateFields.notes = JSON.stringify(existingNotes);

    if (!match.first_submission_at) {
      updateFields.first_submission_at = new Date().toISOString();
      updateFields.first_submitter_club_id = myPlayer.club_id || null;
    }

    await base44.asServiceRole.entities.Match.update(match_id, updateFields);

    // Notify the OTHER side that a result has been submitted and they should submit theirs
    const otherSideEmails = [];
    if (submitterSide === "home") {
      const awayEmails = await getAwayEmails();
      otherSideEmails.push(...awayEmails);
    } else {
      if (match.home_club_id) {
        const hp = await base44.asServiceRole.entities.Player.filter({ club_id: match.home_club_id });
        hp.forEach(p => otherSideEmails.push(p.email));
      } else if (match.home_player_id) {
        const hp = await base44.asServiceRole.entities.Player.filter({ id: match.home_player_id });
        if (hp[0]) otherSideEmails.push(hp[0].email);
      }
    }
    for (const email of otherSideEmails) {
      await base44.asServiceRole.entities.Notification.create({
        recipient_email: email,
        type: "result_submitted",
        title: `Result submitted for: ${matchLabel}`,
        body: "The other side submitted their result. Please submit yours to confirm the match.",
        link: "/game-day",
        read: false,
      });
    }

    // Re-fetch to get latest state
    const refreshed = await base44.asServiceRole.entities.Match.get(match_id);
    const bothSubmitted = refreshed.result_home_submitted && refreshed.result_away_submitted;

    if (!bothSubmitted) {
      return Response.json({ success: true, status: "waiting_for_other_team" });
    }

    // Both submitted — compare scores
    const homeScore_ = refreshed.home_submitted_score;
    const awayScore_ = refreshed.away_submitted_score;

    if (homeScore_ === awayScore_) {
      // Scores match — confirm result
      const [fh, fa] = homeScore_.split("-").map(Number);
      await finalizeMatch(base44, refreshed, match_id, fh, fa, safeParseJSON(refreshed.notes || "{}"));
      return Response.json({ success: true, status: "completed" });
    } else {
      // Dispute
      await base44.asServiceRole.entities.Match.update(match_id, { status: "disputed" });

      const homePlayerName = match.home_club_name || match.home_player_name || "Home";
      const awayPlayerName = match.away_club_name || match.away_player_name || "Away";

      // Notify admins via inbox with full details
      const admins = await base44.asServiceRole.entities.User.filter({ role: "admin" });
      for (const admin of admins) {
        await base44.asServiceRole.entities.InboxMessage.create({
          recipient_email: admin.email,
          sender_email: "system@stage.gg",
          sender_gamertag: "STAGE System",
          is_system: true,
          subject: `⚠️ Disputed Match: ${matchLabel}`,
          body: `A player vs player match result is disputed and requires admin review.\n\n` +
            `Match: ${matchLabel}\n` +
            `Date: ${match.scheduled_date ? new Date(match.scheduled_date).toLocaleString() : "Unknown"}\n\n` +
            `${homePlayerName} submitted: ${homeScore_}\n` +
            `${awayPlayerName} submitted: ${awayScore_}\n\n` +
            `Match ID: ${match_id}\n\n` +
            (proof_url ? `Proof screenshot: ${proof_url}\n` : "") +
            (video_url ? `Video proof: ${video_url}\n` : "") +
            `Please review and resolve this dispute.`,
          message_type: "general",
          action_type: "none",
          status: "pending",
          is_read: false,
          related_entity_id: match_id,
          related_entity_type: "match",
          metadata: {
            match_id,
            home_submitted_score: homeScore_,
            away_submitted_score: awayScore_,
            dispute: true,
            proof_url: proof_url || null,
            video_url: video_url || null,
            home_name: homePlayerName,
            away_name: awayPlayerName,
          },
        });
      }

      // Notify both sides of dispute
      const allEmails = await getAllMatchEmails();
      for (const email of allEmails) {
        await base44.asServiceRole.entities.Notification.create({
          recipient_email: email,
          type: "result_submitted",
          title: `Result disputed: ${matchLabel}`,
          body: `Scores don't match. Admin will review. ${homePlayerName}: ${homeScore_} / ${awayPlayerName}: ${awayScore_}`,
          link: "/game-day",
          read: false,
        });
      }

      return Response.json({ success: true, status: "disputed" });
    }
  }

  // ─── RESOLVE DISPUTE (admin only) ────────────────────────────────────────────
  if (action === "resolve_dispute") {
    if (user.role !== "admin") {
      return Response.json({ error: "Admin only" }, { status: 403 });
    }
    if (final_home_score === undefined || final_away_score === undefined) {
      return Response.json({ error: "final_home_score and final_away_score required" }, { status: 400 });
    }
    const fh = Number(final_home_score);
    const fa = Number(final_away_score);
    const notes = safeParseJSON(match.notes || "{}");
    const mergedStats = [...(notes.home_player_stats || []), ...(notes.away_player_stats || [])];
    notes.home_player_stats = mergedStats;
    await finalizeMatch(base44, match, match_id, fh, fa, notes);
    return Response.json({ success: true, status: "completed" });
  }

  return Response.json({ error: "Invalid action" }, { status: 400 });
});

// ─── Helper: finalize match, update stats, notify ────────────────────────────
async function finalizeMatch(base44, match, match_id, hScore, aScore, notes) {
  const isClubMatch = match.mode === "club";
  const player_stats = [...(notes.home_player_stats || []), ...(notes.away_player_stats || [])];

  let winnerClubId = null, winnerClubName = null, loserClubId = null, loserClubName = null;
  let winnerPlayerId = null, winnerPlayerName = null, loserPlayerId = null, loserPlayerName = null;

  if (isClubMatch) {
    if (hScore > aScore) {
      winnerClubId = match.home_club_id; winnerClubName = match.home_club_name;
      loserClubId = match.away_club_id; loserClubName = match.away_club_name;
    } else if (aScore > hScore) {
      winnerClubId = match.away_club_id; winnerClubName = match.away_club_name;
      loserClubId = match.home_club_id; loserClubName = match.home_club_name;
    }
  } else {
    if (hScore > aScore) {
      winnerPlayerId = match.home_player_id; winnerPlayerName = match.home_player_name;
      loserPlayerId = match.away_player_id; loserPlayerName = match.away_player_name;
    } else if (aScore > hScore) {
      winnerPlayerId = match.away_player_id; winnerPlayerName = match.away_player_name;
      loserPlayerId = match.home_player_id; loserPlayerName = match.home_player_name;
    }
  }

  await base44.asServiceRole.entities.Match.update(match_id, {
    status: "completed",
    home_score: hScore,
    away_score: aScore,
    winner_club_id: winnerClubId,
    winner_club_name: winnerClubName,
    loser_club_id: loserClubId,
    loser_club_name: loserClubName,
    winner_player_id: winnerPlayerId,
    winner_player_name: winnerPlayerName,
    loser_player_id: loserPlayerId,
    loser_player_name: loserPlayerName,
    stats_processed: true,
  });

  // ── Auto-payout wager if active ─────────────────────────────────────────────
  const refreshedMatch = await base44.asServiceRole.entities.Match.get(match_id);
  if (refreshedMatch?.wager_stc > 0 && refreshedMatch?.wager_status === 'active') {
    const pot = refreshedMatch.wager_stc * 2;
    const isDraw = hScore === aScore;

    if (isDraw) {
      // Solo match — refund players by player ID
      for (const pid of [refreshedMatch.wager_home_player_id, refreshedMatch.wager_away_player_id].filter(Boolean)) {
        const pArr = await base44.asServiceRole.entities.Player.filter({ id: pid });
        const p = pArr[0];
        if (p) {
          await base44.asServiceRole.entities.Player.update(p.id, { stc: (p.stc || 0) + refreshedMatch.wager_stc });
          await base44.asServiceRole.entities.STCTransaction.create({
            player_id: p.id, player_email: p.email,
            amount: refreshedMatch.wager_stc, type: 'wager_refund',
            description: 'Match drawn — wager refunded', reference_id: match_id,
          });
        }
      }
      // Club match draw — refund STC to clubs directly
      if (!refreshedMatch.wager_home_player_id && refreshedMatch.home_club_id) {
        for (const cid of [refreshedMatch.home_club_id, refreshedMatch.away_club_id].filter(Boolean)) {
          const cArr = await base44.asServiceRole.entities.Club.filter({ id: cid });
          const c = cArr[0];
          if (c) {
            await base44.asServiceRole.entities.Club.update(c.id, { stc: (c.stc || 0) + refreshedMatch.wager_stc });
            await base44.asServiceRole.entities.STCTransaction.create({
              club_id: c.id, amount: refreshedMatch.wager_stc, type: 'wager_refund',
              description: 'Match drawn — club wager refunded', reference_id: match_id,
            });
          }
        }
      }
      await base44.asServiceRole.entities.Match.update(match_id, { wager_status: 'refunded' });
    } else {
      // Resolve winner entity — for solo matches use winnerPlayerId,
      // for club matches resolve the winning club's owner/captain to receive the pot.
      let recipientPlayerId = winnerPlayerId;
      if (!recipientPlayerId && winnerClubId) {
        // Club match — award pot to the winning club's STC balance directly
        const wClubArr = await base44.asServiceRole.entities.Club.filter({ id: winnerClubId });
        const wClub = wClubArr[0];
        if (wClub) {
          await base44.asServiceRole.entities.Club.update(wClub.id, { stc: (wClub.stc || 0) + pot });
          await base44.asServiceRole.entities.STCTransaction.create({
            club_id: wClub.id, amount: pot, type: 'wager_win',
            description: `Club wager won — full pot vs ${refreshedMatch.home_club_id === winnerClubId ? refreshedMatch.away_club_name : refreshedMatch.home_club_name}`,
            reference_id: match_id,
          });
          // Notify club owner
          if (wClub.owner_email) {
            await base44.asServiceRole.entities.Notification.create({
              recipient_email: wClub.owner_email, type: 'announcement',
              title: `🏆 Club wager won! +${pot.toLocaleString()} STC`,
              body: `${wClub.name} won the wager. ${pot.toLocaleString()} STC has been credited to the club account.`,
              link: '/lifestyle', read: false,
            });
          }
        }
        // Notify losing club owner
        const losingClubId = refreshedMatch.home_club_id === winnerClubId ? refreshedMatch.away_club_id : refreshedMatch.home_club_id;
        if (losingClubId) {
          const lClubArr = await base44.asServiceRole.entities.Club.filter({ id: losingClubId });
          const lClub = lClubArr[0];
          if (lClub?.owner_email) {
            await base44.asServiceRole.entities.Notification.create({
              recipient_email: lClub.owner_email, type: 'announcement',
              title: `Club wager lost (-${refreshedMatch.wager_stc.toLocaleString()} STC)`,
              body: `${lClub.name}'s ${refreshedMatch.wager_stc.toLocaleString()} STC wager was claimed by ${wClub?.name || 'the opponent'}.`,
              link: '/lifestyle', read: false,
            });
          }
        }
      } else if (recipientPlayerId) {
        const wArr = await base44.asServiceRole.entities.Player.filter({ id: recipientPlayerId });
        const winner = wArr[0];
        if (winner) {
          await base44.asServiceRole.entities.Player.update(winner.id, { stc: (winner.stc || 0) + pot });
          await base44.asServiceRole.entities.STCTransaction.create({
            player_id: winner.id, player_email: winner.email,
            amount: pot, type: 'wager_win',
            description: `Wager won — full pot`, reference_id: match_id,
          });
          await base44.asServiceRole.entities.Notification.create({
            recipient_email: winner.email, type: 'announcement',
            title: `🏆 Wager won! +${pot.toLocaleString()} STC`,
            body: `The ${pot.toLocaleString()} STC pot has been credited to your account.`,
            link: '/lifestyle', read: false,
          });
        }
        // Notify loser
        const loserId = refreshedMatch.wager_home_player_id === recipientPlayerId
          ? refreshedMatch.wager_away_player_id : refreshedMatch.wager_home_player_id;
        if (loserId) {
          const lArr = await base44.asServiceRole.entities.Player.filter({ id: loserId });
          const loser = lArr[0];
          if (loser) {
            await base44.asServiceRole.entities.Notification.create({
              recipient_email: loser.email, type: 'announcement',
              title: `Wager lost (-${refreshedMatch.wager_stc.toLocaleString()} STC)`,
              body: `Your ${refreshedMatch.wager_stc.toLocaleString()} STC wager was claimed by the winner.`,
              link: '/lifestyle', read: false,
            });
          }
        }
      }

      // Log wager loss for the loser
      let loserPlayerId = refreshedMatch.wager_home_player_id === recipientPlayerId
        ? refreshedMatch.wager_away_player_id : refreshedMatch.wager_home_player_id;
      let loserClubId = refreshedMatch.home_club_id === winnerClubId
        ? refreshedMatch.away_club_id : refreshedMatch.home_club_id;

      if (loserPlayerId) {
        const lArr = await base44.asServiceRole.entities.Player.filter({ id: loserPlayerId });
        const loser = lArr[0];
        if (loser) {
          const winnerName = refreshedMatch.wager_home_player_id === recipientPlayerId
            ? refreshedMatch.home_player_name : refreshedMatch.away_player_name;
          await base44.asServiceRole.entities.STCTransaction.create({
            player_id: loser.id, player_email: loser.email,
            amount: -refreshedMatch.wager_stc, type: 'wager_loss',
            description: `Wager lost against ${winnerName}`, reference_id: match_id,
          });
        }
      } else if (loserClubId) {
        const lClubArr = await base44.asServiceRole.entities.Club.filter({ id: loserClubId });
        const lClub = lClubArr[0];
        if (lClub) {
          await base44.asServiceRole.entities.STCTransaction.create({
            club_id: lClub.id, amount: -refreshedMatch.wager_stc, type: 'wager_loss',
            description: `Club wager lost against ${wClub?.name || 'opponent'}`, reference_id: match_id,
          });
        }
      }

      await base44.asServiceRole.entities.Match.update(match_id, { wager_status: 'settled' });
      }
      }

  // ── Ticket revenue for home club (every completed club match) ──────────────
  if (isClubMatch && match.home_club_id) {
    const homeClubArr = await base44.asServiceRole.entities.Club.filter({ id: match.home_club_id });
    const homeClub = homeClubArr?.[0];
    if (homeClub) {
      const stadiumLevel = homeClub.stadium_level || 0;
      const stadiumLevels = [
        { capacity: 20_000, ticket_price: 40 },
        { capacity: 45_000, ticket_price: 55 },
        { capacity: 80_000, ticket_price: 75 },
      ];
      const stadium = stadiumLevels[Math.min(Math.max(stadiumLevel, 0), 2)];
      const ticketRevenue = stadium.capacity * stadium.ticket_price;
      const transferAlloc = Math.floor(ticketRevenue * 0.10);
      const wageAlloc = Math.floor(ticketRevenue * 0.05);
      await base44.asServiceRole.entities.Club.update(homeClub.id, {
        stc: (homeClub.stc || 0) + ticketRevenue,
        transfer_budget_stc: (homeClub.transfer_budget_stc || 0) + transferAlloc,
        wage_budget_stc: (homeClub.wage_budget_stc || 0) + wageAlloc,
      });
      await base44.asServiceRole.entities.STCTransaction.create({
        club_id: homeClub.id,
        amount: ticketRevenue,
        type: 'ticket_revenue',
        description: `Ticket sales: ${ticketRevenue.toLocaleString()} STC → Balance +${ticketRevenue}, Transfer +${transferAlloc}, Wage +${wageAlloc}`,
        reference_id: match_id,
      });
    }
  }

  // ── Club match: save player stats + update club stats ──────────────────────
  if (isClubMatch) {
    for (const stat of player_stats) {
      await base44.asServiceRole.entities.MatchPlayerStat.create({
        tournament_id: match.tournament_id || "ranked",
        match_id,
        club_id: stat.club_id || null,
        player_email: stat.player_email,
        player_gamertag: stat.player_gamertag,
        goals: stat.goals || 0,
        assists: stat.assists || 0,
        rating: stat.rating || 6,
      });

      const pArr = await base44.asServiceRole.entities.Player.filter({ email: stat.player_email });
      const p = pArr?.[0];
      if (p) {
        const isHome = p.club_id === match.home_club_id;
        const myScore = isHome ? hScore : aScore;
        const theirScore = isHome ? aScore : hScore;
        const outcome = myScore > theirScore ? "W" : myScore < theirScore ? "L" : "D";

        const updatePayload = {
          matches_played: (p.matches_played || 0) + 1,
          matches_played_club: (p.matches_played_club || 0) + 1,
          goals: (p.goals || 0) + (stat.goals || 0),
          assists: (p.assists || 0) + (stat.assists || 0),
        };
        if (outcome === "W") updatePayload.wins_club = (p.wins_club || 0) + 1;
        else if (outcome === "L") updatePayload.losses_club = (p.losses_club || 0) + 1;
        else updatePayload.draws_club = (p.draws_club || 0) + 1;

        const totalGames = (p.matches_played || 0) + 1;
        const prevRatingTotal = (p.avg_match_rating || 6) * (p.matches_played || 0);
        updatePayload.avg_match_rating = parseFloat(((prevRatingTotal + (stat.rating || 6)) / totalGames).toFixed(2));
        await base44.asServiceRole.entities.Player.update(p.id, updatePayload);
      }
    }

    // Update club aggregate stats
    const clubsToUpdate = [
      match.home_club_id ? { id: match.home_club_id, isHome: true } : null,
      match.away_club_id ? { id: match.away_club_id, isHome: false } : null,
    ].filter(Boolean);

    for (const { id: clubId, isHome } of clubsToUpdate) {
      const clubArr = await base44.asServiceRole.entities.Club.filter({ id: clubId });
      const club = clubArr?.[0];
      if (!club) continue;

      const myScore = isHome ? hScore : aScore;
      const theirScore = isHome ? aScore : hScore;
      const outcome = myScore > theirScore ? "W" : myScore < theirScore ? "L" : "D";
      const form = [...(club.form || []), outcome].slice(-5);

      const clubUpdate = {
        matches_ranked: (club.matches_ranked || 0) + 1,
        goals_scored: (club.goals_scored || 0) + myScore,
        goals_conceded: (club.goals_conceded || 0) + theirScore,
        form,
        last_ranked_match_date: new Date().toISOString(),
      };
      if (outcome === "W") {
        clubUpdate.wins = (club.wins || 0) + 1;
        clubUpdate.win_streak = (club.win_streak || 0) + 1;
        clubUpdate.loss_streak = 0;
      } else if (outcome === "L") {
        clubUpdate.losses = (club.losses || 0) + 1;
        clubUpdate.loss_streak = (club.loss_streak || 0) + 1;
        clubUpdate.win_streak = 0;
      } else {
        clubUpdate.draws = (club.draws || 0) + 1;
        clubUpdate.win_streak = 0;
        clubUpdate.loss_streak = 0;
      }
      await base44.asServiceRole.entities.Club.update(clubId, clubUpdate);
    }
  } else {
    // ── Solo/PvP match: update wins_count / losses_count / draws_count ─────────
    const playerIds = [match.home_player_id, match.away_player_id].filter(Boolean);
    for (const pid of playerIds) {
      const pArr = await base44.asServiceRole.entities.Player.filter({ id: pid });
      const p = pArr?.[0];
      if (!p) continue;

      const isHome = p.id === match.home_player_id;
      const myScore = isHome ? hScore : aScore;
      const theirScore = isHome ? aScore : hScore;
      const outcome = myScore > theirScore ? "W" : myScore < theirScore ? "L" : "D";

      const updatePayload = {
        matches_played: (p.matches_played || 0) + 1,
      };
      if (outcome === "W") updatePayload.wins_count = (p.wins_count || 0) + 1;
      else if (outcome === "L") updatePayload.losses_count = (p.losses_count || 0) + 1;
      else updatePayload.draws_count = (p.draws_count || 0) + 1;

      await base44.asServiceRole.entities.Player.update(p.id, updatePayload);
    }
  }

  // Notify all involved players with result
  const allEmails = new Set();
  if (match.home_club_id) {
    const hp = await base44.asServiceRole.entities.Player.filter({ club_id: match.home_club_id });
    hp.forEach(p => allEmails.add(p.email));
  } else if (match.home_player_id) {
    const hp = await base44.asServiceRole.entities.Player.filter({ id: match.home_player_id });
    if (hp[0]) allEmails.add(hp[0].email);
  }
  if (match.away_club_id) {
    const ap = await base44.asServiceRole.entities.Player.filter({ club_id: match.away_club_id });
    ap.forEach(p => allEmails.add(p.email));
  } else if (match.away_player_id) {
    const ap = await base44.asServiceRole.entities.Player.filter({ id: match.away_player_id });
    if (ap[0]) allEmails.add(ap[0].email);
  }

  const matchResultLabel = `${match.home_club_name || match.home_player_name} ${hScore}–${aScore} ${match.away_club_name || match.away_player_name}`;
  for (const email of allEmails) {
    await base44.asServiceRole.entities.Notification.create({
      recipient_email: email,
      type: "match_result",
      title: `Full Time: ${matchResultLabel}`,
      body: "Match has ended. Check your stats!",
      link: "/schedule",
      read: false,
    });
  }
}

function safeParseJSON(str) {
  try { return JSON.parse(str); } catch { return {}; }
}