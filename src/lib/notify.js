import { stageClient } from "@/api/stageClient";

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

/** Legacy callers remain compatible; accepted agreement records now produce
 * public signing stories on the server. Never publish proposal/pay copy here. */
export async function postContractNews(event = {}) {
  void event;
}
