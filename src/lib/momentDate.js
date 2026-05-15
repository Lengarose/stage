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

const PARSE_FORMATS = [moment.ISO_8601, "YYYY-MM-DD HH:mm:ss", "YYYY-MM-DD HH:mm"];

export function parseISO(value) {
  const m = moment(value, PARSE_FORMATS, true);
  if (m.isValid()) return m.toDate();
  const loose = moment(value);
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
  const m = toMoment(trimmed);
  if (!m.isValid()) return null;
  return m.format("YYYY-MM-DD HH:mm:ss");
}

/** Value for `<input type="datetime-local" />` from a stored schedule datetime. */
export function toDatetimeLocalValue(value) {
  if (!value) return "";
  const m = moment(value, PARSE_FORMATS, true);
  if (!m.isValid()) return "";
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
