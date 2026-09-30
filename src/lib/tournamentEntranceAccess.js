import { isAppAdminUser } from "./adminAuth.js";
import { hasStagePlus } from "./subscriptionUtils.js";

export function shouldApplyTournamentEntranceAccess(user) {
  if (!user) return false;
  if (isAppAdminUser(user)) return false;
  return !hasStagePlus(user);
}

export function isTestEntranceLink(link) {
  return String(link?.link_kind || "").toLowerCase() === "test";
}

export async function claimTournamentTestGrantIfNeeded(client, { token, link } = {}) {
  if (!token || !isTestEntranceLink(link) || !client?.functions?.invoke) return null;
  return client.functions.invoke("claimTournamentTestGrant", { token }).catch(() => null);
}
