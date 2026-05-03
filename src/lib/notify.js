import { base44 } from "@/api/base44Client";

/**
 * Fire-and-forget notification helper.
 * Never throws — failures are silently swallowed so callers don't need try/catch.
 */
export async function notify(recipientEmail, type, title, body = "", link = null) {
  if (!recipientEmail) return;
  try {
    await base44.entities.Notification.create({
      recipient_email: recipientEmail,
      type,
      title,
      body,
      read: false,
      ...(link ? { link } : {}),
    });
  } catch (_) { /* non-fatal */ }
}

/**
 * Fire-and-forget NewsItem poster for contract events.
 * Posts to category "contracts" so it shows under Contracts and All in the News feed.
 */
export async function postContractNews({ title, body = "", club_name = "", club_logo_url = "", player_name = "", player_avatar_url = "", link = "", transfer_fee_stc = 0 }) {
  try {
    await base44.entities.NewsItem.create({
      title,
      body,
      type: "contract",
      category: "contracts",
      club_name,
      club_logo_url,
      player_name,
      player_avatar_url,
      link,
      is_global: true,
      published_at: new Date().toISOString(),
      ...(transfer_fee_stc > 0 ? { transfer_fee_stc } : {}),
    });
  } catch (_) { /* non-fatal */ }
}
