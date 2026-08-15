// Drop-in replacement for the Base44 SDK — mirrors the same API surface
// so zero changes are needed in any component file.
import { CHANNELS, makeChannel, setSocketListeners, offSocketListeners } from "@/lib/SocketContext";
import { toMysqlDateTime, asWallClockDateTimeString } from "@/lib/momentDate";
import { getOwnedClubId, getPresidentClubId, getPresidentId } from "@/lib/userIdentityFields";
import { clearAccountIntent } from "@/lib/accountIntent";

const viteEnv = /** @type {any} */ (import.meta).env;
// Default is a RELATIVE path so:
//   • dev: Vite proxies /api/* to VITE_API_PROXY_TARGET (vite.config.js) — no CORS
//   • prod: frontend and backend share the stageleagues.com origin — no CORS
// Override only for edge cases (e.g. running the frontend on a different host
// than the backend, or pointing dev at the production API on purpose) by
// setting VITE_API_BASE in your .env. Do NOT hardcode an absolute URL here.
const API_BASE = (viteEnv && viteEnv.VITE_API_BASE) || '/api/stage';
const ACCESS_KEY  = 'stage_access_token';
const REFRESH_KEY = 'stage_refresh_token';
const USER_KEY    = 'stage_user_id';
const PLAYER_KEY  = 'stage_player_id';
const OWNER_KEY   = 'stage_owner_id';
const PRESIDENT_CLUB_KEY = 'stage_president_club_id';
const PRESIDENT_ID_KEY = 'stage_president_id';
const AUTH_CHANGED_EVENT = 'stage-auth-changed';
const OAUTH_RETURN_KEY = 'stage_oauth_return';
const OAUTH_ENTRANCE_MODE_KEY = 'stage_oauth_entrance_mode';

function needsOnboardingStorageKey(userId) {
  return `stage_needs_onboarding_${userId}`;
}

/** Mark a brand-new OAuth account so AuthenticatedApp shows full Onboarding. */
export function markNeedsOnboarding(userId) {
  if (!userId || typeof window === 'undefined') return;
  try {
    const key = needsOnboardingStorageKey(userId);
    sessionStorage.setItem(key, '1');
    localStorage.setItem(key, '1');
    localStorage.removeItem(`stage_onboarding_completed_${userId}`);
  } catch {
    /* ignore */
  }
}

export function clearNeedsOnboarding(userId) {
  if (!userId || typeof window === 'undefined') return;
  try {
    const key = needsOnboardingStorageKey(userId);
    sessionStorage.removeItem(key);
    localStorage.removeItem(key);
  } catch {
    /* ignore */
  }
}

export function userNeedsOnboarding(userId) {
  if (!userId || typeof window === 'undefined') return false;
  try {
    const key = needsOnboardingStorageKey(userId);
    return sessionStorage.getItem(key) === '1' || localStorage.getItem(key) === '1';
  } catch {
    return false;
  }
}

/** Same-origin relative path only (blocks open redirects). */
function sanitizeReturnPath(returnTo) {
  if (!returnTo || typeof window === 'undefined') return null;
  try {
    const url = new URL(String(returnTo), window.location.origin);
    if (url.origin !== window.location.origin) return null;
    const path = `${url.pathname}${url.search}${url.hash}`;
    if (!path.startsWith('/') || path.startsWith('//')) return null;
    return path;
  } catch {
    return null;
  }
}

export function peekOAuthEntranceMode() {
  try {
    return sessionStorage.getItem(OAUTH_ENTRANCE_MODE_KEY) || null;
  } catch {
    return null;
  }
}

export function clearOAuthReturnState() {
  try {
    sessionStorage.removeItem(OAUTH_RETURN_KEY);
    sessionStorage.removeItem(OAUTH_ENTRANCE_MODE_KEY);
  } catch {
    /* ignore */
  }
}

export function consumeOAuthReturnPath() {
  try {
    const path = sessionStorage.getItem(OAUTH_RETURN_KEY);
    sessionStorage.removeItem(OAUTH_RETURN_KEY);
    return sanitizeReturnPath(path) || '/';
  } catch {
    return '/';
  }
}

function notifyAuthChanged() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event(AUTH_CHANGED_EVENT));
  }
}

// ── Token helpers ──────────────────────────────────────────────────────────────
export const storeTokens = ({ accessToken, refreshToken, userId, playerId, ownerId, ownedClubId, presidentClubId, presidentId } = /** @type {any} */({})) => {
  if (accessToken)  localStorage.setItem(ACCESS_KEY,  accessToken);
  if (refreshToken) localStorage.setItem(REFRESH_KEY, refreshToken);
  if (userId)       localStorage.setItem(USER_KEY,    String(userId));
  if (playerId)     localStorage.setItem(PLAYER_KEY,  String(playerId));
  if (presidentClubId) localStorage.setItem(PRESIDENT_CLUB_KEY, String(presidentClubId));
  if (presidentId) localStorage.setItem(PRESIDENT_ID_KEY, String(presidentId));
  if (ownedClubId || ownerId || presidentClubId) localStorage.setItem(OWNER_KEY, String(ownedClubId || ownerId || presidentClubId));
  notifyAuthChanged();
};

export const clearTokens = () => {
  const userId = localStorage.getItem(USER_KEY);
  [ACCESS_KEY, REFRESH_KEY, USER_KEY, PLAYER_KEY, OWNER_KEY, PRESIDENT_CLUB_KEY, PRESIDENT_ID_KEY].forEach(k => localStorage.removeItem(k));
  clearAccountIntent(userId);
  notifyAuthChanged();
};

/** Keep localStorage ids aligned with /auth/me (e.g. after refresh or admin login). */
function syncSessionFromMe(me) {
  if (!me || typeof me !== 'object') return;
  if (me.id) localStorage.setItem(USER_KEY, String(me.id));
  if (me.player_id) localStorage.setItem(PLAYER_KEY, String(me.player_id));
  else localStorage.removeItem(PLAYER_KEY);
  const presidentClubId = getPresidentClubId(me);
  if (presidentClubId) localStorage.setItem(PRESIDENT_CLUB_KEY, String(presidentClubId));
  else localStorage.removeItem(PRESIDENT_CLUB_KEY);
  const presidentId = getPresidentId(me);
  if (presidentId) localStorage.setItem(PRESIDENT_ID_KEY, String(presidentId));
  else localStorage.removeItem(PRESIDENT_ID_KEY);
  const ownedClubId = getOwnedClubId(me);
  if (ownedClubId) localStorage.setItem(OWNER_KEY, String(ownedClubId));
  else localStorage.removeItem(OWNER_KEY);
}

// ── Core fetch with auto token-refresh ────────────────────────────────────────
let _refreshPromise = null;

async function apiFetch(path, opts = {}, _isRetry = false) {
  const token      = localStorage.getItem(ACCESS_KEY);
  const isFormData = opts.body instanceof FormData;

  const res = await fetch(`${API_BASE}${path}`, {
    ...opts,
    headers: {
      ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(opts.headers || {}),
    },
  });

  // Auto-refresh on 401
  if (res.status === 401 && !_isRetry) {
    const refreshToken = localStorage.getItem(REFRESH_KEY);
    if (!refreshToken) {
      clearTokens();
      throw { status: 401, message: 'Authentication required' };
    }

    if (!_refreshPromise) {
      _refreshPromise = fetch(`${API_BASE}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken }),
      })
        .then(r => r.ok ? r.json() : Promise.reject())
        .then(({ accessToken }) => storeTokens({ accessToken }))
        .catch(() => clearTokens())
        .finally(() => { _refreshPromise = null; });
    }

    await _refreshPromise;
    return apiFetch(path, opts, true);
  }

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw { status: res.status, message: err.error || err.message || res.statusText, data: err };
  }

  const text = await res.text();
  return text ? JSON.parse(text) : {};
}

// ── Entity name → /kebab-plurals path ─────────────────────────────────────────
function entityToPath(name) {
  const kebab = name
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1-$2')  // STCTransaction → STC-Transaction
    .replace(/([a-z\d])([A-Z])/g, '$1-$2')        // MatchPlayer → Match-Player
    .toLowerCase();
  if (/(s|x|z|ch|sh)$/.test(kebab)) return `/${kebab}es`;
  if (/[^aeiou]y$/.test(kebab)) return `/${kebab.slice(0, -1)}ies`;
  return `/${kebab}s`;
}


// ── Entity CRUD factory ────────────────────────────────────────────────────────
function normalizeEntityFromApi(entityName, row) {
  if (!row || typeof row !== "object") return row;
  if (entityName === "Match") {
    return {
      ...row,
      group: row.group ?? row.group_number,
      scheduled_date: asWallClockDateTimeString(row.scheduled_date),
      first_submission_at: asWallClockDateTimeString(row.first_submission_at),
    };
  }
  return row;
}

function normalizeEntityListFromApi(entityName, data) {
  const arr = Array.isArray(data) ? data : (data ? [data] : []);
  return arr.map((row) => normalizeEntityFromApi(entityName, row));
}

function makeEntity(name) {
  const base = entityToPath(name);
  const normalizeBody = (body) => {
    if (!body || typeof body !== 'object') return body;
    const next = { ...body };
    // Defensive frontend normalization for MySQL DATETIME columns.
    if (name === 'Match' && next.scheduled_date) {
      next.scheduled_date = toMysqlDateTime(next.scheduled_date);
    }
    return next;
  };
  const list = async (orderBy = null, limit = 200) => {
    return makeEntityApi.filter({}, orderBy, limit);
  };

  const subscribe = (handler, filters = {}) => {
    const knownIds = new Set();
    let disposed = false;
    const channels = [];

    const onPayload = (payload) => {
      if (!payload || disposed) return;
      if (payload.deleted) {
        handler?.({ type: "delete", id: payload.id, data: payload });
        return;
      }
      const id = payload.id;
      const type = id && !knownIds.has(id) ? "create" : "update";
      if (id) knownIds.add(id);
      handler?.({ type, id, data: payload });
    };

    (async () => {
      try {
        const me = await auth.me().catch(() => null);
        if (disposed) return;

        const add = (ch) => {
          if (!ch || channels.includes(ch)) return;
          channels.push(ch);
          setSocketListeners(ch, onPayload);
        };

        switch (name) {
          case "Notification":
            if (me?.email) add(makeChannel(me.email, CHANNELS.NOTIFICATION));
            break;
          case "InboxMessage":
          case "DirectMessage":
            if (me?.email) add(makeChannel(me.email, CHANNELS.INBOX));
            if (me?.player_id) add(makeChannel(me.player_id, CHANNELS.INBOX));
            break;
          case "Match":
            add(CHANNELS.MATCH);
            if (filters.id) add(makeChannel(filters.id, CHANNELS.MATCH));
            break;
          case "ChatMessage":
            if (filters.match_id) add(makeChannel(filters.match_id, CHANNELS.CHAT_MESSAGE));
            break;
          case "DressingRoom":
            if (filters.match_id) add(makeChannel(filters.match_id, CHANNELS.DRESSING_ROOM));
            break;
          case "Post":
            add(CHANNELS.POST);
            if (filters.club_id) add(makeChannel(filters.club_id, CHANNELS.POST_FEED));
            if (filters.author_email) add(makeChannel(filters.author_email, CHANNELS.POST_FEED));
            break;
          case "Player":
            if (filters.id) add(makeChannel(filters.id, CHANNELS.PLAYER));
            if (me?.player_id) add(makeChannel(me.player_id, CHANNELS.PLAYER));
            if (filters.club_id) add(makeChannel(filters.club_id, CHANNELS.CLUB));
            break;
          case "Club":
            if (filters.id) add(makeChannel(filters.id, CHANNELS.CLUB));
            break;
          case "Tournament":
            add(CHANNELS.TOURNAMENT);
            if (filters.id) add(makeChannel(filters.id, CHANNELS.TOURNAMENT));
            break;
          case "TransferWindow":
            add(CHANNELS.TRANSFER_WINDOW);
            break;
          case "MatchPlayerStat":
            if (filters.tournament_id) add(makeChannel(filters.tournament_id, CHANNELS.TOURNAMENT));
            if (filters.match_id) add(makeChannel(filters.match_id, CHANNELS.MATCH));
            break;
          default:
            break;
        }
      } catch {
        // Non-fatal: keep app functional if realtime wiring fails.
      }
    })();

    return () => {
      disposed = true;
      for (const ch of channels) offSocketListeners(ch, onPayload);
    };
  };

  const makeEntityApi = {
    async filter(filters = {}, orderBy = null, limit = 200) {
      const clean = {};
      for (const [k, v] of Object.entries(filters)) {
        if (v !== undefined && v !== null) clean[k] = v;
      }
      if (clean.id && Object.keys(clean).length === 1) {
        const row = await makeEntityApi.get(clean.id).catch((err) => {
          if (err?.status === 404) return null;
          throw err;
        });
        return row ? [row] : [];
      }
      const qs = new URLSearchParams({ ...clean, limit: String(limit) }).toString();
      let data;
      try {
        data = await apiFetch(`${base}?${qs}`);
      } catch (err) {
        // Some legacy pages still reference entities not yet exposed by backend routes.
        if (err?.status === 404) return [];
        throw err;
      }
      const arr  = Array.isArray(data) ? data : (data ? [data] : []);
      if (orderBy) {
        const desc  = orderBy.startsWith('-');
        const field = desc ? orderBy.slice(1) : orderBy;
        arr.sort((a, b) => {
          const av = a[field] ?? '', bv = b[field] ?? '';
          if (av === bv) return 0;
          return (av < bv ? -1 : 1) * (desc ? -1 : 1);
        });
      }
      return normalizeEntityListFromApi(name, arr);
    },

    async get(id) {
      try {
        const row = await apiFetch(`${base}/${id}`);
        return normalizeEntityFromApi(name, row);
      } catch (err) {
        if (err?.status === 404) return null;
        throw err;
      }
    },

    async create(body) {
      const row = await apiFetch(base, { method: 'POST', body: JSON.stringify(normalizeBody(body)) });
      return normalizeEntityFromApi(name, row);
    },

    async update(id, body) {
      const row = await apiFetch(`${base}/${id}`, { method: 'PATCH', body: JSON.stringify(normalizeBody(body)) });
      return normalizeEntityFromApi(name, row);
    },

    async delete(id) {
      return apiFetch(`${base}/${id}`, { method: 'DELETE' });
    },
    async bulkCreate(rows = []) {
      const arr = Array.isArray(rows) ? rows : [];
      if (!arr.length) return [];
      return Promise.all(arr.map((row) => makeEntityApi.create(row)));
    },
    list,
    subscribe,
  };

  return makeEntityApi;
}

// ── Entity registry ────────────────────────────────────────────────────────────
const ENTITY_NAMES = [
  'Player', 'President', 'Club', 'Match', 'Tournament', 'Post', 'Comment',
  'MatchPlayerStat', 'Notification', 'PlayerContract', 'PlayerLoan', 'InboxMessage',
  'Prediction', 'PressConference', 'PressQuestion', 'PressArticle',
  'DirectMessage', 'STCTransaction', 'ShirtSale', 'DressingRoom',
  'JoinRequest', 'LifestyleItem', 'LifestylePurchase',
  'UserPurchase', 'TrophyItem', 'TrophyPlacement', 'ChatMessage', 'ChatRead',
  'NewsItem', 'LiveMatch',
  // Competition & league stack used by frontend pages
  'Competition', 'CompetitionSeason', 'CompetitionFixture', 'CompetitionStanding',
  'RegionalLeague', 'RegionalLeagueFixture', 'RegionalLeagueStanding',
  'QualificationEntry', 'RankingConfig', 'SeasonRegistration',
  // Unified competition engine typed operational entities
  'CompetitionInstance', 'CompetitionParticipant', 'CompetitionScheduleProposal',
  'CompetitionResultSubmission', 'CompetitionPhaseState', 'CompetitionPayout',
  // New reward/achievement entities
  'RewardConfig', 'ClubAchievement', 'PlayerAchievement',
  // Pre-login landing page config
  'LandingConfig', 'StoreConfig',
  // Legacy/compat entities used in some screens
  'RatingHistory', 'LiveMatchEvent', 'Challenge', 'LandingPageContent',
  // Post-login home page editor (separate from LandingPageContent)
  'HomePageContent',
  'FaqItem',
  // Global transfer windows (admin manages open/close periods).
  // Business actions (open/close/execute_pending) still go through the
  // `transferWindowActions` server function for transactional behaviour.
  'TransferWindow',
  // Audit log of admin interventions on expired fixtures (force-schedule,
  // declare-forfeit, flag-review). Mutating actions go through dedicated
  // POST endpoints on /api/stage/fixture-admin-actions; this entity exposes
  // the audit history for read access.
  'FixtureAdminAction',
  // Per-player wallet ledger. Backend route /api/stage/player-stc-transactions
  // supports ?player_id=, ?player_email=, ?limit=, ?offset=. Used by Admin.jsx
  // to show recent transactions on a player's economy tab.
  'PlayerStcTransaction',
  // Player identity claiming and admin verification workflow. Approval marks
  // players.is_verified and stores the verified platform handle.
  'PlayerIdentityClaim',
  // A player's own showcase clips, published on their profile so clubs can judge
  // how they play. Readable by anyone; writable only by the player who owns them.
  'PlayerShowcaseVideo',
  // Club-private scouting pipeline: members flag players worth signing, backed by
  // that player's showcase. Always scoped server-side to the caller's own club.
  // Replaced the old public recruitment/LFG board.
  'ScoutingReport',
  // Private club operations: applicant pipeline, staff permissions, fixture availability,
  // fixture lineups, and read-only operations audit history.
  'ClubApplicant', 'ClubMembership', 'ClubStaffRole', 'ClubFixtureAvailability', 'ClubFixtureLineup',
  'ClubOperationAuditLog',
  // EAFC-inspired modules — see server/src/server.js for routes and AGENTS.md §7.2.
  // ObjectiveDefinition: catalogue of Daily/Weekly objectives (admin-managed).
  // ObjectiveProgress:   per-player progress; rewards claimed via
  //                      stageClient.functions.invoke('claimObjectiveReward', { progress_id }).
  // Archetype:           catalogue of 13 player archetypes (seeded at boot).
  // ChemistryLink:       pairwise relationships used by the chemistry service.
  // Sbc / SbcSubmission: SBC catalogue + submission log. Submissions go through
  //                      stageClient.functions.invoke('submitSbc',
  //                        { sbc_id, sacrificed_player_ids, cornerstone_player_id? }).
  'ObjectiveDefinition', 'ObjectiveProgress',
  'Archetype',
  'ChemistryLink',
  'Sbc', 'SbcSubmission',
  // Player-logged Ultimate Team matches (manual tracking).
  'FutMatch',
];

const entities = Object.fromEntries(ENTITY_NAMES.map(n => [n, makeEntity(n)]));

// ── Auth ───────────────────────────────────────────────────────────────────────
const auth = {
  async me() {
    if (!localStorage.getItem(ACCESS_KEY)) throw { status: 401, message: 'Not authenticated' };
    const me = await apiFetch('/auth/me');
    syncSessionFromMe(me);
    return me;
  },

  async loginViaEmailPassword(identifier, password) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);
    try {
      const res = await fetch(`${API_BASE}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier, password }),
        signal: controller.signal,
      });
      const data = await res.json();
      if (!res.ok) throw data;
      storeTokens(data);
      return { access_token: data.accessToken };
    } catch (err) {
      if (err.name === 'AbortError') throw { message: 'Request timed out. Please check your connection and try again.' };
      throw err;
    } finally {
      clearTimeout(timeout);
    }
  },

  async registerViaEmailPassword({ email, password }) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);
    try {
      const res = await fetch(`${API_BASE}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
        signal: controller.signal,
      });
      const data = await res.json();
      if (!res.ok) throw data;
      storeTokens(data);
      return { access_token: data.accessToken };
    } catch (err) {
      if (err.name === 'AbortError') throw { message: 'Request timed out. Please check your connection and try again.' };
      throw err;
    } finally {
      clearTimeout(timeout);
    }
  },

  setToken(token) {
    localStorage.setItem(ACCESS_KEY, token);
  },

  logout(redirectUrl) {
    const refreshToken = localStorage.getItem(REFRESH_KEY);
    if (refreshToken) {
      fetch(`${API_BASE}/auth/logout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken }),
      }).catch(() => {});
    }
    clearTokens();
    window.location.href = redirectUrl || '/';
  },

  // Redirect to backend OAuth — backend redirects back to /auth/callback with tokens.
  // Optional returnTo (same-origin) is restored after callback so tournament entrance
  // invites and deep links survive the OAuth round-trip.
  loginWithProvider(provider, returnTo) {
    const safe = sanitizeReturnPath(returnTo || (typeof window !== 'undefined' ? window.location.href : null));
    try {
      if (safe) {
        sessionStorage.setItem(OAUTH_RETURN_KEY, safe);
        const entrance = safe.match(/\/tournaments\/entrance\/[^/]+\/(signin|signup)/);
        if (entrance) sessionStorage.setItem(OAUTH_ENTRANCE_MODE_KEY, entrance[1]);
        else sessionStorage.removeItem(OAUTH_ENTRANCE_MODE_KEY);
      } else {
        sessionStorage.removeItem(OAUTH_RETURN_KEY);
        sessionStorage.removeItem(OAUTH_ENTRANCE_MODE_KEY);
      }
    } catch {
      /* ignore */
    }
    window.location.href = `${API_BASE}/auth/${provider}`;
  },

  redirectToLogin() {
    window.location.href = '/';
  },

  // Call once on /auth/callback page load to store tokens from URL params.
  // Returns { ok, isNewUser, returnTo }.
  handleOAuthCallback() {
    const params       = new URLSearchParams(window.location.search);
    const accessToken  = params.get('accessToken');
    const refreshToken = params.get('refreshToken');
    const userId       = params.get('userId');
    const playerId     = params.get('playerId');
    const ownerId      = params.get('ownerId');
    const ownedClubId  = params.get('ownedClubId');
    const presidentClubId = params.get('presidentClubId');
    const isNewUser    = params.get('isNewUser') === '1';
    if (accessToken && (userId || playerId)) {
      storeTokens({ accessToken, refreshToken, userId, playerId, ownerId, ownedClubId, presidentClubId, presidentId: params.get('presidentId') });
      if (isNewUser && userId) markNeedsOnboarding(userId);
      let returnTo = '/';
      try {
        returnTo = sanitizeReturnPath(sessionStorage.getItem(OAUTH_RETURN_KEY)) || '/';
      } catch {
        returnTo = '/';
      }
      window.history.replaceState({}, '', '/auth/callback');
      return { ok: true, isNewUser, returnTo };
    }
    return { ok: false, isNewUser: false, returnTo: '/' };
  },

  async updateMe(data) {
    if (!localStorage.getItem(ACCESS_KEY)) throw { status: 401, message: 'Not authenticated' };

    let playerId = localStorage.getItem(PLAYER_KEY);
    if (!playerId) {
      const me = await apiFetch('/auth/me');
      syncSessionFromMe(me);
      playerId = me?.player_id || null;
    }

    // System admins and other accounts without a player profile have nothing to PATCH.
    if (!playerId) return null;

    return apiFetch(`/players/${playerId}`, { method: 'PATCH', body: JSON.stringify(data) });
  },

  async updateTimezone(timezone) {
    if (!localStorage.getItem(ACCESS_KEY)) throw { status: 401, message: 'Not authenticated' };
    return apiFetch('/auth/timezone', { method: 'PATCH', body: JSON.stringify({ timezone }) });
  },

  hasToken() {
    return !!localStorage.getItem(ACCESS_KEY);
  },

  async isAuthenticated() {
    if (!localStorage.getItem(ACCESS_KEY)) return false;
    try { await auth.me(); return true; } catch { return false; }
  },
};

// ── File upload ────────────────────────────────────────────────────────────────
const integrations = {
  Core: {
    async UploadFile({ file, timeoutMs = 20000 }) {
      const form = new FormData();
      form.append('file', file);
      const controller = new AbortController();
      const timeout = window.setTimeout(() => controller.abort(), timeoutMs);
      try {
        return await apiFetch('/upload', { method: 'POST', body: form, signal: controller.signal });
      } catch (err) {
        if (err?.name === 'AbortError') {
          throw { message: 'Upload timed out. Try a smaller image or check your connection.' };
        }
        throw err;
      } finally {
        window.clearTimeout(timeout);
      }
      // returns { file_url: 'https://stageleagues.com/uploads/...' }
    },
  },
};

// ── Server-side functions ──────────────────────────────────────────────────────
const functions = {
  async invoke(name, params = {}) {
    return apiFetch(`/functions/${name}`, {
      method: 'POST',
      body: JSON.stringify(params),
    });
  },
};

// ── Identity claims ───────────────────────────────────────────────────────────
// Prefer the proper entity route, but fall back to server functions so older
// process managers or partially deployed backends still have a working path.
const identityClaims = {
  async submit(body = {}) {
    try {
      return await entities.PlayerIdentityClaim.create(body);
    } catch (err) {
      if (err?.status !== 404) throw err;
      try {
        const result = await functions.invoke('submitPlayerIdentityClaim', body);
        return result?.data || result;
      } catch (fallbackErr) {
        if (fallbackErr?.status === 404) {
          throw {
            ...fallbackErr,
            message: 'Identity verification is not available on this server yet. Deploy or restart the backend, then try again.',
          };
        }
        throw fallbackErr;
      }
    }
  },

  async list(filters = {}, orderBy = '-created_date', limit = 50) {
    try {
      return await entities.PlayerIdentityClaim.filter(filters, orderBy, limit);
    } catch (err) {
      if (err?.status !== 404) throw err;
      try {
        const result = await functions.invoke('listPlayerIdentityClaims', { ...filters, limit });
        const rows = result?.data || result?.claims || [];
        return Array.isArray(rows) ? rows : [];
      } catch (fallbackErr) {
        if (fallbackErr?.status === 404) return [];
        throw fallbackErr;
      }
    }
  },

  async review(id, body = {}) {
    try {
      return await entities.PlayerIdentityClaim.update(id, body);
    } catch (err) {
      if (err?.status !== 404) throw err;
      try {
        const result = await functions.invoke('reviewPlayerIdentityClaim', { id, ...body });
        return result?.data || result;
      } catch (fallbackErr) {
        if (fallbackErr?.status === 404) {
          throw {
            ...fallbackErr,
            message: 'Identity verification is not available on this server yet. Deploy or restart the backend, then try again.',
          };
        }
        throw fallbackErr;
      }
    }
  },
};

// ── Raw HTTP helpers ──────────────────────────────────────────────────────────
// Path is relative to API_BASE (e.g. '/fixture-admin-actions/force-schedule').
// Bodies are JSON-serialized automatically; auth header + 401-refresh are
// handled by apiFetch.
const http = {
  get:    (path, query)        => apiFetch(`${path}${buildQuery(query)}`, { method: 'GET' }),
  post:   (path, body)         => apiFetch(path, { method: 'POST',   body: JSON.stringify(body || {}) }),
  patch:  (path, body)         => apiFetch(path, { method: 'PATCH',  body: JSON.stringify(body || {}) }),
  delete: (path)               => apiFetch(path, { method: 'DELETE' }),
};

const posts = {
  likeToggle(postId) {
    return http.post(`/posts/${encodeURIComponent(postId)}/like-toggle`);
  },
};

const comments = {
  createForPost(body = {}) {
    return http.post('/comments', body);
  },
};

const profileMatches = {
  async list(filters = {}, orderBy = null, limit = 50) {
    const rows = await http.get('/matches/profile', { ...filters, limit });
    const normalized = normalizeEntityListFromApi('Match', rows);
    if (!orderBy) return normalized;
    const desc = orderBy.startsWith('-');
    const field = desc ? orderBy.slice(1) : orderBy;
    return [...normalized].sort((a, b) => {
      const av = a[field] ?? '';
      const bv = b[field] ?? '';
      if (av === bv) return 0;
      return (av < bv ? -1 : 1) * (desc ? -1 : 1);
    });
  },
};

function buildQuery(q) {
  if (!q || typeof q !== 'object') return '';
  const params = Object.entries(q)
    .filter(([, v]) => v !== undefined && v !== null && v !== '')
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`);
  return params.length ? `?${params.join('&')}` : '';
}

// ── Unified competition engine commands ──────────────────────────────────────
const competitionEngine = {
  listInstances(params = {}) {
    return http.get('/competition-engine/instances', params);
  },

  getInstance(id) {
    return http.get(`/competition-engine/instances/${encodeURIComponent(id)}`);
  },

  listParticipants(instanceId) {
    return http.get(`/competition-engine/instances/${encodeURIComponent(instanceId)}/participants`);
  },

  listFixtures(instanceId, params = {}) {
    return http.get(`/competition-engine/instances/${encodeURIComponent(instanceId)}/fixtures`, params);
  },

  createMatchFromFixture(fixtureId) {
    return http.post(`/competition-engine/fixtures/${encodeURIComponent(fixtureId)}/match/create`, {});
  },

  submitResult(matchId, payload = {}) {
    return http.post(`/competition-engine/matches/${encodeURIComponent(matchId)}/results/submit`, payload);
  },
};

// ── Canonical user→player→club resolver ───────────────────────────────────────
// The correct lookup chain is:
//   users table (auth.me()) → player_id → players table → club_id → clubs table
//   Fallbacks: players.email/users.email, users.president_club_id,
//   users.owned_club_id/owner_id, clubs.owner_email.
//
// Usage:
//   const { user, player, club, presidentClub, president, activeRoles } = await resolveMyPlayerAndClub();
export async function resolveMyPlayerAndClub() {
  const u = await auth.me().catch(() => null);
  if (!u) return { user: null, player: null, club: null, presidentClub: null, president: null, activeRoles: [] };

  let player = null;
  let club = null;
  let presidentClub = null;
  let president = null;

  // 1) Use user.player_id from users table to get player directly.
  //    Use .get(id) for one-row identity lookups.
  if (u.player_id) {
    player = await entities.Player.get(u.player_id).catch(() => null);
  }

  // 2) Fallback: user/player links can drift on older data; email is the
  // stable identity claim for this account.
  if (!player && u.email) {
    const rows = await entities.Player.filter({ email: u.email }, null, 1).catch(() => []);
    player = rows[0] || null;
  }

  // 3) From player, get club via club_id
  //    Club controller supports ?id= but .get() is cleaner.
  if (player?.club_id) {
    club = await entities.Club.get(player.club_id).catch(() => null);
  }

  // 4) President accounts may have no player profile. Prefer explicit president club id.
  const presidentClubId = getPresidentClubId(u);
  if (presidentClubId) {
    presidentClub = await entities.Club.get(presidentClubId).catch(() => null);
    if (!club && presidentClub) club = presidentClub;
  }

  // 5) Club-only legacy accounts may have no player profile. Use the owned club id.
  const ownedClubId = getOwnedClubId(u);
  if (!club && ownedClubId) {
    club = await entities.Club.get(ownedClubId).catch(() => null);
    if (!presidentClub && club && String(club.id) === String(ownedClubId)) presidentClub = club;
  }

  // 6) Final fallback: find club by owner_email
  if (!club && u.email) {
    const rows = await entities.Club.filter({ owner_email: u.email }, null, 1).catch(() => []);
    club = rows[0] || null;
    if (!presidentClub && club) presidentClub = club;
  }

  // 7) Resolve legacy first-class President entity when present. New
  // player-president flows use clubs.president_player_id as the public identity.
  const presidentId = getPresidentId(u) || presidentClub?.president_id || null;
  if (presidentId) {
    president = await entities.President.get(presidentId).catch(() => null);
  }
  if (!president && presidentClub?.id) {
    const rows = await entities.President.filter({ club_id: presidentClub.id }, null, 1).catch(() => []);
    president = rows[0] || null;
  }
  if (!president && u?.id) {
    const rows = await entities.President.filter({ user_id: u.id }, null, 1).catch(() => []);
    president = rows[0] || null;
  }

  const activeRoles = [
    ...(player ? ['player'] : []),
    ...(presidentClub ? ['president'] : []),
  ];

  return { user: u, player, club, presidentClub, president, activeRoles };
}

// ── Chat read markers ──────────────────────────────────────────────────────────
// Lightweight wrappers around the /chat-reads REST endpoints so callers don't
// have to remember the URL shape. All methods scope to the authenticated user
// server-side (the controller ignores any body-supplied user_email).
const chatReads = {
  markRead(channelId, lastReadAt = null) {
    if (!channelId) return Promise.resolve(null);
    return apiFetch('/chat-reads/mark-read', {
      method: 'POST',
      body: JSON.stringify({
        channel_id: String(channelId),
        ...(lastReadAt ? { last_read_at: new Date(lastReadAt).toISOString() } : {}),
      }),
    });
  },
  // Returns { counts: { [channel_id]: number }, total: number }
  async getUnreadCounts(channelId = null) {
    const qs = channelId ? `?channel_id=${encodeURIComponent(channelId)}` : '';
    return apiFetch(`/chat-reads/unread-counts${qs}`);
  },
  // Returns all read markers for the current user (or one if channelId provided).
  async list(channelId = null) {
    const qs = channelId ? `?channel_id=${encodeURIComponent(channelId)}` : '';
    return apiFetch(`/chat-reads${qs}`);
  },
};

// ── President club assignment (admin) ─────────────────────────────────────────
// Club pairing / matchmaking stays on club_id. This only reassigns which
// president entity is linked to a club (audited server-side).
const presidents = {
  transfer(presidentId, { club_id, reason } = {}) {
    if (!presidentId) return Promise.reject(new Error('presidentId is required'));
    return http.post(`/presidents/${encodeURIComponent(presidentId)}/transfer`, {
      club_id: club_id === undefined ? null : club_id,
      ...(reason ? { reason } : {}),
    });
  },
  history(presidentId, { limit } = {}) {
    if (!presidentId) return Promise.reject(new Error('presidentId is required'));
    const qs = limit ? `?limit=${encodeURIComponent(String(limit))}` : '';
    return http.get(`/presidents/${encodeURIComponent(presidentId)}/history${qs}`);
  },
};

const clubs = {
  createFounder(body = {}) {
    return http.post('/clubs/founder', body);
  },
  leave(clubId, body = {}) {
    if (!clubId) return Promise.reject(new Error('clubId is required'));
    return http.post(`/clubs/${encodeURIComponent(clubId)}/leave`, body);
  },
};

export const stageClient = { entities, auth, integrations, functions, http, identityClaims, competitionEngine, profileMatches, chatReads, presidents, clubs, posts, comments };
// Backward-compat alias during migration
export const base44 = stageClient;
