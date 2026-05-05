import { base44 } from "@/api/base44Client";

// ─── Context label ────────────────────────────────────────────────────────────

const PHASE_LABEL = {
  league:         md => `League Phase – Matchday ${md}`,
  playoff_round:  ()  => "Playoff Round",
  knockout_r16:   ()  => "Round of 16",
  knockout_qf:    ()  => "Quarter-Final",
  knockout_sf:    ()  => "Semi-Final",
  knockout_final: ()  => "Final",
};

export function buildMatchContext(fixture, fixtureType) {
  if (fixtureType === "regional_league") {
    return `${fixture.league_name || "Regional League"} · Division ${fixture.division || 1} · Matchday ${fixture.matchday || ""}`.trim();
  }
  const phaseFn  = PHASE_LABEL[fixture.phase] || (() => fixture.phase || "Match");
  const phaseStr = phaseFn(fixture.matchday);
  return `${fixture.competition_name || "Competition"} · ${phaseStr}`;
}

// ─── Match creation from a confirmed fixture ──────────────────────────────────

export async function createMatchFromFixture(fixture, fixtureType) {
  // Guard: already linked — just keep the scheduled_date in sync
  if (fixture.match_id) {
    await base44.entities.Match.update(fixture.match_id, {
      scheduled_date: fixture.confirmed_date || fixture.scheduled_date || null,
    }).catch(() => {});
    return { id: fixture.match_id };
  }

  const context = buildMatchContext(fixture, fixtureType);

  const match = await base44.entities.Match.create({
    home_club_id:        fixture.home_club_id,
    home_club_name:      fixture.home_club_name,
    away_club_id:        fixture.away_club_id,
    away_club_name:      fixture.away_club_name,
    mode:                "club",
    status:              "scheduled",
    scheduled_date:      fixture.confirmed_date || fixture.scheduled_date || null,
    // Use the competition/league ID as tournament_id so existing downstream logic works
    tournament_id:       fixtureType === "competition"
      ? (fixture.season_id || fixture.competition_id)
      : (fixture.league_id),
    round:               fixture.matchday || fixture.round || 1,
    source_fixture_id:   fixture.id,
    source_fixture_type: fixtureType,
    competition_context: context,
    stats_processed:     false,
    wager_stc:           0,
    wager_status:        "none",
  });

  // Link fixture → match
  if (fixtureType === "regional_league") {
    await (base44.entities.RegionalLeagueFixture?.update(fixture.id, { match_id: match.id }) ?? Promise.resolve()).catch(() => {});
  } else {
    await (base44.entities.CompetitionFixture?.update(fixture.id, { match_id: match.id }) ?? Promise.resolve()).catch(() => {});
  }

  return match;
}

// ─── Sync completed match result back to fixture + standings ──────────────────

export async function syncFixtureAfterMatch(match) {
  if (!match?.source_fixture_id || !match?.source_fixture_type) return;
  if (match.status !== "completed") return;

  const homeScore  = match.home_score  ?? 0;
  const awayScore  = match.away_score  ?? 0;
  const homeWon    = homeScore > awayScore;
  const awayWon    = awayScore > homeScore;
  const winnerId   = homeWon ? match.home_club_id   : awayWon ? match.away_club_id   : null;
  const winnerName = homeWon ? match.home_club_name : awayWon ? match.away_club_name : null;

  try {
    if (match.source_fixture_type === "competition") {
      const rows = await (base44.entities.CompetitionFixture?.filter(
        { id: match.source_fixture_id }, null, 1
      ) ?? Promise.resolve([])).catch(() => []);
      const fixture = rows[0];
      if (!fixture || fixture.stats_processed) return;

      await base44.entities.CompetitionFixture.update(fixture.id, {
        home_score:       homeScore,
        away_score:       awayScore,
        status:           "completed",
        winner_club_id:   winnerId   || "",
        winner_club_name: winnerName || "",
      });

      const { processFixtureResult } = await import("./competitionUtils");
      await processFixtureResult({
        ...fixture,
        home_score:      homeScore,
        away_score:      awayScore,
        stats_processed: false,
      });

    } else {
      const rows = await (base44.entities.RegionalLeagueFixture?.filter(
        { id: match.source_fixture_id }, null, 1
      ) ?? Promise.resolve([])).catch(() => []);
      const fixture = rows[0];
      if (!fixture || fixture.stats_processed) return;

      await (base44.entities.RegionalLeagueFixture?.update(fixture.id, {
        home_score:       homeScore,
        away_score:       awayScore,
        status:           "played",
        winner_club_id:   winnerId   || "",
        winner_club_name: winnerName || "",
      }) ?? Promise.resolve());

      const { processRegionalLeagueFixtureResult } = await import("./competitionUtils");
      await processRegionalLeagueFixtureResult({
        ...fixture,
        home_score:      homeScore,
        away_score:      awayScore,
        stats_processed: false,
      });
    }
  } catch {
    // Non-fatal: fixture sync failure must not degrade the match flow
  }
}

// ─── Sync aggregate player career stats after match ───────────────────────────

export async function syncPlayerCareerStats(matchId) {
  if (!matchId) return;
  try {
    const stats = await base44.entities.MatchPlayerStat.filter({ match_id: matchId }, null, 50).catch(() => []);
    if (!stats.length) return;

    await Promise.all(stats.map(async (stat) => {
      if (!stat.player_email) return;
      const players = await base44.entities.Player.filter({ email: stat.player_email }, null, 1).catch(() => []);
      const player  = players[0];
      if (!player) return;

      const allStats = await base44.entities.MatchPlayerStat.filter(
        { player_email: stat.player_email }, null, 500
      ).catch(() => []);

      const totalGoals   = allStats.reduce((s, r) => s + (r.goals   || 0), 0);
      const totalAssists = allStats.reduce((s, r) => s + (r.assists  || 0), 0);
      const rated        = allStats.filter(r => r.rating && r.rating > 0);
      const avgRating    = rated.length
        ? Math.round((rated.reduce((s, r) => s + r.rating, 0) / rated.length) * 10) / 10
        : 0;

      await base44.entities.Player.update(player.id, {
        goals:      totalGoals,
        assists:    totalAssists,
        avg_rating: avgRating,
      }).catch(() => {});
    }));
  } catch {
    // Non-fatal
  }
}
