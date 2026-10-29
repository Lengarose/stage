import { stageClient } from "@/api/stageClient";

// Completion outcomes are validated and applied by the canonical server lifecycle.
export async function processLeagueSeasonEnd(league, _standings, _competitions, _allLeagues = []) {
  return stageClient.http.post(
    `/competition-views/regional_league/${encodeURIComponent(league.id)}/lifecycle`,
    { action: "complete", season_number: league.season_number || 1 }
  );
}
