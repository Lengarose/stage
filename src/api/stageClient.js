// Drop-in replacement for the Base44 SDK — mirrors the same API surface
// so zero changes are needed in any component file.
import { CHANNELS, makeChannel, setSocketListeners, offSocketListeners } from "@/lib/SocketContext";
import { toMysqlDateTime } from "@/lib/momentDate";

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

// ── Token helpers ──────────────────────────────────────────────────────────────
export const storeTokens = ({ accessToken, refreshToken, userId, playerId, ownerId } = /** @type {any} */({})) => {
  if (accessToken)  localStorage.setItem(ACCESS_KEY,  accessToken);
  if (refreshToken) localStorage.setItem(REFRESH_KEY, refreshToken);
  if (userId)       localStorage.setItem(USER_KEY,    String(userId));
  if (playerId)     localStorage.setItem(PLAYER_KEY,  String(playerId));
  if (ownerId)      localStorage.setItem(OWNER_KEY,   String(ownerId));
};

export const clearTokens = () => {
  [ACCESS_KEY, REFRESH_KEY, USER_KEY, PLAYER_KEY, OWNER_KEY].forEach(k => localStorage.removeItem(k));
};

/** Keep localStorage ids aligned with /auth/me (e.g. after refresh or admin login). */
function syncSessionFromMe(me) {
  if (!me || typeof me !== 'object') return;
  if (me.id) localStorage.setItem(USER_KEY, String(me.id));
  if (me.player_id) localStorage.setItem(PLAYER_KEY, String(me.player_id));
  else localStorage.removeItem(PLAYER_KEY);
  if (me.owner_id) localStorage.setItem(OWNER_KEY, String(me.owner_id));
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

  const subscribe = (handler) => {
    const knownIds = new Set();
    let disposed = false;
    let channel = null;

    (async () => {
      try {
        // Current backend emits room-scoped updates. For now, wire entities that
        // are reliably user-scoped in the existing app.
        const me = await auth.me().catch(() => null);
        if (disposed || !me?.email) return;

        if (name === "Notification") {
          channel = makeChannel(me.email, CHANNELS.NOTIFICATION);
        } else if (name === "InboxMessage") {
          channel = makeChannel(me.email, CHANNELS.INBOX);
        } else {
          // Keep compatibility for unsupported entities.
          return;
        }

        setSocketListeners(channel, (payload) => {
          if (!payload || disposed) return;
          if (payload.deleted) {
            handler?.({ type: "delete", id: payload.id, data: payload });
            return;
          }
          const id = payload.id;
          const type = id && !knownIds.has(id) ? "create" : "update";
          if (id) knownIds.add(id);
          handler?.({ type, id, data: payload });
        });
      } catch {
        // Non-fatal: keep app functional if realtime wiring fails.
      }
    })();

    return () => {
      disposed = true;
      if (channel) offSocketListeners(channel);
    };
  };

  const makeEntityApi = {
    async filter(filters = {}, orderBy = null, limit = 200) {
      const clean = {};
      for (const [k, v] of Object.entries(filters)) {
        if (v !== undefined && v !== null) clean[k] = v;
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
      return arr;
    },

    async get(id) {
      try {
        return await apiFetch(`${base}/${id}`);
      } catch (err) {
        if (err?.status === 404) return null;
        throw err;
      }
    },

    async create(body) {
      return apiFetch(base, { method: 'POST', body: JSON.stringify(normalizeBody(body)) });
    },

    async update(id, body) {
      return apiFetch(`${base}/${id}`, { method: 'PATCH', body: JSON.stringify(normalizeBody(body)) });
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
  'Player', 'Club', 'Match', 'Tournament', 'Post', 'Comment',
  'MatchPlayerStat', 'Notification', 'PlayerContract', 'InboxMessage',
  'Prediction', 'PressConference', 'PressQuestion', 'PressArticle',
  'DirectMessage', 'STCTransaction', 'ShirtSale', 'DressingRoom',
  'Follow', 'JoinRequest', 'LifestyleItem', 'LifestylePurchase',
  'UserPurchase', 'TrophyItem', 'TrophyPlacement', 'ChatMessage',
  'NewsItem', 'LiveMatch',
  // Competition & league stack used by frontend pages
  'Competition', 'CompetitionSeason', 'CompetitionFixture', 'CompetitionStanding',
  'RegionalLeague', 'RegionalLeagueFixture', 'RegionalLeagueStanding',
  'QualificationEntry', 'RankingConfig', 'SeasonRegistration',
  // New reward/achievement entities
  'RewardConfig', 'ClubAchievement', 'PlayerAchievement',
  // Pre-login landing page config
  'LandingConfig',
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
  // Lightweight recruitment/LFG board that feeds contract and transfer flows.
  'RecruitmentPost', 'RecruitmentInterest',
  // Private club operations: applicant pipeline, staff permissions, fixture availability,
  // fixture lineups, and read-only operations audit history.
  'ClubApplicant', 'ClubStaffRole', 'ClubFixtureAvailability', 'ClubFixtureLineup',
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

  // Redirect to backend OAuth — backend redirects back to /auth/callback with tokens
  loginWithProvider(provider) {
    window.location.href = `${API_BASE}/auth/${provider}`;
  },

  redirectToLogin() {
    window.location.href = '/';
  },

  // Call once on /auth/callback page load to store tokens from URL params
  handleOAuthCallback() {
    const params       = new URLSearchParams(window.location.search);
    const accessToken  = params.get('accessToken');
    const refreshToken = params.get('refreshToken');
    const userId       = params.get('userId');
    const playerId     = params.get('playerId');
    const ownerId      = params.get('ownerId');
    if (accessToken && (userId || playerId)) {
      storeTokens({ accessToken, refreshToken, userId, playerId, ownerId });
      window.history.replaceState({}, '', '/');
      return true;
    }
    return false;
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
    async UploadFile({ file }) {
      const form = new FormData();
      form.append('file', file);
      const controller = new AbortController();
      const timeout = window.setTimeout(() => controller.abort(), 20000);
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

function buildQuery(q) {
  if (!q || typeof q !== 'object') return '';
  const params = Object.entries(q)
    .filter(([, v]) => v !== undefined && v !== null && v !== '')
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`);
  return params.length ? `?${params.join('&')}` : '';
}

export const stageClient = { entities, auth, integrations, functions, http, identityClaims };
// Backward-compat alias during migration
export const base44 = stageClient;
