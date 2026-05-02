/**
 * matchReminders — scheduled function that sends reminders for upcoming matches.
 * Runs every hour. Sends:
 *   - 1 day before match: reminder notification to all involved players
 *   - On match day (morning): reminder notification
 */

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me();
  if (user?.role !== "admin") {
    return Response.json({ error: "Admin only" }, { status: 403 });
  }

  const now = new Date();
  const in24h = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  const in25h = new Date(now.getTime() + 25 * 60 * 60 * 1000);
  const todayStart = new Date(now);
  todayStart.setHours(0, 0, 0, 0);
  const todayEnd = new Date(now);
  todayEnd.setHours(23, 59, 59, 999);

  // Get all scheduled matches
  const scheduledMatches = await base44.asServiceRole.entities.Match.filter(
    { status: "scheduled" }, "-scheduled_date", 200
  );

  let sent = 0;

  for (const match of scheduledMatches) {
    if (!match.scheduled_date) continue;

    const matchDate = new Date(match.scheduled_date);
    const notes = match.notes ? JSON.parse(match.notes).catch?.() || tryParse(match.notes) : {};
    const notifyEmails = notes?.notify_emails || [];

    if (notifyEmails.length === 0) continue;

    const home = match.home_club_name || match.home_player_name || "Home";
    const away = match.away_club_name || match.away_player_name || "Away";
    // Format in UTC so the time shown matches what was scheduled regardless of server/user timezone
    const dateLabel = matchDate.toLocaleString("en-GB", {
      timeZone: "UTC",
      dateStyle: "full",
      timeStyle: "short",
    }) + " UTC";

    // 1 day before reminder
    if (
      !notes.reminder_sent_day_before &&
      matchDate >= in24h && matchDate <= in25h
    ) {
      for (const email of notifyEmails) {
        await base44.asServiceRole.entities.Notification.create({
          recipient_email: email,
          type: "match_reminder",
          title: `⏰ Match Tomorrow: ${home} vs ${away}`,
          body: `Don't forget! Your match is tomorrow at ${dateLabel}.`,
          link: "/game-day",
          read: false,
        });
      }
      notes.reminder_sent_day_before = true;
      await base44.asServiceRole.entities.Match.update(match.id, {
        notes: JSON.stringify(notes),
      });
      sent += notifyEmails.length;
    }

    // Match day reminder (within today)
    if (
      !notes.reminder_sent_match_day &&
      matchDate >= todayStart && matchDate <= todayEnd
    ) {
      for (const email of notifyEmails) {
        await base44.asServiceRole.entities.Notification.create({
          recipient_email: email,
          type: "match_reminder",
          title: `🟢 Match Day: ${home} vs ${away}`,
          body: `Today's the day! Match kicks off at ${dateLabel}. Head to Game Day!`,
          link: "/game-day",
          read: false,
        });
      }
      notes.reminder_sent_match_day = true;
      await base44.asServiceRole.entities.Match.update(match.id, {
        notes: JSON.stringify(notes),
      });
      sent += notifyEmails.length;
    }
  }

  return Response.json({ success: true, reminders_sent: sent });
});

function tryParse(str) {
  try { return JSON.parse(str); } catch { return {}; }
}