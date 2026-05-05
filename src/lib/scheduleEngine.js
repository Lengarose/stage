import { base44 } from "@/api/base44Client";
import { notify } from "./notify";
import { addDays, format } from "date-fns";

const DEFAULT_WINDOW_DAYS_REGIONAL = 4;
const DEFAULT_WINDOW_DAYS_COMPETITION = 5;

// ─── Entity selector ─────────────────────────────────────────────────────────

function entity(fixtureType) {
  const ent = fixtureType === "regional_league"
    ? base44.entities.RegionalLeagueFixture
    : base44.entities.CompetitionFixture;
  if (!ent) {
    const name = fixtureType === "regional_league" ? "RegionalLeagueFixture" : "CompetitionFixture";
    throw new Error(`${name} schema not published yet. Please publish it on app.base44.com to enable scheduling.`);
  }
  return ent;
}

function defaultWindowDays(fixtureType) {
  return fixtureType === "regional_league"
    ? DEFAULT_WINDOW_DAYS_REGIONAL
    : DEFAULT_WINDOW_DAYS_COMPETITION;
}

// ─── Club manager email lookup ────────────────────────────────────────────────

export async function getClubManagerEmail(clubId) {
  if (!clubId) return null;
  try {
    const players = await base44.entities.Player.filter({ club_id: clubId });
    const manager = players.find(p =>
      p.club_roles?.includes("president") ||
      p.club_roles?.includes("manager") ||
      p.club_roles?.includes("captain") ||
      p.role === "captain" ||
      p.role === "admin"
    ) || players[0];
    return manager?.email || null;
  } catch {
    return null;
  }
}

// ─── Open scheduling window ───────────────────────────────────────────────────

export async function openSchedulingWindow(fixtureId, fixtureType, windowDays) {
  const days = windowDays ?? defaultWindowDays(fixtureType);
  const now = new Date();
  await entity(fixtureType).update(fixtureId, {
    window_start:       now.toISOString(),
    window_end:         addDays(now, days).toISOString(),
    window_days:        days,
    scheduling_status:  "open",
  });
}

// ─── Batch open windows for a matchday ────────────────────────────────────────

export async function openMatchdayWindows(fixtures, fixtureType, windowDays) {
  const days = windowDays ?? defaultWindowDays(fixtureType);
  const now = new Date();
  const deadline = addDays(now, days).toISOString();
  await Promise.all(
    fixtures.map(f =>
      entity(fixtureType).update(f.id, {
        window_start:      now.toISOString(),
        window_end:        deadline,
        window_days:       days,
        scheduling_status: f.scheduling_status === "confirmed" ? "confirmed" : "open",
      })
    )
  );
}

// ─── Propose a match time ─────────────────────────────────────────────────────

export async function proposeTime({ fixture, fixtureType, role, proposedDate, myClub, myEmail, myGamertag }) {
  const isHome    = role === "home";
  const recipientClubId = isHome ? fixture.away_club_id : fixture.home_club_id;
  const recipientEmail  = await getClubManagerEmail(recipientClubId);

  const updates = {
    scheduling_status: isHome ? "home_proposed" : "away_proposed",
    last_proposed_by:  role,
    proposal_count:    (fixture.proposal_count || 0) + 1,
  };
  if (isHome) updates.home_proposed_date = proposedDate;
  else        updates.away_proposed_date = proposedDate;

  await entity(fixtureType).update(fixture.id, updates);

  if (!recipientEmail) return;

  const proposerName   = myClub?.name || myGamertag || "Your opponent";
  const fixtureName    = `${fixture.home_club_name} vs ${fixture.away_club_name}`;
  const matchContext   = _matchContext(fixture, fixtureType);
  const formattedDate  = format(new Date(proposedDate), "EEEE d MMMM yyyy 'at' HH:mm");
  const deadline       = fixture.window_end
    ? format(new Date(fixture.window_end), "d MMM yyyy")
    : "TBD";

  await base44.entities.InboxMessage.create({
    recipient_email:     recipientEmail,
    sender_email:        myEmail,
    sender_gamertag:     proposerName,
    sender_club_name:    myClub?.name || null,
    sender_avatar_url:   myClub?.logo_url || null,
    subject:             `📅 Match Time Proposed: ${fixtureName}`,
    body:                `${proposerName} has proposed a time for your upcoming match.\n\n${matchContext}\n${fixtureName}\n\nProposed: ${formattedDate}\n\nYou can accept this time or propose a different one.\nScheduling deadline: ${deadline}.`,
    message_type:        "league_schedule",
    action_type:         "schedule_accept_propose",
    related_entity_id:   fixture.id,
    related_entity_type: fixtureType === "regional_league" ? "league_fixture" : "competition_fixture",
    status:              "pending",
    is_read:             false,
    metadata: {
      fixture_id:           fixture.id,
      fixture_type:         fixtureType,
      proposed_date:        proposedDate,
      proposed_by_role:     role,
      proposer_club_id:     myClub?.id || null,
      proposer_email:       myEmail,
      home_club_id:         fixture.home_club_id,
      home_club_name:       fixture.home_club_name,
      away_club_id:         fixture.away_club_id,
      away_club_name:       fixture.away_club_name,
      match_context:        matchContext,
      window_end:           fixture.window_end,
    },
  });

  await notify(
    recipientEmail,
    "schedule_proposed",
    `📅 Match Time Proposed: ${fixtureName}`,
    `${proposerName} proposed ${formattedDate}. Open your inbox to accept or suggest a different time.`,
    "/inbox"
  );
}

// ─── Accept a proposal ────────────────────────────────────────────────────────

export async function acceptProposal({ fixture, fixtureType, role, myClub, myEmail }) {
  const isHome        = role === "home";
  const confirmedDate = isHome ? fixture.away_proposed_date : fixture.home_proposed_date;
  if (!confirmedDate) return;

  const proposerClubId    = isHome ? fixture.away_club_id : fixture.home_club_id;
  const proposerEmail     = await getClubManagerEmail(proposerClubId);
  const accepterName      = myClub?.name || "Your opponent";
  const fixtureName       = `${fixture.home_club_name} vs ${fixture.away_club_name}`;
  const formattedDate     = format(new Date(confirmedDate), "EEEE d MMMM yyyy 'at' HH:mm");

  await entity(fixtureType).update(fixture.id, {
    scheduling_status: "confirmed",
    confirmed_date:    confirmedDate,
    status:            "scheduled",
    ...(fixtureType === "competition" ? { scheduled_date: confirmedDate } : {}),
  });

  // Auto-create a Match record so this fixture appears on Game Day for both clubs
  import("./gameDayIntegration").then(({ createMatchFromFixture }) =>
    createMatchFromFixture({ ...fixture, confirmed_date: confirmedDate, status: "scheduled" }, fixtureType)
  ).catch(() => {});

  if (proposerEmail) {
    await base44.entities.InboxMessage.create({
      recipient_email: proposerEmail,
      sender_email:    myEmail,
      sender_gamertag: accepterName,
      sender_club_name: myClub?.name || null,
      subject:         `✅ Match Confirmed: ${fixtureName}`,
      body:            `${accepterName} has accepted your proposed time.\n\nMatch: ${fixtureName}\nDate: ${formattedDate}\n\nThis match is now confirmed. Make sure you're available!`,
      message_type:    "league_schedule",
      action_type:     "none",
      status:          "confirmed",
      is_read:         false,
      metadata: {
        fixture_id:   fixture.id,
        fixture_type: fixtureType,
        confirmed_date: confirmedDate,
      },
    });

    await notify(
      proposerEmail,
      "schedule_confirmed",
      `✅ Match Confirmed: ${fixtureName}`,
      `${accepterName} accepted your proposed time. Match on ${formattedDate}.`,
      "/schedule"
    );
  }
}

// ─── Check and expire overdue fixtures ────────────────────────────────────────

export async function checkAndExpire(fixture, fixtureType) {
  const { scheduling_status, window_end } = fixture;
  if (!window_end) return false;
  if (scheduling_status === "confirmed" || scheduling_status === "expired" || scheduling_status === "admin_review") return false;
  if (new Date() <= new Date(window_end)) return false;

  await entity(fixtureType).update(fixture.id, { scheduling_status: "expired" });

  const fixtureName = `${fixture.home_club_name} vs ${fixture.away_club_name}`;
  const msg = `The scheduling window for ${fixtureName} expired without both teams agreeing. An admin will review.`;

  const [homeEmail, awayEmail] = await Promise.all([
    getClubManagerEmail(fixture.home_club_id),
    getClubManagerEmail(fixture.away_club_id),
  ]);

  if (homeEmail) await notify(homeEmail, "schedule_expired", `⏰ Scheduling Expired: ${fixtureName}`, msg, "/schedule");
  if (awayEmail) await notify(awayEmail, "schedule_expired", `⏰ Scheduling Expired: ${fixtureName}`, msg, "/schedule");

  return true;
}

// ─── Admin: force-schedule a fixture ─────────────────────────────────────────

export async function forceSchedule({ fixture, fixtureType, date, adminNote = "" }) {
  const formattedDate = format(new Date(date), "EEEE d MMMM yyyy 'at' HH:mm");
  await entity(fixtureType).update(fixture.id, {
    scheduling_status: "confirmed",
    confirmed_date:    date,
    status:            "scheduled",
    ...(fixtureType === "competition" ? { scheduled_date: date } : {}),
    admin_notes: [fixture.admin_notes, `Admin force-scheduled: ${formattedDate}${adminNote ? " — " + adminNote : ""}`]
      .filter(Boolean).join("\n"),
  });

  // Auto-create a Match record so this fixture appears on Game Day
  import("./gameDayIntegration").then(({ createMatchFromFixture }) =>
    createMatchFromFixture({ ...fixture, confirmed_date: date, status: "scheduled" }, fixtureType)
  ).catch(() => {});

  const fixtureName = `${fixture.home_club_name} vs ${fixture.away_club_name}`;
  const msg = `An admin has scheduled your match: ${fixtureName} on ${formattedDate}.`;
  const [homeEmail, awayEmail] = await Promise.all([
    getClubManagerEmail(fixture.home_club_id),
    getClubManagerEmail(fixture.away_club_id),
  ]);
  if (homeEmail) await notify(homeEmail, "schedule_confirmed", `✅ Match Scheduled: ${fixtureName}`, msg, "/schedule");
  if (awayEmail) await notify(awayEmail, "schedule_confirmed", `✅ Match Scheduled: ${fixtureName}`, msg, "/schedule");
}

// ─── Admin: flag for review ───────────────────────────────────────────────────

export async function flagForAdminReview(fixture, fixtureType) {
  await entity(fixtureType).update(fixture.id, { scheduling_status: "admin_review" });
}

// ─── Admin: declare forfeit ───────────────────────────────────────────────────

export async function declareForfeit({ fixture, fixtureType, forfeitingClubId, adminNote = "" }) {
  const isHomeForfeit = forfeitingClubId === fixture.home_club_id;
  await entity(fixtureType).update(fixture.id, {
    scheduling_status: "confirmed",
    status:            "forfeit",
    winner_club_id:    isHomeForfeit ? fixture.away_club_id   : fixture.home_club_id,
    winner_club_name:  isHomeForfeit ? fixture.away_club_name : fixture.home_club_name,
    admin_notes: [fixture.admin_notes, `Forfeit declared: ${forfeitingClubId === fixture.home_club_id ? fixture.home_club_name : fixture.away_club_name} forfeited.${adminNote ? " " + adminNote : ""}`]
      .filter(Boolean).join("\n"),
  });
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function _matchContext(fixture, fixtureType) {
  if (fixtureType === "regional_league") {
    return `${fixture.league_name} · Division ${fixture.division || 1} · Matchday ${fixture.matchday}`;
  }
  const phaseLabel = {
    league:         `League Phase – Matchday ${fixture.matchday}`,
    playoff_round:  "Playoff Round",
    knockout_r16:   "Round of 16",
    knockout_qf:    "Quarter-final",
    knockout_sf:    "Semi-final",
    knockout_final: "Final",
  }[fixture.phase] || fixture.phase;
  return `${fixture.competition_name} · ${phaseLabel}`;
}
