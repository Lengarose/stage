import { base44 } from "@/api/base44Client";
import { sortStandings } from "./competitionUtils";
import { STAGE_QUALIFICATION_RULES, RELEGATION_SPOTS, PROMOTION_SPOTS } from "./qualificationConfig";

/**
 * Process end-of-season for a regional league.
 *
 * Division 1: creates QualificationEntry records for all 3 STAGE competitions
 *             per the STAGE_QUALIFICATION_RULES config, marks relegated clubs.
 * Division 2: marks promoted and relegated clubs (no STAGE entries).
 *
 * @param {object} league   - RegionalLeague record
 * @param {Array}  standings - RegionalLeagueStanding records for this league/season
 * @param {Array}  competitions - Competition records (for ID lookup)
 * @returns {object} summary of what was created
 */
export async function processLeagueSeasonEnd(league, standings, competitions) {
  if (!standings.length) throw new Error("No standings found — add clubs before processing.");

  const sorted = sortStandings(standings);
  const total = sorted.length;

  if ((league.division || 1) !== 1) {
    return processDiv2SeasonEnd(league, sorted);
  }

  // ── Division 1: STAGE qualification + relegation ─────────────────────────

  const ops = [];

  // Create one QualificationEntry per qualifying position per rule
  for (const rule of STAGE_QUALIFICATION_RULES) {
    const comp = competitions.find(c => c.slug === rule.competitionSlug);
    if (!comp) continue;

    for (const pos of rule.positions) {
      if (pos > total) continue;
      const s = sorted[pos - 1];
      ops.push(
        base44.entities.QualificationEntry.create({
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
      // Mark standing as qualified
      ops.push(
        base44.entities.RegionalLeagueStanding.update(s.id, {
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
    ops.push(
      base44.entities.RegionalLeagueStanding.update(s.id, {
        is_relegated: true,
        final_position: sorted.indexOf(s) + 1,
      })
    );
  }

  // Mark all other clubs with their final position
  for (let i = 0; i < total; i++) {
    const s = sorted[i];
    const isQualified = STAGE_QUALIFICATION_RULES.some(r => r.positions.includes(i + 1));
    const isRelegated = i >= total - RELEGATION_SPOTS;
    if (!isQualified && !isRelegated) {
      ops.push(base44.entities.RegionalLeagueStanding.update(s.id, { final_position: i + 1 }));
    }
  }

  await Promise.all(ops);
  await base44.entities.RegionalLeague.update(league.id, { status: "completed" });

  const qualCount = STAGE_QUALIFICATION_RULES.reduce((n, r) =>
    n + r.positions.filter(p => p <= total).length, 0
  );

  return { type: "div1", qualified: qualCount, relegated: relegated.length };
}

async function processDiv2SeasonEnd(league, sorted) {
  const total = sorted.length;
  const ops = [];

  const promoted = sorted.slice(0, Math.min(PROMOTION_SPOTS, total));
  for (let i = 0; i < promoted.length; i++) {
    ops.push(base44.entities.RegionalLeagueStanding.update(promoted[i].id, {
      is_promoted: true,
      final_position: i + 1,
    }));
  }

  // Relegate bottom 2 only if the division has enough clubs
  if (total > RELEGATION_SPOTS + PROMOTION_SPOTS) {
    const relegated = sorted.slice(total - RELEGATION_SPOTS);
    for (const s of relegated) {
      ops.push(base44.entities.RegionalLeagueStanding.update(s.id, {
        is_relegated: true,
        final_position: sorted.indexOf(s) + 1,
      }));
    }
  }

  await Promise.all(ops);
  await base44.entities.RegionalLeague.update(league.id, { status: "completed" });

  return { type: "div2", promoted: promoted.length };
}
