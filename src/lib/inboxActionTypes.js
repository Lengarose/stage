export function parseInboxMetadata(message = {}) {
  const raw = message.metadata;
  if (!raw) return {};
  if (typeof raw === "object" && !Array.isArray(raw)) return raw;
  try {
    return JSON.parse(String(raw));
  } catch {
    return {};
  }
}

export function isMatchCancelRequest(message = {}) {
  return Boolean(parseInboxMetadata(message).cancel_request);
}

export function getEffectiveInboxActionType(message = {}) {
  if (isMatchCancelRequest(message)) return "accept_decline";
  if (message.action_type && message.action_type !== "none") return message.action_type;
  if (message.message_type === "match_invite") return "accept_decline_date";
  if (message.message_type === "contract_offer") return "contract_negotiation";
  if (message.message_type === "trial_request") return "trial_response";
  if (message.message_type === "loan_proposal") return "loan_parent_response";
  if (message.message_type === "loan_early_end") return "loan_early_end_response";
  if (message.message_type === "loan_purchase") return "loan_purchase_response";
  return "none";
}

export function inboxMessageNeedsAction(message = {}) {
  return getEffectiveInboxActionType(message) !== "none" && (message.status || "pending") === "pending";
}

export function inboxMessageIsActioned(message = {}) {
  return getEffectiveInboxActionType(message) !== "none" && (message.status || "pending") !== "pending";
}
