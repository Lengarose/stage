export const ASSIGNABLE_CLUB_STAFF_ROLES = ["captain", "vice_captain"];

const ROLE_PRIORITY = [
  "president",
  "captain",
  "vice_captain",
  "recruiter",
  "finance_manager",
  "match_coordinator",
];

export function normalizeClubRole(role) {
  return String(role || "").trim().toLowerCase().replace(/-/g, "_");
}

export function getPrimaryClubRole(player = {}) {
  const roles = [
    normalizeClubRole(player.role),
    ...(Array.isArray(player.club_roles) ? player.club_roles.map(normalizeClubRole) : []),
  ].filter(Boolean);
  return ROLE_PRIORITY.find((role) => roles.includes(role)) || normalizeClubRole(player.role) || "member";
}

export function mergeStaffRolesIntoPlayers(players = [], staffRoles = []) {
  const rolesByPlayer = new Map();
  for (const row of staffRoles || []) {
    if (!row?.player_id) continue;
    const role = normalizeClubRole(row.role);
    if (!role) continue;
    const current = rolesByPlayer.get(row.player_id) || [];
    current.push(role);
    rolesByPlayer.set(row.player_id, current);
  }

  return (players || []).map((player) => {
    const staff = rolesByPlayer.get(player.id) || [];
    if (!staff.length) return player;
    const clubRoles = [
      ...(Array.isArray(player.club_roles) ? player.club_roles.map(normalizeClubRole) : []),
      ...staff,
    ].filter(Boolean);
    const enriched = { ...player, club_roles: [...new Set(clubRoles)] };
    return { ...enriched, role: getPrimaryClubRole(enriched) };
  });
}
