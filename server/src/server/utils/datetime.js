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
  const parsed = new Date(trimmed);
  if (Number.isNaN(parsed.getTime())) return value;
  return formatLocalWallClock(parsed);
}

module.exports = { toMysqlDateTime, isIsoDateString, ISO_DATETIME_RE, MYSQL_DATETIME_RE };
