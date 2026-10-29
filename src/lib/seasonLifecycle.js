import { stageClient } from "@/api/stageClient";

// ─── Competition season lifecycle ────────────────────────────────────────────

export async function openSeasonRegistration(season) {
  throw new Error(`${season?.competition_name || "This competition"} is qualification-only. Confirm qualified clubs instead of opening public registration.`);
}

export async function archiveCompetitionSeason(season) {
  return stageClient.http.post(`/competition-views/competition_season/${encodeURIComponent(season.id)}/reconcile`,{action:'archive',reason:'Admin requested archival after verified season settlement'});
}

export async function createNextCompetitionSeason(season, _competition) {
  const result = await stageClient.http.post(
    `/competition-views/competition_season/${encodeURIComponent(season.id)}/lifecycle`,
    { action: "rollover", season_number: season.season_number || 1 }
  );
  return result.record;
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
  return result.record;
}
