import { isAppAdminUser } from "./adminAuth.js";
import { hasStagePlus } from "./subscriptionUtils.js";

export function shouldApplyTournamentEntranceAccess(user) {
  if (!user) return false;
  if (isAppAdminUser(user)) return false;
  return !hasStagePlus(user);
}
