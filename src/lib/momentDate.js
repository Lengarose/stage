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

export function parseISO(value) {
  const m = moment(value, moment.ISO_8601, true);
  return m.isValid() ? m.toDate() : new Date("invalid");
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
