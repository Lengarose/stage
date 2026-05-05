import { base44 } from "@/api/base44Client";

// ─── Default config ────────────────────────────────────────────────────────────
// Mirrors RankingConfig entity defaults. Overridden at runtime by the active
// RankingConfig record when one is available.

export const DEFAULT_CONFIG = {
  // Base result points
  win_points:  100,
  draw_points:  40,
  loss_points:  10,

  // Opponent strength multipliers (by global-rank percentile of all clubs)
  opp_top10:   2.0,
  opp_top25:   1.5,
  opp_top50:   1.2,
  opp_bot50:   1.0,
  opp_bot25:   0.8,

  // Competition level multipliers
  comp_regional_div2: 0.8,
  comp_regional_div1: 1.0,
  comp_challenger:    1.2,
  comp_elite:         1.5,
  comp_supreme:       2.0,
  comp_tournament:    1.0,

  // Tournament stage / round multipliers
  stage_group:   1.0,
  stage_playoff: 1.1,
  stage_r16:     1.2,
  stage_qf:      1.4,
  stage_sf:      1.6,
  stage_final:   2.0,
};

// ─── Config loader ─────────────────────────────────────────────────────────────

export async function getRankingConfig() {
  try {
    const rows = await base44.entities.RankingConfig?.list(null, 10) ?? [];
    const active = rows.find(r => r.is_active) || rows[0];
    return active ? { ...DEFAULT_CONFIG, ...active } : DEFAULT_CONFIG;
  } catch {
    return DEFAULT_CONFIG;
  }
}

// ─── Multiplier helpers ────────────────────────────────────────────────────────

export function getOpponentMultiplier(opponentGlobalRank, totalClubs, cfg) {
  if (!opponentGlobalRank || !totalClubs || totalClubs === 0) return cfg.opp_bot50;
  const pct = opponentGlobalRank / totalClubs;
  if (pct <= 0.10) return cfg.opp_top10;
  if (pct <= 0.25) return cfg.opp_top25;
  if (pct <= 0.50) return cfg.opp_top50;
  if (pct <= 0.75) return cfg.opp_bot50;
  return cfg.opp_bot25;
}

export function getCompetitionMultiplier(competitionType, competitionSlug, division, cfg) {
  if (competitionType === "regional_league") {
    return division === 1 ? cfg.comp_regional_div1 : cfg.comp_regional_div2;
  }
  if (competitionType === "competition") {
    if (competitionSlug === "supreme")    return cfg.comp_supreme;
    if (competitionSlug === "elite")      return cfg.comp_elite;
    if (competitionSlug === "challenger") return cfg.comp_challenger;
  }
  return cfg.comp_tournament;
}

export function getStageMultiplier(phase, cfg) {
  if (!phase) return cfg.stage_group;
  const p = phase.toLowerCase();
  if ((p.includes("final") || p === "knockout_final") && !p.includes("semi") && !p.includes("quarter")) return cfg.stage_final;
  if (p.includes("semi") || p === "knockout_sf")   return cfg.stage_sf;
  if (p.includes("quarter") || p === "knockout_qf") return cfg.stage_qf;
  if (p.includes("r16") || p === "knockout_r16")   return cfg.stage_r16;
  if (p.includes("playoff"))                        return cfg.stage_playoff;
  return cfg.stage_group;
}

// ─── Core point computation ────────────────────────────────────────────────────

export function computeMatchPoints({
  result,           // "W" | "D" | "L"
  opponentGlobalRank,
  totalClubs,
  competitionType,  // "regional_league" | "competition" | "tournament"
  competitionSlug,  // "supreme" | "elite" | "challenger" | null
  division,         // 1 | 2 | null
  phase,            // "league" | "playoff_round" | "knockout_r16" | ... | "knockout_final"
  config,
}) {
  const cfg = config || DEFAULT_CONFIG;
  const base     = result === "W" ? cfg.win_points : result === "D" ? cfg.draw_points : cfg.loss_points;
  const oppMult  = getOpponentMultiplier(opponentGlobalRank, totalClubs, cfg);
  const compMult = getCompetitionMultiplier(competitionType, competitionSlug, division, cfg);
  const stageMult = getStageMultiplier(phase, cfg);
  return {
    points: Math.round(base * oppMult * compMult * stageMult),
    oppMult, compMult, stageMult,
  };
}

// ─── Main update function ──────────────────────────────────────────────────────
// Call this after any match result is confirmed. homeClub and awayClub must be
// full Club records (with id, ranking_points, global_rank, form, win_streak, etc.)

export async function updateClubRankingAfterMatch({
  homeClub,
  awayClub,
  homeScore,
  awayScore,
  competitionType,
  competitionSlug = null,
  division = null,
  phase = null,
  matchId = null,
}) {
  const config    = await getRankingConfig();
  const allClubs  = await base44.entities.Club.list("-ranking_points", 1000).catch(() => []);
  const totalClubs = allClubs.length || 1;

  // Look up current global ranks (from live sorted list, not stored field — more accurate)
  const homeRank = (allClubs.findIndex(c => c.id === homeClub.id) + 1) || totalClubs;
  const awayRank = (allClubs.findIndex(c => c.id === awayClub.id) + 1) || totalClubs;

  const isDraw  = homeScore === awayScore;
  const homeWin = homeScore > awayScore;
  const homeResult = homeWin ? "W" : isDraw ? "D" : "L";
  const awayResult = homeWin ? "L" : isDraw ? "D" : "W";

  const { points: homeEarned, oppMult: hOpp, compMult: hComp, stageMult: hStage } = computeMatchPoints({
    result: homeResult, opponentGlobalRank: awayRank, totalClubs,
    competitionType, competitionSlug, division, phase, config,
  });
  const { points: awayEarned, oppMult: aOpp, compMult: aComp, stageMult: aStage } = computeMatchPoints({
    result: awayResult, opponentGlobalRank: homeRank, totalClubs,
    competitionType, competitionSlug, division, phase, config,
  });

  const now = new Date().toISOString();
  const updateForm = (existing, r) => [r, ...(existing || [])].slice(0, 5);

  await Promise.all([
    base44.entities.Club.update(homeClub.id, {
      ranking_points: (homeClub.ranking_points || 0) + homeEarned,
      form:        updateForm(homeClub.form, homeResult),
      win_streak:  homeWin ? (homeClub.win_streak || 0) + 1 : 0,
      loss_streak: !homeWin && !isDraw ? (homeClub.loss_streak || 0) + 1 : 0,
    }),
    base44.entities.Club.update(awayClub.id, {
      ranking_points: (awayClub.ranking_points || 0) + awayEarned,
      form:        updateForm(awayClub.form, awayResult),
      win_streak:  !homeWin && !isDraw ? (awayClub.win_streak || 0) + 1 : 0,
      loss_streak: homeWin ? (awayClub.loss_streak || 0) + 1 : 0,
    }),
  ]);

  // Non-fatal: log to RankingHistory if entity is published
  if (base44.entities.RatingHistory) {
    await Promise.all([
      base44.entities.RatingHistory.create({
        club_id:            homeClub.id,
        club_name:          homeClub.name,
        opponent_club_id:   awayClub.id,
        opponent_club_name: awayClub.name,
        match_id:           matchId,
        competition_type:   competitionType,
        competition_slug:   competitionSlug,
        division,
        phase,
        result:             homeResult,
        home_score:         homeScore,
        away_score:         awayScore,
        points_before:      homeClub.ranking_points || 0,
        points_after:       (homeClub.ranking_points || 0) + homeEarned,
        points_change:      homeEarned,
        opponent_rank:      awayRank,
        opp_strength_multiplier: hOpp,
        competition_multiplier:  hComp,
        stage_multiplier:        hStage,
        played_at:          now,
      }),
      base44.entities.RatingHistory.create({
        club_id:            awayClub.id,
        club_name:          awayClub.name,
        opponent_club_id:   homeClub.id,
        opponent_club_name: homeClub.name,
        match_id:           matchId,
        competition_type:   competitionType,
        competition_slug:   competitionSlug,
        division,
        phase,
        result:             awayResult,
        home_score:         homeScore,
        away_score:         awayScore,
        points_before:      awayClub.ranking_points || 0,
        points_after:       (awayClub.ranking_points || 0) + awayEarned,
        points_change:      awayEarned,
        opponent_rank:      homeRank,
        opp_strength_multiplier: aOpp,
        competition_multiplier:  aComp,
        stage_multiplier:        aStage,
        played_at:          now,
      }),
    ]).catch(() => {}); // non-fatal
  }

  return { homeEarned, awayEarned };
}

// ─── Recalculate all global ranks ─────────────────────────────────────────────
// Sorts all clubs by ranking_points DESC and writes their global_rank positions.
// Run after bulk operations or periodic recalculation.

export async function recalculateGlobalRanks() {
  const clubs = await base44.entities.Club.list("-ranking_points", 1000);
  await Promise.all(
    clubs.map((club, i) =>
      base44.entities.Club.update(club.id, { global_rank: i + 1 })
    )
  );
  return clubs.length;
}

// ─── Recalculate all regional ranks ───────────────────────────────────────────
// Within each region, sorts clubs by ranking_points DESC and writes regional_rank.

export async function recalculateRegionalRanks() {
  const clubs = await base44.entities.Club.list(null, 1000);

  const byRegion = {};
  for (const club of clubs) {
    const r = club.region || "Unknown";
    if (!byRegion[r]) byRegion[r] = [];
    byRegion[r].push(club);
  }

  const updates = [];
  for (const regionClubs of Object.values(byRegion)) {
    regionClubs.sort((a, b) => (b.ranking_points || 0) - (a.ranking_points || 0));
    regionClubs.forEach((club, i) =>
      updates.push(base44.entities.Club.update(club.id, { regional_rank: i + 1 }))
    );
  }
  await Promise.all(updates);
  return Object.keys(byRegion).length;
}

// ─── Seeding ──────────────────────────────────────────────────────────────────
// Returns clubs sorted for tournament/qualifier seeding.
// Seed 1 = highest ranking_points. Ties broken by wins, then fewest losses.

export function seedClubs(clubs) {
  return [...clubs].sort((a, b) => {
    const ptsDiff = (b.ranking_points || 0) - (a.ranking_points || 0);
    if (ptsDiff !== 0) return ptsDiff;
    const winsDiff = (b.wins || 0) - (a.wins || 0);
    if (winsDiff !== 0) return winsDiff;
    return (a.losses || 0) - (b.losses || 0);
  });
}

// ─── Qualification priority ───────────────────────────────────────────────────
// When multiple clubs qualify from different regions, sort them by regional_rank
// (then ranking_points as tiebreak) to determine which get the top slots.

export function sortByQualificationPriority(clubs) {
  return [...clubs].sort((a, b) => {
    const raDiff = (a.regional_rank || 9999) - (b.regional_rank || 9999);
    if (raDiff !== 0) return raDiff;
    return (b.ranking_points || 0) - (a.ranking_points || 0);
  });
}
