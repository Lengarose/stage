export function parseGamertagMentions(text = "") {
  const seen = new Set();
  const matches = String(text).matchAll(/(^|\s)@([A-Za-z0-9_-]{2,32})\b/g);
  for (const match of matches) seen.add(match[2]);
  return [...seen];
}

export function getMentionPlayerId(tags, gamertag) {
  let parsedTags = tags;
  if (typeof parsedTags === "string") {
    try { parsedTags = JSON.parse(parsedTags); } catch { return null; }
  }
  const match = Array.isArray(parsedTags)
    ? parsedTags.find((tag) => tag?.gamertag === gamertag)
    : null;
  return match?.player_id || null;
}
