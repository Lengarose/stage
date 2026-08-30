// Datetime coercion helpers for the MySQL layer.
//
// MySQL DATETIME has no timezone — it stores the wall-clock time users pick in
// the UI (date + time inputs). Do NOT convert to UTC on save; that shifts
// hours when the value is read back and parsed as local time in the browser.
// Persist naive wall clock + a separate `timezone` column. On GET, emit an
// offset ISO string in that zone (e.g. 2026-08-30T17:20:00+02:00).

const ISO_DATETIME_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:?\d{2})$/;
const MYSQL_DATETIME_RE = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/;
const LOCAL_INPUT_RE = /^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}(?::\d{2})?(?:\.\d+)?$/;
const DEFAULT_TIMEZONE = 'Europe/Brussels';

function pad2(n) {
  return String(n).padStart(2, '0');
}

/** Format a Date using local wall-clock components (not UTC). */
function formatLocalWallClock(d) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())} ${pad2(d.getHours())}:${pad2(d.getMinutes())}:${pad2(d.getSeconds())}`;
}

/** Format Date for API — use UTC parts so DATETIME digits match MySQL on Gandi (UTC). */
function formatUtcWallClock(d) {
  return `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())} ${pad2(d.getUTCHours())}:${pad2(d.getUTCMinutes())}:${pad2(d.getUTCSeconds())}`;
}

function isIsoDateString(value) {
  return typeof value === 'string' && ISO_DATETIME_RE.test(value);
}

function isValidTimeZone(value) {
  if (!value || typeof value !== 'string' || value.length > 80) return false;
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: value }).format(new Date());
    return true;
  } catch {
    return false;
  }
}

function resolveTimeZone(value) {
  const tz = String(value || '').trim();
  return isValidTimeZone(tz) ? tz : DEFAULT_TIMEZONE;
}

function toMysqlDateTime(value) {
  if (value === null || value === undefined || value === '') return null;
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return null;
    return formatLocalWallClock(value);
  }
  if (typeof value !== 'string') return value;
  const trimmed = value.trim();
  if (MYSQL_DATETIME_RE.test(trimmed)) return trimmed;
  // datetime-local / date+time strings without timezone — store as-is
  if (LOCAL_INPUT_RE.test(trimmed) && !/[Z+-]\d{2}/.test(trimmed)) {
    const normalized = trimmed.replace('T', ' ');
    return normalized.length === 16 ? `${normalized}:00` : normalized.slice(0, 19);
  }
  // Legacy ISO with Z — use the literal date/time digits, not server-local conversion.
  if (isIsoDateString(trimmed)) {
    const parts = trimmed.match(/^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2}:\d{2})/);
    if (parts) return `${parts[1]} ${parts[2]}`;
  }
  const parsed = new Date(trimmed);
  if (Number.isNaN(parsed.getTime())) return value;
  return formatLocalWallClock(parsed);
}

/**
 * API read helper: always emit MySQL wall-clock strings for schedule fields.
 * Handles legacy rows where mysql2/JSON turned DATETIME into Date or ISO "…Z".
 */
function asWallClockDateTimeString(value) {
  if (value === null || value === undefined || value === '') return null;
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return null;
    return formatLocalWallClock(value);
  }
  if (typeof value !== 'string') return value;
  const trimmed = value.trim();
  if (MYSQL_DATETIME_RE.test(trimmed)) return trimmed;
  if (LOCAL_INPUT_RE.test(trimmed) && !/[Z+-]\d{2}/.test(trimmed)) {
    const normalized = trimmed.replace('T', ' ');
    return normalized.length === 16 ? `${normalized}:00` : normalized.slice(0, 19);
  }
  const isoZ = trimmed.match(/^(\d{4}-\d{2}-\d{2})[T ](\d{2}:\d{2})(?::(\d{2}))?(?:\.\d+)?Z$/i);
  if (isoZ) {
    const sec = isoZ[3] || '00';
    return `${isoZ[1]} ${isoZ[2]}:${sec}`;
  }
  if (isIsoDateString(trimmed)) {
    const parts = trimmed.match(/^(\d{4}-\d{2}-\d{2})[T ](\d{2}:\d{2}:\d{2})/);
    if (parts) return `${parts[1]} ${parts[2]}`;
  }
  return trimmed;
}

function parseWallClockDateTime(value) {
  const wallClock = asWallClockDateTimeString(value);
  if (!wallClock) return null;
  const normalized = String(wallClock).trim().replace(' ', 'T');
  const parsed = new Date(normalized);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function isWallClockPast(value, now = new Date()) {
  const parsed = parseWallClockDateTime(value);
  return Boolean(parsed && parsed.getTime() < now.getTime());
}

/** Offset minutes of `timeZone` at UTC instant `date` (positive = east of UTC). */
function getTimeZoneOffsetMinutes(timeZone, date) {
  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone: resolveTimeZone(timeZone),
    timeZoneName: 'longOffset',
    hour: 'numeric',
  });
  const tzName = dtf.formatToParts(date).find((p) => p.type === 'timeZoneName')?.value || 'GMT';
  if (tzName === 'GMT' || tzName === 'UTC') return 0;
  const match = tzName.match(/GMT([+-])(\d{1,2})(?::?(\d{2}))?/i);
  if (!match) return 0;
  const sign = match[1] === '-' ? -1 : 1;
  const hours = Number(match[2] || 0);
  const mins = Number(match[3] || 0);
  return sign * (hours * 60 + mins);
}

/**
 * Convert naive MySQL DATETIME digits + IANA zone → offset ISO.
 * Digits are NOT shifted: 17:20 in Europe/Brussels (Aug) → 2026-08-30T17:20:00+02:00.
 */
function wallClockToOffsetIso(value, timeZone) {
  const wall = asWallClockDateTimeString(value);
  if (!wall) return null;
  const m = String(wall).match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})(?::(\d{2}))?/);
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  const h = Number(m[4]);
  const mi = Number(m[5]);
  const s = Number(m[6] || 0);
  const tz = resolveTimeZone(timeZone);
  const asUtcGuess = Date.UTC(y, mo - 1, d, h, mi, s);
  let utcMs = asUtcGuess;
  for (let i = 0; i < 3; i += 1) {
    const offsetMin = getTimeZoneOffsetMinutes(tz, new Date(utcMs));
    const next = asUtcGuess - offsetMin * 60_000;
    if (next === utcMs) break;
    utcMs = next;
  }
  const offsetMin = getTimeZoneOffsetMinutes(tz, new Date(utcMs));
  const sign = offsetMin >= 0 ? '+' : '-';
  const abs = Math.abs(offsetMin);
  const oh = pad2(Math.floor(abs / 60));
  const om = pad2(abs % 60);
  return `${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}:${pad2(s)}${sign}${oh}:${om}`;
}

const MATCH_SCHEDULE_FIELDS = ['scheduled_date', 'first_submission_at'];

function normalizeMatchForApi(row) {
  if (!row || typeof row !== 'object') return row;
  const out = { ...row };
  const tz = resolveTimeZone(out.timezone);
  out.timezone = tz;
  for (const field of MATCH_SCHEDULE_FIELDS) {
    if (!(field in out)) continue;
    if (field === 'scheduled_date') {
      out[field] = wallClockToOffsetIso(out[field], tz) || asWallClockDateTimeString(out[field]);
    } else {
      out[field] = asWallClockDateTimeString(out[field]);
    }
  }
  return out;
}

module.exports = {
  toMysqlDateTime,
  isIsoDateString,
  ISO_DATETIME_RE,
  MYSQL_DATETIME_RE,
  asWallClockDateTimeString,
  parseWallClockDateTime,
  isWallClockPast,
  normalizeMatchForApi,
  wallClockToOffsetIso,
  resolveTimeZone,
  isValidTimeZone,
  DEFAULT_TIMEZONE,
};
