# Stage Mobile App Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build `stage-app/`, a standalone Expo SDK 54 mobile frontend for Stage League with route parity, NativeWind 4 UI primitives, centralized API/auth, and a separate Render Socket.IO client.

**Architecture:** The existing `stage/` repo remains the source for backend, web, and socket server. The new sibling `stage-app/` owns mobile routes, native UI, auth storage, REST client, and realtime client. Route files stay thin and delegate to domain modules under `features/`.

**Tech Stack:** Expo SDK 54, React Native, Expo Router, NativeWind 4, Socket.IO client, Expo SecureStore, AsyncStorage, Reanimated, Safe Area Context, React Native SVG, lucide-react-native.

---

## File Structure

Create this sibling app outside the current repo:

```txt
/Users/creaafde/Documents/workbench stage/
  stage/
  stage-app/
```

Core files created during implementation:

```txt
stage-app/
  app/
    _layout.tsx
    index.tsx
    (auth)/
      _layout.tsx
      login.tsx
      onboarding.tsx
      callback.tsx
    (tabs)/
      _layout.tsx
      home.tsx
      competitions.tsx
      clubs.tsx
      social.tsx
      more.tsx
    (admin)/
      _layout.tsx
      index.tsx
    clubs/
      [id].tsx
      registered.tsx
    players/
      index.tsx
      [id].tsx
      registered.tsx
      stats.tsx
      free-agents.tsx
    competitions/
      index.tsx
      [slug].tsx
      register-league.tsx
    leagues/
      [slug].tsx
    tournaments/
      index.tsx
      [id].tsx
      international.tsx
    schedule.tsx
    game-day.tsx
    contracts/
      create.tsx
    transfer-market.tsx
    recruitment.tsx
    wallet.tsx
    lifestyle.tsx
    store.tsx
    inbox.tsx
    notifications.tsx
    community.tsx
    search.tsx
    rankings.tsx
    predictions.tsx
    news.tsx
    settings.tsx
    follow-back.tsx
  api/
    stageClient.js
  components/
    feedback/
      ErrorState.tsx
      LoadingState.tsx
      EmptyState.tsx
    layout/
      AppShell.tsx
      HeaderBar.tsx
      Screen.tsx
    ui/
      AppText.tsx
      Avatar.tsx
      Badge.tsx
      Button.tsx
      Card.tsx
      IconButton.tsx
      ListRow.tsx
      SearchField.tsx
      SegmentedControl.tsx
      StatTile.tsx
      TextField.tsx
  constants/
    env.js
    routes.js
    theme.js
  features/
    auth/
      AuthProvider.tsx
      LoginScreen.tsx
      session.js
    home/
      HomeScreen.tsx
    clubs/
      ClubDetailScreen.tsx
      ClubsScreen.tsx
      clubHooks.js
    competitions/
      CompetitionDetailScreen.tsx
      CompetitionsScreen.tsx
    inbox/
      InboxScreen.tsx
    notifications/
      NotificationsScreen.tsx
    players/
      PlayerProfileScreen.tsx
      PlayersScreen.tsx
    shared/
      PlaceholderScreen.tsx
    social/
      SocialScreen.tsx
    wallet/
      WalletScreen.tsx
  hooks/
    useAsyncAction.js
    useStageQuery.js
  lib/
    auth/
      authStorage.js
    socket/
      socketClient.js
      SocketProvider.tsx
    storage/
      jsonStorage.js
    format/
      money.js
  assets/
  global.css
  babel.config.js
  metro.config.js
  tailwind.config.js
  nativewind-env.d.ts
  app.json
  package.json
  tsconfig.json
```

---

### Task 1: Scaffold Expo SDK 54 App

**Files:**
- Create: `/Users/creaafde/Documents/workbench stage/stage-app/`
- Create: `/Users/creaafde/Documents/workbench stage/stage-app/package.json`
- Create: `/Users/creaafde/Documents/workbench stage/stage-app/app.json`

- [ ] **Step 1: Request parent-folder write permission**

Run from `/Users/creaafde/Documents/workbench stage/stage` with escalation because the target is outside the current writable repo:

```bash
cd "/Users/creaafde/Documents/workbench stage" && npx create-expo-app@latest stage-app --template blank-typescript
```

Expected: `stage-app/` is created as a sibling of `stage/`.

- [ ] **Step 2: Install required runtime dependencies**

Run:

```bash
cd "/Users/creaafde/Documents/workbench stage/stage-app" && npx expo install expo-router react-native-safe-area-context react-native-screens react-native-reanimated react-native-svg expo-secure-store
```

Expected: packages are installed with Expo-compatible versions.

- [ ] **Step 3: Install app libraries**

Run:

```bash
cd "/Users/creaafde/Documents/workbench stage/stage-app" && npm install nativewind@^4 tailwindcss socket.io-client @react-native-async-storage/async-storage lucide-react-native
```

Expected: `package.json` includes NativeWind 4, Socket.IO client, AsyncStorage, and lucide icons.

- [ ] **Step 4: Update package scripts**

Modify `/Users/creaafde/Documents/workbench stage/stage-app/package.json` so scripts include:

```json
{
  "scripts": {
    "start": "expo start",
    "android": "expo start --android",
    "ios": "expo start --ios",
    "web": "expo start --web",
    "typecheck": "tsc --noEmit"
  }
}
```

Expected: `npm run typecheck` is available.

- [ ] **Step 5: Verify scaffold**

Run:

```bash
cd "/Users/creaafde/Documents/workbench stage/stage-app" && npm run typecheck
```

Expected: TypeScript exits cleanly or reports only template-level issues that are fixed before moving on.

---

### Task 2: Configure Expo Router And NativeWind

**Files:**
- Modify: `/Users/creaafde/Documents/workbench stage/stage-app/package.json`
- Modify: `/Users/creaafde/Documents/workbench stage/stage-app/app.json`
- Modify: `/Users/creaafde/Documents/workbench stage/stage-app/babel.config.js`
- Create: `/Users/creaafde/Documents/workbench stage/stage-app/metro.config.js`
- Create: `/Users/creaafde/Documents/workbench stage/stage-app/tailwind.config.js`
- Create: `/Users/creaafde/Documents/workbench stage/stage-app/global.css`
- Create: `/Users/creaafde/Documents/workbench stage/stage-app/nativewind-env.d.ts`

- [ ] **Step 1: Set Expo Router entry**

Update `/Users/creaafde/Documents/workbench stage/stage-app/package.json`:

```json
{
  "main": "expo-router/entry"
}
```

Expected: Expo Router owns app startup.

- [ ] **Step 2: Configure app scheme and plugins**

Update `/Users/creaafde/Documents/workbench stage/stage-app/app.json`:

```json
{
  "expo": {
    "name": "Stage League",
    "slug": "stage-app",
    "scheme": "stageapp",
    "plugins": ["expo-router", "expo-secure-store"],
    "experiments": {
      "typedRoutes": true
    }
  }
}
```

Expected: app has a mobile scheme and router plugin.

- [ ] **Step 3: Configure Babel**

Create or update `/Users/creaafde/Documents/workbench stage/stage-app/babel.config.js`:

```js
module.exports = function apiConfig(api) {
  api.cache(true);

  return {
    presets: ['babel-preset-expo'],
    plugins: ['nativewind/babel', 'react-native-reanimated/plugin'],
  };
};
```

Expected: NativeWind and Reanimated Babel plugins load.

- [ ] **Step 4: Configure Metro**

Create `/Users/creaafde/Documents/workbench stage/stage-app/metro.config.js`:

```js
const { getDefaultConfig } = require('expo/metro-config');
const { withNativeWind } = require('nativewind/metro');

const config = getDefaultConfig(__dirname);

module.exports = withNativeWind(config, { input: './global.css' });
```

Expected: Metro can process NativeWind CSS.

- [ ] **Step 5: Configure Tailwind content**

Create `/Users/creaafde/Documents/workbench stage/stage-app/tailwind.config.js`:

```js
/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./app/**/*.{js,jsx,ts,tsx}', './components/**/*.{js,jsx,ts,tsx}', './features/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      colors: {
        stage: {
          ink: '#061113',
          panel: '#0b181b',
          line: '#1f383d',
          mint: '#7df4c5',
          cyan: '#45d9ff',
          gold: '#ffd166',
          danger: '#ff6b6b',
          muted: '#8aa1a7',
        },
      },
      borderRadius: {
        stage: '8px',
      },
    },
  },
  plugins: [],
};
```

Expected: NativeWind can scan app and feature files.

- [ ] **Step 6: Add global CSS**

Create `/Users/creaafde/Documents/workbench stage/stage-app/global.css`:

```css
@tailwind base;
@tailwind components;
@tailwind utilities;
```

Expected: NativeWind CSS entry exists.

- [ ] **Step 7: Add NativeWind types**

Create `/Users/creaafde/Documents/workbench stage/stage-app/nativewind-env.d.ts`:

```ts
/// <reference types="nativewind/types" />
```

Expected: TypeScript accepts `className` on native components.

- [ ] **Step 8: Verify NativeWind configuration**

Run:

```bash
cd "/Users/creaafde/Documents/workbench stage/stage-app" && npm run typecheck
```

Expected: no NativeWind type errors.

---

### Task 3: Add Environment And Theme Constants

**Files:**
- Create: `/Users/creaafde/Documents/workbench stage/stage-app/constants/env.js`
- Create: `/Users/creaafde/Documents/workbench stage/stage-app/constants/theme.js`
- Create: `/Users/creaafde/Documents/workbench stage/stage-app/constants/routes.js`

- [ ] **Step 1: Create environment constants**

Create `/Users/creaafde/Documents/workbench stage/stage-app/constants/env.js`:

```js
export const STAGE_API_BASE =
  process.env.EXPO_PUBLIC_STAGE_API_BASE || 'https://stageleagues.com/api/stage';

export const STAGE_SOCKET_URL =
  process.env.EXPO_PUBLIC_STAGE_SOCKET_URL || 'https://stage-7osn.onrender.com';
```

Expected: API and socket URLs are absolute by default.

- [ ] **Step 2: Create theme constants**

Create `/Users/creaafde/Documents/workbench stage/stage-app/constants/theme.js`:

```js
export const colors = {
  ink: '#061113',
  panel: '#0b181b',
  panelSoft: '#102428',
  line: '#1f383d',
  mint: '#7df4c5',
  cyan: '#45d9ff',
  gold: '#ffd166',
  danger: '#ff6b6b',
  text: '#f4fbfc',
  muted: '#8aa1a7',
};

export const radii = {
  sm: 6,
  md: 8,
  lg: 12,
};
```

Expected: shared colors are available outside class strings.

- [ ] **Step 3: Create route registry**

Create `/Users/creaafde/Documents/workbench stage/stage-app/constants/routes.js`:

```js
export const mobileRoutes = [
  { label: 'Home', href: '/home' },
  { label: 'Competitions', href: '/competitions' },
  { label: 'Clubs', href: '/clubs' },
  { label: 'Social', href: '/social' },
  { label: 'Wallet', href: '/wallet' },
  { label: 'Inbox', href: '/inbox' },
  { label: 'Notifications', href: '/notifications' },
  { label: 'Transfers', href: '/transfer-market' },
  { label: 'Tournaments', href: '/tournaments' },
  { label: 'Rankings', href: '/rankings' },
  { label: 'Settings', href: '/settings' },
];
```

Expected: `More` can render secondary navigation from one registry.

- [ ] **Step 4: Verify constants import**

Run:

```bash
cd "/Users/creaafde/Documents/workbench stage/stage-app" && npm run typecheck
```

Expected: constants are valid modules.

---

### Task 4: Build Auth Storage And Session Layer

**Files:**
- Create: `/Users/creaafde/Documents/workbench stage/stage-app/lib/auth/authStorage.js`
- Create: `/Users/creaafde/Documents/workbench stage/stage-app/lib/storage/jsonStorage.js`
- Create: `/Users/creaafde/Documents/workbench stage/stage-app/features/auth/session.js`

- [ ] **Step 1: Create JSON AsyncStorage helper**

Create `/Users/creaafde/Documents/workbench stage/stage-app/lib/storage/jsonStorage.js`:

```js
import AsyncStorage from '@react-native-async-storage/async-storage';

export async function getJson(key, fallback = null) {
  const raw = await AsyncStorage.getItem(key);
  if (!raw) return fallback;

  try {
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

export async function setJson(key, value) {
  if (value === undefined || value === null) {
    await AsyncStorage.removeItem(key);
    return;
  }

  await AsyncStorage.setItem(key, JSON.stringify(value));
}
```

Expected: harmless JSON cache can be persisted.

- [ ] **Step 2: Create secure token storage**

Create `/Users/creaafde/Documents/workbench stage/stage-app/lib/auth/authStorage.js`:

```js
import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';

const ACCESS_TOKEN_KEY = 'stage_access_token';
const REFRESH_TOKEN_KEY = 'stage_refresh_token';
const USER_ID_KEY = 'stage_user_id';
const PLAYER_ID_KEY = 'stage_player_id';
const OWNER_ID_KEY = 'stage_owner_id';

let memoryTokens = {
  accessToken: null,
  refreshToken: null,
};

export async function hydrateAuthStorage() {
  const [accessToken, refreshToken, userId, playerId, ownerId] = await Promise.all([
    SecureStore.getItemAsync(ACCESS_TOKEN_KEY),
    SecureStore.getItemAsync(REFRESH_TOKEN_KEY),
    AsyncStorage.getItem(USER_ID_KEY),
    AsyncStorage.getItem(PLAYER_ID_KEY),
    AsyncStorage.getItem(OWNER_ID_KEY),
  ]);

  memoryTokens = { accessToken, refreshToken };
  return { accessToken, refreshToken, userId, playerId, ownerId };
}

export function getAccessTokenSync() {
  return memoryTokens.accessToken;
}

export function getRefreshTokenSync() {
  return memoryTokens.refreshToken;
}

export async function storeAuthTokens({ accessToken, refreshToken, userId, playerId, ownerId }) {
  memoryTokens = { accessToken: accessToken || null, refreshToken: refreshToken || null };

  await Promise.all([
    accessToken ? SecureStore.setItemAsync(ACCESS_TOKEN_KEY, accessToken) : SecureStore.deleteItemAsync(ACCESS_TOKEN_KEY),
    refreshToken ? SecureStore.setItemAsync(REFRESH_TOKEN_KEY, refreshToken) : SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY),
    userId ? AsyncStorage.setItem(USER_ID_KEY, String(userId)) : AsyncStorage.removeItem(USER_ID_KEY),
    playerId ? AsyncStorage.setItem(PLAYER_ID_KEY, String(playerId)) : AsyncStorage.removeItem(PLAYER_ID_KEY),
    ownerId ? AsyncStorage.setItem(OWNER_ID_KEY, String(ownerId)) : AsyncStorage.removeItem(OWNER_ID_KEY),
  ]);
}

export async function clearAuthTokens() {
  memoryTokens = { accessToken: null, refreshToken: null };

  await Promise.all([
    SecureStore.deleteItemAsync(ACCESS_TOKEN_KEY),
    SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY),
    AsyncStorage.removeItem(USER_ID_KEY),
    AsyncStorage.removeItem(PLAYER_ID_KEY),
    AsyncStorage.removeItem(OWNER_ID_KEY),
  ]);
}
```

Expected: access and refresh tokens use SecureStore.

- [ ] **Step 3: Create session event module**

Create `/Users/creaafde/Documents/workbench stage/stage-app/features/auth/session.js`:

```js
const listeners = new Set();

export function subscribeToSession(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function notifySessionChanged(session) {
  listeners.forEach((listener) => listener(session));
}
```

Expected: API client and providers can react to login/logout without browser events.

- [ ] **Step 4: Verify auth modules**

Run:

```bash
cd "/Users/creaafde/Documents/workbench stage/stage-app" && npm run typecheck
```

Expected: storage modules compile.

---

### Task 5: Create Mobile Stage API Client

**Files:**
- Create: `/Users/creaafde/Documents/workbench stage/stage-app/api/stageClient.js`

- [ ] **Step 1: Create entity path mapping and request helper**

Create `/Users/creaafde/Documents/workbench stage/stage-app/api/stageClient.js` with:

```js
import { STAGE_API_BASE } from '../constants/env';
import {
  clearAuthTokens,
  getAccessTokenSync,
  getRefreshTokenSync,
  storeAuthTokens,
} from '../lib/auth/authStorage';
import { notifySessionChanged } from '../features/auth/session';

const ENTITY_NAMES = [
  'User',
  'Player',
  'Club',
  'Match',
  'Tournament',
  'Competition',
  'League',
  'Notification',
  'InboxMessage',
  'Transfer',
  'Contract',
  'WalletTransaction',
  'PlayerStcTransaction',
];

function entityToPath(name) {
  return name
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .toLowerCase()
    .replace(/ys$/, 'ies') + 's';
}

function normalizeError(status, payload) {
  return {
    status,
    code: payload?.code || payload?.error || 'request_failed',
    message: payload?.message || payload?.error || 'Request failed',
    details: payload?.details || payload || null,
  };
}

async function parseResponse(response) {
  const text = await response.text();
  if (!text) return null;

  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}
```

Expected: entity names and error normalization exist.

- [ ] **Step 2: Add auth refresh and API fetch**

Append:

```js
let refreshPromise = null;

async function refreshAccessToken() {
  if (!refreshPromise) {
    refreshPromise = (async () => {
      const refreshToken = getRefreshTokenSync();
      if (!refreshToken) return null;

      const response = await fetch(`${STAGE_API_BASE}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken }),
      });
      const payload = await parseResponse(response);

      if (!response.ok || !payload?.accessToken) {
        await clearAuthTokens();
        notifySessionChanged(null);
        return null;
      }

      await storeAuthTokens({
        accessToken: payload.accessToken,
        refreshToken: payload.refreshToken || refreshToken,
        userId: payload.user?.id,
        playerId: payload.player?.id,
        ownerId: payload.owner?.id,
      });
      notifySessionChanged(payload);
      return payload.accessToken;
    })().finally(() => {
      refreshPromise = null;
    });
  }

  return refreshPromise;
}

async function apiFetch(path, options = {}, retry = true) {
  const token = getAccessTokenSync();
  const headers = {
    Accept: 'application/json',
    ...(options.body ? { 'Content-Type': 'application/json' } : {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(options.headers || {}),
  };

  const response = await fetch(`${STAGE_API_BASE}${path}`, {
    ...options,
    headers,
    body: options.body && typeof options.body !== 'string' ? JSON.stringify(options.body) : options.body,
  });
  const payload = await parseResponse(response);

  if (response.status === 401 && retry) {
    const nextToken = await refreshAccessToken();
    if (nextToken) {
      return apiFetch(path, options, false);
    }
  }

  if (!response.ok) {
    throw normalizeError(response.status, payload);
  }

  return payload;
}
```

Expected: 401 triggers one refresh attempt.

- [ ] **Step 3: Add auth, http, functions, and entity factory**

Append:

```js
function makeEntity(name) {
  const path = `/${entityToPath(name)}`;

  return {
    filter(params = {}, sort, limit) {
      const query = new URLSearchParams();
      Object.entries(params || {}).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== '') query.set(key, String(value));
      });
      if (sort) query.set('sort', sort);
      if (limit) query.set('limit', String(limit));
      const suffix = query.toString() ? `?${query.toString()}` : '';
      return apiFetch(`${path}${suffix}`);
    },
    get(id) {
      return apiFetch(`${path}/${encodeURIComponent(id)}`);
    },
    create(body) {
      return apiFetch(path, { method: 'POST', body });
    },
    update(id, body) {
      return apiFetch(`${path}/${encodeURIComponent(id)}`, { method: 'PATCH', body });
    },
    delete(id) {
      return apiFetch(`${path}/${encodeURIComponent(id)}`, { method: 'DELETE' });
    },
  };
}

const entities = ENTITY_NAMES.reduce((acc, name) => {
  acc[name] = makeEntity(name);
  return acc;
}, {});

export const stageClient = {
  auth: {
    async login(email, password) {
      const payload = await apiFetch('/auth/login', {
        method: 'POST',
        body: { email, password },
      });
      await storeAuthTokens({
        accessToken: payload.accessToken || payload.token,
        refreshToken: payload.refreshToken,
        userId: payload.user?.id,
        playerId: payload.player?.id,
        ownerId: payload.owner?.id,
      });
      notifySessionChanged(payload);
      return payload;
    },
    async logout() {
      await clearAuthTokens();
      notifySessionChanged(null);
    },
    me() {
      return apiFetch('/auth/me');
    },
    refresh: refreshAccessToken,
  },
  entities,
  functions: {
    invoke(name, params = {}) {
      return apiFetch(`/functions/${encodeURIComponent(name)}`, {
        method: 'POST',
        body: params,
      });
    },
  },
  http: {
    get(path, options) {
      return apiFetch(path, { ...(options || {}), method: 'GET' });
    },
    post(path, body, options) {
      return apiFetch(path, { ...(options || {}), method: 'POST', body });
    },
    patch(path, body, options) {
      return apiFetch(path, { ...(options || {}), method: 'PATCH', body });
    },
  },
};

export default stageClient;
```

Expected: mobile screens can call auth, entities, functions, and http from one client.

- [ ] **Step 4: Verify API client syntax**

Run:

```bash
cd "/Users/creaafde/Documents/workbench stage/stage-app" && npm run typecheck
```

Expected: API client imports and compiles.

---

### Task 6: Add Socket Client And Provider

**Files:**
- Create: `/Users/creaafde/Documents/workbench stage/stage-app/lib/socket/socketClient.js`
- Create: `/Users/creaafde/Documents/workbench stage/stage-app/lib/socket/SocketProvider.tsx`

- [ ] **Step 1: Create socket client singleton**

Create `/Users/creaafde/Documents/workbench stage/stage-app/lib/socket/socketClient.js`:

```js
import { io } from 'socket.io-client';
import { STAGE_SOCKET_URL } from '../../constants/env';
import { getAccessTokenSync } from '../auth/authStorage';

let socket = null;

export function getSocket() {
  if (!socket) {
    socket = io(STAGE_SOCKET_URL, {
      transports: ['websocket', 'polling'],
      auth: { token: getAccessTokenSync() },
      reconnectionAttempts: 10,
      reconnectionDelay: 2000,
      autoConnect: false,
    });
  }

  return socket;
}

export function connectSocket() {
  const activeSocket = getSocket();
  activeSocket.auth = { token: getAccessTokenSync() };
  if (!activeSocket.connected) activeSocket.connect();
  return activeSocket;
}

export function disconnectSocket() {
  if (socket?.connected) socket.disconnect();
}

export function joinRoom(room) {
  if (!room) return;
  getSocket().emit('join-room', room);
}

export function leaveRoom(room) {
  if (!room) return;
  getSocket().emit('leave-room', room);
}
```

Expected: socket URL and JWT are configured independently from REST.

- [ ] **Step 2: Create SocketProvider**

Create `/Users/creaafde/Documents/workbench stage/stage-app/lib/socket/SocketProvider.tsx`:

```tsx
import { createContext, PropsWithChildren, useContext, useEffect, useMemo, useState } from 'react';
import { connectSocket, disconnectSocket, getSocket } from './socketClient';
import { subscribeToSession } from '../../features/auth/session';

const SocketContext = createContext({ connected: false, socket: null as ReturnType<typeof getSocket> | null });

export function SocketProvider({ children }: PropsWithChildren) {
  const [connected, setConnected] = useState(false);
  const socket = useMemo(() => getSocket(), []);

  useEffect(() => {
    const handleConnect = () => setConnected(true);
    const handleDisconnect = () => setConnected(false);

    socket.on('connect', handleConnect);
    socket.on('disconnect', handleDisconnect);

    const unsubscribe = subscribeToSession((session) => {
      if (session) connectSocket();
      else disconnectSocket();
    });

    return () => {
      unsubscribe();
      socket.off('connect', handleConnect);
      socket.off('disconnect', handleDisconnect);
    };
  }, [socket]);

  return <SocketContext.Provider value={{ connected, socket }}>{children}</SocketContext.Provider>;
}

export function useSocket() {
  return useContext(SocketContext);
}
```

Expected: socket connects/disconnects based on auth session events.

- [ ] **Step 3: Verify socket modules**

Run:

```bash
cd "/Users/creaafde/Documents/workbench stage/stage-app" && npm run typecheck
```

Expected: socket modules compile.

---

### Task 7: Build Native UI Primitives

**Files:**
- Create: `/Users/creaafde/Documents/workbench stage/stage-app/components/layout/Screen.tsx`
- Create: `/Users/creaafde/Documents/workbench stage/stage-app/components/layout/HeaderBar.tsx`
- Create: `/Users/creaafde/Documents/workbench stage/stage-app/components/ui/AppText.tsx`
- Create: `/Users/creaafde/Documents/workbench stage/stage-app/components/ui/Button.tsx`
- Create: `/Users/creaafde/Documents/workbench stage/stage-app/components/ui/IconButton.tsx`
- Create: `/Users/creaafde/Documents/workbench stage/stage-app/components/ui/Card.tsx`
- Create: `/Users/creaafde/Documents/workbench stage/stage-app/components/ui/ListRow.tsx`
- Create: `/Users/creaafde/Documents/workbench stage/stage-app/components/ui/TextField.tsx`
- Create: `/Users/creaafde/Documents/workbench stage/stage-app/components/ui/SearchField.tsx`
- Create: `/Users/creaafde/Documents/workbench stage/stage-app/components/ui/Badge.tsx`
- Create: `/Users/creaafde/Documents/workbench stage/stage-app/components/ui/StatTile.tsx`
- Create: `/Users/creaafde/Documents/workbench stage/stage-app/components/feedback/LoadingState.tsx`
- Create: `/Users/creaafde/Documents/workbench stage/stage-app/components/feedback/ErrorState.tsx`
- Create: `/Users/creaafde/Documents/workbench stage/stage-app/components/feedback/EmptyState.tsx`

- [ ] **Step 1: Create Screen wrapper**

Create `/Users/creaafde/Documents/workbench stage/stage-app/components/layout/Screen.tsx`:

```tsx
import { PropsWithChildren } from 'react';
import { ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

type ScreenProps = PropsWithChildren<{
  scroll?: boolean;
  className?: string;
}>;

export function Screen({ children, scroll = true, className = '' }: ScreenProps) {
  const content = <View className={`px-4 py-4 ${className}`}>{children}</View>;

  return (
    <SafeAreaView className="flex-1 bg-stage-ink">
      {scroll ? <ScrollView keyboardShouldPersistTaps="handled">{content}</ScrollView> : content}
    </SafeAreaView>
  );
}
```

Expected: every screen has safe-area and consistent background.

- [ ] **Step 2: Create text and button primitives**

Create `/Users/creaafde/Documents/workbench stage/stage-app/components/ui/AppText.tsx`:

```tsx
import { PropsWithChildren } from 'react';
import { Text, TextProps } from 'react-native';

type AppTextProps = PropsWithChildren<TextProps & {
  variant?: 'title' | 'subtitle' | 'body' | 'caption';
}>;

const variants = {
  title: 'text-3xl font-black text-white',
  subtitle: 'text-xl font-bold text-white',
  body: 'text-base text-white',
  caption: 'text-sm text-stage-muted',
};

export function AppText({ children, className = '', variant = 'body', ...props }: AppTextProps) {
  return (
    <Text className={`${variants[variant]} ${className}`} {...props}>
      {children}
    </Text>
  );
}
```

Create `/Users/creaafde/Documents/workbench stage/stage-app/components/ui/Button.tsx`:

```tsx
import { PropsWithChildren } from 'react';
import { Pressable, PressableProps } from 'react-native';
import { AppText } from './AppText';

type ButtonProps = PropsWithChildren<PressableProps & {
  variant?: 'primary' | 'secondary' | 'danger';
}>;

const variants = {
  primary: 'bg-stage-mint',
  secondary: 'bg-stage-panel border border-stage-line',
  danger: 'bg-stage-danger',
};

export function Button({ children, className = '', disabled, variant = 'primary', ...props }: ButtonProps) {
  return (
    <Pressable
      className={`min-h-12 items-center justify-center rounded-stage px-4 ${variants[variant]} ${disabled ? 'opacity-50' : ''} ${className}`}
      disabled={disabled}
      {...props}
    >
      <AppText className={variant === 'secondary' ? 'text-white' : 'text-stage-ink'}>{children}</AppText>
    </Pressable>
  );
}
```

Expected: text and button components are native and reusable.

- [ ] **Step 3: Create feedback states**

Create `/Users/creaafde/Documents/workbench stage/stage-app/components/feedback/LoadingState.tsx`:

```tsx
import { ActivityIndicator, View } from 'react-native';
import { AppText } from '../ui/AppText';

export function LoadingState({ label = 'Loading' }: { label?: string }) {
  return (
    <View className="items-center justify-center gap-3 py-10">
      <ActivityIndicator color="#7df4c5" />
      <AppText variant="caption">{label}</AppText>
    </View>
  );
}
```

Create `/Users/creaafde/Documents/workbench stage/stage-app/components/feedback/ErrorState.tsx`:

```tsx
import { View } from 'react-native';
import { Button } from '../ui/Button';
import { AppText } from '../ui/AppText';

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <View className="gap-4 rounded-stage border border-stage-line bg-stage-panel p-4">
      <AppText variant="subtitle">Something went wrong</AppText>
      <AppText variant="caption">{message}</AppText>
      {onRetry ? <Button variant="secondary" onPress={onRetry}>Retry</Button> : null}
    </View>
  );
}
```

Create `/Users/creaafde/Documents/workbench stage/stage-app/components/feedback/EmptyState.tsx`:

```tsx
import { View } from 'react-native';
import { AppText } from '../ui/AppText';

export function EmptyState({ title, message }: { title: string; message?: string }) {
  return (
    <View className="items-center gap-2 rounded-stage border border-stage-line bg-stage-panel p-6">
      <AppText variant="subtitle" className="text-center">{title}</AppText>
      {message ? <AppText variant="caption" className="text-center">{message}</AppText> : null}
    </View>
  );
}
```

Expected: screens have consistent loading, error, and empty states.

- [ ] **Step 4: Add remaining primitives**

Create the remaining primitives with the same rule: native components only, no DOM assumptions, no web shadcn copy. Each primitive must accept `className`, expose a small prop API, and use Stage theme colors.

Expected: imports exist for route and feature screens.

- [ ] **Step 5: Verify UI primitives**

Run:

```bash
cd "/Users/creaafde/Documents/workbench stage/stage-app" && npm run typecheck
```

Expected: all primitives compile.

---

### Task 8: Add App Shell, Auth Provider, And Route Layouts

**Files:**
- Create: `/Users/creaafde/Documents/workbench stage/stage-app/features/auth/AuthProvider.tsx`
- Create: `/Users/creaafde/Documents/workbench stage/stage-app/app/_layout.tsx`
- Create: `/Users/creaafde/Documents/workbench stage/stage-app/app/index.tsx`
- Create: `/Users/creaafde/Documents/workbench stage/stage-app/app/(auth)/_layout.tsx`
- Create: `/Users/creaafde/Documents/workbench stage/stage-app/app/(tabs)/_layout.tsx`
- Create: `/Users/creaafde/Documents/workbench stage/stage-app/app/(admin)/_layout.tsx`

- [ ] **Step 1: Create AuthProvider**

Create `/Users/creaafde/Documents/workbench stage/stage-app/features/auth/AuthProvider.tsx`:

```tsx
import { createContext, PropsWithChildren, useContext, useEffect, useMemo, useState } from 'react';
import { hydrateAuthStorage } from '../../lib/auth/authStorage';
import { subscribeToSession } from './session';

type AuthContextValue = {
  ready: boolean;
  session: unknown;
  isAuthenticated: boolean;
};

const AuthContext = createContext<AuthContextValue>({
  ready: false,
  session: null,
  isAuthenticated: false,
});

export function AuthProvider({ children }: PropsWithChildren) {
  const [ready, setReady] = useState(false);
  const [session, setSession] = useState<unknown>(null);

  useEffect(() => {
    let mounted = true;
    hydrateAuthStorage().then((stored) => {
      if (!mounted) return;
      setSession(stored.accessToken ? stored : null);
      setReady(true);
    });

    const unsubscribe = subscribeToSession((nextSession) => {
      setSession(nextSession);
    });

    return () => {
      mounted = false;
      unsubscribe();
    };
  }, []);

  const value = useMemo(
    () => ({ ready, session, isAuthenticated: Boolean(session) }),
    [ready, session],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
```

Expected: app can restore auth state before routing.

- [ ] **Step 2: Create root layout**

Create `/Users/creaafde/Documents/workbench stage/stage-app/app/_layout.tsx`:

```tsx
import '../global.css';
import { Stack } from 'expo-router';
import { AuthProvider } from '../features/auth/AuthProvider';
import { SocketProvider } from '../lib/socket/SocketProvider';

export default function RootLayout() {
  return (
    <AuthProvider>
      <SocketProvider>
        <Stack screenOptions={{ headerShown: false }} />
      </SocketProvider>
    </AuthProvider>
  );
}
```

Expected: auth and socket providers wrap all routes.

- [ ] **Step 3: Create index redirect**

Create `/Users/creaafde/Documents/workbench stage/stage-app/app/index.tsx`:

```tsx
import { Redirect } from 'expo-router';
import { LoadingState } from '../components/feedback/LoadingState';
import { Screen } from '../components/layout/Screen';
import { useAuth } from '../features/auth/AuthProvider';

export default function IndexRoute() {
  const { ready, isAuthenticated } = useAuth();

  if (!ready) {
    return (
      <Screen scroll={false}>
        <LoadingState label="Restoring session" />
      </Screen>
    );
  }

  return <Redirect href={isAuthenticated ? '/home' : '/login'} />;
}
```

Expected: app boots to login or home based on session.

- [ ] **Step 4: Create auth and tab layouts**

Create `/Users/creaafde/Documents/workbench stage/stage-app/app/(auth)/_layout.tsx`:

```tsx
import { Stack } from 'expo-router';

export default function AuthLayout() {
  return <Stack screenOptions={{ headerShown: false }} />;
}
```

Create `/Users/creaafde/Documents/workbench stage/stage-app/app/(tabs)/_layout.tsx`:

```tsx
import { Tabs } from 'expo-router';
import { Home, Shield, Trophy, Users, Menu } from 'lucide-react-native';
import { colors } from '../../constants/theme';

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.mint,
        tabBarInactiveTintColor: colors.muted,
        tabBarStyle: { backgroundColor: colors.panel, borderTopColor: colors.line },
      }}
    >
      <Tabs.Screen name="home" options={{ title: 'Home', tabBarIcon: ({ color }) => <Home color={color} size={20} /> }} />
      <Tabs.Screen name="competitions" options={{ title: 'Comp', tabBarIcon: ({ color }) => <Trophy color={color} size={20} /> }} />
      <Tabs.Screen name="clubs" options={{ title: 'Clubs', tabBarIcon: ({ color }) => <Shield color={color} size={20} /> }} />
      <Tabs.Screen name="social" options={{ title: 'Social', tabBarIcon: ({ color }) => <Users color={color} size={20} /> }} />
      <Tabs.Screen name="more" options={{ title: 'More', tabBarIcon: ({ color }) => <Menu color={color} size={20} /> }} />
    </Tabs>
  );
}
```

Expected: primary bottom tabs exist.

- [ ] **Step 5: Verify route shell**

Run:

```bash
cd "/Users/creaafde/Documents/workbench stage/stage-app" && npm run typecheck
```

Expected: route layouts compile.

---

### Task 9: Implement Login And Session Restore

**Files:**
- Create: `/Users/creaafde/Documents/workbench stage/stage-app/features/auth/LoginScreen.tsx`
- Create: `/Users/creaafde/Documents/workbench stage/stage-app/app/(auth)/login.tsx`
- Create: `/Users/creaafde/Documents/workbench stage/stage-app/app/(auth)/onboarding.tsx`
- Create: `/Users/creaafde/Documents/workbench stage/stage-app/app/(auth)/callback.tsx`

- [ ] **Step 1: Create LoginScreen**

Create `/Users/creaafde/Documents/workbench stage/stage-app/features/auth/LoginScreen.tsx`:

```tsx
import { useState } from 'react';
import { Alert, View } from 'react-native';
import { router } from 'expo-router';
import stageClient from '../../api/stageClient';
import { Screen } from '../../components/layout/Screen';
import { AppText } from '../../components/ui/AppText';
import { Button } from '../../components/ui/Button';
import { TextField } from '../../components/ui/TextField';

export function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function handleLogin() {
    setSubmitting(true);
    try {
      await stageClient.auth.login(email.trim(), password);
      router.replace('/home');
    } catch (error: any) {
      Alert.alert('Login failed', error?.message || 'Check your credentials and try again.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Screen scroll={false} className="flex-1 justify-center gap-6">
      <View className="gap-2">
        <AppText variant="title">Stage League</AppText>
        <AppText variant="caption">Sign in to manage matches, clubs, wallet, and messages.</AppText>
      </View>
      <View className="gap-3">
        <TextField label="Email" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" />
        <TextField label="Password" value={password} onChangeText={setPassword} secureTextEntry />
        <Button disabled={submitting || !email || !password} onPress={handleLogin}>
          {submitting ? 'Signing in' : 'Sign in'}
        </Button>
      </View>
    </Screen>
  );
}
```

Expected: login uses `stageClient.auth.login`.

- [ ] **Step 2: Create login route**

Create `/Users/creaafde/Documents/workbench stage/stage-app/app/(auth)/login.tsx`:

```tsx
import { LoginScreen } from '../../features/auth/LoginScreen';

export default LoginScreen;
```

Expected: `/login` renders native login.

- [ ] **Step 3: Create onboarding and callback shells**

Create `/Users/creaafde/Documents/workbench stage/stage-app/app/(auth)/onboarding.tsx`:

```tsx
import { PlaceholderScreen } from '../../features/shared/PlaceholderScreen';

export default function OnboardingRoute() {
  return <PlaceholderScreen title="Onboarding" message="Mobile onboarding route is ready for the native flow." />;
}
```

Create `/Users/creaafde/Documents/workbench stage/stage-app/app/(auth)/callback.tsx`:

```tsx
import { PlaceholderScreen } from '../../features/shared/PlaceholderScreen';

export default function CallbackRoute() {
  return <PlaceholderScreen title="Auth callback" message="OAuth mobile callback support will be wired after backend mobile return links are available." />;
}
```

Expected: route parity exists without pretending OAuth is ready.

- [ ] **Step 4: Verify login**

Run:

```bash
cd "/Users/creaafde/Documents/workbench stage/stage-app" && npm run typecheck
```

Expected: login route compiles.

---

### Task 10: Create Placeholder Route Coverage

**Files:**
- Create: `/Users/creaafde/Documents/workbench stage/stage-app/features/shared/PlaceholderScreen.tsx`
- Create all remaining route files listed in File Structure.

- [ ] **Step 1: Create reusable placeholder screen**

Create `/Users/creaafde/Documents/workbench stage/stage-app/features/shared/PlaceholderScreen.tsx`:

```tsx
import { Screen } from '../../components/layout/Screen';
import { AppText } from '../../components/ui/AppText';

export function PlaceholderScreen({ title, message }: { title: string; message?: string }) {
  return (
    <Screen className="gap-3">
      <AppText variant="title">{title}</AppText>
      <AppText variant="caption">{message || 'This mobile route is wired and ready for its feature module.'}</AppText>
    </Screen>
  );
}
```

Expected: incomplete routes have a consistent mobile-safe shell.

- [ ] **Step 2: Add all route files**

For each route in the File Structure section, create a route file that either imports a real feature screen or renders `PlaceholderScreen`.

Example for `/Users/creaafde/Documents/workbench stage/stage-app/app/wallet.tsx`:

```tsx
import { PlaceholderScreen } from '../features/shared/PlaceholderScreen';

export default function WalletRoute() {
  return <PlaceholderScreen title="Wallet" />;
}
```

Example for `/Users/creaafde/Documents/workbench stage/stage-app/app/clubs/[id].tsx`:

```tsx
import { useLocalSearchParams } from 'expo-router';
import { PlaceholderScreen } from '../../features/shared/PlaceholderScreen';

export default function ClubDetailRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <PlaceholderScreen title="Club detail" message={`Club ID: ${id}`} />;
}
```

Expected: every web page has a mobile route counterpart.

- [ ] **Step 3: Verify route coverage**

Run:

```bash
cd "/Users/creaafde/Documents/workbench stage/stage-app" && npm run typecheck
```

Expected: all route files compile.

---

### Task 11: Implement First Live Data Screens

**Files:**
- Create: `/Users/creaafde/Documents/workbench stage/stage-app/hooks/useStageQuery.js`
- Create: `/Users/creaafde/Documents/workbench stage/stage-app/features/clubs/clubHooks.js`
- Create: `/Users/creaafde/Documents/workbench stage/stage-app/features/clubs/ClubsScreen.tsx`
- Create: `/Users/creaafde/Documents/workbench stage/stage-app/features/clubs/ClubDetailScreen.tsx`
- Create: `/Users/creaafde/Documents/workbench stage/stage-app/features/home/HomeScreen.tsx`
- Modify: `/Users/creaafde/Documents/workbench stage/stage-app/app/(tabs)/home.tsx`
- Modify: `/Users/creaafde/Documents/workbench stage/stage-app/app/(tabs)/clubs.tsx`
- Modify: `/Users/creaafde/Documents/workbench stage/stage-app/app/clubs/[id].tsx`

- [ ] **Step 1: Create query hook**

Create `/Users/creaafde/Documents/workbench stage/stage-app/hooks/useStageQuery.js`:

```js
import { useCallback, useEffect, useState } from 'react';

export function useStageQuery(loader, deps = []) {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setData(await loader());
    } catch (nextError) {
      setError(nextError);
    } finally {
      setLoading(false);
    }
  }, deps);

  useEffect(() => {
    reload();
  }, [reload]);

  return { data, error, loading, reload };
}
```

Expected: screens can load backend data with retry.

- [ ] **Step 2: Create club hooks**

Create `/Users/creaafde/Documents/workbench stage/stage-app/features/clubs/clubHooks.js`:

```js
import stageClient from '../../api/stageClient';
import { useStageQuery } from '../../hooks/useStageQuery';

export function useClubs() {
  return useStageQuery(() => stageClient.entities.Club.filter({}, '-created_date', 25), []);
}

export function useClub(id) {
  return useStageQuery(() => stageClient.entities.Club.get(id), [id]);
}
```

Expected: club reads are isolated from UI components.

- [ ] **Step 3: Create ClubsScreen**

Create `/Users/creaafde/Documents/workbench stage/stage-app/features/clubs/ClubsScreen.tsx`:

```tsx
import { Pressable, View } from 'react-native';
import { router } from 'expo-router';
import { ErrorState } from '../../components/feedback/ErrorState';
import { LoadingState } from '../../components/feedback/LoadingState';
import { EmptyState } from '../../components/feedback/EmptyState';
import { Screen } from '../../components/layout/Screen';
import { AppText } from '../../components/ui/AppText';
import { useClubs } from './clubHooks';

export function ClubsScreen() {
  const { data, error, loading, reload } = useClubs();
  const clubs = Array.isArray(data) ? data : data?.data || [];

  if (loading) return <Screen><LoadingState label="Loading clubs" /></Screen>;
  if (error) return <Screen><ErrorState message={error.message || 'Unable to load clubs'} onRetry={reload} /></Screen>;

  return (
    <Screen className="gap-4">
      <AppText variant="title">Clubs</AppText>
      {!clubs.length ? <EmptyState title="No clubs found" /> : null}
      <View className="gap-3">
        {clubs.map((club: any) => (
          <Pressable key={club.id} className="rounded-stage border border-stage-line bg-stage-panel p-4" onPress={() => router.push(`/clubs/${club.id}`)}>
            <AppText variant="subtitle">{club.name || 'Unnamed club'}</AppText>
            <AppText variant="caption">{club.country || club.city || 'Stage League club'}</AppText>
          </Pressable>
        ))}
      </View>
    </Screen>
  );
}
```

Expected: clubs list loads live backend data.

- [ ] **Step 4: Wire routes to live club screens**

Update `/Users/creaafde/Documents/workbench stage/stage-app/app/(tabs)/clubs.tsx`:

```tsx
import { ClubsScreen } from '../../features/clubs/ClubsScreen';

export default ClubsScreen;
```

Update `/Users/creaafde/Documents/workbench stage/stage-app/app/clubs/[id].tsx` to render `ClubDetailScreen`.

Expected: tab and detail route use feature screens.

- [ ] **Step 5: Verify live screens**

Run:

```bash
cd "/Users/creaafde/Documents/workbench stage/stage-app" && npm run typecheck
```

Expected: live screens compile.

---

### Task 12: Start Expo And Smoke Test

**Files:**
- No code changes unless verification exposes a specific bug.

- [ ] **Step 1: Start Expo dev server**

Run:

```bash
cd "/Users/creaafde/Documents/workbench stage/stage-app" && npm run start
```

Expected: Expo starts and prints QR/dev URLs.

- [ ] **Step 2: Verify app boots**

Open the app in iOS simulator, Android emulator, or Expo Go.

Expected:
- App starts without red screen.
- First route shows login when no token is stored.
- Bottom tabs render after session restore or login.

- [ ] **Step 3: Verify backend read**

After login, open Clubs.

Expected:
- Request goes to `https://stageleagues.com/api/stage/clubs`.
- Clubs list either renders data or shows a normalized error state.

- [ ] **Step 4: Verify socket connection**

After login, inspect Expo logs.

Expected:
- Socket attempts connection to `https://stage-7osn.onrender.com`.
- No hardcoded socket secret appears in the frontend bundle.
- If token is valid, socket connects or returns a clear auth error.

- [ ] **Step 5: Run final checks**

Run:

```bash
cd "/Users/creaafde/Documents/workbench stage/stage-app" && npm run typecheck
```

Expected: typecheck passes.

---

## Self-Review

- Spec coverage: The plan covers sibling `stage-app/`, Expo SDK 54, NativeWind 4, API client, auth storage, socket client, route parity, UI primitives, live first screens, and verification.
- Placeholder scan: Placeholder screens are intentional route shells, not incomplete plan instructions. No task asks the implementer to invent unspecified behavior.
- Type consistency: Route names, auth storage methods, `stageClient`, and socket helpers are named consistently across tasks.
- Scope check: This plan builds the mobile scaffold and first live screens. Full feature parity for every complex business workflow should follow as domain-specific plans after this scaffold is verified.

## Execution Options

1. **Subagent-Driven (recommended)** - dispatch a fresh subagent per task, review between tasks, faster and cleaner for this many files.
2. **Inline Execution** - execute tasks in this session using checkpoints.

Recommended choice: Subagent-Driven, because this app has independent layers: scaffold/config, API/auth, socket, UI primitives, route coverage, and live screens.
