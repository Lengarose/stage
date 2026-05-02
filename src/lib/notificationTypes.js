/**
 * Central registry of all notification types.
 * To add a new type: add an entry here and add it to the Notification entity enum.
 *
 * settingKey: maps to the key stored in user's notification_settings object.
 * group: display grouping in settings UI.
 */

export const NOTIFICATION_TYPES = {
  // Contracts
  contract_offer:      { label: "Contract offers",     settingKey: "contract_offers",   group: "Contracts" },
  contract_accepted:   { label: "Contract accepted",   settingKey: "contract_updates",  group: "Contracts" },
  contract_rejected:   { label: "Contract rejected",   settingKey: "contract_updates",  group: "Contracts" },
  contract_terminated: { label: "Contract terminated", settingKey: "contract_updates",  group: "Contracts" },
  contract_expired:    { label: "Contract expired",    settingKey: "contract_updates",  group: "Contracts" },
  contract_completed:  { label: "Contract completed",  settingKey: "contract_updates",  group: "Contracts" },

  // Matches
  match_scheduled:     { label: "Match scheduled",     settingKey: "match_reminders",   group: "Matches" },
  match_result:        { label: "Match results",       settingKey: "match_results",     group: "Matches" },
  match_reminder:      { label: "Match reminders",     settingKey: "match_reminders",   group: "Matches" },
  result_submitted:    { label: "Result submitted",    settingKey: "match_results",     group: "Matches" },
  result_confirmed:    { label: "Result confirmed",    settingKey: "match_results",     group: "Matches" },

  // Club
  join_request:        { label: "Join requests",       settingKey: "club_updates",      group: "Club" },
  join_approved:       { label: "Join approved",       settingKey: "club_updates",      group: "Club" },
  join_rejected:       { label: "Join rejected",       settingKey: "club_updates",      group: "Club" },
  club_update:         { label: "Club updates",        settingKey: "club_updates",      group: "Club" },
  invite:              { label: "Club invites",        settingKey: "club_updates",      group: "Club" },

  // Messages
  message:             { label: "Messages",            settingKey: "messages",          group: "Social" },

  // Tournaments
  tournament_start:    { label: "Tournament starts",   settingKey: "tournament_updates", group: "Tournaments" },
  tournament_complete: { label: "Tournament results",  settingKey: "tournament_updates", group: "Tournaments" },

  // General
  announcement:        { label: "Announcements",       settingKey: "announcements",     group: "General" },
};

/**
 * The user-level notification settings keys with labels shown in settings UI.
 * Default = true (all on).
 */
export const NOTIFICATION_SETTINGS = [
  { key: "messages",           label: "Messages",            description: "Direct messages from other players" },
  { key: "contract_offers",    label: "Contract offers",     description: "When someone offers you a contract" },
  { key: "contract_updates",   label: "Contract updates",    description: "Accepted, rejected, terminated contracts" },
  { key: "match_reminders",    label: "Match reminders",     description: "Upcoming scheduled matches" },
  { key: "match_results",      label: "Match results",       description: "Match outcomes and confirmations" },
  { key: "club_updates",       label: "Club updates",        description: "Join requests, approvals, and invites" },
  { key: "tournament_updates", label: "Tournament updates",  description: "Tournament starts and completions" },
  { key: "announcements",      label: "Announcements",       description: "Platform news and announcements" },
];

/**
 * Get the default notification settings object (all ON).
 */
export function getDefaultNotificationSettings() {
  const defaults = {};
  NOTIFICATION_SETTINGS.forEach(s => { defaults[s.key] = true; });
  return defaults;
}

/**
 * Check if a notification type is enabled for a given settings object.
 * Defaults to true if the setting has never been set.
 */
export function isNotificationEnabled(notificationType, userSettings) {
  const meta = NOTIFICATION_TYPES[notificationType];
  if (!meta) return true; // unknown type → always send
  const settings = userSettings || {};
  const val = settings[meta.settingKey];
  return val === undefined ? true : val === true;
}