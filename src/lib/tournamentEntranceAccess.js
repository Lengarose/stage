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

const ENTRANCE_TOURNAMENT_KEY = "stage_entrance_tournament_id";

export function entranceTournamentPath(tournamentId) {
  const id = String(tournamentId || "").trim();
  if (!id) return "/";
  return `/tournaments/${encodeURIComponent(id)}`;
}

export function rememberEntranceTournament(tournamentId) {
  const id = String(tournamentId || "").trim();
  if (!id || typeof sessionStorage === "undefined") return;
  sessionStorage.setItem(ENTRANCE_TOURNAMENT_KEY, id);
}

export function readEntranceTournament() {
  if (typeof sessionStorage === "undefined") return null;
  const id = sessionStorage.getItem(ENTRANCE_TOURNAMENT_KEY);
  return id ? String(id) : null;
}

export function clearEntranceTournament() {
  if (typeof sessionStorage === "undefined") return;
  sessionStorage.removeItem(ENTRANCE_TOURNAMENT_KEY);
}

// Test invites keep the normal app header. They only open the tournament so the
// player can register. Standard invites still scope free accounts.
export async function finishTournamentEntranceSession(client, { user, tournamentId, token, link } = {}) {
  const invoke = client?.functions?.invoke;
  if (isTestEntranceLink(link)) {
    if (String(user?.access_mode || "").toLowerCase() === "tournament_limited" && invoke) {
      await invoke("clearTournamentLimitedAccess", {}).catch(() => {});
    }
  } else if (tournamentId && shouldApplyTournamentEntranceAccess(user) && invoke) {
    await invoke("applyTournamentEntranceAccessMode", { tournament_id: tournamentId }).catch(() => {});
  }
  await claimTournamentTestGrantIfNeeded(client, { token, link });
  rememberEntranceTournament(tournamentId);
  return entranceTournamentPath(tournamentId);
}

export async function claimTournamentTestGrantIfNeeded(client, { token, link } = {}) {
  if (!token || !isTestEntranceLink(link) || !client?.functions?.invoke) return null;
  return client.functions.invoke("claimTournamentTestGrant", { token }).catch(() => null);
}
