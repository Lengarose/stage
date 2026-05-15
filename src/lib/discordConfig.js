const viteEnv = /** @type {import('vite').ImportMetaEnv} */ (import.meta).env;

/** Discord server widget ID (Server Settings → Widget). */
export const DISCORD_SERVER_ID = (viteEnv?.VITE_DISCORD_SERVER_ID || "1504515556458496050").trim();

/** Full invite URL, e.g. https://discord.gg/your-code */
export const DISCORD_INVITE_URL = (viteEnv?.VITE_DISCORD_INVITE_URL || "https://discord.gg/YEe4M7T75").trim();

export function isDiscordConfigured() {
  return Boolean(DISCORD_SERVER_ID || DISCORD_INVITE_URL);
}

export function discordWidgetSrc(theme = "dark") {
  if (!DISCORD_SERVER_ID) return null;
  return `https://discord.com/widget?id=${encodeURIComponent(DISCORD_SERVER_ID)}&theme=${theme}`;
}
