// Datetime coercion helpers for the MySQL layer.
//
// MySQL's DATETIME/TIMESTAMP columns reject ISO 8601 strings with the `T` and
// `Z` suffix (e.g. `2026-05-13T22:00:00.000Z`). They want `YYYY-MM-DD HH:MM:SS`.
// The frontend used to normalize a few specific fields client-side
// (Match.scheduled_date), but the rest of the codebase relied on the backend
// to be lenient — which it wasn't. This caused real bugs (e.g. tournament
// creation failing with `Incorrect datetime value: '2026-05-13T22:00:00.000Z'
// for column 'start_date'`).
//
// `toMysqlDateTime` accepts:
//   • `null` / `undefined` / empty string → returns `null`
//   • `Date` instances → MySQL-formatted UTC string
//   • Already-MySQL-formatted strings (`YYYY-MM-DD HH:MM:SS`) → unchanged
//   • Any string parseable by `new Date(...)` (incl. ISO 8601) → MySQL-formatted UTC string
//   • Anything else → original value (caller decides what to do)
//
// `isIsoDateString` is the strict matcher used by the DB-layer auto-coercion
// so it ONLY converts values that look like ISO 8601 — UUIDs, names, JSON,
// numeric strings, etc. are never touched.

const ISO_DATETIME_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:?\d{2})$/;
const MYSQL_DATETIME_RE = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/;

function isIsoDateString(value) {
  return typeof value === 'string' && ISO_DATETIME_RE.test(value);
}

function toMysqlDateTime(value) {
  if (value === null || value === undefined || value === '') return null;
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return null;
    return value.toISOString().slice(0, 19).replace('T', ' ');
  }
  if (typeof value !== 'string') return value;
  const trimmed = value.trim();
  if (MYSQL_DATETIME_RE.test(trimmed)) return trimmed;
  const parsed = new Date(trimmed);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toISOString().slice(0, 19).replace('T', ' ');
}

module.exports = { toMysqlDateTime, isIsoDateString, ISO_DATETIME_RE, MYSQL_DATETIME_RE };
