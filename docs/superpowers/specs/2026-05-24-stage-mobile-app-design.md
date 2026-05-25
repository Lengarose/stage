# Stage Mobile App Design

## Goal

Create a new mobile frontend in the parent workspace as `stage-app/`, using Expo SDK 54, React Native, and NativeWind 4. The app must cover the current web frontend route surface while fixing the architecture problem that exists in the web app: business logic, page structure, UI, and realtime wiring must be separated into focused modules.

The existing backend REST server remains in `stage/server/` on Gandi. The existing realtime socket server remains in `stage/socket-server/` on Render. The mobile app is a new frontend only.

## Non-Goals

- Do not move backend code into the mobile app.
- Do not merge the socket server into the backend.
- Do not rewrite the SQL model layer.
- Do not implement sensitive business mutations with direct frontend CRUD.
- Do not port web-only UI libraries such as Radix, shadcn web components, React Router, Recharts DOM charts, `localStorage`, or `window` APIs.
- Do not treat mobile as a pixel copy of the web app. It should preserve product behavior and visual identity, but use native mobile interaction patterns.

## Recommended Approach

Use route parity with clean mobile architecture.

Every current web page gets a corresponding mobile route or route placeholder from the first scaffold. Critical workflows are implemented as native screens first. Complex secondary screens can initially expose mobile-safe shells connected to the central API client, then be completed feature by feature. This keeps navigation complete while avoiding a rushed copy of the current large web pages.

This approach is better than a direct full copy because the current web frontend already has too much business logic inside page files. It is also better than a tiny MVP because the product needs confidence that the complete frontend surface has a mobile home.

## Target Folder

The new app should be created next to the current repo:

```txt
/Users/creaafde/Documents/workbench stage/
  stage/       existing web, backend, socket-server
  stage-app/   new Expo mobile frontend
```

Creating `stage-app/` requires write permission outside the current repo sandbox.

## Tech Stack

- Expo SDK 54
- React Native
- Expo Router
- NativeWind 4
- `socket.io-client`
- `expo-secure-store`
- `@react-native-async-storage/async-storage`
- `react-native-safe-area-context`
- `react-native-reanimated`
- `react-native-svg`
- `lucide-react-native`

## Environment

The mobile app uses public Expo environment variables:

```txt
EXPO_PUBLIC_STAGE_API_BASE=https://stageleagues.com/api/stage
EXPO_PUBLIC_STAGE_SOCKET_URL=https://stage-7osn.onrender.com
```

The API base must be absolute. The web app can use `/api/stage` because it is served from the same origin, but the mobile app cannot rely on a browser proxy.

## Architecture

```txt
stage-app/
  app/
    _layout.tsx
    index.tsx
    (auth)/
    (tabs)/
    (admin)/
    clubs/
    players/
    tournaments/
    competitions/
    leagues/
  api/
    stageClient.js
  constants/
    env.js
    routes.js
    theme.js
  components/
    ui/
    layout/
    feedback/
  features/
    auth/
    home/
    clubs/
    players/
    competitions/
    tournaments/
    contracts/
    transfers/
    wallet/
    inbox/
    notifications/
    social/
    admin/
  lib/
    auth/
    socket/
    storage/
    format/
  hooks/
  assets/
```

### Responsibilities

`app/` owns navigation only. Route files should stay thin and delegate to feature screens.

`api/stageClient.js` owns REST calls, auth refresh, entity factories, and function invocation. It should intentionally mirror the useful surface of the web `src/api/stageClient.js`, adjusted for React Native storage and absolute URLs.

`lib/auth/` owns token persistence and session events. Access and refresh tokens go in SecureStore. User, player, owner IDs and harmless preferences can go in AsyncStorage.

`lib/socket/` owns the Socket.IO connection. It connects to Render with the JWT in `auth`, handles reconnects, and exposes room/channel helpers. It must not be mixed into page components.

`features/` owns product workflows. Each domain gets screens, hooks, small components, and adapters close together.

`components/ui/` owns reusable native primitives such as buttons, inputs, cards, list rows, bottom sheets, empty states, loading states, badges, and icon buttons.

## Route Coverage

The first scaffold should include mobile route coverage for:

- Landing, login, onboarding, auth callback handling
- Home
- Clubs, registered clubs, club detail
- Players, registered players, player profile, player stats, free agents
- Competitions, competition detail, league detail, league registration
- Tournaments, tournament detail, international tournaments
- Schedule, game day
- Contracts create flow, inbox contract offer handling
- Transfer market, recruitment
- Wallet, lifestyle, store
- Inbox, notifications
- Social, community, follow back, search
- Rankings, prediction leaderboard
- News, settings
- Admin dashboard and admin section shells

The mobile routes can be grouped differently from the web routes when it improves usability. For example, secondary routes can live under a `More` tab instead of becoming top-level tabs.

## Navigation Model

Use Expo Router with a small number of top-level groups:

```txt
app/(auth)/          login, onboarding, auth callback
app/(tabs)/          main player experience
app/(admin)/         admin experience
app/clubs/[id].tsx
app/players/[id].tsx
app/tournaments/[id].tsx
app/competitions/[slug].tsx
app/leagues/[slug].tsx
```

Primary tabs:

- Home
- Competitions
- Clubs
- Social
- More

The `More` screen links to wallet, transfers, tournaments, rankings, inbox, notifications, lifestyle, store, recruitment, international tournaments, settings, and other secondary workflows.

Admin should be a separate stack reachable only for authorized users. Admin pages should be split into modules rather than copied as one giant screen.

## API Client Design

The mobile `stageClient` should expose:

```js
stageClient.auth.login(email, password)
stageClient.auth.logout()
stageClient.auth.me()
stageClient.auth.refresh()
stageClient.entities.Player.filter(params, sort, limit)
stageClient.entities.Club.get(id)
stageClient.entities.Match.update(id, patch)
stageClient.functions.invoke(name, params)
stageClient.http.get(path, options)
stageClient.http.post(path, body, options)
```

Sensitive actions must use backend functions or dedicated endpoints:

- Contract offers, counters, rejects, renewals, cancellations
- Tournament registration and withdrawal
- Transfer payments
- Competition fixture result submission
- Admin match actions
- Admin membership actions
- Club admin actions
- Wallet or STC mutations
- Any action that requires audit logs

Plain entity CRUD is allowed only for benign data reads or simple safe edits that already follow the backend contract.

## Auth Design

Email/password auth should be implemented first.

OAuth can be supported later through universal links or backend support for signed mobile return targets. The current web OAuth callback assumes browser redirects and should not block the first mobile scaffold.

Token storage:

- `stage_access_token`: SecureStore
- `stage_refresh_token`: SecureStore
- `stage_user_id`: AsyncStorage
- `stage_player_id`: AsyncStorage
- `stage_owner_id`: AsyncStorage

The auth module should maintain an in-memory cache after boot so the API client can attach tokens without repeatedly awaiting SecureStore for every request.

## Realtime Design

The socket client should use:

```js
io(EXPO_PUBLIC_STAGE_SOCKET_URL, {
  transports: ['websocket', 'polling'],
  auth: { token },
  reconnectionAttempts: 10,
  reconnectionDelay: 2000,
  autoConnect: false,
})
```

It should connect only after a valid token exists and disconnect on logout. It should preserve the current protocol used by the web app for notifications, inbox messages, and room joins.

Render configuration remains:

- `ACCESS_TOKEN_SECRET`
- `EMIT_SECRET`
- `ALLOWED_ORIGINS`

Gandi backend configuration remains:

- `SOCKET_SERVER_URL`
- `SOCKET_SERVER_SECRET`

## UI/UX Direction

The mobile app should feel like a dense sports operations console, not a marketing landing page. The design should prioritize:

- Fast scanning of fixtures, clubs, standings, wallet balances, inbox items, and notifications.
- Strong native touch targets.
- Bottom tabs for primary navigation.
- Sticky action bars for screens with important actions.
- Native lists instead of web tables.
- Bottom sheets for filters, actions, confirmations, and compact forms.
- Segmented controls for mode switches.
- Icon buttons with labels where clarity matters.
- Clear loading, empty, offline, unauthorized, and error states.

The visual identity should port the Stage League atmosphere from web, but the implementation should use NativeWind tokens and native primitives rather than DOM CSS assumptions.

## UI Primitive Set

Create reusable primitives before porting complex pages:

- `Screen`
- `HeaderBar`
- `AppText`
- `Button`
- `IconButton`
- `TextField`
- `SearchField`
- `Card`
- `Panel`
- `ListRow`
- `FixtureRow`
- `ClubRow`
- `PlayerRow`
- `StatTile`
- `Badge`
- `StatusPill`
- `CurrencyPill`
- `Avatar`
- `EmptyState`
- `LoadingState`
- `ErrorState`
- `ConfirmSheet`
- `ActionSheet`
- `SegmentedControl`
- `ScrollTabs`

These primitives should be small and native-first. Web primitives from `src/components/ui/*` should not be copied.

## Page Porting Strategy

Port by domain, not by copying web files line by line.

Recommended order:

1. App shell, theme, navigation, auth storage, API client.
2. Login, session restore, logout.
3. Home, notifications, inbox, search.
4. Clubs, club detail, players, player profile.
5. Competitions, league detail, schedule, game day.
6. Wallet, transfer market, recruitment, contracts.
7. Tournaments and international tournaments.
8. Social, community, rankings, news, settings.
9. Admin shell and high-value admin actions.
10. Remaining admin modules and secondary pages.

Each domain should include its own screen components, data hooks, and action adapters. Large web pages such as Admin, TournamentDetail, CompetitionDetail, and Contracts should be split into feature modules during the mobile port.

## Error Handling

The API client should normalize errors into:

```js
{
  status,
  code,
  message,
  details
}
```

Screens should display:

- Unauthorized state for expired or missing sessions.
- Retry state for network failures.
- Validation messages near form fields.
- Confirmation sheets before destructive actions.
- Toast or inline success feedback after completed actions.

401 responses should attempt one token refresh. If refresh fails, the app should clear auth state and return to login.

## Verification Strategy

Before claiming the mobile app scaffold is complete:

- Run package install successfully.
- Run Expo type/check commands available in the scaffold.
- Run lint if configured.
- Run a syntax/import check for the API client and socket client.
- Start the Expo dev server.
- Verify that the app boots to login.
- Verify login against the configured backend when credentials are available.
- Verify socket connection against Render with a valid token.
- Verify at least one read screen loads from Gandi.
- Verify at least one backend function call reaches the server for a non-destructive action or a safe test endpoint.

For later business-action screens, do not claim a mutation works unless the endpoint or function has been called and the returned state has been checked.

## Risks And Decisions

OAuth is a known risk because web OAuth redirects are browser-oriented. The first mobile version should ship email/password auth and leave OAuth as a follow-up backend/mobile-link task.

Charts are a known risk because web Recharts cannot be reused. Mobile stats should begin with native stat cards and simple lists, then add charting only where it provides real value.

Admin is a known risk because the web admin surface is large. The mobile admin should start with route coverage and high-value action modules, not a one-screen copy of the web admin page.

Business logic drift is a known risk. The mobile app should treat backend functions as the source of truth for sensitive actions and should not recreate calculations in page components.

## Acceptance Criteria

- `stage-app/` exists in the parent workspace as a standalone Expo SDK 54 app.
- NativeWind 4 is configured and used by the UI primitives.
- Expo Router route coverage exists for all current web pages.
- `api/stageClient.js` exists and centralizes REST, auth, refresh, entities, and functions.
- Socket.IO client exists under `lib/socket/` and points to the Render socket URL.
- Email/password login works with SecureStore token persistence.
- The app restores session on launch and disconnects socket on logout.
- At least the first core screens load live backend data: Home, Clubs, Club detail, Competitions or Schedule, Inbox or Notifications.
- Sensitive actions are wired through backend functions or dedicated endpoints, not direct frontend CRUD.
- Large domains are split into `features/` modules rather than implemented as single giant route files.
