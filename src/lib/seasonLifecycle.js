import { stageClient } from "@/api/stageClient";
import { OFFICIAL_STAGE_TOURNAMENT_MAX_CLUBS, REGIONAL_LEAGUE_MAX_CLUBS } from "./qualificationConfig";

// ─── Competition season lifecycle ────────────────────────────────────────────

export async function openSeasonRegistration(season) {
  throw new Error(`${season?.competition_name || "This competition"} is qualification-only. Confirm qualified clubs instead of opening public registration.`);
}

export async function archiveCompetitionSeason(season) {
  return stageClient.http.post(`/competition-views/competition_season/${encodeURIComponent(season.id)}/reconcile`,{action:'archive',reason:'Admin requested archival after verified season settlement'});
}

export async function createNextCompetitionSeason(season, competition) {
  const config=await (await import('./rewardsEngine')).getRewardConfiguration(season.competition_id,'competition');
  const nextNumber = (season.season_number || 1) + 1;
  const created = await stageClient.entities.CompetitionSeason.create({
    competition_id:        season.competition_id,
    competition_name:      season.competition_name,
    competition_tier:      season.competition_tier,
    competition_slug:      season.competition_slug,
    season_number:         nextNumber,
    season_label:          `Season ${nextNumber}`,
    platform:              season.platform,
    region:                season.region,
    format:                season.format || "league_36_8md",
    num_league_matchdays:  season.num_league_matchdays || 8,
    league_matchday_total: season.league_matchday_total || 8,
    fixtures_generated:    false,
    registered_club_ids:   [],
    num_clubs:             0,
    max_clubs:             OFFICIAL_STAGE_TOURNAMENT_MAX_CLUBS,
    target_clubs:          OFFICIAL_STAGE_TOURNAMENT_MAX_CLUBS,
    current_matchday:      1,
    status:                "draft",
    prize_pool_stc:        config.version ? config.settings.budget : '0.00',
  });
  if (competition) {
    const { ensureDefaultRewardConfigs } = await import("./rewardsEngine");
    await ensureDefaultRewardConfigs(competition.id, "competition", competition.name, competition, OFFICIAL_STAGE_TOURNAMENT_MAX_CLUBS);
  }
  await stageClient.entities.CompetitionSeason.update(season.id, { next_season_id: created.id });
  if (competition) {
    await stageClient.entities.Competition.update(competition.id, { current_season: nextNumber });
  }
  return created;
}

// ─── Regional league lifecycle ────────────────────────────────────────────────

export async function openLeagueRegistration(league) {
  await stageClient.entities.RegionalLeague.update(league.id, {
    status: "registration",
    seeding_mode: Boolean(league.seeding_mode),
    placement_locked: false,
  });
}

export async function startLeague(league) {
  await stageClient.http.post(`/competition-views/regional_league/${encodeURIComponent(league.id)}/reconcile`,{action:'capture_rewards',reason:'Capture the regional reward promise before league start'});
  const now = new Date().toISOString();
  await stageClient.entities.RegionalLeague.update(league.id, {
    status: "in_progress",
    start_date: now,
    started_at: now,
    registration_closed_at: now,
    seeding_mode: false,
    placement_locked: true,
    launch_seeding_closed_at: league.launch_seeding_closed_at || now,
  });
}

export async function archiveLeague(league) {
  return stageClient.http.post(`/competition-views/regional_league/${encodeURIComponent(league.id)}/reconcile`,{action:'archive',reason:'Admin requested archival after verified season settlement'});
}

export async function createNextLeagueSeason(league) {
  const result = await stageClient.http.post(`/regional-leagues/${encodeURIComponent(league.id)}/next-season`, {});
  const created = result.record;
  const { ensureDefaultRewardConfigs } = await import("./rewardsEngine");
  await ensureDefaultRewardConfigs(created.id, "regional_league", created.name, created, created.max_clubs || REGIONAL_LEAGUE_MAX_CLUBS);

  return created;
}
