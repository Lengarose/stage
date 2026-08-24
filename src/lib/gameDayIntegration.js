import { stageClient } from "@/api/stageClient";
import { isActiveGameDayMatch } from "@/lib/gameDayPresentation";

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
  const schedulingStatus = String(fixture.scheduling_status || "").toLowerCase();
  const fixtureStatus = String(fixture.status || "").toLowerCase();
  const isConfirmedFixture = schedulingStatus === "confirmed" || fixtureStatus === "scheduled";
  if (!isConfirmedFixture) return null;

  const sourceType = fixtureType === "regional_league" || fixtureType === "regional_league_fixture"
    ? "regional_league"
    : "competition";
  const fixtureEntity = sourceType === "regional_league"
    ? stageClient.entities.RegionalLeagueFixture
    : stageClient.entities.CompetitionFixture;

  const existingByLinkedId = fixture.match_id
    ? await stageClient.entities.Match.get(fixture.match_id).catch(() => null)
    : null;
  if (existingByLinkedId?.id) {
    return isActiveGameDayMatch(existingByLinkedId) ? existingByLinkedId : null;
  }

  const existingBySource = await stageClient.entities.Match
    .filter({ source_fixture_id: fixture.id, source_fixture_type: sourceType }, "-created_date", 1)
    .catch(() => []);
  if (existingBySource[0]?.id) {
    if (!isActiveGameDayMatch(existingBySource[0])) return null;
    if (!fixture.match_id && fixtureEntity?.update) {
      await fixtureEntity.update(fixture.id, { match_id: existingBySource[0].id }).catch(() => {});
    }
    return existingBySource[0];
  }

  try {
    const result = await stageClient.functions.invoke("createMatchFromLeagueFixture", {
      fixture_id: fixture.id,
      fixture_type: sourceType,
    });
    const match = result?.data?.match || result?.match || null;
    if (match?.id) return isActiveGameDayMatch(match) ? match : null;
  } catch (err) {
    // Older deployments may not have the server function yet. Fall back to the
    // normal Match route so confirmed fixtures never disappear from Game Day.
    console.warn("[GameDay] server fixture conversion failed, using direct match fallback", err);
  }

  const scheduledDate = fixture.confirmed_date || fixture.scheduled_date || null;
  const created = await stageClient.entities.Match.create({
    home_club_id: fixture.home_club_id || null,
    home_club_name: fixture.home_club_name || null,
    home_owner_email: fixture.home_owner_email || null,
    away_club_id: fixture.away_club_id || null,
    away_club_name: fixture.away_club_name || null,
    away_owner_email: fixture.away_owner_email || null,
    home_player_id: fixture.home_player_id || null,
    home_player_name: fixture.home_player_name || null,
    home_player_email: fixture.home_player_email || null,
    away_player_id: fixture.away_player_id || null,
    away_player_name: fixture.away_player_name || null,
    away_player_email: fixture.away_player_email || null,
    mode: fixture.home_player_id || fixture.away_player_id ? "solo" : "club",
    status: "scheduled",
    scheduled_date: scheduledDate,
    tournament_id: sourceType === "competition"
      ? (fixture.season_id || fixture.competition_id || null)
      : (fixture.league_id || null),
    round: fixture.matchday || fixture.round || 1,
    source_fixture_id: fixture.id,
    source_fixture_type: sourceType,
    competition_context: buildMatchContext(fixture, sourceType),
    type: sourceType,
    stats_processed: 0,
    wager_stc: 0,
    wager_status: "none",
  });
  if (created?.id && fixtureEntity?.update) {
    await fixtureEntity.update(fixture.id, { match_id: created.id, status: fixture.status || "scheduled" }).catch(() => {});
  }
  return created || null;
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
