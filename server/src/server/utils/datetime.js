// Datetime coercion helpers for the MySQL layer.
//
// MySQL DATETIME has no timezone — it stores the wall-clock time users pick in
// the UI (date + time inputs). Do NOT convert to UTC on save; that shifts
// hours when the value is read back and parsed as local time in the browser.

const ISO_DATETIME_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:?\d{2})$/;
const MYSQL_DATETIME_RE = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/;
const LOCAL_INPUT_RE = /^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}(?::\d{2})?(?:\.\d+)?$/;

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
    return formatUtcWallClock(value);
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

const MATCH_SCHEDULE_FIELDS = ['scheduled_date', 'first_submission_at'];

function normalizeMatchForApi(row) {
  if (!row || typeof row !== 'object') return row;
  const out = { ...row };
  for (const field of MATCH_SCHEDULE_FIELDS) {
    if (field in out) out[field] = asWallClockDateTimeString(out[field]);
  }
  return out;
}

module.exports = {
  toMysqlDateTime,
  isIsoDateString,
  ISO_DATETIME_RE,
  MYSQL_DATETIME_RE,
  asWallClockDateTimeString,
  normalizeMatchForApi,
};
