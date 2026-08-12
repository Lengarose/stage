/**
 * Public president directory eligibility.
 * Ensure/backfill can create stub rows with only user_id/email — hide those until
 * PresidentSetup (or equivalent) filled a public identity.
 */
export function isPublicPresidentProfile(president) {
  if (!president?.id) return false;
  const name = String(president.display_name || "").trim();
  const country = String(president.country_code || "").trim();
  return Boolean(name || country);
}

export function filterPublicPresidentProfiles(presidents) {
  if (!Array.isArray(presidents)) return [];
  return presidents.filter(isPublicPresidentProfile);
}

function mapPlayersById(players) {
  const byId = new Map();
  if (!Array.isArray(players)) return byId;
  for (const player of players) {
    if (player?.id) byId.set(String(player.id), player);
  }
  return byId;
}

export function buildPlayerPresidentDirectoryRows(clubs, players) {
  const playersById = mapPlayersById(players);
  if (!Array.isArray(clubs)) return [];

  return clubs
    .map((club) => {
      const playerId = club?.president_player_id;
      const player = playerId ? playersById.get(String(playerId)) : null;
      if (!club?.id || !player?.id) return null;
      return {
        id: player.id,
        player_id: player.id,
        club_id: club.id,
        club_name: club.name || "",
        club_tag: club.tag || "",
        club_logo_url: club.logo_url || "",
        display_name: player.gamertag || player.display_name || club.name || "",
        role_title: "President",
        avatar_url: player.avatar_url || "",
        avatar_position: player.avatar_position || "50% 50%",
        avatar_zoom: player.avatar_zoom || 150,
        banner_url: player.banner_url || club.banner_url || "",
        banner_position: player.banner_position || club.banner_position || "50% 50%",
        banner_zoom: player.banner_zoom || club.banner_zoom || 150,
        country_code: player.country_code || club.country_code || "",
        platform: player.platform || club.platform || "",
        management_style: club.play_style || club.region || "",
      };
    })
    .filter(Boolean);
}

export function matchesPlayerPresidentQuery(row, query) {
  const q = String(query || "").trim().toLowerCase();
  if (!q) return true;
  return [
    row?.display_name,
    row?.club_name,
    row?.club_tag,
    row?.country_code,
    row?.platform,
  ].some((value) => String(value || "").toLowerCase().includes(q));
}
