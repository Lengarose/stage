import { stageClient } from "@/api/stageClient";
import { REGIONAL_LEAGUE_MAX_CLUBS } from "@/lib/qualificationConfig";

export function getRegionalLeagueMaxClubs(league) {
  return Number(league?.max_clubs) || REGIONAL_LEAGUE_MAX_CLUBS;
}

export function isRegionalLeagueFull(league) {
  return Number(league?.num_clubs || 0) >= getRegionalLeagueMaxClubs(league);
}

export function isRegionalLeagueSetupSeedingOpen(league) {
  const status = String(league?.status || "").toLowerCase();
  if (!["draft", "setup", "registration"].includes(status)) return false;
  if (league?.fixtures_generated) return false;
  if (league?.launch_seeding_closed_at) return false;
  if ((Number(league?.season_number) || 1) === 1) return true;
  if (league?.placement_locked) return false;
  return league?.seeding_mode !== false;
}

export function sortRegionalLeaguesByDivision(leagues) {
  return [...(leagues || [])].sort((a, b) => (Number(a.division) || 1) - (Number(b.division) || 1));
}

export function getLowestOpenDivision(leagues) {
  const open = (leagues || []).filter(l => l.status === "registration" && !isRegionalLeagueFull(l));
  if (!open.length) return null;
  return Math.max(...open.map(l => Number(l.division) || 1));
}

export function getOpenRegionalLeagueCandidates(registration, regionalLeagues) {
  return sortRegionalLeaguesByDivision((regionalLeagues || []).filter(
    league => league.region_slug === registration.region_slug
      && league.status === "registration"
      && (
        league.platform === registration.platform ||
        league.platform === "Cross-Platform" ||
        registration.platform === "Cross-Platform"
      )
  ));
}

function getPlacementDivisionFromStanding(standing, leagues) {
  const currentDivision = Number(standing?.division) || 1;
  if (standing?.is_promoted) {
    const target = leagues.find(l => l.id === standing.promotion_target_league_id);
    return Number(target?.division) || Math.max(1, currentDivision - 1);
  }
  if (standing?.is_relegated) {
    const target = leagues.find(l => l.id === standing.relegation_target_league_id);
    return Number(target?.division) || currentDivision + 1;
  }
  return currentDivision;
}

export async function getClubRegionalLeaguePlacement(clubId, regionalLeagues) {
  if (!clubId || !stageClient.entities.RegionalLeagueStanding) return null;
  const rows = await stageClient.entities.RegionalLeagueStanding
    .filter({ club_id: clubId }, null, 200)
    .catch(() => []);
  const completedRows = (rows || [])
    .filter(row => row.final_position || row.is_promoted || row.is_relegated)
    .sort((a, b) => {
      const seasonDelta = (Number(b.season_number) || 0) - (Number(a.season_number) || 0);
      if (seasonDelta) return seasonDelta;
      return (Number(b.final_position) || 999) - (Number(a.final_position) || 999);
    });
  const latest = completedRows[0];
  if (!latest) return null;
  return {
    sourceStanding: latest,
    division: getPlacementDivisionFromStanding(latest, regionalLeagues),
  };
}

export async function getEligibleRegionalLeaguesForRegistration(registration, regionalLeagues, options = {}) {
  const candidates = getOpenRegionalLeagueCandidates(registration, regionalLeagues);
  const withCapacity = candidates.filter(league => !isRegionalLeagueFull(league));
  if (!withCapacity.length) {
    return { eligibleLeagues: [], placement: null, reason: "No open league spots in this region." };
  }

  if (options.allowSetupSeeding) {
    const setupSeedLeagues = withCapacity.filter(isRegionalLeagueSetupSeedingOpen);
    if (setupSeedLeagues.length) {
      return {
        eligibleLeagues: setupSeedLeagues,
        placement: null,
        reason: "",
      };
    }
  }

  const placement = await getClubRegionalLeaguePlacement(registration.club_id, regionalLeagues);
  if (placement?.division) {
    const eligibleLeagues = withCapacity.filter(league => (Number(league.division) || 1) === placement.division);
    return {
      eligibleLeagues,
      placement,
      reason: eligibleLeagues.length
        ? ""
        : `This club's next-season placement is Division ${placement.division}, but no matching open division has space.`,
    };
  }

  const lowestOpenDivision = getLowestOpenDivision(candidates);
  const eligibleLeagues = withCapacity.filter(league => (Number(league.division) || 1) === lowestOpenDivision);
  return {
    eligibleLeagues,
    placement: null,
    reason: eligibleLeagues.length
      ? ""
      : "New clubs can only enter the lowest open division, and it has no space.",
  };
}
