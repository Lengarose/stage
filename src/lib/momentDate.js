import moment from "moment";

function toMoment(input) {
  if (moment.isMoment(input)) return input.clone();
  if (input instanceof Date) return moment(input);
  if (typeof input === "string") return moment(input);
  if (typeof input === "number") return moment(input);
  return moment.invalid();
}

function convertDateFnsPattern(pattern = "") {
  const tokenMap = [
    ["yyyy", "YYYY"],
    ["yy", "YY"],
    ["EEEE", "dddd"],
    ["EEE", "ddd"],
    ["dd", "DD"],
    ["d", "D"],
  ];

  let converted = String(pattern).replace(/'([^']*)'/g, "[$1]");
  for (const [dateFnsToken, momentToken] of tokenMap) {
    converted = converted.replaceAll(dateFnsToken, momentToken);
  }
  return converted;
}

const MYSQL_WALL_CLOCK_RE = /^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}(?::\d{2})?$/;

const PARSE_FORMATS = ["YYYY-MM-DD HH:mm:ss", "YYYY-MM-DD HH:mm", moment.ISO_8601];

function formatLocalWallClockFromDate(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}:${String(d.getSeconds()).padStart(2, "0")}`;
}

/**
 * Normalize API/DB schedule values to "YYYY-MM-DD HH:mm:ss" (no timezone shift).
 * Use on every Match fetch — legacy APIs may return ISO "…Z" even when DB is correct.
 */
export function asWallClockDateTimeString(value) {
  if (value == null || value === "") return null;
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return null;
    return formatLocalWallClockFromDate(value);
  }
  const s = String(value).trim();
  if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(s)) return s;
  if (MYSQL_WALL_CLOCK_RE.test(s)) {
    const normalized = s.replace("T", " ");
    return normalized.length === 16 ? `${normalized}:00` : normalized.slice(0, 19);
  }
  const isoZ = s.match(/^(\d{4}-\d{2}-\d{2})[T ](\d{2}:\d{2})(?::(\d{2}))?(?:\.\d+)?Z$/i);
  if (isoZ) {
    const sec = isoZ[3] || "00";
    return `${isoZ[1]} ${isoZ[2]}:${sec}`;
  }
  const isoParts = s.match(/^(\d{4}-\d{2}-\d{2})[T ](\d{2}:\d{2}:\d{2})/);
  if (isoParts && (s.endsWith("Z") || /[+-]\d{2}:?\d{2}$/.test(s))) {
    return `${isoParts[1]} ${isoParts[2]}`;
  }
  return s;
}

/** Parse schedule datetimes as wall-clock (no UTC shift). */
export function parseISO(value) {
  if (value == null || value === "") return new Date("invalid");
  if (value instanceof Date) return value;
  const wall = asWallClockDateTimeString(value);
  if (wall) {
    const normalized = wall.replace("T", " ");
    const m = moment(normalized, ["YYYY-MM-DD HH:mm:ss", "YYYY-MM-DD HH:mm"], true);
    if (m.isValid()) return m.toDate();
  }
  const s = String(value).trim();
  const m = moment(s, PARSE_FORMATS, true);
  if (m.isValid()) return m.toDate();
  const loose = moment(s);
  return loose.isValid() ? loose.toDate() : new Date("invalid");
}

export function isValid(value) {
  return toMoment(value).isValid();
}

export function format(value, pattern) {
  const m = toMoment(value);
  if (!m.isValid()) return "Invalid date";
  return m.format(convertDateFnsPattern(pattern));
}

export function formatDistanceToNow(value, options = {}) {
  const m = toMoment(value);
  if (!m.isValid()) return "";
  const withoutSuffix = m.fromNow(true);
  if (options.addSuffix === false) return withoutSuffix;
  return m.fromNow();
}

export function isPast(value) {
  const m = toMoment(value);
  return m.isValid() ? m.isBefore(moment()) : false;
}

export function differenceInHours(left, right) {
  const l = toMoment(left);
  const r = toMoment(right);
  if (!l.isValid() || !r.isValid()) return 0;
  return l.diff(r, "hours");
}

export function differenceInMinutes(left, right) {
  const l = toMoment(left);
  const r = toMoment(right);
  if (!l.isValid() || !r.isValid()) return 0;
  return l.diff(r, "minutes");
}

export function startOfMonth(value) {
  return toMoment(value).startOf("month").toDate();
}

export function endOfMonth(value) {
  return toMoment(value).endOf("month").toDate();
}

export function startOfWeek(value, options = {}) {
  const weekStartsOn = Number(options.weekStartsOn ?? 0);
  const m = toMoment(value);
  if (!m.isValid()) return new Date("invalid");
  const currentDay = m.day();
  const delta = (currentDay - weekStartsOn + 7) % 7;
  return m.clone().subtract(delta, "days").startOf("day").toDate();
}

export function endOfWeek(value, options = {}) {
  const start = startOfWeek(value, options);
  return moment(start).add(6, "days").endOf("day").toDate();
}

export function addDays(value, amount) {
  return toMoment(value).add(amount, "days").toDate();
}

export function addMonths(value, amount) {
  return toMoment(value).add(amount, "months").toDate();
}

export function subMonths(value, amount) {
  return toMoment(value).subtract(amount, "months").toDate();
}

export function isSameMonth(left, right) {
  const l = toMoment(left);
  const r = toMoment(right);
  if (!l.isValid() || !r.isValid()) return false;
  return l.isSame(r, "month");
}

export function isSameDay(left, right) {
  const l = toMoment(left);
  const r = toMoment(right);
  if (!l.isValid() || !r.isValid()) return false;
  return l.isSame(r, "day");
}

export function isToday(value) {
  const m = toMoment(value);
  return m.isValid() ? m.isSame(moment(), "day") : false;
}

// ── Saving helpers ──────────────────────────────────────────────────────────
// MySQL DATETIME is timezone-naive: store the wall-clock time the user picked
// (local), not UTC — otherwise displayed times shift by the browser offset.
export function toMysqlDateTime(value) {
  if (value === null || value === undefined || value === "") return null;
  const trimmed = typeof value === "string" ? value.trim() : value;
  if (typeof trimmed === "string" && /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(trimmed)) {
    return trimmed;
  }
  if (typeof trimmed === "string" && MYSQL_WALL_CLOCK_RE.test(trimmed)) {
    const normalized = trimmed.replace("T", " ");
    return normalized.length === 16 ? `${normalized}:00` : normalized.slice(0, 19);
  }
  if (trimmed instanceof Date) {
    if (Number.isNaN(trimmed.getTime())) return null;
    return formatLocalWallClockFromDate(trimmed);
  }
  const m = toMoment(trimmed);
  if (!m.isValid()) return null;
  return m.format("YYYY-MM-DD HH:mm:ss");
}

/** Date + time inputs → MySQL wall-clock string (no UTC round-trip). */
export function combineDateTimeToMysql(dateStr, timeStr) {
  if (!dateStr || !timeStr) return null;
  const t = String(timeStr).trim();
  const timePart = t.length === 5 ? `${t}:00` : t.slice(0, 8);
  return `${dateStr} ${timePart}`;
}

/** Value for `<input type="datetime-local" />` from a stored schedule datetime. */
export function toDatetimeLocalValue(value) {
  if (!value) return "";
  const parsed = parseISO(value);
  if (!isValid(parsed)) return "";
  const m = moment(parsed);
  return m.format("YYYY-MM-DDTHH:mm");
}

// Combine a `<input type="date">` value (YYYY-MM-DD) with a
// `<input type="time">` value (HH:mm) into a moment in the user's LOCAL
// timezone — which is what the user just picked on screen.
export function combineDateTime(dateStr, timeStr) {
  if (!dateStr || !timeStr) return null;
  const m = moment(`${dateStr}T${timeStr}:00`);
  return m.isValid() ? m.toDate() : null;
}
