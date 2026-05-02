/**
 * Backend function: sendNotification
 *
 * Creates a notification for a user, respecting their notification settings.
 * Called from other backend functions or frontend actions.
 *
 * Payload:
 *   recipient_email: string (required)
 *   type: string (required) — one of the NOTIFICATION_TYPES keys
 *   title: string (required)
 *   body: string (optional)
 *   link: string (optional) — URL path to navigate to on click
 *   related_id: string (optional) — related entity ID
 *   dedup_key: string (optional) — if provided, checks for duplicate before inserting
 */

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

const NOTIFICATION_SETTING_KEYS = {
  contract_offer:      "contract_offers",
  contract_accepted:   "contract_updates",
  contract_rejected:   "contract_updates",
  contract_terminated: "contract_updates",
  contract_expired:    "contract_updates",
  contract_completed:  "contract_updates",
  match_scheduled:     "match_reminders",
  match_result:        "match_results",
  match_reminder:      "match_reminders",
  result_submitted:    "match_results",
  result_confirmed:    "match_results",
  join_request:        "club_updates",
  join_approved:       "club_updates",
  join_rejected:       "club_updates",
  club_update:         "club_updates",
  invite:              "club_updates",
  message:             "messages",
  tournament_start:    "tournament_updates",
  tournament_complete: "tournament_updates",
  announcement:        "announcements",
};

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);

  const body = await req.json();
  const { recipient_email, type, title, body: msgBody, link, related_id, dedup_key } = body;

  if (!recipient_email || !type || !title) {
    return Response.json({ error: "Missing required fields: recipient_email, type, title" }, { status: 400 });
  }

  // 1. Find the recipient's player record to get notification settings
  const players = await base44.asServiceRole.entities.Player.filter({ email: recipient_email });
  const player = players?.[0];

  // 2. Check notification settings (default = all ON)
  const settingKey = NOTIFICATION_SETTING_KEYS[type];
  if (settingKey && player?.notification_settings) {
    const settings = player.notification_settings;
    const isEnabled = settings[settingKey] === undefined ? true : settings[settingKey] === true;
    if (!isEnabled) {
      return Response.json({ skipped: true, reason: "User has this notification type disabled" });
    }
  }

  // 3. Dedup check — if dedup_key provided, skip if notification already exists recently (last 5 min)
  if (dedup_key) {
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    const existing = await base44.asServiceRole.entities.Notification.filter({
      recipient_email,
      related_id: dedup_key,
      type,
    });
    // Filter to recent ones
    const recent = (existing || []).filter(n => n.created_date > fiveMinutesAgo);
    if (recent.length > 0) {
      return Response.json({ skipped: true, reason: "Duplicate notification suppressed" });
    }
  }

  // 4. Create notification
  const notification = await base44.asServiceRole.entities.Notification.create({
    recipient_email,
    type,
    title,
    body: msgBody || "",
    link: link || "",
    related_id: related_id || dedup_key || "",
    read: false,
  });

  return Response.json({ success: true, notification });
});