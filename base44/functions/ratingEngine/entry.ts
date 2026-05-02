import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

// ── Rating Engine ──────────────────────────────────────────────────────────────
// Implements ELO-style rating with K-factor, match weight, roster continuity,
// goal difference bonus, placement phase, and anti-abuse rules.

const PLACEMENT_MATCHES = 10;
const LEADERBOARD_MIN_MATCHES = 5;
const INITIAL_RATING = 1500;
const MAX_REMATCH_FACTOR = 0.5; // reduce gain after 3+ matches vs same opponent in 30 days

function getTier(rating) {
  if (rating < 1200) return 'Bronze';
  if (rating < 1400) return 'Silver';
  if (rating < 1600) return 'Gold';
  if (rating < 1800) return 'Elite';
  return 'World Class';
}

function getKFactor(isProvisional) {
  return isProvisional ? 40 : 20;
}

function getMatchWeight(matchType) {
  const weights = { ranked: 1.0, league: 1.1, playoff: 1.25, final: 1.4 };
  return weights[matchType] || 1.0;
}

function getExpectedResult(ratingA, ratingB) {
  return 1 / (1 + Math.pow(10, (ratingB - ratingA) / 400));
}

function getGoalDiffBonus(goalDiff, actualResult) {
  // Cap at 3 goals difference, max ±5 points
  const cappedDiff = Math.min(Math.abs(goalDiff), 3);
  const sign = actualResult === 1 ? 1 : actualResult === 0 ? -1 : 0;
  return sign * (cappedDiff / 3) * 5;
}

function getActualResult(result) {
  if (result === 'W') return 1;
  if (result === 'D') return 0.5;
  return 0;
}

function calculateDelta(ratingA, ratingB, result, matchType, isProvisional, goalDiff, rosterContinuity) {
  const K = getKFactor(isProvisional);
  const W = getMatchWeight(matchType);
  const C = rosterContinuity;
  const actual = getActualResult(result);
  const expected = getExpectedResult(ratingA, ratingB);
  const gdBonus = getGoalDiffBonus(goalDiff, actual);

  const delta = K * W * C * (actual - expected) + gdBonus;
  return Math.round(delta * 10) / 10;
}

async function getRecentRematchCount(base44, clubId, opponentId, days = 30) {
  const since = new Date(Date.now() - days * 86400000).toISOString();
  const history = await base44.asServiceRole.entities.RatingHistory.filter({ club_id: clubId, opponent_club_id: opponentId });
  return history.filter(h => h.played_at > since && !h.voided).length;
}

function applyRematchPenalty(delta, rematchCount) {
  if (rematchCount < 3) return delta;
  const penalty = Math.max(MAX_REMATCH_FACTOR, 1 - (rematchCount - 2) * 0.15);
  return Math.round(delta * penalty * 10) / 10;
}

function updateForm(currentForm, result) {
  const form = [...(currentForm || []), result];
  return form.slice(-5); // keep last 5
}

function updateStreaks(winStreak, lossStreak, result) {
  if (result === 'W') return { win_streak: winStreak + 1, loss_streak: 0 };
  if (result === 'L') return { win_streak: 0, loss_streak: lossStreak + 1 };
  return { win_streak: 0, loss_streak: 0 };
}

// ── Main handler ───────────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const {
      home_club_id,
      away_club_id,
      home_score,
      away_score,
      match_type = 'ranked',     // ranked | league | playoff | final
      match_id,
      home_roster_continuity = 1.0,
      away_roster_continuity = 1.0,
    } = body;

    if (!home_club_id || !away_club_id || home_score == null || away_score == null) {
      return Response.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Fetch both clubs
    const [homeclubs, awayclubs] = await Promise.all([
      base44.asServiceRole.entities.Club.filter({ id: home_club_id }, null, 1),
      base44.asServiceRole.entities.Club.filter({ id: away_club_id }, null, 1),
    ]);
    const homeClub = homeclubs[0];
    const awayClub = awayclubs[0];
    if (!homeClub || !awayClub) return Response.json({ error: 'Club not found' }, { status: 404 });

    const homeRating = homeClub.rating ?? INITIAL_RATING;
    const awayRating = awayClub.rating ?? INITIAL_RATING;
    const homeProvisional = homeClub.is_provisional ?? true;
    const awayProvisional = awayClub.is_provisional ?? true;
    const homeRanked = homeClub.matches_ranked ?? 0;
    const awayRanked = awayClub.matches_ranked ?? 0;

    // Determine results
    const goalDiff = home_score - away_score;
    let homeResult, awayResult;
    if (home_score > away_score) { homeResult = 'W'; awayResult = 'L'; }
    else if (home_score < away_score) { homeResult = 'L'; awayResult = 'W'; }
    else { homeResult = 'D'; awayResult = 'D'; }

    // Anti-abuse: rematch check
    const [homeRematch, awayRematch] = await Promise.all([
      getRecentRematchCount(base44, home_club_id, away_club_id),
      getRecentRematchCount(base44, away_club_id, home_club_id),
    ]);

    // Calculate raw deltas
    let homeDelta = calculateDelta(homeRating, awayRating, homeResult, match_type, homeProvisional, goalDiff, home_roster_continuity);
    let awayDelta = calculateDelta(awayRating, homeRating, awayResult, match_type, awayProvisional, -goalDiff, away_roster_continuity);

    // Apply rematch penalty
    homeDelta = applyRematchPenalty(homeDelta, homeRematch);
    awayDelta = applyRematchPenalty(awayDelta, awayRematch);

    // New ratings (floor at 100)
    const newHomeRating = Math.max(100, Math.round(homeRating + homeDelta));
    const newAwayRating = Math.max(100, Math.round(awayRating + awayDelta));

    const newHomeRanked = homeRanked + 1;
    const newAwayRanked = awayRanked + 1;
    const homeNowProvisional = newHomeRanked < PLACEMENT_MATCHES;
    const awayNowProvisional = newAwayRanked < PLACEMENT_MATCHES;

    const playedAt = new Date().toISOString();

    // Update home club
    const homeStreaks = updateStreaks(homeClub.win_streak || 0, homeClub.loss_streak || 0, homeResult);
    const newHomeSoS = Math.round(((homeClub.ranked_opponents_played || 0) + awayRating) / (newHomeRanked || 1));
    await base44.asServiceRole.entities.Club.update(home_club_id, {
      rating: newHomeRating,
      peak_rating: Math.max(homeClub.peak_rating || INITIAL_RATING, newHomeRating),
      matches_ranked: newHomeRanked,
      is_provisional: homeNowProvisional,
      tier: getTier(newHomeRating),
      wins: homeResult === 'W' ? (homeClub.wins || 0) + 1 : homeClub.wins || 0,
      losses: homeResult === 'L' ? (homeClub.losses || 0) + 1 : homeClub.losses || 0,
      draws: homeResult === 'D' ? (homeClub.draws || 0) + 1 : homeClub.draws || 0,
      goals_scored: (homeClub.goals_scored || 0) + home_score,
      goals_conceded: (homeClub.goals_conceded || 0) + away_score,
      form: updateForm(homeClub.form, homeResult),
      win_streak: homeStreaks.win_streak,
      loss_streak: homeStreaks.loss_streak,
      last_ranked_match_date: playedAt,
      ranked_opponents_played: (homeClub.ranked_opponents_played || 0) + awayRating,
      strength_of_schedule: newHomeSoS,
    });

    // Update away club
    const awayStreaks = updateStreaks(awayClub.win_streak || 0, awayClub.loss_streak || 0, awayResult);
    const newAwaySoS = Math.round(((awayClub.ranked_opponents_played || 0) + homeRating) / (newAwayRanked || 1));
    await base44.asServiceRole.entities.Club.update(away_club_id, {
      rating: newAwayRating,
      peak_rating: Math.max(awayClub.peak_rating || INITIAL_RATING, newAwayRating),
      matches_ranked: newAwayRanked,
      is_provisional: awayNowProvisional,
      tier: getTier(newAwayRating),
      wins: awayResult === 'W' ? (awayClub.wins || 0) + 1 : awayClub.wins || 0,
      losses: awayResult === 'L' ? (awayClub.losses || 0) + 1 : awayClub.losses || 0,
      draws: awayResult === 'D' ? (awayClub.draws || 0) + 1 : awayClub.draws || 0,
      goals_scored: (awayClub.goals_scored || 0) + away_score,
      goals_conceded: (awayClub.goals_conceded || 0) + home_score,
      form: updateForm(awayClub.form, awayResult),
      win_streak: awayStreaks.win_streak,
      loss_streak: awayStreaks.loss_streak,
      last_ranked_match_date: playedAt,
      ranked_opponents_played: (awayClub.ranked_opponents_played || 0) + homeRating,
      strength_of_schedule: newAwaySoS,
    });

    // Save rating history for both clubs
    const historyBase = {
      match_id: match_id || 'manual',
      match_type,
      home_score,
      away_score,
      played_at: playedAt,
      voided: false,
    };
    await Promise.all([
      base44.asServiceRole.entities.RatingHistory.create({
        ...historyBase,
        club_id: home_club_id,
        club_name: homeClub.name,
        opponent_club_id: away_club_id,
        opponent_club_name: awayClub.name,
        result: homeResult,
        rating_before: homeRating,
        rating_after: newHomeRating,
        rating_change: homeDelta,
        opponent_rating: awayRating,
        k_factor: getKFactor(homeProvisional),
        match_weight: getMatchWeight(match_type),
        goal_diff_bonus: getGoalDiffBonus(goalDiff, getActualResult(homeResult)),
        roster_continuity: home_roster_continuity,
        was_provisional: homeProvisional,
      }),
      base44.asServiceRole.entities.RatingHistory.create({
        ...historyBase,
        club_id: away_club_id,
        club_name: awayClub.name,
        opponent_club_id: home_club_id,
        opponent_club_name: homeClub.name,
        result: awayResult,
        rating_before: awayRating,
        rating_after: newAwayRating,
        rating_change: awayDelta,
        opponent_rating: homeRating,
        k_factor: getKFactor(awayProvisional),
        match_weight: getMatchWeight(match_type),
        goal_diff_bonus: getGoalDiffBonus(-goalDiff, getActualResult(awayResult)),
        roster_continuity: away_roster_continuity,
        was_provisional: awayProvisional,
      }),
    ]);

    return Response.json({
      success: true,
      home: {
        club_id: home_club_id,
        result: homeResult,
        rating_before: homeRating,
        rating_after: newHomeRating,
        delta: homeDelta,
        tier: getTier(newHomeRating),
        provisional: homeNowProvisional,
      },
      away: {
        club_id: away_club_id,
        result: awayResult,
        rating_before: awayRating,
        rating_after: newAwayRating,
        delta: awayDelta,
        tier: getTier(newAwayRating),
        provisional: awayNowProvisional,
      },
    });

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});