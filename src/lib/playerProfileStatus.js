const NON_FOOTBALL_ROLES = new Set(["president", "owner", "manager", "member"]);
const FOUNDER_CONTRACT_TYPES = new Set(["founder", "founder_player"]);

export function normalizeClubRoles(roles) {
  if (Array.isArray(roles)) return roles;
  if (typeof roles === "string") {
    try {
      const parsed = JSON.parse(roles);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return roles.split(",").map((role) => role.trim()).filter(Boolean);
    }
  }
  return [];
}

export function getFootballRoleBadges(player) {
  const rawRoles = normalizeClubRoles(player?.club_roles);
  const roles = rawRoles.length > 0 ? rawRoles : [player?.role].filter(Boolean);
  return Array.from(new Set(roles.filter((role) => role && !NON_FOOTBALL_ROLES.has(role))));
}

export function getVisibleFootballRole(player) {
  const roles = normalizeClubRoles(player?.club_roles);
  if (roles.includes("captain") || player?.role === "captain") return "captain";
  if (roles.includes("vice-captain") || player?.role === "vice-captain") return "vice-captain";
  return player?.role && !NON_FOOTBALL_ROLES.has(player.role) ? player.role : "";
}

function getContractTargetPlayerId(contract) {
  return contract?.target_player_id || contract?.player_id || contract?.user_id || null;
}

function getContractType(contract) {
  return String(contract?.contract_type || contract?.type || "").toLowerCase();
}

export function getPlayerManagementBadges({ player, club, memberships = [], contracts = [] } = {}) {
  if (!player?.id || !club?.id) return [];
  const isCanonicalPresident = String(club.president_player_id || "") === String(player.id);
  const isLegacyOwner = player.user_id && (
    String(club.president_user_id || "") === String(player.user_id) ||
    String(club.user_id || "") === String(player.user_id)
  );
  const activeMemberships = Array.isArray(memberships) ? memberships.filter((membership) => (
    membership?.status === "active" &&
    String(membership.player_id || "") === String(player.id) &&
    String(membership.club_id || "") === String(club.id)
  )) : [];
  const founderMembership = activeMemberships.find((membership) => membership.source === "founder_contract");
  const presidentMembership = activeMemberships.find((membership) => membership.primary_role === "president");
  const founderContract = Array.isArray(contracts) ? contracts.find((contract) => (
    contract?.status === "active" &&
    FOUNDER_CONTRACT_TYPES.has(getContractType(contract)) &&
    String(contract.team_id || "") === String(club.id) &&
    String(getContractTargetPlayerId(contract) || "") === String(player.id)
  )) : null;

  const badges = [];
  if (founderMembership || founderContract) {
    badges.push({ id: "founder", label: "Founder", tone: "amber", clubId: club.id, clubName: club.name || "" });
  }
  if (isCanonicalPresident || presidentMembership) {
    badges.push({ id: "president", label: "President", tone: "cyan", clubId: club.id, clubName: club.name || "" });
  } else if (isLegacyOwner) {
    badges.push({ id: "owner", label: "Owner", tone: "slate", clubId: club.id, clubName: club.name || "" });
  }

  return badges;
}
