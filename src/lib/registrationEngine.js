import { stageClient } from "@/api/stageClient";
import { hasStagePlus } from "@/lib/subscriptionUtils";
import {
  getEligibleRegionalLeaguesForRegistration,
  getRegionalLeagueMaxClubs,
  isRegionalLeagueSetupSeedingOpen,
} from "@/lib/regionalLeagueRules";

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
 * @param {object} options — { note, seasonLabel }
 */
export async function applyForLeague(club, regionSlug, regionName, platform, {
  note = "",
  seasonLabel = "",
} = {}) {
  const user = await stageClient.auth.me();
  const isAdmin = user?.role === "admin" || [0, 2].includes(Number(user?.role_id));
  if (!isAdmin && !hasStagePlus(user?.subscription)) {
    throw new Error("STAGE Plus is required to enter STAGE regional leagues and official competitions.");
  }

  // Guard: no duplicate active application for same region + platform
  const existing = await (stageClient.entities.SeasonRegistration?.filter({
    club_id: club.id,
    region_slug: regionSlug,
    platform,
  }, null, 10) ?? Promise.resolve([])).catch(() => []);

  const activeStatuses = new Set(["pending", "waitlisted", "approved"]);
  const inactiveStatuses = new Set(["rejected", "removed", "withdrawn", "cancelled", "canceled"]);
  const active = existing.find(r => {
    const status = String(r.status || "").toLowerCase();
    const adminNotes = String(r.admin_notes || "").toLowerCase();
    if (inactiveStatuses.has(status)) return false;
    if (adminNotes.includes("removed from")) return false;
    return activeStatuses.has(status);
  });
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
export async function approveRegistration(reg, league, adminEmail, allRegionalLeagues = [], options = {}) {
  if (league.status !== "registration") {
    throw new Error(`${league.name} is not in Registration status (current: ${league.status}).`);
  }

  const adminSeeding = options.adminSeeding ?? isRegionalLeagueSetupSeedingOpen(league);
  if (allRegionalLeagues.length) {
    const { eligibleLeagues, reason } = await getEligibleRegionalLeaguesForRegistration(reg, allRegionalLeagues, {
      allowSetupSeeding: adminSeeding,
    });
    if (!eligibleLeagues.some(candidate => candidate.id === league.id)) {
      throw new Error(reason || `${reg.club_name} is not eligible for ${league.name}.`);
    }
  }

  const max = getRegionalLeagueMaxClubs(league);
  const current = league.num_clubs || 0;
  if (current >= max) {
    throw new Error(`${league.name} is full (${current}/${max} clubs).`);
  }

  // Guard: club not already in this league
  const ids = league.registered_club_ids || [];
  if (ids.includes(reg.club_id)) {
    throw new Error(`${reg.club_name} is already in ${league.name}.`);
  }

  const response = await stageClient.functions.invoke("adminRegisterClubToRegionalLeague", {
    league_id: league.id,
    club_id: reg.club_id,
    season_registration_id: reg.id,
    admin_seeding: adminSeeding,
    reason: `Approved by ${adminEmail || "admin"}`,
  });
  const data = response?.data || response || {};
  if (!data.success) {
    throw new Error(data.error || `Could not approve ${reg.club_name} for ${league.name}.`);
  }
  return data;
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
