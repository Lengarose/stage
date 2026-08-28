/**
 * Central registry of all notification types and delivery channels.
 * settingKey maps to the key stored in player's notification_settings.
 *
 * Stored shape (legacy flat keys still work as a fallback for every channel):
 * {
 *   messages: true,
 *   web: { messages: true, ... },
 *   email: { messages: true, ... },
 *   mobile: { messages: true, ... },
 *   push: { messages: true, ... },
 * }
 */

export const NOTIFICATION_TYPES = {
  contract_offer:      { label: "Contract offers",     settingKey: "contract_offers",   group: "Contracts" },
  contract_accepted:   { label: "Contract accepted",   settingKey: "contract_updates",  group: "Contracts" },
  contract_rejected:   { label: "Contract rejected",   settingKey: "contract_updates",  group: "Contracts" },
  contract_terminated: { label: "Contract terminated", settingKey: "contract_updates",  group: "Contracts" },
  contract_expired:    { label: "Contract expired",    settingKey: "contract_updates",  group: "Contracts" },
  contract_completed:  { label: "Contract completed",  settingKey: "contract_updates",  group: "Contracts" },
  loan_offer:          { label: "Loan offers",         settingKey: "club_updates",      group: "Club" },

  match_scheduled:     { label: "Match scheduled",     settingKey: "match_reminders",   group: "Matches" },
  match_result:        { label: "Match results",       settingKey: "match_results",     group: "Matches" },
  match_reminder:      { label: "Match reminders",     settingKey: "match_reminders",   group: "Matches" },
  result_submitted:    { label: "Result submitted",    settingKey: "match_results",     group: "Matches" },
  result_confirmed:    { label: "Result confirmed",    settingKey: "match_results",     group: "Matches" },

  join_request:        { label: "Join requests",       settingKey: "club_updates",      group: "Club" },
  join_approved:       { label: "Join approved",       settingKey: "club_updates",      group: "Club" },
  join_rejected:       { label: "Join rejected",       settingKey: "club_updates",      group: "Club" },
  club_update:         { label: "Club updates",        settingKey: "club_updates",      group: "Club" },
  invite:              { label: "Club invites",        settingKey: "club_updates",      group: "Club" },

  message:             { label: "Messages",            settingKey: "messages",          group: "Social" },

  tournament_start:    { label: "Tournament starts",   settingKey: "tournament_updates", group: "Tournaments" },
  tournament_complete: { label: "Tournament results",  settingKey: "tournament_updates", group: "Tournaments" },

  announcement:        { label: "Announcements",       settingKey: "announcements",     group: "General" },
};

export const NOTIFICATION_SETTINGS = [
  { key: "messages",           label: "Messages",            description: "Direct messages, match chat, and club chat" },
  { key: "contract_offers",    label: "Contract offers",     description: "When someone offers you a contract" },
  { key: "contract_updates",   label: "Contract updates",    description: "Accepted, rejected, terminated contracts" },
  { key: "match_reminders",    label: "Match reminders",     description: "Upcoming scheduled matches" },
  { key: "match_results",      label: "Match results",       description: "Match outcomes and confirmations" },
  { key: "club_updates",       label: "Club updates",        description: "Join requests, approvals, and invites" },
  { key: "tournament_updates", label: "Tournament updates",  description: "Tournament starts and completions" },
  { key: "announcements",      label: "Announcements",       description: "Platform news and announcements" },
];

export const NOTIFICATION_SETTING_GROUPS = [
  { label: "Social",      keys: ["messages"] },
  { label: "Contracts",   keys: ["contract_offers", "contract_updates"] },
  { label: "Matches",     keys: ["match_reminders", "match_results"] },
  { label: "Club",        keys: ["club_updates"] },
  { label: "Tournaments", keys: ["tournament_updates"] },
  { label: "General",     keys: ["announcements"] },
];

export const NOTIFICATION_CHANNEL_KEYS = ["web", "email", "mobile", "push"];

export const NOTIFICATION_CHANNELS = [
  {
    key: "email",
    label: "Email notifications",
    description: "Sent to your account email.",
  },
  {
    key: "mobile",
    label: "Mobile notifications",
    description: "In-app toasts and the notification list on your phone.",
  },
  {
    key: "push",
    label: "Push notifications",
    description: "Lock screen and banner alerts on this device.",
  },
];

export const TEST_TOAST_SAMPLES = [
  { key: "messages", variant: "info", title: "Messages", message: "New chat from Neo" },
  { key: "contract_offers", variant: "info", title: "Contract offers", message: "Ajax sent you a contract" },
  { key: "match_reminders", variant: "warning", title: "Match reminders", message: "Kickoff in 30 minutes" },
  { key: "match_results", variant: "success", title: "Match results", message: "Result confirmed 3–1" },
  { key: "club_updates", variant: "success", title: "Club updates", message: "Join request approved" },
  { key: "announcements", variant: "info", title: "Announcements", message: "Transfer window is open" },
];

export function parseNotificationSettings(raw) {
  if (!raw) return {};
  if (typeof raw === "string") {
    try {
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
    } catch {
      return {};
    }
  }
  return typeof raw === "object" && !Array.isArray(raw) ? raw : {};
}

export function isSettingOn(settings, key) {
  const val = settings?.[key];
  if (val === undefined || val === null) return true;
  return val === true || val === 1 || val === "true" || val === "1";
}

export function isChannelCategoryOn(settings, channel, categoryKey) {
  const parsed = parseNotificationSettings(settings);
  const nested = parsed?.[channel];
  if (nested && typeof nested === "object" && !Array.isArray(nested) && Object.prototype.hasOwnProperty.call(nested, categoryKey)) {
    return isSettingOn(nested, categoryKey);
  }
  return isSettingOn(parsed, categoryKey);
}

export function materializeNotificationSettings(raw) {
  const parsed = parseNotificationSettings(raw);
  const next = { ...parsed };
  for (const channel of NOTIFICATION_CHANNEL_KEYS) {
    const nested = {};
    for (const row of NOTIFICATION_SETTINGS) {
      nested[row.key] = isChannelCategoryOn(parsed, channel, row.key);
    }
    next[channel] = nested;
  }
  for (const row of NOTIFICATION_SETTINGS) {
    next[row.key] = next.web[row.key];
  }
  return next;
}

export function getDefaultNotificationSettings() {
  const categories = {};
  NOTIFICATION_SETTINGS.forEach((row) => { categories[row.key] = true; });
  return materializeNotificationSettings(categories);
}

export function setChannelCategory(settings, channel, categoryKey, value) {
  const current = materializeNotificationSettings(settings);
  const nested = { ...(current[channel] || {}), [categoryKey]: Boolean(value) };
  const next = { ...current, [channel]: nested };
  if (channel === "web") next[categoryKey] = Boolean(value);
  return next;
}

export function isNotificationEnabled(notificationType, userSettings, channel = "web") {
  const meta = NOTIFICATION_TYPES[notificationType];
  if (!meta) return true;
  return isChannelCategoryOn(userSettings, channel, meta.settingKey);
}
