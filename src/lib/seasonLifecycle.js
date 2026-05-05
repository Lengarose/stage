import { base44 } from "@/api/base44Client";
import { sortStandings } from "./competitionUtils";

// ─── Competition season lifecycle ────────────────────────────────────────────

export async function openSeasonRegistration(season) {
  await base44.entities.CompetitionSeason.update(season.id, { status: "registration" });
}

export async function archiveCompetitionSeason(season, competition) {
  const standings = await (base44.entities.CompetitionStanding?.filter(
    { season_id: season.id }, null, 200
  ) ?? Promise.resolve([])).catch(() => []);

  if (!standings.length) throw new Error("No standings found — cannot archive an empty season.");

  const sorted = sortStandings(standings);
  const ops = [];

  // Stamp final positions on any that don't have them
  sorted.forEach((s, i) => {
    if (!s.final_position) {
      ops.push(base44.entities.CompetitionStanding.update(s.id, { final_position: i + 1 }));
    }
  });

  // Mark promotions / relegations from competition config
  const promoSpots = competition?.promotion_spots || 0;
  const relSpots   = competition?.relegation_spots || 0;
  sorted.slice(0, promoSpots).forEach(s => {
    ops.push(base44.entities.CompetitionStanding.update(s.id, { is_promoted: true }));
  });
  sorted.slice(sorted.length - relSpots).forEach(s => {
    if (relSpots > 0) ops.push(base44.entities.CompetitionStanding.update(s.id, { is_relegated: true }));
  });

  const winner   = sorted[0];
  const runnerUp = sorted[1] || null;

  const seasonPatch = {
    status:      "archived",
    archived_at: new Date().toISOString(),
  };
  if (winner)   { seasonPatch.winner_club_id = winner.club_id; seasonPatch.winner_club_name = winner.club_name; }
  if (runnerUp) { seasonPatch.runner_up_club_id = runnerUp.club_id; seasonPatch.runner_up_club_name = runnerUp.club_name; }

  // Award achievement to winner
  if (winner?.club_id) {
    const clubs = await base44.entities.Club.filter({ id: winner.club_id }, null, 1).catch(() => []);
    const club = clubs[0];
    if (club) {
      const label = `${season.competition_name} — Season ${season.season_number} Winner`;
      const current = club.achievements || [];
      if (!current.includes(label)) {
        ops.push(base44.entities.Club.update(club.id, { achievements: [...current, label] }));
      }
    }
  }

  await Promise.all(ops);
  await base44.entities.CompetitionSeason.update(season.id, seasonPatch);

  // Distribute STC prizes, trophies, and achievements (non-fatal)
  import("./rewardsEngine").then(({ distributeSeasonRewards }) =>
    distributeSeasonRewards({
      sourceId:       season.competition_id,
      sourceType:     "competition",
      sourceName:     season.competition_name || competition?.name || "Competition",
      seasonId:       season.id,
      seasonNumber:   season.season_number,
      seasonLabel:    season.season_label || `Season ${season.season_number}`,
      trophyImageUrl: competition?.trophy_image_url || "",
      standings:      sorted.map((s, i) => ({ ...s, final_position: s.final_position || (i + 1) })),
    })
  ).catch(() => {});
}

export async function createNextCompetitionSeason(season, competition) {
  const nextNumber = (season.season_number || 1) + 1;
  const created = await base44.entities.CompetitionSeason.create({
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
    current_matchday:      1,
    status:                "draft",
    prize_pool_stc:        season.prize_pool_stc || 0,
  });
  await base44.entities.CompetitionSeason.update(season.id, { next_season_id: created.id });
  if (competition) {
    await base44.entities.Competition.update(competition.id, { current_season: nextNumber });
  }
  return created;
}

// ─── Regional league lifecycle ────────────────────────────────────────────────

export async function openLeagueRegistration(league) {
  await base44.entities.RegionalLeague.update(league.id, { status: "registration" });
}

export async function archiveLeague(league) {
  const standings = await (base44.entities.RegionalLeagueStanding?.filter(
    { league_id: league.id }, null, 50
  ) ?? Promise.resolve([])).catch(() => []);

  const ops = [];
  const sorted = standings.slice().sort((a, b) =>
    (a.final_position || a.position || 99) - (b.final_position || b.position || 99)
  );

  sorted.forEach((s, i) => {
    if (!s.final_position) {
      ops.push(base44.entities.RegionalLeagueStanding.update(s.id, { final_position: i + 1 }));
    }
  });

  const winner = sorted[0];
  const patch = {
    status:      "archived",
    archived_at: new Date().toISOString(),
  };
  if (winner) { patch.winner_club_id = winner.club_id; patch.winner_club_name = winner.club_name; }

  // Award achievement to winner
  if (winner?.club_id) {
    const clubs = await base44.entities.Club.filter({ id: winner.club_id }, null, 1).catch(() => []);
    const club = clubs[0];
    if (club) {
      const label = `${league.name} — Season ${league.season_number} Winner`;
      const current = club.achievements || [];
      if (!current.includes(label)) {
        ops.push(base44.entities.Club.update(club.id, { achievements: [...current, label] }));
      }
    }
  }

  await Promise.all(ops);
  await base44.entities.RegionalLeague.update(league.id, patch);

  // Distribute STC prizes, trophies, and achievements (non-fatal)
  import("./rewardsEngine").then(({ distributeSeasonRewards }) =>
    distributeSeasonRewards({
      sourceId:       league.id,
      sourceType:     "regional_league",
      sourceName:     league.name,
      seasonId:       "",
      seasonNumber:   league.season_number,
      seasonLabel:    `Season ${league.season_number}`,
      trophyImageUrl: league.trophy_image_url || "",
      standings:      sorted.map((s, i) => ({ ...s, final_position: s.final_position || (i + 1) })),
    })
  ).catch(() => {});
}

export async function createNextLeagueSeason(league) {
  const baseSlug   = league.slug.replace(/-s\d+$/, "");
  const nextNumber = (league.season_number || 1) + 1;
  const newSlug    = `${baseSlug}-s${nextNumber}`;

  const created = await base44.entities.RegionalLeague.create({
    name:            league.name,
    slug:            newSlug,
    region_slug:     league.region_slug,
    division:        league.division || 1,
    country_code:    league.country_code || "",
    region:          league.region,
    platform:        league.platform,
    season_number:   nextNumber,
    status:          "draft",
    max_clubs:       league.max_clubs || 16,
    num_clubs:       0,
    promoted_slots:  league.promoted_slots || 2,
    registered_club_ids: [],
    linked_league_slug:  league.linked_league_slug || null,
  });

  await base44.entities.RegionalLeague.update(league.id, { next_season_id: created.id });
  return created;
}
