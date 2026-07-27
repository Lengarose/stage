/**
 * Transfer window helpers — status alone is not enough; end_date must be respected.
 */

function endOfWindowMs(endDate) {
  if (!endDate) return null;
  const end = new Date(endDate);
  if (Number.isNaN(end.getTime())) return null;
  // Date-only / midnight means open through that calendar day.
  if (end.getUTCHours() === 0 && end.getUTCMinutes() === 0 && end.getUTCSeconds() === 0) {
    end.setUTCHours(23, 59, 59, 999);
  }
  return end.getTime();
}

/** True when the window row is open and its end_date has not passed. */
export function isTransferWindowOpen(window) {
  if (!window || String(window.status || "").toLowerCase() !== "open") return false;
  const endMs = endOfWindowMs(window.end_date);
  if (endMs == null) return true; // open with no end date
  return endMs >= Date.now();
}
