/**
 * Backend function: sendInboxMessage
 *
 * Creates an inbox message for a recipient and optionally sends a notification.
 *
 * Payload:
 *   recipient_email: string (required)
 *   sender_email: string (optional — omit for system messages)
 *   subject: string (required)
 *   body: string (required)
 *   message_type: string (optional, default "general")
 *   action_type: string (optional, default "none") — "accept_decline" | "confirm" | "accept_decline_date"
 *   related_entity_id: string (optional)
 *   related_entity_type: string (optional)
 *   metadata: object (optional)
 *   send_notification: boolean (optional, default true)
 */

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

// Maps message_type to the notification settingKey (mirrors notificationTypes.js)
const MESSAGE_TYPE_SETTING_KEY = {
  match_invite:    "match_reminders",
  contract_offer:  "contract_offers",
  club_invite:     "club_updates",
  announcement:    "announcements",
  general:         "messages",
};

function isNotifEnabled(messageType, settings) {
  const key = MESSAGE_TYPE_SETTING_KEY[messageType] || "messages";
  const val = (settings || {})[key];
  return val === undefined ? true : val === true;
}

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);

  const body = await req.json();
  const {
    recipient_email,
    sender_email,
    subject,
    body: msgBody,
    message_type = "general",
    action_type = "none",
    related_entity_id,
    related_entity_type,
    metadata,
    send_notification = true,
  } = body;

  // Support recipient_player_id as an alternative to recipient_email
  const { recipient_player_id } = body;
  let resolvedRecipientEmail = recipient_email;

  if (!resolvedRecipientEmail && recipient_player_id) {
    const player = await base44.asServiceRole.entities.Player.get(recipient_player_id);
    resolvedRecipientEmail = player?.email || null;
  }

  if (!resolvedRecipientEmail || !subject || !msgBody) {
    return Response.json({ error: "Missing required fields: recipient_email (or recipient_player_id), subject, body" }, { status: 400 });
  }

  // Override recipient_email with resolved value
  const recipient_email_final = resolvedRecipientEmail;

  // Resolve sender info if sender_email is provided
  let sender_gamertag = null;
  let sender_avatar_url = null;
  let sender_club_name = null;
  const is_system = !sender_email;

  if (sender_email) {
    const senderPlayers = await base44.asServiceRole.entities.Player.filter({ email: sender_email });
    const senderPlayer = senderPlayers?.[0];
    if (senderPlayer) {
      sender_gamertag = senderPlayer.gamertag || null;
      sender_avatar_url = senderPlayer.avatar_url || null;
      // Get sender's club name
      if (senderPlayer.club_id) {
        const club = await base44.asServiceRole.entities.Club.get(senderPlayer.club_id);
        sender_club_name = club?.name || null;
      }
    }
  }

  // Create the inbox message
  const message = await base44.asServiceRole.entities.InboxMessage.create({
    recipient_email: recipient_email_final,
    sender_email: sender_email || null,
    sender_gamertag,
    sender_avatar_url,
    sender_club_name,
    is_system,
    subject,
    body: msgBody,
    message_type,
    action_type,
    status: "pending",
    is_read: false,
    related_entity_id: related_entity_id || null,
    related_entity_type: related_entity_type || null,
    metadata: metadata || null,
  });

  // Optionally send a notification
  if (send_notification) {
    const recipientPlayers = await base44.asServiceRole.entities.Player.filter({ email: recipient_email_final });
    const recipientPlayer = recipientPlayers?.[0];
    const settings = recipientPlayer?.notification_settings || {};

    if (isNotifEnabled(message_type, settings)) {
      await base44.asServiceRole.entities.Notification.create({
        recipient_email: recipient_email_final,
        type: "message",
        title: `New message: ${subject}`,
        body: is_system ? "System message" : `From ${sender_gamertag || sender_email}`,
        link: `/inbox?id=${message.id}`,
        related_id: message.id,
        read: false,
      });
    }
  }

  return Response.json({ success: true, message });
});