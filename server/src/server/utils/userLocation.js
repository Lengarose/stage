/**
 * users.location JSON: GPS captured at login so kickoff times use that country's timezone.
 */
function roundCoord(value, digits = 6) {
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  const f = 10 ** digits;
  return Math.round(n * f) / f;
}

function normalizeCountry(raw) {
  const code = String(raw || '').trim().toUpperCase();
  return /^[A-Z]{2}$/.test(code) ? code : null;
}

function normalizeUserLocation(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const latitude = roundCoord(raw.latitude ?? raw.lat);
  const longitude = roundCoord(raw.longitude ?? raw.lng);
  if (latitude == null || longitude == null) return null;
  if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) return null;
  const accuracy = Number(raw.accuracy);
  const country = normalizeCountry(raw.country || raw.isoCountryCode);
  return {
    latitude,
    longitude,
    accuracy: Number.isFinite(accuracy) ? Math.round(accuracy) : null,
    source: String(raw.source || 'gps').slice(0, 32),
    captured_at: typeof raw.captured_at === 'string' ? raw.captured_at : new Date().toISOString(),
    country,
  };
}

function parseStoredLocation(value) {
  if (!value) return null;
  if (typeof value === 'object') return normalizeUserLocation(value);
  if (typeof value !== 'string') return null;
  try {
    return normalizeUserLocation(JSON.parse(value));
  } catch {
    return null;
  }
}

module.exports = {
  normalizeUserLocation,
  parseStoredLocation,
};
