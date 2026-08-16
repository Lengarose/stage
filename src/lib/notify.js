import { stageClient } from "@/api/stageClient";
import { contractNewsSections } from "@/lib/newsPaper";

/**
 * Fire-and-forget notification helper.
 * Never throws — failures are silently swallowed so callers don't need try/catch.
 */
export async function notify(recipientEmail, type, title, body = "", link = null) {
  const target = String(recipientEmail || "").trim().toLowerCase();
  if (!target) return;
  try {
    await stageClient.entities.Notification.create({
      recipient_email: target,
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
 * Posts a contract story linked to the shared mercato transfer when transfer_id is known.
 */
export async function postContractNews({ title, body = "", club_name = "", club_logo_url = "", player_name = "", player_avatar_url = "", link = "", transfer_fee_stc = 0, tags, transfer_id }) {
  try {
    await stageClient.entities.NewsItem.create({
      title,
      body,
      type: "contract",
      category: "contracts",
      tags: tags || contractNewsSections(title, body),
      club_name,
      club_logo_url,
      player_name,
      player_avatar_url,
      link,
      is_global: true,
      published_at: new Date().toISOString(),
      ...(transfer_fee_stc > 0 ? { transfer_fee_stc } : {}),
      ...(transfer_id ? { transfer_id } : {}),
    });
  } catch (_) { /* non-fatal */ }
}
