export const TRANSFER_WINDOW_TIME_ZONES = [
  ['Belgium / Central Europe', 'Europe/Brussels'],
  ['United Kingdom', 'Europe/London'],
  ['New York / Eastern', 'America/New_York'],
  ['Chicago / Central', 'America/Chicago'],
  ['Denver / Mountain', 'America/Denver'],
  ['Los Angeles / Pacific', 'America/Los_Angeles'],
];
export function viewerTimeZone() {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || 'Europe/Brussels';
}
export function formatWindowDeadline(value, timeZone = viewerTimeZone()) {
  const date = new Date(value);
  if (!value || !Number.isFinite(date.getTime())) return null;
  try {
    return new Intl.DateTimeFormat('en-GB', {
      timeZone, weekday:'short', day:'numeric', month:'short', year:'numeric',
      hour:'2-digit', minute:'2-digit', hourCycle:'h23', timeZoneName:'shortOffset',
    }).format(date);
  } catch { return null; }
}
