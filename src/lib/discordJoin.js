import { isDiscordConfigured } from "@/lib/discordConfig";

const JOINED_KEY = "stage_discord_joined";
const DISMISS_KEY = "stage_discord_prompt_dismissed";

export function hasMarkedDiscordJoined() {
  if (typeof window === "undefined") return false;
  return localStorage.getItem(JOINED_KEY) === "1";
}

export function markDiscordJoined() {
  if (typeof window === "undefined") return;
  localStorage.setItem(JOINED_KEY, "1");
  localStorage.removeItem(DISMISS_KEY);
}

export function dismissDiscordPrompt() {
  if (typeof window === "undefined") return;
  localStorage.setItem(DISMISS_KEY, "1");
}

export function clearDiscordJoinState() {
  if (typeof window === "undefined") return;
  localStorage.removeItem(JOINED_KEY);
  localStorage.removeItem(DISMISS_KEY);
}

/** Show join prompts on Home etc. until user joins or dismisses. */
export function shouldShowDiscordPrompt() {
  if (!isDiscordConfigured()) return false;
  if (hasMarkedDiscordJoined()) return false;
  if (typeof window === "undefined") return false;
  return localStorage.getItem(DISMISS_KEY) !== "1";
}

export function openDiscordInvite(inviteUrl) {
  if (!inviteUrl) return;
  window.open(inviteUrl, "_blank", "noopener,noreferrer");
  markDiscordJoined();
}
