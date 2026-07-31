export function getEffectiveInboxActionType(message = {}) {
  if (message.action_type && message.action_type !== "none") return message.action_type;
  if (message.message_type === "match_invite") return "accept_decline_date";
  if (message.message_type === "contract_offer") return "contract_negotiation";
  if (message.message_type === "trial_request") return "trial_response";
  return "none";
}

export function inboxMessageNeedsAction(message = {}) {
  return getEffectiveInboxActionType(message) !== "none" && (message.status || "pending") === "pending";
}

export function inboxMessageIsActioned(message = {}) {
  return getEffectiveInboxActionType(message) !== "none" && (message.status || "pending") !== "pending";
}
