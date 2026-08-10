function parseGamertagMentions(text = "") {
  const seen = new Set();
  for (const match of String(text).matchAll(/(^|\s)@([A-Za-z0-9_-]{2,32})\b/g)) {
    seen.add(match[2]);
  }
  return [...seen];
}

async function resolveMentionedPlayers(EXECUTESQL, content) {
  const names = parseGamertagMentions(content);
  if (!names.length) return [];
  const placeholders = names.map(() => "?").join(",");
  return EXECUTESQL(
    `SELECT id, gamertag, email, avatar_url FROM players WHERE gamertag IN (${placeholders})`,
    names
  );
}

module.exports = { parseGamertagMentions, resolveMentionedPlayers };
