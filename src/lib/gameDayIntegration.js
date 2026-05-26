import { stageClient } from "@/api/stageClient";

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
  if (!fixture?.id) return null;
  const result = await stageClient.functions.invoke("createMatchFromLeagueFixture", {
    fixture_id: fixture.id,
    fixture_type: fixtureType,
  });
  return result?.data?.match || result?.match || null;
}

// ─── Sync completed match result back to fixture + standings ──────────────────

export async function syncFixtureAfterMatch(match) {
  if (!match?.source_fixture_id || !match?.source_fixture_type) return;
  if (match.status !== "completed") return;
  try {
    await stageClient.functions.invoke("syncCompletedMatchToSource", { match_id: match.id });
  } catch {
    // Non-fatal: fixture sync failure must not degrade the match flow
  }
}

// ─── Sync aggregate player career stats after match ───────────────────────────

export async function syncPlayerCareerStats(matchId) {
  if (!matchId) return;
  try {
    const stats = await stageClient.entities.MatchPlayerStat.filter({ match_id: matchId }, null, 50).catch(() => []);
    if (!stats.length) return;

    await Promise.all(stats.map(async (stat) => {
      if (!stat.player_email) return;
      const players = await stageClient.entities.Player.filter({ email: stat.player_email }, null, 1).catch(() => []);
      const player  = players[0];
      if (!player) return;

      const allStats = await stageClient.entities.MatchPlayerStat.filter(
        { player_email: stat.player_email }, null, 500
      ).catch(() => []);

      const totalGoals   = allStats.reduce((s, r) => s + (r.goals   || 0), 0);
      const totalAssists = allStats.reduce((s, r) => s + (r.assists  || 0), 0);
      const rated        = allStats.filter(r => r.rating && r.rating > 0);
      const avgRating    = rated.length
        ? Math.round((rated.reduce((s, r) => s + r.rating, 0) / rated.length) * 10) / 10
        : 0;

      await stageClient.entities.Player.update(player.id, {
        goals:      totalGoals,
        assists:    totalAssists,
        avg_rating: avgRating,
      }).catch(() => {});
    }));
  } catch {
    // Non-fatal
  }
}
