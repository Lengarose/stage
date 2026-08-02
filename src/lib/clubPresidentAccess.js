import { getPresidentClubId } from "./userIdentityFields.js";

function sameId(left, right) {
  return String(left || "") === String(right || "");
}

function sameEmail(left, right) {
  const a = String(left || "").trim().toLowerCase();
  const b = String(right || "").trim().toLowerCase();
  return Boolean(a && b && a === b);
}

function normalizeEmail(value) {
  return String(value || "").trim().toLowerCase();
}

export function isAdminUser(user) {
  return Number(user?.role_id) === 0 || user?.role === "admin";
}

export function isClubPresidentForUser({ user, club, presidentClub, includeLegacyOwnerEmail = true } = {}) {
  if (!user || !club) return false;
  if (sameId(club.president_user_id, user.id)) return true;
  if (sameId(getPresidentClubId(user), club.id)) return true;
  if (sameId(presidentClub?.id, club.id)) return true;
  if (includeLegacyOwnerEmail && sameEmail(club.owner_email, user.email)) return true;
  return false;
}

export function canManageClubIdentity({
  user,
  club,
  presidentClub,
  activeRoles = [],
  staffPermissions = [],
  requiredPermission = null,
} = {}) {
  if (isAdminUser(user)) return true;
  if (isClubPresidentForUser({ user, club, presidentClub })) return true;
  if (activeRoles.includes("president")) {
    return !presidentClub?.id || !club?.id || sameId(presidentClub.id, club.id);
  }
  if (!requiredPermission) return staffPermissions.length > 0;
  return staffPermissions.includes(requiredPermission);
}

export function getClubPresidentContactEmail({ presidentUser, club } = {}) {
  return normalizeEmail(presidentUser?.email || club?.president_email || club?.owner_email);
}
