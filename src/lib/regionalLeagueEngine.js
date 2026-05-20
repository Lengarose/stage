import { stageClient } from "@/api/stageClient";
import { sortStandings } from "./competitionUtils";
import { STAGE_QUALIFICATION_RULES, RELEGATION_SPOTS, PROMOTION_SPOTS } from "./qualificationConfig";

/**
 * Process end-of-season for a regional league.
 *
 * Division 1: creates QualificationEntry records for all 3 STAGE competitions
 *             per the STAGE_QUALIFICATION_RULES config, marks relegated clubs,
 *             and stamps relegation_target_league_id on their standings.
 * Division 2: marks promoted clubs with promotion_target_league_id pointing
 *             to the paired Div 1 league.
 *
 * @param {object} league       - RegionalLeague record
 * @param {Array}  standings    - RegionalLeagueStanding records for this league/season
 * @param {Array}  competitions - Competition records (for ID lookup)
 * @param {Array}  allLeagues   - All RegionalLeague records (for linked-league lookup)
 * @returns {object} summary of what was created
 */
export async function processLeagueSeasonEnd(league, standings, competitions, allLeagues = []) {
  if (!standings.length) throw new Error("No standings found — add clubs before processing.");

  const sorted = sortStandings(standings);
  const total = sorted.length;

  // Find the paired league in the other division for this region
  const linkedLeague = allLeagues.find(l => l.slug === league.linked_league_slug) || null;

  if ((league.division || 1) !== 1) {
    return processDiv2SeasonEnd(league, sorted, linkedLeague);
  }

  // ── Division 1: STAGE qualification + relegation ─────────────────────────

  const ops = [];

  // Build a dedup set: fetch all existing pending entries for clubs in this league
  const clubIds = sorted.map(s => s.club_id);
  const existingEntries = await Promise.all(
    clubIds.map(id =>
      stageClient.entities.QualificationEntry.filter({ club_id: id, status: "pending" }, null, 10).catch(() => [])
    )
  );
  // Map: clubId → Set of target_competition_id strings already pending
  const pendingMap = {};
  existingEntries.forEach((entries, i) => {
    pendingMap[clubIds[i]] = new Set((entries || []).map(e => e.target_competition_id));
  });

  // Create one QualificationEntry per qualifying position per rule (skip duplicates)
  for (const rule of STAGE_QUALIFICATION_RULES) {
    const comp = competitions.find(c => c.slug === rule.competitionSlug);
    if (!comp) continue;

    for (const pos of rule.positions) {
      if (pos > total) continue;
      const s = sorted[pos - 1];

      // Skip if club already has a pending entry for this competition
      if (pendingMap[s.club_id]?.has(comp.id)) continue;

      ops.push(
        stageClient.entities.QualificationEntry.create({
          source_type: "regional_league",
          regional_league_id: league.id,
          regional_league_name: league.name,
          regional_finish_position: pos,
          target_competition_id: comp.id,
          target_competition_name: comp.name,
          target_competition_tier: comp.tier,
          target_season_id: null,
          target_season_number: null,
          club_id: s.club_id,
          club_name: s.club_name,
          club_logo_url: s.club_logo_url || "",
          club_tag: s.club_tag || "",
          club_region: s.region || "",
          club_platform: s.platform || "",
          status: "pending",
        })
      );
      ops.push(
        stageClient.entities.RegionalLeagueStanding.update(s.id, {
          is_stage_qualified: true,
          stage_competition_slug: rule.competitionSlug,
          final_position: pos,
        })
      );
    }
  }

  // Mark relegated clubs (bottom RELEGATION_SPOTS)
  const relegated = sorted.slice(Math.max(0, total - RELEGATION_SPOTS));
  for (const s of relegated) {
    const update = {
      is_relegated: true,
      final_position: sorted.indexOf(s) + 1,
    };
    if (linkedLeague) update.relegation_target_league_id = linkedLeague.id;
    ops.push(stageClient.entities.RegionalLeagueStanding.update(s.id, update));
  }

  // Stamp final position on all other clubs
  for (let i = 0; i < total; i++) {
    const s = sorted[i];
    const isQualified = STAGE_QUALIFICATION_RULES.some(r => r.positions.includes(i + 1));
    const isRelegated = i >= total - RELEGATION_SPOTS;
    if (!isQualified && !isRelegated) {
      ops.push(stageClient.entities.RegionalLeagueStanding.update(s.id, { final_position: i + 1 }));
    }
  }

  await Promise.all(ops);
  await stageClient.entities.RegionalLeague.update(league.id, { status: "completed" });

  const qualCount = STAGE_QUALIFICATION_RULES.reduce((n, r) =>
    n + r.positions.filter(p => p <= total).length, 0
  );

  return { type: "div1", qualified: qualCount, relegated: relegated.length };
}

async function processDiv2SeasonEnd(league, sorted, linkedLeague) {
  const total = sorted.length;
  const ops = [];

  const promoted = sorted.slice(0, Math.min(PROMOTION_SPOTS, total));
  for (let i = 0; i < promoted.length; i++) {
    const update = { is_promoted: true, final_position: i + 1 };
    if (linkedLeague) update.promotion_target_league_id = linkedLeague.id;
    ops.push(stageClient.entities.RegionalLeagueStanding.update(promoted[i].id, update));
  }

  // Relegate bottom 2 only if the division has enough clubs
  if (total > RELEGATION_SPOTS + PROMOTION_SPOTS) {
    const relegated = sorted.slice(total - RELEGATION_SPOTS);
    for (const s of relegated) {
      ops.push(stageClient.entities.RegionalLeagueStanding.update(s.id, {
        is_relegated: true,
        final_position: sorted.indexOf(s) + 1,
      }));
    }
  }

  // Stamp final position on mid-table
  for (let i = PROMOTION_SPOTS; i < total - RELEGATION_SPOTS; i++) {
    ops.push(stageClient.entities.RegionalLeagueStanding.update(sorted[i].id, { final_position: i + 1 }));
  }

  await Promise.all(ops);
  await stageClient.entities.RegionalLeague.update(league.id, { status: "completed" });

  return { type: "div2", promoted: promoted.length };
}
