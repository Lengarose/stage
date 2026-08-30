/**
 * Browser GPS + IANA timezone for session sync.
 * Location is proof of where they connected; users.timezone is what clocks read.
 * Web has no reverse-geocode — Intl timezone is the primary IANA source.
 * If a country code is ever present, BE → Europe/Brussels.
 */

const COOLDOWN_MS = 15 * 60 * 1000;
const COOLDOWN_KEY = 'stage_location_sync_at';
const GEO_TIMEOUT_MS = 8000;

export function detectBrowserTimezone() {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'Europe/Brussels';
  } catch {
    return 'Europe/Brussels';
  }
}

export function timezoneFromCountry(countryCode, fallback = detectBrowserTimezone()) {
  const code = String(countryCode || '').trim().toUpperCase();
  if (code === 'BE') return 'Europe/Brussels';
  return fallback || 'Europe/Brussels';
}

function roundCoord(value, digits = 6) {
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  const f = 10 ** digits;
  return Math.round(n * f) / f;
}

export function normalizeClientLocation(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const latitude = roundCoord(raw.latitude ?? raw.lat);
  const longitude = roundCoord(raw.longitude ?? raw.lng);
  if (latitude == null || longitude == null) return null;
  if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) return null;
  const accuracy = Number(raw.accuracy);
  const country = String(raw.country || raw.isoCountryCode || '').trim().toUpperCase();
  return {
    latitude,
    longitude,
    accuracy: Number.isFinite(accuracy) ? Math.round(accuracy) : null,
    source: String(raw.source || 'gps').slice(0, 32),
    captured_at: typeof raw.captured_at === 'string' ? raw.captured_at : new Date().toISOString(),
    country: /^[A-Z]{2}$/.test(country) ? country : null,
  };
}

function readCooldown() {
  try {
    const raw = localStorage.getItem(COOLDOWN_KEY);
    const ts = Number(raw);
    return Number.isFinite(ts) ? ts : 0;
  } catch {
    return 0;
  }
}

function writeCooldown() {
  try {
    localStorage.setItem(COOLDOWN_KEY, String(Date.now()));
  } catch {
    /* ignore quota / private mode */
  }
}

function getBrowserPosition() {
  if (typeof navigator === 'undefined' || !navigator.geolocation?.getCurrentPosition) {
    return Promise.resolve(null);
  }
  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        resolve(normalizeClientLocation({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
          source: 'gps',
          captured_at: new Date().toISOString(),
        }));
      },
      () => resolve(null),
      {
        enableHighAccuracy: false,
        timeout: GEO_TIMEOUT_MS,
        maximumAge: COOLDOWN_MS,
      },
    );
  });
}

/**
 * Fire-and-forget after me(). Does not block login if geolocation is denied.
 * @param {{ updateTimezone: (tz: string, location?: object|null) => Promise<unknown> }} auth
 */
export async function syncSessionLocation(auth) {
  if (!auth?.updateTimezone) return null;
  if (Date.now() - readCooldown() < COOLDOWN_MS) return null;

  const location = await getBrowserPosition();
  const timezone = timezoneFromCountry(location?.country, detectBrowserTimezone());

  writeCooldown();
  try {
    return await auth.updateTimezone(timezone, location || null);
  } catch {
    return null;
  }
}
