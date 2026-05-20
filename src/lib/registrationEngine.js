import { stageClient } from "@/api/stageClient";

// ─── Club → League registration flow ─────────────────────────────────────────
//
// Clubs apply for a region. Admin assigns them to a specific division's league
// on approval, which creates the standing row and adds the club to the league.
//
// Status machine:  pending → approved | rejected | waitlisted
//                  waitlisted → approved (promoteFromWaitlist)

/**
 * Submit a registration application for a club.
 * @param {object} club   — Club entity record
 * @param {string} regionSlug — e.g. "uk-ireland"
 * @param {string} regionName — display name e.g. "UK & Ireland"
 * @param {string} platform
 * @param {object} options — { preferredDivision, note, seasonLabel }
 */
export async function applyForLeague(club, regionSlug, regionName, platform, {
  preferredDivision = 1,
  note = "",
  seasonLabel = "",
} = {}) {
  // Guard: no duplicate active application for same region + platform
  const existing = await (stageClient.entities.SeasonRegistration?.filter({
    club_id: club.id,
    region_slug: regionSlug,
    platform,
  }, null, 10) ?? Promise.resolve([])).catch(() => []);

  const active = existing.find(r => r.status === "pending" || r.status === "waitlisted" || r.status === "approved");
  if (active) {
    throw new Error(`Your club already has an active application for ${regionName} (${active.status}).`);
  }

  const reg = await stageClient.entities.SeasonRegistration.create({
    club_id:            club.id,
    club_name:          club.name,
    club_tag:           club.tag  || "",
    club_logo_url:      club.logo_url || "",
    owner_email:        club.owner_email || "",
    target_type:        "regional_league",
    region_slug:        regionSlug,
    region_name:        regionName,
    platform,
    preferred_division: preferredDivision || 1,
    note_from_club:     note || "",
    season_label:       seasonLabel || "",
    status:             "pending",
    applied_at:         new Date().toISOString(),
  });

  return reg;
}

/**
 * Approve an application: assigns the club to a specific league, creates their
 * standing row, and marks the application as approved.
 * @param {object} reg       — SeasonRegistration record
 * @param {object} league    — RegionalLeague record to assign to
 * @param {string} adminEmail
 */
export async function approveRegistration(reg, league, adminEmail) {
  if (league.status !== "registration") {
    throw new Error(`${league.name} is not in Registration status (current: ${league.status}).`);
  }

  const max = league.max_clubs || 16;
  const current = league.num_clubs || 0;
  if (current >= max) {
    throw new Error(`${league.name} is full (${current}/${max} clubs).`);
  }

  // Guard: club not already in this league
  const ids = league.registered_club_ids || [];
  if (ids.includes(reg.club_id)) {
    throw new Error(`${reg.club_name} is already in ${league.name}.`);
  }

  const now = new Date().toISOString();
  const ops = [];

  // Add club to league
  ops.push(
    stageClient.entities.RegionalLeague.update(league.id, {
      registered_club_ids: [...ids, reg.club_id],
      num_clubs: current + 1,
    })
  );

  // Create standing row
  ops.push(
    stageClient.entities.RegionalLeagueStanding.create({
      league_id:     league.id,
      league_name:   league.name,
      region_slug:   league.region_slug || reg.region_slug,
      division:      league.division || 1,
      season_number: league.season_number || 1,
      club_id:       reg.club_id,
      club_name:     reg.club_name,
      club_logo_url: reg.club_logo_url || "",
      club_tag:      reg.club_tag || "",
      platform:      league.platform || reg.platform,
      region:        league.region || "",
      position:      current + 1,
      played: 0, wins: 0, draws: 0, losses: 0,
      goals_for: 0, goals_against: 0, goal_difference: 0, points: 0,
    })
  );

  await Promise.all(ops);

  // Mark application approved
  await stageClient.entities.SeasonRegistration.update(reg.id, {
    status:               "approved",
    assigned_league_id:   league.id,
    assigned_league_name: league.name,
    assigned_division:    league.division || 1,
    reviewed_by:          adminEmail,
    reviewed_at:          now,
  });
}

/**
 * Reject an application.
 */
export async function rejectRegistration(reg, adminNotes, adminEmail) {
  await stageClient.entities.SeasonRegistration.update(reg.id, {
    status:      "rejected",
    admin_notes: adminNotes || "",
    reviewed_by: adminEmail,
    reviewed_at: new Date().toISOString(),
  });
}

/**
 * Move an application to the waiting list.
 */
export async function waitlistRegistration(reg, adminNotes, adminEmail) {
  await stageClient.entities.SeasonRegistration.update(reg.id, {
    status:      "waitlisted",
    admin_notes: adminNotes || "",
    reviewed_by: adminEmail,
    reviewed_at: new Date().toISOString(),
  });
}

/**
 * Promote a waitlisted application — delegates to approveRegistration.
 */
export async function promoteFromWaitlist(reg, league, adminEmail) {
  if (reg.status !== "waitlisted") {
    throw new Error("Application is not on the waitlist.");
  }
  return approveRegistration(reg, league, adminEmail);
}
