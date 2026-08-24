import { stageClient } from "@/api/stageClient";
import { notify } from "./notify";
import { addDays, format } from "@/lib/momentDate";

const DEFAULT_WINDOW_DAYS_REGIONAL = 4;
const DEFAULT_WINDOW_DAYS_COMPETITION = 5;

// ─── Entity selector ─────────────────────────────────────────────────────────

function entity(fixtureType) {
  const ent = fixtureType === "regional_league"
    ? stageClient.entities.RegionalLeagueFixture
    : stageClient.entities.CompetitionFixture;
  if (!ent) {
    const name = fixtureType === "regional_league" ? "RegionalLeagueFixture" : "CompetitionFixture";
    throw new Error(`${name} schema not published yet. Please publish it on app.stageClient.com to enable scheduling.`);
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
  const emails = await getClubManagerEmails(clubId);
  return emails[0] || null;
}

export async function getClubManagerEmails(clubId) {
  if (!clubId) return [];
  try {
    const players = await stageClient.entities.Player.filter({ club_id: clubId });
    const managers = players.filter(p =>
      p.club_roles?.includes("president") ||
      p.club_roles?.includes("owner") ||
      p.club_roles?.includes("manager") ||
      p.club_roles?.includes("captain") ||
      p.club_roles?.includes("vice_captain") ||
      p.role === "president" ||
      p.role === "captain" ||
      p.role === "owner" ||
      p.role === "admin"
    );
    const targets = managers.length ? managers : players.slice(0, 1);
    return [...new Set(targets.map((player) => String(player?.email || "").trim().toLowerCase()).filter(Boolean))];
  } catch {
    return [];
  }
}

async function markMyPendingScheduleMessages({ fixtureId, myEmail, status }) {
  const email = String(myEmail || "").trim().toLowerCase();
  if (!fixtureId || !email) return;
  try {
    const messages = await stageClient.entities.InboxMessage.filter({
      related_entity_id: fixtureId,
      message_type: "league_schedule",
      recipient_email: email,
      status: "pending",
    }, "-created_date", 20);
    await Promise.all(asArray(messages).map((message) =>
      stageClient.entities.InboxMessage.update(message.id, {
        status,
        is_read: true,
      })
    ));
  } catch {
    // Inbox cleanup is best-effort; fixture scheduling itself is the source of truth.
  }
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
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
  if (role !== "home") {
    throw new Error("Only the home club can propose a match time.");
  }
  const isHome    = role === "home";
  const recipientClubId = isHome ? fixture.away_club_id : fixture.home_club_id;
  const recipientEmails = await getClubManagerEmails(recipientClubId);

  const updates = {
    scheduling_status: isHome ? "home_proposed" : "away_proposed",
    last_proposed_by:  role,
    proposal_count:    (fixture.proposal_count || 0) + 1,
  };
  if (isHome) updates.home_proposed_date = proposedDate;
  else        updates.away_proposed_date = proposedDate;

  await entity(fixtureType).update(fixture.id, updates);

  if (!recipientEmails.length) return;

  const proposerName   = myClub?.name || myGamertag || "Your opponent";
  const fixtureName    = `${fixture.home_club_name} vs ${fixture.away_club_name}`;
  const matchContext   = _matchContext(fixture, fixtureType);
  const formattedDate  = format(new Date(proposedDate), "EEEE d MMMM yyyy 'at' HH:mm");
  const deadline       = fixture.window_end
    ? format(new Date(fixture.window_end), "d MMM yyyy")
    : "TBD";

  await Promise.all(recipientEmails.map((recipientEmail) =>
    stageClient.functions.invoke("sendInboxMessage", {
      recipient_email:     recipientEmail,
      sender_email:        myEmail,
      sender_gamertag:     proposerName,
      sender_club_name:    myClub?.name || null,
      sender_avatar_url:   myClub?.logo_url || null,
      subject:             `📅 Match Time Proposed: ${fixtureName}`,
      body:                `${proposerName} has proposed a time for your upcoming match.\n\n${matchContext}\n${fixtureName}\n\nProposed: ${formattedDate}\n\nYou can accept this time or decline it. If declined, the fixture stays open so the home club can send a new proposal.\nScheduling deadline: ${deadline}.`,
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
      send_notification:   true,
    })
  ));
}

// ─── Accept a proposal ────────────────────────────────────────────────────────

export async function acceptProposal({ fixture, fixtureType, role, myClub, myEmail }) {
  const isHome        = role === "home";
  const confirmedDate = isHome ? fixture.away_proposed_date : fixture.home_proposed_date;
  if (!confirmedDate) return;

  const proposerClubId    = isHome ? fixture.away_club_id : fixture.home_club_id;
  const proposerEmails    = await getClubManagerEmails(proposerClubId);
  const accepterName      = myClub?.name || "Your opponent";
  const fixtureName       = `${fixture.home_club_name} vs ${fixture.away_club_name}`;
  const formattedDate     = format(new Date(confirmedDate), "EEEE d MMMM yyyy 'at' HH:mm");

  await entity(fixtureType).update(fixture.id, {
    scheduling_status: "confirmed",
    confirmed_date:    confirmedDate,
    status:            "scheduled",
    scheduled_date:    confirmedDate,
  });
  const { createMatchFromFixture } = await import("./gameDayIntegration");
  await createMatchFromFixture({ ...fixture, confirmed_date: confirmedDate, scheduled_date: confirmedDate, status: "scheduled" }, fixtureType);
  await markMyPendingScheduleMessages({ fixtureId: fixture.id, myEmail, status: "confirmed" });

  await Promise.all(proposerEmails.map((proposerEmail) =>
    stageClient.functions.invoke("sendInboxMessage", {
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
      send_notification: true,
    })
  ));
}

export async function declineProposal({ fixture, fixtureType, role, myClub, myEmail }) {
  if (!fixture?.id) return;
  const isAwayDecliningHomeProposal = role === "away" && fixture.scheduling_status === "home_proposed";
  if (!isAwayDecliningHomeProposal) {
    throw new Error("Only the away club can decline the home club's proposal.");
  }

  const proposerEmails = await getClubManagerEmails(fixture.home_club_id);
  const declinerName = myClub?.name || "Your opponent";
  const fixtureName = `${fixture.home_club_name} vs ${fixture.away_club_name}`;

  await entity(fixtureType).update(fixture.id, {
    scheduling_status: "open",
    last_proposed_by: null,
    home_proposed_date: null,
    away_proposed_date: null,
  });
  await markMyPendingScheduleMessages({ fixtureId: fixture.id, myEmail, status: "declined" });

  await Promise.all(proposerEmails.map((proposerEmail) =>
    stageClient.functions.invoke("sendInboxMessage", {
      recipient_email: proposerEmail,
      sender_email: myEmail,
      sender_gamertag: declinerName,
      sender_club_name: myClub?.name || null,
      sender_avatar_url: myClub?.logo_url || null,
      subject: `❌ Match Time Declined: ${fixtureName}`,
      body: `${declinerName} declined your proposed match time.\n\nMatch: ${fixtureName}\n\nThe fixture is still open. Please send a new proposal from the fixture scheduling panel.`,
      message_type: "league_schedule",
      action_type: "none",
      related_entity_id: fixture.id,
      related_entity_type: fixtureType === "regional_league" ? "league_fixture" : "competition_fixture",
      status: "declined",
      is_read: false,
      metadata: {
        fixture_id: fixture.id,
        fixture_type: fixtureType,
        declined_by_role: role,
      },
      send_notification: true,
    })
  ));
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
// The fixture update + audit log are written server-side via the dedicated
// /fixture-admin-actions/force-schedule endpoint. Notifications stay
// client-side so we don't have to re-implement the email pipeline on the
// server for this one action.

export async function forceSchedule({ fixture, fixtureType, date, adminNote = "" }) {
  const formattedDate = format(new Date(date), "EEEE d MMMM yyyy 'at' HH:mm");
  const res = await stageClient.http.post("/fixture-admin-actions/force-schedule", {
    fixture_id:   fixture.id,
    fixture_type: fixtureType,
    date,
    admin_note:   adminNote || null,
  });

  // Auto-create a Match record so this fixture appears on Game Day.
  const { createMatchFromFixture } = await import("./gameDayIntegration");
  await createMatchFromFixture({ ...fixture, confirmed_date: date, status: "scheduled" }, fixtureType);

  const fixtureName = `${fixture.home_club_name} vs ${fixture.away_club_name}`;
  const msg = `An admin has scheduled your match: ${fixtureName} on ${formattedDate}.`;
  const [homeEmail, awayEmail] = await Promise.all([
    getClubManagerEmail(fixture.home_club_id),
    getClubManagerEmail(fixture.away_club_id),
  ]);
  if (homeEmail) await notify(homeEmail, "schedule_confirmed", `✅ Match Scheduled: ${fixtureName}`, msg, "/schedule");
  if (awayEmail) await notify(awayEmail, "schedule_confirmed", `✅ Match Scheduled: ${fixtureName}`, msg, "/schedule");

  return res?.fixture || null;
}

// ─── Admin: flag for review ───────────────────────────────────────────────────

export async function flagForAdminReview(fixture, fixtureType, adminNote = "") {
  const res = await stageClient.http.post("/fixture-admin-actions/flag-review", {
    fixture_id:   fixture.id,
    fixture_type: fixtureType,
    admin_note:   adminNote || null,
  });
  return res?.fixture || null;
}

// ─── Admin: declare forfeit ───────────────────────────────────────────────────

export async function declareForfeit({ fixture, fixtureType, forfeitingClubId, adminNote = "" }) {
  const res = await stageClient.http.post("/fixture-admin-actions/declare-forfeit", {
    fixture_id:          fixture.id,
    fixture_type:        fixtureType,
    forfeiting_club_id:  forfeitingClubId,
    admin_note:          adminNote || null,
  });
  return res?.fixture || null;
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
