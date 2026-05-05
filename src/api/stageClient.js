// Drop-in replacement for the Base44 SDK — mirrors the same API surface
// so zero changes are needed in any component file.

const viteEnv = /** @type {any} */ (import.meta).env;
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
    if (!refreshToken) { clearTokens(); return; }

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
    throw { status: res.status, message: err.error || res.statusText, data: err };
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
  const list = async (orderBy = null, limit = 200) => {
    return makeEntityApi.filter({}, orderBy, limit);
  };

  // Compatibility stub for old Base44 real-time subscriptions.
  // Components keep working without runtime crashes; live updates are handled elsewhere.
  const subscribe = (_handler) => () => {};

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
      return apiFetch(base, { method: 'POST', body: JSON.stringify(body) });
    },

    async update(id, body) {
      return apiFetch(`${base}/${id}`, { method: 'PATCH', body: JSON.stringify(body) });
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
  // Legacy/compat entities used in some screens
  'RatingHistory', 'LiveMatchEvent', 'Challenge',
];

const entities = Object.fromEntries(ENTITY_NAMES.map(n => [n, makeEntity(n)]));

// ── Auth ───────────────────────────────────────────────────────────────────────
const auth = {
  async me() {
    if (!localStorage.getItem(ACCESS_KEY)) throw { status: 401, message: 'Not authenticated' };
    return apiFetch('/auth/me');
  },

  async loginViaEmailPassword(email, password) {
    const res = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    const data = await res.json();
    if (!res.ok) throw data;
    storeTokens(data);
    return { access_token: data.accessToken };
  },

  async registerViaEmailPassword({ email, password, gamertag }) {
    const res = await fetch(`${API_BASE}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, gamertag }),
    });
    const data = await res.json();
    if (!res.ok) throw data;
    storeTokens(data);
    return { access_token: data.accessToken };
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
    const playerId = localStorage.getItem(PLAYER_KEY);
    if (!playerId) throw { status: 401, message: 'Not authenticated' };
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
      return apiFetch('/upload', { method: 'POST', body: form });
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

export const stageClient = { entities, auth, integrations, functions };
// Backward-compat alias during migration
export const base44 = stageClient;
