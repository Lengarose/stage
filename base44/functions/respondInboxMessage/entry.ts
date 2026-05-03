/**
 * Backend function: respondInboxMessage
 *
 * Handles accept / decline / confirmed / date_change_requested actions on inbox messages.
 *
 * When action = "accepted" on a match_invite:
 *   → Creates a Match record (ranked, scheduled) visible in Schedule + GameDay + Calendar
 *   → Notifies the original sender with a confirmation message in their inbox
 *
 * When action = "date_change_requested":
 *   → Sends a new message back to the original sender with the new date proposal
 *   → Does NOT create a match yet
 *
 * When action = "confirmed" (sender accepts the new date):
 *   → Updates the existing match date (or creates if not yet created)
 *
 * When action = "declined":
 *   → Only updates message status; no match is created
 */

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

const VALID_ACTIONS = ["accepted", "declined", "confirmed", "date_change_requested"];

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);

  const user = await base44.auth.me();
  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const { message_id, action, new_date, new_time } = body;

  if (!message_id || !action) {
    return Response.json({ error: "Missing required fields: message_id, action" }, { status: 400 });
  }

  if (!VALID_ACTIONS.includes(action)) {
    return Response.json({ error: `Invalid action. Must be one of: ${VALID_ACTIONS.join(", ")}` }, { status: 400 });
  }

  // Fetch the message
  const message = await base44.asServiceRole.entities.InboxMessage.get(message_id);
  if (!message) {
    return Response.json({ error: "Message not found" }, { status: 404 });
  }

  // Security: only recipient can respond
  if (message.recipient_email !== user.email) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  // Update the message status (use user token, not service role, due to RLS)
  const updated = await base44.entities.InboxMessage.update(message_id, {
    status: action,
    is_read: true,
  });

  const meta = message.metadata || {};
  const isMatchInvite = message.message_type === "match_invite";

  // ─── ACCEPTED on a RESCHEDULE PROPOSAL: Confirm the new date ────────────────
  // If the message is a reschedule counter-proposal, "Accept" means confirming the new date,
  // not creating a fresh match. Handle this before the normal "create match" path.
  if (action === "accepted" && isMatchInvite && meta.reschedule_request) {
    const existingMatchId = meta.created_match_id;
    const newScheduledDate = meta.scheduled_date;

    if (existingMatchId && newScheduledDate) {
      await base44.asServiceRole.entities.Match.update(existingMatchId, {
        scheduled_date: newScheduledDate,
      });
    }

    // Notify the rescheduler that their proposal was accepted
    if (message.sender_email) {
      const recipientPlayers = await base44.asServiceRole.entities.Player.filter({ email: user.email });
      const confirmerGamertag = recipientPlayers?.[0]?.gamertag || user.email;
      const dateLabel = newScheduledDate ? new Date(newScheduledDate).toLocaleString("en-GB", { timeZone: "UTC", dateStyle: "full", timeStyle: "short" }) + " UTC" : "TBD";

      await base44.asServiceRole.entities.Notification.create({
        recipient_email: message.sender_email,
        type: "match_scheduled",
        title: `${confirmerGamertag} accepted the rescheduled date!`,
        body: `Match confirmed for ${dateLabel}`,
        link: "/schedule",
        read: false,
      });
    }

    return Response.json({ success: true, message: updated });
  }

  // ─── ACCEPTED: Create a match record ─────────────────────────────────────────
  if (action === "accepted" && isMatchInvite) {
    const scheduledDate = meta.scheduled_date || null;
    const invitationType = meta.invitation_type || "player_vs_player";
    const isClubMatch = invitationType === "club_vs_club";

    // Determine tournament_id: use a sentinel value for arrange-game ranked matches
    // We store these under a special "ranked" tournament approach — no real tournament_id needed
    // but Match entity requires tournament_id, so we use "ranked" as a placeholder
    let matchPayload = {
      tournament_id: "ranked",
      status: "scheduled",
      mode: isClubMatch ? "club" : "solo",
      type: "knockout", // legacy field — use as "ranked"
      scheduled_date: scheduledDate,
      stats_processed: false,
    };

    if (isClubMatch) {
      // Challenger club = home, opponent club = away
      const challengerClubId = meta.challenger_club_id;
      const opponentClubId = meta.opponent_club_id;

      // Fetch club details
      const [challengerClubs, opponentClubs] = await Promise.all([
        base44.asServiceRole.entities.Club.filter({ id: challengerClubId }),
        base44.asServiceRole.entities.Club.filter({ id: opponentClubId }),
      ]);
      const challengerClub = challengerClubs?.[0];
      const opponentClub = opponentClubs?.[0];

      matchPayload = {
        ...matchPayload,
        home_club_id: challengerClubId,
        home_club_name: challengerClub?.name || meta.challenger_name || "Home",
        away_club_id: opponentClubId,
        away_club_name: opponentClub?.name || meta.opponent_name || "Away",
      };
    } else {
      // Player vs player
      const challengerPlayerId = meta.challenger_player_id;
      const opponentPlayerId = meta.opponent_player_id;

      const [challengerPlayers, opponentPlayers] = await Promise.all([
        base44.asServiceRole.entities.Player.filter({ id: challengerPlayerId }),
        base44.asServiceRole.entities.Player.filter({ id: opponentPlayerId }),
      ]);
      const challengerPlayer = challengerPlayers?.[0];
      const opponentPlayer = opponentPlayers?.[0];

      matchPayload = {
        ...matchPayload,
        home_player_id: challengerPlayerId,
        home_player_name: challengerPlayer?.gamertag || meta.challenger_name || "Home",
        away_player_id: opponentPlayerId,
        away_player_name: opponentPlayer?.gamertag || meta.opponent_name || "Away",
      };
    }

    let createdMatch = null;
    try {
      createdMatch = await base44.asServiceRole.entities.Match.create(matchPayload);
      console.log("[respondInboxMessage] Match created:", createdMatch.id);
    } catch (err) {
      console.error("[respondInboxMessage] FAILED to create match:", err);
      return Response.json({ error: "Failed to create match record: " + err.message }, { status: 500 });
    }

    // Store match_id back on the inbox message metadata for future reference (e.g. reschedule)
    await base44.entities.InboxMessage.update(message_id, {
      metadata: { ...meta, created_match_id: createdMatch.id },
    });

    // ── Notify ALL players in both clubs ─────────────────────────────────────
    const acceptorPlayers = await base44.asServiceRole.entities.Player.filter({ email: user.email });
    const acceptorGamertag = acceptorPlayers?.[0]?.gamertag || user.email;

    const dateLabel = scheduledDate
      ? new Date(scheduledDate).toLocaleString("en-GB", { timeZone: "UTC", dateStyle: "full", timeStyle: "short" }) + " UTC"
      : "TBD";

    const matchSubject = `⚽ Match Scheduled: ${matchPayload.home_club_name || matchPayload.home_player_name} vs ${matchPayload.away_club_name || matchPayload.away_player_name}`;
    const matchBody = `A match has been scheduled!\n\n${matchPayload.home_club_name || matchPayload.home_player_name} vs ${matchPayload.away_club_name || matchPayload.away_player_name}\n📅 Date: ${dateLabel}\n\nGet ready and check the Schedule page.`;

    // Collect all emails to notify (both clubs' players)
    const emailsToNotify = new Set();

    if (isClubMatch) {
      const [homePlayers, awayPlayers] = await Promise.all([
        base44.asServiceRole.entities.Player.filter({ club_id: matchPayload.home_club_id }),
        base44.asServiceRole.entities.Player.filter({ club_id: matchPayload.away_club_id }),
      ]);
      [...(homePlayers || []), ...(awayPlayers || [])].forEach(p => p.email && emailsToNotify.add(p.email));
    } else {
      // Player match — notify both players
      const [hp, ap] = await Promise.all([
        base44.asServiceRole.entities.Player.filter({ id: matchPayload.home_player_id }),
        base44.asServiceRole.entities.Player.filter({ id: matchPayload.away_player_id }),
      ]);
      if (hp?.[0]?.email) emailsToNotify.add(hp[0].email);
      if (ap?.[0]?.email) emailsToNotify.add(ap[0].email);
    }

    // Also always include original sender
    if (message.sender_email) emailsToNotify.add(message.sender_email);

    // Create notifications and inbox messages in parallel batches to prevent timeouts
    const notificationChunks = Array.from(emailsToNotify);
    const BATCH_SIZE = 5;
    for (let i = 0; i < notificationChunks.length; i += BATCH_SIZE) {
      const chunk = notificationChunks.slice(i, i + BATCH_SIZE);
      await Promise.all(chunk.flatMap(email => [
        base44.asServiceRole.entities.InboxMessage.create({
          recipient_email: email,
          sender_email: user.email,
          sender_gamertag: acceptorGamertag,
          is_system: true,
          subject: matchSubject,
          body: matchBody,
          message_type: "general",
          action_type: "none",
          status: "pending",
          is_read: false,
          related_entity_id: createdMatch.id,
          related_entity_type: "match",
          metadata: { created_match_id: createdMatch.id, scheduled_date: scheduledDate },
        }),
        base44.asServiceRole.entities.Notification.create({
          recipient_email: email,
          type: "match_scheduled",
          title: matchSubject,
          body: `📅 ${dateLabel}`,
          link: "/game-day",
          related_id: createdMatch.id,
          read: false,
        })
      ]));
    }

    // ── Schedule reminder notifications via a reminder (1 day before + match day) ─
    // We store a flag on the match for reminder automation to pick up
    // The scheduled automation (matchReminders) will check matches and send reminders
    // For now, store the reminder info on the match metadata via notes field
    await base44.asServiceRole.entities.Match.update(createdMatch.id, {
      notes: JSON.stringify({
        reminder_sent_day_before: false,
        reminder_sent_match_day: false,
        notify_emails: [...emailsToNotify],
      }),
    });

    return Response.json({ success: true, message: updated, match: createdMatch });
  }

  // ─── DATE CHANGE REQUESTED: Send proposal back to original sender ─────────────
  if (action === "date_change_requested" && isMatchInvite) {
    const recipientPlayers = await base44.asServiceRole.entities.Player.filter({ email: user.email });
    const responderGamertag = recipientPlayers?.[0]?.gamertag || user.email;

    // The new date/time comes from the body (optional — if not provided, ask them to specify)
    // Convert user's local date+time input to a proper UTC ISO string
    const proposedDate = new_date && new_time ? new Date(`${new_date}T${new_time}:00`).toISOString() : null;
    const proposedLabel = proposedDate
      ? new Date(proposedDate).toLocaleString()
      : "a different date (they will contact you separately)";

    // The reschedule message must go to the OTHER party — the person who is NOT the current user.
    // message.sender_email = original sender of the message we are responding to.
    // user.email = current user (the one clicking Reschedule).
    // So the new reschedule message should always go to message.sender_email (the other party).
    const rescheduleRecipient = message.sender_email;

    if (rescheduleRecipient && rescheduleRecipient !== user.email) {
      // Resolve sender avatar for the new message
      const senderPlayers2 = await base44.asServiceRole.entities.Player.filter({ email: user.email });
      const senderPlayer2 = senderPlayers2?.[0];

      // Send reschedule proposal to the other party.
      // Use action_type "accept_decline_date" so they can also Accept, Decline, OR counter-reschedule.
      await base44.asServiceRole.entities.InboxMessage.create({
        recipient_email: rescheduleRecipient,
        sender_email: user.email,
        sender_gamertag: responderGamertag,
        sender_avatar_url: senderPlayer2?.avatar_url || null,
        sender_club_name: senderPlayer2?.club_id
          ? (await base44.asServiceRole.entities.Club.get(senderPlayer2.club_id).catch(() => null))?.name || null
          : null,
        is_system: false,
        subject: `📅 Reschedule Proposal: ${message.subject.replace(/^📅 (Reschedule Proposal|Date Change Requested): /, "")}`,
        body: `${responderGamertag} would like to reschedule the match.\n\nProposed new date/time: ${proposedLabel}\n\nYou can accept, decline, or propose a different date.`,
        message_type: "match_invite",
        action_type: "accept_decline_date",
        status: "pending",
        is_read: false,
        related_entity_id: meta.created_match_id || message.related_entity_id,
        related_entity_type: meta.created_match_id ? "match" : (message.related_entity_type || "player"),
        metadata: {
          ...meta,
          scheduled_date: proposedDate || meta.scheduled_date,
          reschedule_request: true,
          original_message_id: message_id,
          // Flip challenger/opponent so the receiving side has correct role context
          challenger_player_id: meta.opponent_player_id,
          challenger_club_id: meta.opponent_club_id,
          challenger_name: meta.opponent_name,
          opponent_player_id: meta.challenger_player_id,
          opponent_club_id: meta.challenger_club_id,
          opponent_name: meta.challenger_name,
        },
      });

      await base44.asServiceRole.entities.Notification.create({
        recipient_email: rescheduleRecipient,
        type: "match_reminder",
        title: `${responderGamertag} wants to reschedule`,
        body: `New proposed date: ${proposedLabel}`,
        link: "/inbox",
        read: false,
      });
    }

    return Response.json({ success: true, message: updated });
  }

  // ─── CONFIRMED: Sender accepts the rescheduled date ──────────────────────────
  if (action === "confirmed" && isMatchInvite) {
    const existingMatchId = meta.created_match_id;
    const newScheduledDate = meta.scheduled_date;

    if (existingMatchId && newScheduledDate) {
      // Update the existing match date
      try {
        await base44.asServiceRole.entities.Match.update(existingMatchId, {
          scheduled_date: newScheduledDate,
        });
        console.log("[respondInboxMessage] Match rescheduled:", existingMatchId, "→", newScheduledDate);
      } catch (err) {
        console.error("[respondInboxMessage] Failed to reschedule match:", err);
      }
    } else if (!existingMatchId && newScheduledDate && meta.reschedule_request) {
      // Original sender is confirming a date change before a match was created
      // This means: create the match now with the new date
      const isClubMatch = (meta.invitation_type || "player_vs_player") === "club_vs_club";
      let matchPayload = {
        tournament_id: "ranked",
        status: "scheduled",
        mode: isClubMatch ? "club" : "solo",
        type: "knockout",
        scheduled_date: newScheduledDate,
        stats_processed: false,
      };

      if (isClubMatch) {
        const [homeclubs, awayclubs] = await Promise.all([
          base44.asServiceRole.entities.Club.filter({ id: meta.opponent_club_id }),
          base44.asServiceRole.entities.Club.filter({ id: meta.challenger_club_id }),
        ]);
        matchPayload = {
          ...matchPayload,
          home_club_id: meta.opponent_club_id,
          home_club_name: homeclubs?.[0]?.name || meta.opponent_name,
          away_club_id: meta.challenger_club_id,
          away_club_name: awayclubs?.[0]?.name || meta.challenger_name,
        };
      } else {
        const [homePlayers, awayPlayers] = await Promise.all([
          base44.asServiceRole.entities.Player.filter({ id: meta.opponent_player_id }),
          base44.asServiceRole.entities.Player.filter({ id: meta.challenger_player_id }),
        ]);
        matchPayload = {
          ...matchPayload,
          home_player_id: meta.opponent_player_id,
          home_player_name: homePlayers?.[0]?.gamertag || meta.opponent_name,
          away_player_id: meta.challenger_player_id,
          away_player_name: awayPlayers?.[0]?.gamertag || meta.challenger_name,
        };
      }

      try {
        const newMatch = await base44.asServiceRole.entities.Match.create(matchPayload);
        console.log("[respondInboxMessage] Match created (after reschedule confirm):", newMatch.id);
      } catch (err) {
        console.error("[respondInboxMessage] Failed to create match after reschedule:", err);
      }
    }

    // Notify the person who requested the reschedule
    if (message.sender_email) {
      const recipientPlayers = await base44.asServiceRole.entities.Player.filter({ email: user.email });
      const confirmerGamertag = recipientPlayers?.[0]?.gamertag || user.email;

      await base44.asServiceRole.entities.Notification.create({
        recipient_email: message.sender_email,
        type: "match_scheduled",
        title: `${confirmerGamertag} confirmed the new match date!`,
        body: `Match scheduled for ${newScheduledDate ? new Date(newScheduledDate).toLocaleString() : "TBD"}`,
        link: "/schedule",
        read: false,
      });
    }

    return Response.json({ success: true, message: updated });
  }

  // ─── DECLINED or generic notification ────────────────────────────────────────
  if (message.sender_email) {
    const senderPlayers = await base44.asServiceRole.entities.Player.filter({ email: message.sender_email });
    const senderPlayer = senderPlayers?.[0];
    const settings = senderPlayer?.notification_settings || {};
    const isEnabled = settings["messages"] === undefined ? true : settings["messages"] === true;

    if (isEnabled) {
      const actionLabels = {
        accepted: "accepted",
        declined: "declined",
        confirmed: "confirmed",
        date_change_requested: "requested a different date for",
      };

      const recipientPlayers = await base44.asServiceRole.entities.Player.filter({ email: user.email });
      const recipientGamertag = recipientPlayers?.[0]?.gamertag || user.email;

      await base44.asServiceRole.entities.Notification.create({
        recipient_email: message.sender_email,
        type: "message",
        title: `${recipientGamertag} ${actionLabels[action] || action} your message`,
        body: `Regarding: "${message.subject}"`,
        link: "/inbox",
        related_id: message_id,
        read: false,
      });
    }
  }

  return Response.json({ success: true, message: updated });
});