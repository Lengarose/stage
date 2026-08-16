export function resolvePlayerAvatarUrl(player) {
  if (!player || typeof player !== "object") return "";
  const raw = player.avatar_url || player.avatar || player.photo_url || "";
  return String(raw).trim();
}

export function playerAvatarInitials(player) {
  const tag = String(player?.gamertag || "").trim();
  return (tag[0] || "?").toUpperCase();
}
