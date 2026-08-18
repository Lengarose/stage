import { isPersistableMediaUrl, trimUrl } from "./mediaUrls.js";

export function resolvePlayerAvatarUrl(player) {
  if (!player || typeof player !== "object") return "";
  const raw = trimUrl(player.avatar_url || player.avatar || player.photo_url || "");
  return isPersistableMediaUrl(raw) ? raw : "";
}

export function playerAvatarInitials(player) {
  const tag = String(player?.gamertag || "").trim();
  return (tag[0] || "?").toUpperCase();
}
