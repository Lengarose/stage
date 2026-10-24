# Stage League API reference

To run status checks against this inventory, see [API testing instructions](API_TESTING.md).

Source inventory generated on 24 October 2026 from the current checkout. These URLs use the documented production origin; deployment and live responses have not been tested. Replace `:id`, `:clubId`, `:fixtureId`, and other placeholders with actual values.

## Base URLs and usage

- Web API: [https://stageleagues.com/api/stage](https://stageleagues.com/api/stage)
- Mobile compatibility API: [https://stageleagues.com/api/mobile](https://stageleagues.com/api/mobile)
- Realtime service configured in source: [https://stage-7osn.onrender.com](https://stage-7osn.onrender.com)
- Local backend default: [http://localhost:8080](http://localhost:8080)

Protected routes require `Authorization: Bearer <access_token>`. Resource permissions and administrator checks may impose additional restrictions. The main `/auth` router applies authentication inside individual handlers where needed; public tournament reads require no login. Uploads require login. HTTP links alone do not perform POST, PATCH, PUT, or DELETE requests.

GET collection routes usually list/filter records; GET `/:id` reads one; POST creates; PATCH edits; DELETE removes. Only methods actually declared in each router are listed below. Filter fields and request bodies vary by endpoint; consult the linked implementation.

## Main web API

### /api/stage/auth

Implementation: [authController.js](../server/src/server/controllers/authController.js).

| Method | API link | Function |
|---|---|---|
| POST | [/api/stage/auth/register](https://stageleagues.com/api/stage/auth/register) | Create an account. |
| POST | [/api/stage/auth/login](https://stageleagues.com/api/stage/auth/login) | Sign in with email and password; obtain authentication tokens. |
| POST | [/api/stage/auth/refresh](https://stageleagues.com/api/stage/auth/refresh) | Refresh an access token. |
| POST | [/api/stage/auth/logout](https://stageleagues.com/api/stage/auth/logout) | Sign out and invalidate the refresh token. |
| GET | [/api/stage/auth/me](https://stageleagues.com/api/stage/auth/me) | Read the signed-in user profile. |
| POST | [/api/stage/auth/forgot-password](https://stageleagues.com/api/stage/auth/forgot-password) | Request a password reset email. |
| GET | [/api/stage/auth/reset-password](https://stageleagues.com/api/stage/auth/reset-password) | Validate a password reset token. |
| POST | [/api/stage/auth/reset-password](https://stageleagues.com/api/stage/auth/reset-password) | Set a new password using a valid reset token. |
| PATCH | [/api/stage/auth/timezone](https://stageleagues.com/api/stage/auth/timezone) | Update the user timezone. |

### /api/stage/auth

Implementation: [oauthController.js](../server/src/server/controllers/oauthController.js).

| Method | API link | Function |
|---|---|---|
| GET | [/api/stage/auth/google](https://stageleagues.com/api/stage/auth/google) | Start Google OAuth sign-in. |
| GET | [/api/stage/auth/google/callback](https://stageleagues.com/api/stage/auth/google/callback) | Handle the Google OAuth callback and finish sign-in. |
| GET | [/api/stage/auth/microsoft](https://stageleagues.com/api/stage/auth/microsoft) | Start Microsoft OAuth sign-in. |
| GET | [/api/stage/auth/microsoft/callback](https://stageleagues.com/api/stage/auth/microsoft/callback) | Handle the Microsoft OAuth callback and finish sign-in. |
| GET | [/api/stage/auth/twitch](https://stageleagues.com/api/stage/auth/twitch) | Start Twitch OAuth sign-in. |
| GET | [/api/stage/auth/twitch/callback](https://stageleagues.com/api/stage/auth/twitch/callback) | Handle the Twitch OAuth callback and finish sign-in. |
| GET | [/api/stage/auth/kick](https://stageleagues.com/api/stage/auth/kick) | Start Kick OAuth sign-in. |
| GET | [/api/stage/auth/kick/callback](https://stageleagues.com/api/stage/auth/kick/callback) | Handle the Kick OAuth callback and finish sign-in. |
| GET | [/api/stage/auth/mobile-handoff](https://stageleagues.com/api/stage/auth/mobile-handoff) | Hand off an authenticated session to the mobile client. |
| GET | [/api/stage/auth/store-return](https://stageleagues.com/api/stage/auth/store-return) | Handle the return from store checkout. |

### /api/stage/public

Implementation: [publicTournamentController.js](../server/src/server/controllers/publicTournamentController.js).

| Method | API link | Function |
|---|---|---|
| GET | [/api/stage/public/tournaments/:id/statistics/:category](https://stageleagues.com/api/stage/public/tournaments/:id/statistics/:category) | Read tournaments / statistics for public. |
| GET | [/api/stage/public/tournaments/:id/statistics](https://stageleagues.com/api/stage/public/tournaments/:id/statistics) | Read tournaments / statistics for public. |
| POST | [/api/stage/public/resolve-entrance-token](https://stageleagues.com/api/stage/public/resolve-entrance-token) | Perform resolve entrance token for public. |
| GET | [/api/stage/public/tournaments/:id](https://stageleagues.com/api/stage/public/tournaments/:id) | Read tournaments for public. |
| GET | [/api/stage/public/tournaments/:id/stages](https://stageleagues.com/api/stage/public/tournaments/:id/stages) | Read tournaments / stages for public. |
| GET | [/api/stage/public/tournaments/:id/stages/:stageKey/matches](https://stageleagues.com/api/stage/public/tournaments/:id/stages/:stageKey/matches) | Read tournaments / stages / matches for public. |
| GET | [/api/stage/public/tournaments/:id/stages/:stageKey](https://stageleagues.com/api/stage/public/tournaments/:id/stages/:stageKey) | Read tournaments / stages for public. |
| GET | [/api/stage/public/tournaments/:id/matches](https://stageleagues.com/api/stage/public/tournaments/:id/matches) | Read tournaments / matches for public. |

### /api/stage/upload

Implementation: [uploadController.js](../server/src/server/controllers/uploadController.js).

| Method | API link | Function |
|---|---|---|
| POST | [/api/stage/upload](https://stageleagues.com/api/stage/upload) | Upload an image or video using multipart field `file`. |

### /api/stage/functions

All functions use POST. See the server functions section below.

### /api/stage/players

Implementation: [playerController.js](../server/src/server/controllers/playerController.js).

| Method | API link | Function |
|---|---|---|
| GET | [/api/stage/players](https://stageleagues.com/api/stage/players) | List or filter players. |
| GET | [/api/stage/players/:id](https://stageleagues.com/api/stage/players/:id) | Read one players record. |
| POST | [/api/stage/players](https://stageleagues.com/api/stage/players) | Create a players record. |
| PATCH | [/api/stage/players/:id](https://stageleagues.com/api/stage/players/:id) | Update one players record. |
| PATCH | [/api/stage/players/:id/card-background](https://stageleagues.com/api/stage/players/:id/card-background) | Update card background for players. |
| PATCH | [/api/stage/players/:id/career-tile-background](https://stageleagues.com/api/stage/players/:id/career-tile-background) | Update career tile background for players. |
| PATCH | [/api/stage/players/:id/game-day-tile-background](https://stageleagues.com/api/stage/players/:id/game-day-tile-background) | Update game day tile background for players. |
| DELETE | [/api/stage/players/:id](https://stageleagues.com/api/stage/players/:id) | Delete one players record. |

### /api/stage/player-careers

Implementation: [playerCareerController.js](../server/src/server/controllers/playerCareerController.js).

| Method | API link | Function |
|---|---|---|
| GET | [/api/stage/player-careers/:playerId](https://stageleagues.com/api/stage/player-careers/:playerId) | Read player careers for player careers. |

### /api/stage/presidents

Implementation: [presidentController.js](../server/src/server/controllers/presidentController.js).

| Method | API link | Function |
|---|---|---|
| GET | [/api/stage/presidents](https://stageleagues.com/api/stage/presidents) | List or filter presidents. |
| GET | [/api/stage/presidents/:id/history](https://stageleagues.com/api/stage/presidents/:id/history) | Read history for presidents. |
| GET | [/api/stage/presidents/:id](https://stageleagues.com/api/stage/presidents/:id) | Read one presidents record. |
| POST | [/api/stage/presidents](https://stageleagues.com/api/stage/presidents) | Create a presidents record. |
| POST | [/api/stage/presidents/:id/transfer](https://stageleagues.com/api/stage/presidents/:id/transfer) | Perform transfer for presidents. |
| PATCH | [/api/stage/presidents/:id](https://stageleagues.com/api/stage/presidents/:id) | Update one presidents record. |
| DELETE | [/api/stage/presidents/:id](https://stageleagues.com/api/stage/presidents/:id) | Delete one presidents record. |

### /api/stage/clubs

Implementation: [clubController.js](../server/src/server/controllers/clubController.js).

| Method | API link | Function |
|---|---|---|
| GET | [/api/stage/clubs](https://stageleagues.com/api/stage/clubs) | List or filter clubs. |
| POST | [/api/stage/clubs/founder](https://stageleagues.com/api/stage/clubs/founder) | Perform founder for clubs. |
| POST | [/api/stage/clubs/:id/leave](https://stageleagues.com/api/stage/clubs/:id/leave) | Perform leave for clubs. |
| GET | [/api/stage/clubs/:id](https://stageleagues.com/api/stage/clubs/:id) | Read one clubs record. |
| POST | [/api/stage/clubs](https://stageleagues.com/api/stage/clubs) | Create a clubs record. |
| PATCH | [/api/stage/clubs/:id](https://stageleagues.com/api/stage/clubs/:id) | Update one clubs record. |
| PATCH | [/api/stage/clubs/:id/stats-tile-background](https://stageleagues.com/api/stage/clubs/:id/stats-tile-background) | Update stats tile background for clubs. |
| DELETE | [/api/stage/clubs/:id](https://stageleagues.com/api/stage/clubs/:id) | Delete one clubs record. |
| POST | [/api/stage/clubs/:id/staff](https://stageleagues.com/api/stage/clubs/:id/staff) | Perform staff for clubs. |
| POST | [/api/stage/clubs/:id/staff/:playerId/remove](https://stageleagues.com/api/stage/clubs/:id/staff/:playerId/remove) | Perform staff / remove for clubs. |
| POST | [/api/stage/clubs/:id/staff/:playerId/permissions](https://stageleagues.com/api/stage/clubs/:id/staff/:playerId/permissions) | Perform staff / permissions for clubs. |
| POST | [/api/stage/clubs/:id/lineups/:fixtureId/publish](https://stageleagues.com/api/stage/clubs/:id/lineups/:fixtureId/publish) | Perform lineups / publish for clubs. |

### /api/stage/matches

Implementation: [matchController.js](../server/src/server/controllers/matchController.js).

| Method | API link | Function |
|---|---|---|
| GET | [/api/stage/matches](https://stageleagues.com/api/stage/matches) | List or filter matches. |
| GET | [/api/stage/matches/profile](https://stageleagues.com/api/stage/matches/profile) | Read profile for matches. |
| GET | [/api/stage/matches/:id](https://stageleagues.com/api/stage/matches/:id) | Read one matches record. |
| POST | [/api/stage/matches](https://stageleagues.com/api/stage/matches) | Create a matches record. |
| PATCH | [/api/stage/matches/:id](https://stageleagues.com/api/stage/matches/:id) | Update one matches record. |
| POST | [/api/stage/matches/:id/admin-void](https://stageleagues.com/api/stage/matches/:id/admin-void) | Perform admin void for matches. |
| DELETE | [/api/stage/matches/:id](https://stageleagues.com/api/stage/matches/:id) | Delete one matches record. |

### /api/stage/tournaments

Implementation: [tournamentController.js](../server/src/server/controllers/tournamentController.js).

| Method | API link | Function |
|---|---|---|
| POST | [/api/stage/tournaments/:id/reconcile-progression](https://stageleagues.com/api/stage/tournaments/:id/reconcile-progression) | Perform reconcile progression for tournaments. |
| GET | [/api/stage/tournaments](https://stageleagues.com/api/stage/tournaments) | List or filter tournaments. |
| GET | [/api/stage/tournaments/:id](https://stageleagues.com/api/stage/tournaments/:id) | Read one tournaments record. |
| POST | [/api/stage/tournaments](https://stageleagues.com/api/stage/tournaments) | Create a tournaments record. |
| PATCH | [/api/stage/tournaments/:id](https://stageleagues.com/api/stage/tournaments/:id) | Update one tournaments record. |
| DELETE | [/api/stage/tournaments/:id](https://stageleagues.com/api/stage/tournaments/:id) | Delete one tournaments record. |
| GET | [/api/stage/tournaments/:id/statistics/:category](https://stageleagues.com/api/stage/tournaments/:id/statistics/:category) | Read statistics for tournaments. |
| GET | [/api/stage/tournaments/:id/statistics](https://stageleagues.com/api/stage/tournaments/:id/statistics) | Read statistics for tournaments. |
| GET | [/api/stage/tournaments/:id/stages](https://stageleagues.com/api/stage/tournaments/:id/stages) | Read stages for tournaments. |
| GET | [/api/stage/tournaments/:id/stages/:stageKey/matches](https://stageleagues.com/api/stage/tournaments/:id/stages/:stageKey/matches) | Read stages / matches for tournaments. |
| GET | [/api/stage/tournaments/:id/stages/:stageKey](https://stageleagues.com/api/stage/tournaments/:id/stages/:stageKey) | Read stages for tournaments. |
| GET | [/api/stage/tournaments/:id/invite-link](https://stageleagues.com/api/stage/tournaments/:id/invite-link) | Read invite link for tournaments. |
| POST | [/api/stage/tournaments/:id/invite-link](https://stageleagues.com/api/stage/tournaments/:id/invite-link) | Perform invite link for tournaments. |

### /api/stage/competition-engine

Implementation: [competitionEngineController.js](../server/src/server/controllers/competitionEngineController.js).

| Method | API link | Function |
|---|---|---|
| GET | [/api/stage/competition-engine/instances](https://stageleagues.com/api/stage/competition-engine/instances) | Read instances for competition engine. |
| GET | [/api/stage/competition-engine/instances/:id](https://stageleagues.com/api/stage/competition-engine/instances/:id) | Read instances for competition engine. |
| GET | [/api/stage/competition-engine/instances/:id/participants](https://stageleagues.com/api/stage/competition-engine/instances/:id/participants) | Read instances / participants for competition engine. |
| GET | [/api/stage/competition-engine/instances/:id/fixtures](https://stageleagues.com/api/stage/competition-engine/instances/:id/fixtures) | Read instances / fixtures for competition engine. |
| POST | [/api/stage/competition-engine/instances/backfill](https://stageleagues.com/api/stage/competition-engine/instances/backfill) | Perform instances / backfill for competition engine. |
| POST | [/api/stage/competition-engine/fixtures/:id/match/create](https://stageleagues.com/api/stage/competition-engine/fixtures/:id/match/create) | Perform fixtures / match / create for competition engine. |
| POST | [/api/stage/competition-engine/matches/:id/results/submit](https://stageleagues.com/api/stage/competition-engine/matches/:id/results/submit) | Perform matches / results / submit for competition engine. |

### /api/stage/competition-views

Implementation: [competitionViewsController.js](../server/src/server/controllers/competitionViewsController.js).

| Method | API link | Function |
|---|---|---|
| GET | [/api/stage/competition-views/:kind/:id/statistics](https://stageleagues.com/api/stage/competition-views/:kind/:id/statistics) | Read statistics for competition views. |
| GET | [/api/stage/competition-views/:kind/:id](https://stageleagues.com/api/stage/competition-views/:kind/:id) | Read competition views for competition views. |
| POST | [/api/stage/competition-views/:kind/:id/reconcile](https://stageleagues.com/api/stage/competition-views/:kind/:id/reconcile) | Perform reconcile for competition views. |

### /api/stage/competition-instances

Implementation: [competitionEngineEntityController.js](../server/src/server/controllers/competitionEngineEntityController.js).

| Method | API link | Function |
|---|---|---|
| GET | [/api/stage/competition-instances](https://stageleagues.com/api/stage/competition-instances) | List or filter competition instances. |
| GET | [/api/stage/competition-instances/:id](https://stageleagues.com/api/stage/competition-instances/:id) | Read one competition instances record. |
| POST | [/api/stage/competition-instances](https://stageleagues.com/api/stage/competition-instances) | Create a competition instances record. |
| PATCH | [/api/stage/competition-instances/:id](https://stageleagues.com/api/stage/competition-instances/:id) | Update one competition instances record. |
| DELETE | [/api/stage/competition-instances/:id](https://stageleagues.com/api/stage/competition-instances/:id) | Delete one competition instances record. |

### /api/stage/competition-participants

Implementation: [competitionEngineEntityController.js](../server/src/server/controllers/competitionEngineEntityController.js).

| Method | API link | Function |
|---|---|---|
| GET | [/api/stage/competition-participants](https://stageleagues.com/api/stage/competition-participants) | List or filter competition participants. |
| GET | [/api/stage/competition-participants/:id](https://stageleagues.com/api/stage/competition-participants/:id) | Read one competition participants record. |
| POST | [/api/stage/competition-participants](https://stageleagues.com/api/stage/competition-participants) | Create a competition participants record. |
| PATCH | [/api/stage/competition-participants/:id](https://stageleagues.com/api/stage/competition-participants/:id) | Update one competition participants record. |
| DELETE | [/api/stage/competition-participants/:id](https://stageleagues.com/api/stage/competition-participants/:id) | Delete one competition participants record. |

### /api/stage/competition-schedule-proposals

Implementation: [competitionEngineEntityController.js](../server/src/server/controllers/competitionEngineEntityController.js).

| Method | API link | Function |
|---|---|---|
| GET | [/api/stage/competition-schedule-proposals](https://stageleagues.com/api/stage/competition-schedule-proposals) | List or filter competition schedule proposals. |
| GET | [/api/stage/competition-schedule-proposals/:id](https://stageleagues.com/api/stage/competition-schedule-proposals/:id) | Read one competition schedule proposals record. |
| POST | [/api/stage/competition-schedule-proposals](https://stageleagues.com/api/stage/competition-schedule-proposals) | Create a competition schedule proposals record. |
| PATCH | [/api/stage/competition-schedule-proposals/:id](https://stageleagues.com/api/stage/competition-schedule-proposals/:id) | Update one competition schedule proposals record. |
| DELETE | [/api/stage/competition-schedule-proposals/:id](https://stageleagues.com/api/stage/competition-schedule-proposals/:id) | Delete one competition schedule proposals record. |

### /api/stage/competition-result-submissions

Implementation: [competitionEngineEntityController.js](../server/src/server/controllers/competitionEngineEntityController.js).

| Method | API link | Function |
|---|---|---|
| GET | [/api/stage/competition-result-submissions](https://stageleagues.com/api/stage/competition-result-submissions) | List or filter competition result submissions. |
| GET | [/api/stage/competition-result-submissions/:id](https://stageleagues.com/api/stage/competition-result-submissions/:id) | Read one competition result submissions record. |
| POST | [/api/stage/competition-result-submissions](https://stageleagues.com/api/stage/competition-result-submissions) | Create a competition result submissions record. |
| PATCH | [/api/stage/competition-result-submissions/:id](https://stageleagues.com/api/stage/competition-result-submissions/:id) | Update one competition result submissions record. |
| DELETE | [/api/stage/competition-result-submissions/:id](https://stageleagues.com/api/stage/competition-result-submissions/:id) | Delete one competition result submissions record. |

### /api/stage/competition-phase-states

Implementation: [competitionEngineEntityController.js](../server/src/server/controllers/competitionEngineEntityController.js).

| Method | API link | Function |
|---|---|---|
| GET | [/api/stage/competition-phase-states](https://stageleagues.com/api/stage/competition-phase-states) | List or filter competition phase states. |
| GET | [/api/stage/competition-phase-states/:id](https://stageleagues.com/api/stage/competition-phase-states/:id) | Read one competition phase states record. |
| POST | [/api/stage/competition-phase-states](https://stageleagues.com/api/stage/competition-phase-states) | Create a competition phase states record. |
| PATCH | [/api/stage/competition-phase-states/:id](https://stageleagues.com/api/stage/competition-phase-states/:id) | Update one competition phase states record. |
| DELETE | [/api/stage/competition-phase-states/:id](https://stageleagues.com/api/stage/competition-phase-states/:id) | Delete one competition phase states record. |

### /api/stage/competition-payouts

Implementation: [competitionEngineEntityController.js](../server/src/server/controllers/competitionEngineEntityController.js).

| Method | API link | Function |
|---|---|---|
| GET | [/api/stage/competition-payouts](https://stageleagues.com/api/stage/competition-payouts) | List or filter competition payouts. |
| GET | [/api/stage/competition-payouts/:id](https://stageleagues.com/api/stage/competition-payouts/:id) | Read one competition payouts record. |
| POST | [/api/stage/competition-payouts](https://stageleagues.com/api/stage/competition-payouts) | Create a competition payouts record. |
| PATCH | [/api/stage/competition-payouts/:id](https://stageleagues.com/api/stage/competition-payouts/:id) | Update one competition payouts record. |
| DELETE | [/api/stage/competition-payouts/:id](https://stageleagues.com/api/stage/competition-payouts/:id) | Delete one competition payouts record. |

### /api/stage/international-tournaments

Implementation: [internationalTournamentController.js](../server/src/server/controllers/internationalTournamentController.js).

| Method | API link | Function |
|---|---|---|
| GET | [/api/stage/international-tournaments](https://stageleagues.com/api/stage/international-tournaments) | List or filter international tournaments. |
| POST | [/api/stage/international-tournaments](https://stageleagues.com/api/stage/international-tournaments) | Create a international tournaments record. |
| PATCH | [/api/stage/international-tournaments/:id](https://stageleagues.com/api/stage/international-tournaments/:id) | Update one international tournaments record. |
| GET | [/api/stage/international-tournaments/:id/elections](https://stageleagues.com/api/stage/international-tournaments/:id/elections) | Read elections for international tournaments. |
| GET | [/api/stage/international-tournaments/:id/elections/:electionId/owner-candidates](https://stageleagues.com/api/stage/international-tournaments/:id/elections/:electionId/owner-candidates) | Read elections / owner candidates for international tournaments. |
| POST | [/api/stage/international-tournaments/:id/open-voting](https://stageleagues.com/api/stage/international-tournaments/:id/open-voting) | Perform open voting for international tournaments. |
| POST | [/api/stage/international-tournaments/elections/:electionId/vote](https://stageleagues.com/api/stage/international-tournaments/elections/:electionId/vote) | Perform elections / vote for international tournaments. |
| POST | [/api/stage/international-tournaments/:id/close-voting](https://stageleagues.com/api/stage/international-tournaments/:id/close-voting) | Perform close voting for international tournaments. |
| GET | [/api/stage/international-tournaments/:id/eligible-players](https://stageleagues.com/api/stage/international-tournaments/:id/eligible-players) | Read eligible players for international tournaments. |
| GET | [/api/stage/international-tournaments/:id/squads/:countryCode](https://stageleagues.com/api/stage/international-tournaments/:id/squads/:countryCode) | Read squads for international tournaments. |
| POST | [/api/stage/international-tournaments/:id/squads](https://stageleagues.com/api/stage/international-tournaments/:id/squads) | Perform squads for international tournaments. |
| POST | [/api/stage/international-tournaments/:id/squads/:squadId/lock](https://stageleagues.com/api/stage/international-tournaments/:id/squads/:squadId/lock) | Perform squads / lock for international tournaments. |

### /api/stage/posts

Implementation: [postController.js](../server/src/server/controllers/postController.js).

| Method | API link | Function |
|---|---|---|
| GET | [/api/stage/posts](https://stageleagues.com/api/stage/posts) | List or filter posts. |
| POST | [/api/stage/posts/:id/like-toggle](https://stageleagues.com/api/stage/posts/:id/like-toggle) | Perform like toggle for posts. |
| GET | [/api/stage/posts/:id](https://stageleagues.com/api/stage/posts/:id) | Read one posts record. |
| POST | [/api/stage/posts](https://stageleagues.com/api/stage/posts) | Create a posts record. |
| POST | [/api/stage/posts/:id/like](https://stageleagues.com/api/stage/posts/:id/like) | Perform like for posts. |
| PATCH | [/api/stage/posts/:id](https://stageleagues.com/api/stage/posts/:id) | Update one posts record. |
| DELETE | [/api/stage/posts/:id](https://stageleagues.com/api/stage/posts/:id) | Delete one posts record. |

### /api/stage/comments

Implementation: [commentController.js](../server/src/server/controllers/commentController.js).

| Method | API link | Function |
|---|---|---|
| GET | [/api/stage/comments](https://stageleagues.com/api/stage/comments) | List or filter comments. |
| GET | [/api/stage/comments/:id](https://stageleagues.com/api/stage/comments/:id) | Read one comments record. |
| POST | [/api/stage/comments](https://stageleagues.com/api/stage/comments) | Create a comments record. |
| PATCH | [/api/stage/comments/:id](https://stageleagues.com/api/stage/comments/:id) | Update one comments record. |
| DELETE | [/api/stage/comments/:id](https://stageleagues.com/api/stage/comments/:id) | Delete one comments record. |

### /api/stage/match-player-stats

Implementation: [matchPlayerStatController.js](../server/src/server/controllers/matchPlayerStatController.js).

| Method | API link | Function |
|---|---|---|
| GET | [/api/stage/match-player-stats](https://stageleagues.com/api/stage/match-player-stats) | List or filter match player stats. |
| GET | [/api/stage/match-player-stats/:id](https://stageleagues.com/api/stage/match-player-stats/:id) | Read one match player stats record. |
| POST | [/api/stage/match-player-stats](https://stageleagues.com/api/stage/match-player-stats) | Create a match player stats record. |
| PATCH | [/api/stage/match-player-stats/:id](https://stageleagues.com/api/stage/match-player-stats/:id) | Update one match player stats record. |
| DELETE | [/api/stage/match-player-stats/:id](https://stageleagues.com/api/stage/match-player-stats/:id) | Delete one match player stats record. |

### /api/stage/notifications

Implementation: [notificationController.js](../server/src/server/controllers/notificationController.js).

| Method | API link | Function |
|---|---|---|
| GET | [/api/stage/notifications](https://stageleagues.com/api/stage/notifications) | List or filter notifications. |
| POST | [/api/stage/notifications/:id/read](https://stageleagues.com/api/stage/notifications/:id/read) | Perform read for notifications. |
| GET | [/api/stage/notifications/:id](https://stageleagues.com/api/stage/notifications/:id) | Read one notifications record. |
| POST | [/api/stage/notifications](https://stageleagues.com/api/stage/notifications) | Create a notifications record. |
| PATCH | [/api/stage/notifications/:id](https://stageleagues.com/api/stage/notifications/:id) | Update one notifications record. |
| DELETE | [/api/stage/notifications/:id](https://stageleagues.com/api/stage/notifications/:id) | Delete one notifications record. |

### /api/stage/player-contracts

Implementation: [playerContractController.js](../server/src/server/controllers/playerContractController.js).

| Method | API link | Function |
|---|---|---|
| GET | [/api/stage/player-contracts](https://stageleagues.com/api/stage/player-contracts) | List or filter player contracts. |
| GET | [/api/stage/player-contracts/:id](https://stageleagues.com/api/stage/player-contracts/:id) | Read one player contracts record. |
| POST | [/api/stage/player-contracts](https://stageleagues.com/api/stage/player-contracts) | Create a player contracts record. |
| POST | [/api/stage/player-contracts/:id/cancel](https://stageleagues.com/api/stage/player-contracts/:id/cancel) | Perform cancel for player contracts. |
| PATCH | [/api/stage/player-contracts/:id](https://stageleagues.com/api/stage/player-contracts/:id) | Update one player contracts record. |
| DELETE | [/api/stage/player-contracts/:id](https://stageleagues.com/api/stage/player-contracts/:id) | Delete one player contracts record. |

### /api/stage/player-loans

Implementation: [playerLoanController.js](../server/src/server/controllers/playerLoanController.js).

| Method | API link | Function |
|---|---|---|
| GET | [/api/stage/player-loans](https://stageleagues.com/api/stage/player-loans) | List or filter player loans. |
| GET | [/api/stage/player-loans/:id](https://stageleagues.com/api/stage/player-loans/:id) | Read one player loans record. |
| POST | [/api/stage/player-loans](https://stageleagues.com/api/stage/player-loans) | Create a player loans record. |
| POST | [/api/stage/player-loans/:id/parent-accept](https://stageleagues.com/api/stage/player-loans/:id/parent-accept) | Perform parent accept for player loans. |
| POST | [/api/stage/player-loans/:id/parent-reject](https://stageleagues.com/api/stage/player-loans/:id/parent-reject) | Perform parent reject for player loans. |
| POST | [/api/stage/player-loans/:id/player-accept](https://stageleagues.com/api/stage/player-loans/:id/player-accept) | Perform player accept for player loans. |
| POST | [/api/stage/player-loans/:id/player-reject](https://stageleagues.com/api/stage/player-loans/:id/player-reject) | Perform player reject for player loans. |
| POST | [/api/stage/player-loans/:id/cancel](https://stageleagues.com/api/stage/player-loans/:id/cancel) | Perform cancel for player loans. |
| POST | [/api/stage/player-loans/:id/recall](https://stageleagues.com/api/stage/player-loans/:id/recall) | Perform recall for player loans. |
| POST | [/api/stage/player-loans/:id/early-end](https://stageleagues.com/api/stage/player-loans/:id/early-end) | Perform early end for player loans. |
| POST | [/api/stage/player-loans/:id/early-end-accept](https://stageleagues.com/api/stage/player-loans/:id/early-end-accept) | Perform early end accept for player loans. |
| POST | [/api/stage/player-loans/:id/early-end-reject](https://stageleagues.com/api/stage/player-loans/:id/early-end-reject) | Perform early end reject for player loans. |
| POST | [/api/stage/player-loans/:id/exercise-option](https://stageleagues.com/api/stage/player-loans/:id/exercise-option) | Perform exercise option for player loans. |
| POST | [/api/stage/player-loans/:id/purchase-accept](https://stageleagues.com/api/stage/player-loans/:id/purchase-accept) | Perform purchase accept for player loans. |
| POST | [/api/stage/player-loans/:id/purchase-reject](https://stageleagues.com/api/stage/player-loans/:id/purchase-reject) | Perform purchase reject for player loans. |

### /api/stage/inbox-messages

Implementation: [inboxMessageController.js](../server/src/server/controllers/inboxMessageController.js).

| Method | API link | Function |
|---|---|---|
| GET | [/api/stage/inbox-messages](https://stageleagues.com/api/stage/inbox-messages) | List or filter inbox messages. |
| GET | [/api/stage/inbox-messages/:id](https://stageleagues.com/api/stage/inbox-messages/:id) | Read one inbox messages record. |
| POST | [/api/stage/inbox-messages](https://stageleagues.com/api/stage/inbox-messages) | Create a inbox messages record. |
| PATCH | [/api/stage/inbox-messages/:id](https://stageleagues.com/api/stage/inbox-messages/:id) | Update one inbox messages record. |
| DELETE | [/api/stage/inbox-messages/:id](https://stageleagues.com/api/stage/inbox-messages/:id) | Delete one inbox messages record. |

### /api/stage/predictions

Implementation: [predictionController.js](../server/src/server/controllers/predictionController.js).

| Method | API link | Function |
|---|---|---|
| GET | [/api/stage/predictions](https://stageleagues.com/api/stage/predictions) | List or filter predictions. |
| GET | [/api/stage/predictions/:id](https://stageleagues.com/api/stage/predictions/:id) | Read one predictions record. |
| POST | [/api/stage/predictions](https://stageleagues.com/api/stage/predictions) | Create a predictions record. |
| PATCH | [/api/stage/predictions/:id](https://stageleagues.com/api/stage/predictions/:id) | Update one predictions record. |
| DELETE | [/api/stage/predictions/:id](https://stageleagues.com/api/stage/predictions/:id) | Delete one predictions record. |

### /api/stage/direct-messages

Implementation: [directMessageController.js](../server/src/server/controllers/directMessageController.js).

| Method | API link | Function |
|---|---|---|
| GET | [/api/stage/direct-messages](https://stageleagues.com/api/stage/direct-messages) | List or filter direct messages. |
| GET | [/api/stage/direct-messages/:id](https://stageleagues.com/api/stage/direct-messages/:id) | Read one direct messages record. |
| POST | [/api/stage/direct-messages](https://stageleagues.com/api/stage/direct-messages) | Create a direct messages record. |
| PATCH | [/api/stage/direct-messages/:id](https://stageleagues.com/api/stage/direct-messages/:id) | Update one direct messages record. |
| DELETE | [/api/stage/direct-messages/:id](https://stageleagues.com/api/stage/direct-messages/:id) | Delete one direct messages record. |

### /api/stage/stc-transactions

Implementation: [stcTransactionController.js](../server/src/server/controllers/stcTransactionController.js).

| Method | API link | Function |
|---|---|---|
| GET | [/api/stage/stc-transactions](https://stageleagues.com/api/stage/stc-transactions) | List or filter stc transactions. |
| GET | [/api/stage/stc-transactions/:id](https://stageleagues.com/api/stage/stc-transactions/:id) | Read one stc transactions record. |
| POST | [/api/stage/stc-transactions](https://stageleagues.com/api/stage/stc-transactions) | Create a stc transactions record. |
| PATCH | [/api/stage/stc-transactions/:id](https://stageleagues.com/api/stage/stc-transactions/:id) | Update one stc transactions record. |
| DELETE | [/api/stage/stc-transactions/:id](https://stageleagues.com/api/stage/stc-transactions/:id) | Delete one stc transactions record. |

### /api/stage/shirt-sales

Implementation: [shirtSaleController.js](../server/src/server/controllers/shirtSaleController.js).

| Method | API link | Function |
|---|---|---|
| GET | [/api/stage/shirt-sales](https://stageleagues.com/api/stage/shirt-sales) | List or filter shirt sales. |
| GET | [/api/stage/shirt-sales/:id](https://stageleagues.com/api/stage/shirt-sales/:id) | Read one shirt sales record. |
| POST | [/api/stage/shirt-sales](https://stageleagues.com/api/stage/shirt-sales) | Create a shirt sales record. |
| PATCH | [/api/stage/shirt-sales/:id](https://stageleagues.com/api/stage/shirt-sales/:id) | Update one shirt sales record. |
| DELETE | [/api/stage/shirt-sales/:id](https://stageleagues.com/api/stage/shirt-sales/:id) | Delete one shirt sales record. |

### /api/stage/dressing-rooms

Implementation: [dressingRoomController.js](../server/src/server/controllers/dressingRoomController.js).

| Method | API link | Function |
|---|---|---|
| GET | [/api/stage/dressing-rooms](https://stageleagues.com/api/stage/dressing-rooms) | List or filter dressing rooms. |
| GET | [/api/stage/dressing-rooms/:id](https://stageleagues.com/api/stage/dressing-rooms/:id) | Read one dressing rooms record. |
| POST | [/api/stage/dressing-rooms](https://stageleagues.com/api/stage/dressing-rooms) | Create a dressing rooms record. |
| PATCH | [/api/stage/dressing-rooms/:id](https://stageleagues.com/api/stage/dressing-rooms/:id) | Update one dressing rooms record. |
| DELETE | [/api/stage/dressing-rooms/:id](https://stageleagues.com/api/stage/dressing-rooms/:id) | Delete one dressing rooms record. |

### /api/stage/join-requests

Implementation: [joinRequestController.js](../server/src/server/controllers/joinRequestController.js).

| Method | API link | Function |
|---|---|---|
| GET | [/api/stage/join-requests](https://stageleagues.com/api/stage/join-requests) | List or filter join requests. |
| GET | [/api/stage/join-requests/:id](https://stageleagues.com/api/stage/join-requests/:id) | Read one join requests record. |
| POST | [/api/stage/join-requests](https://stageleagues.com/api/stage/join-requests) | Create a join requests record. |
| PATCH | [/api/stage/join-requests/:id](https://stageleagues.com/api/stage/join-requests/:id) | Update one join requests record. |
| DELETE | [/api/stage/join-requests/:id](https://stageleagues.com/api/stage/join-requests/:id) | Delete one join requests record. |

### /api/stage/follows

Implementation: [followController.js](../server/src/server/controllers/followController.js).

| Method | API link | Function |
|---|---|---|
| GET | [/api/stage/follows](https://stageleagues.com/api/stage/follows) | List or filter follows. |
| GET | [/api/stage/follows/:id](https://stageleagues.com/api/stage/follows/:id) | Read one follows record. |
| POST | [/api/stage/follows](https://stageleagues.com/api/stage/follows) | Create a follows record. |
| DELETE | [/api/stage/follows/:id](https://stageleagues.com/api/stage/follows/:id) | Delete one follows record. |

### /api/stage/lifestyle-items

Implementation: [lifestyleItemController.js](../server/src/server/controllers/lifestyleItemController.js).

| Method | API link | Function |
|---|---|---|
| GET | [/api/stage/lifestyle-items](https://stageleagues.com/api/stage/lifestyle-items) | List or filter lifestyle items. |
| GET | [/api/stage/lifestyle-items/:id](https://stageleagues.com/api/stage/lifestyle-items/:id) | Read one lifestyle items record. |
| POST | [/api/stage/lifestyle-items](https://stageleagues.com/api/stage/lifestyle-items) | Create a lifestyle items record. |
| PATCH | [/api/stage/lifestyle-items/:id](https://stageleagues.com/api/stage/lifestyle-items/:id) | Update one lifestyle items record. |
| DELETE | [/api/stage/lifestyle-items/:id](https://stageleagues.com/api/stage/lifestyle-items/:id) | Delete one lifestyle items record. |

### /api/stage/lifestyle-purchases

Implementation: [lifestylePurchaseController.js](../server/src/server/controllers/lifestylePurchaseController.js).

| Method | API link | Function |
|---|---|---|
| GET | [/api/stage/lifestyle-purchases](https://stageleagues.com/api/stage/lifestyle-purchases) | List or filter lifestyle purchases. |
| GET | [/api/stage/lifestyle-purchases/:id](https://stageleagues.com/api/stage/lifestyle-purchases/:id) | Read one lifestyle purchases record. |
| POST | [/api/stage/lifestyle-purchases](https://stageleagues.com/api/stage/lifestyle-purchases) | Create a lifestyle purchases record. |
| PATCH | [/api/stage/lifestyle-purchases/:id](https://stageleagues.com/api/stage/lifestyle-purchases/:id) | Update one lifestyle purchases record. |
| DELETE | [/api/stage/lifestyle-purchases/:id](https://stageleagues.com/api/stage/lifestyle-purchases/:id) | Delete one lifestyle purchases record. |

### /api/stage/user-purchases

Implementation: [userPurchaseController.js](../server/src/server/controllers/userPurchaseController.js).

| Method | API link | Function |
|---|---|---|
| GET | [/api/stage/user-purchases](https://stageleagues.com/api/stage/user-purchases) | List or filter user purchases. |
| GET | [/api/stage/user-purchases/:id](https://stageleagues.com/api/stage/user-purchases/:id) | Read one user purchases record. |
| POST | [/api/stage/user-purchases](https://stageleagues.com/api/stage/user-purchases) | Create a user purchases record. |
| PATCH | [/api/stage/user-purchases/:id](https://stageleagues.com/api/stage/user-purchases/:id) | Update one user purchases record. |
| DELETE | [/api/stage/user-purchases/:id](https://stageleagues.com/api/stage/user-purchases/:id) | Delete one user purchases record. |

### /api/stage/trophy-items

Implementation: [trophyItemController.js](../server/src/server/controllers/trophyItemController.js).

| Method | API link | Function |
|---|---|---|
| GET | [/api/stage/trophy-items](https://stageleagues.com/api/stage/trophy-items) | List or filter trophy items. |
| GET | [/api/stage/trophy-items/:id](https://stageleagues.com/api/stage/trophy-items/:id) | Read one trophy items record. |
| POST | [/api/stage/trophy-items](https://stageleagues.com/api/stage/trophy-items) | Create a trophy items record. |
| PATCH | [/api/stage/trophy-items/:id](https://stageleagues.com/api/stage/trophy-items/:id) | Update one trophy items record. |
| DELETE | [/api/stage/trophy-items/:id](https://stageleagues.com/api/stage/trophy-items/:id) | Delete one trophy items record. |

### /api/stage/trophy-placements

Implementation: [trophyPlacementController.js](../server/src/server/controllers/trophyPlacementController.js).

| Method | API link | Function |
|---|---|---|
| GET | [/api/stage/trophy-placements](https://stageleagues.com/api/stage/trophy-placements) | List or filter trophy placements. |
| GET | [/api/stage/trophy-placements/:id](https://stageleagues.com/api/stage/trophy-placements/:id) | Read one trophy placements record. |
| POST | [/api/stage/trophy-placements](https://stageleagues.com/api/stage/trophy-placements) | Create a trophy placements record. |
| PATCH | [/api/stage/trophy-placements/:id](https://stageleagues.com/api/stage/trophy-placements/:id) | Update one trophy placements record. |
| DELETE | [/api/stage/trophy-placements/:id](https://stageleagues.com/api/stage/trophy-placements/:id) | Delete one trophy placements record. |

### /api/stage/chat-messages

Implementation: [chatMessageController.js](../server/src/server/controllers/chatMessageController.js).

| Method | API link | Function |
|---|---|---|
| GET | [/api/stage/chat-messages](https://stageleagues.com/api/stage/chat-messages) | List or filter chat messages. |
| GET | [/api/stage/chat-messages/:id](https://stageleagues.com/api/stage/chat-messages/:id) | Read one chat messages record. |
| POST | [/api/stage/chat-messages](https://stageleagues.com/api/stage/chat-messages) | Create a chat messages record. |
| PATCH | [/api/stage/chat-messages/:id](https://stageleagues.com/api/stage/chat-messages/:id) | Update one chat messages record. |
| DELETE | [/api/stage/chat-messages/:id](https://stageleagues.com/api/stage/chat-messages/:id) | Delete one chat messages record. |

### /api/stage/chat-reads

Implementation: [chatReadController.js](../server/src/server/controllers/chatReadController.js).

| Method | API link | Function |
|---|---|---|
| GET | [/api/stage/chat-reads](https://stageleagues.com/api/stage/chat-reads) | List or filter chat reads. |
| GET | [/api/stage/chat-reads/unread-counts](https://stageleagues.com/api/stage/chat-reads/unread-counts) | Read unread counts for chat reads. |
| POST | [/api/stage/chat-reads/mark-read](https://stageleagues.com/api/stage/chat-reads/mark-read) | Perform mark read for chat reads. |

### /api/stage/news-items

Implementation: [newsItemController.js](../server/src/server/controllers/newsItemController.js).

| Method | API link | Function |
|---|---|---|
| GET | [/api/stage/news-items](https://stageleagues.com/api/stage/news-items) | List or filter news items. |
| GET | [/api/stage/news-items/:id](https://stageleagues.com/api/stage/news-items/:id) | Read one news items record. |
| POST | [/api/stage/news-items](https://stageleagues.com/api/stage/news-items) | Create a news items record. |
| PATCH | [/api/stage/news-items/:id](https://stageleagues.com/api/stage/news-items/:id) | Update one news items record. |
| DELETE | [/api/stage/news-items/:id](https://stageleagues.com/api/stage/news-items/:id) | Delete one news items record. |

### /api/stage/news-desks

Implementation: [newsDeskController.js](../server/src/server/controllers/newsDeskController.js).

| Method | API link | Function |
|---|---|---|
| GET | [/api/stage/news-desks/:section](https://stageleagues.com/api/stage/news-desks/:section) | Read news desks for news desks. |

### /api/stage/mercato-transfers

Implementation: [mercatoTransferController.js](../server/src/server/controllers/mercatoTransferController.js).

| Method | API link | Function |
|---|---|---|
| GET | [/api/stage/mercato-transfers](https://stageleagues.com/api/stage/mercato-transfers) | List or filter mercato transfers. |
| GET | [/api/stage/mercato-transfers/desk](https://stageleagues.com/api/stage/mercato-transfers/desk) | Read desk for mercato transfers. |
| GET | [/api/stage/mercato-transfers/clubs/:clubId](https://stageleagues.com/api/stage/mercato-transfers/clubs/:clubId) | Read clubs for mercato transfers. |
| GET | [/api/stage/mercato-transfers/players/:playerId](https://stageleagues.com/api/stage/mercato-transfers/players/:playerId) | Read players for mercato transfers. |
| GET | [/api/stage/mercato-transfers/:id](https://stageleagues.com/api/stage/mercato-transfers/:id) | Read one mercato transfers record. |
| POST | [/api/stage/mercato-transfers](https://stageleagues.com/api/stage/mercato-transfers) | Create a mercato transfers record. |
| POST | [/api/stage/mercato-transfers/:id/status](https://stageleagues.com/api/stage/mercato-transfers/:id/status) | Perform status for mercato transfers. |

### /api/stage/live-matches

Implementation: [liveMatchController.js](../server/src/server/controllers/liveMatchController.js).

| Method | API link | Function |
|---|---|---|
| GET | [/api/stage/live-matches](https://stageleagues.com/api/stage/live-matches) | List or filter live matches. |
| GET | [/api/stage/live-matches/:id](https://stageleagues.com/api/stage/live-matches/:id) | Read one live matches record. |
| POST | [/api/stage/live-matches](https://stageleagues.com/api/stage/live-matches) | Create a live matches record. |
| PATCH | [/api/stage/live-matches/:id](https://stageleagues.com/api/stage/live-matches/:id) | Update one live matches record. |
| DELETE | [/api/stage/live-matches/:id](https://stageleagues.com/api/stage/live-matches/:id) | Delete one live matches record. |

### /api/stage/landing-page-contents

Implementation: [landingPageContentController.js](../server/src/server/controllers/landingPageContentController.js).

| Method | API link | Function |
|---|---|---|
| GET | [/api/stage/landing-page-contents](https://stageleagues.com/api/stage/landing-page-contents) | List or filter landing page contents. |
| GET | [/api/stage/landing-page-contents/:id](https://stageleagues.com/api/stage/landing-page-contents/:id) | Read one landing page contents record. |
| POST | [/api/stage/landing-page-contents](https://stageleagues.com/api/stage/landing-page-contents) | Create a landing page contents record. |
| PATCH | [/api/stage/landing-page-contents/:id](https://stageleagues.com/api/stage/landing-page-contents/:id) | Update one landing page contents record. |
| DELETE | [/api/stage/landing-page-contents/:id](https://stageleagues.com/api/stage/landing-page-contents/:id) | Delete one landing page contents record. |

### /api/stage/home-page-contents

Implementation: [homePageContentController.js](../server/src/server/controllers/homePageContentController.js).

| Method | API link | Function |
|---|---|---|
| GET | [/api/stage/home-page-contents](https://stageleagues.com/api/stage/home-page-contents) | List or filter home page contents. |
| GET | [/api/stage/home-page-contents/:id](https://stageleagues.com/api/stage/home-page-contents/:id) | Read one home page contents record. |
| POST | [/api/stage/home-page-contents](https://stageleagues.com/api/stage/home-page-contents) | Create a home page contents record. |
| PATCH | [/api/stage/home-page-contents/:id](https://stageleagues.com/api/stage/home-page-contents/:id) | Update one home page contents record. |
| DELETE | [/api/stage/home-page-contents/:id](https://stageleagues.com/api/stage/home-page-contents/:id) | Delete one home page contents record. |

### /api/stage/faq-items

Implementation: [faqItemController.js](../server/src/server/controllers/faqItemController.js).

| Method | API link | Function |
|---|---|---|
| GET | [/api/stage/faq-items](https://stageleagues.com/api/stage/faq-items) | List or filter faq items. |
| GET | [/api/stage/faq-items/:id](https://stageleagues.com/api/stage/faq-items/:id) | Read one faq items record. |
| POST | [/api/stage/faq-items](https://stageleagues.com/api/stage/faq-items) | Create a faq items record. |
| PATCH | [/api/stage/faq-items/:id](https://stageleagues.com/api/stage/faq-items/:id) | Update one faq items record. |
| DELETE | [/api/stage/faq-items/:id](https://stageleagues.com/api/stage/faq-items/:id) | Delete one faq items record. |

### /api/stage/landing-configs

Implementation: [landingConfigController.js](../server/src/server/controllers/landingConfigController.js).

| Method | API link | Function |
|---|---|---|
| GET | [/api/stage/landing-configs](https://stageleagues.com/api/stage/landing-configs) | List or filter landing configs. |
| GET | [/api/stage/landing-configs/:id](https://stageleagues.com/api/stage/landing-configs/:id) | Read one landing configs record. |
| POST | [/api/stage/landing-configs](https://stageleagues.com/api/stage/landing-configs) | Create a landing configs record. |
| PATCH | [/api/stage/landing-configs/:id](https://stageleagues.com/api/stage/landing-configs/:id) | Update one landing configs record. |
| DELETE | [/api/stage/landing-configs/:id](https://stageleagues.com/api/stage/landing-configs/:id) | Delete one landing configs record. |

### /api/stage/store-configs

Implementation: [storeConfigController.js](../server/src/server/controllers/storeConfigController.js).

| Method | API link | Function |
|---|---|---|
| GET | [/api/stage/store-configs](https://stageleagues.com/api/stage/store-configs) | List or filter store configs. |
| GET | [/api/stage/store-configs/:id](https://stageleagues.com/api/stage/store-configs/:id) | Read one store configs record. |
| POST | [/api/stage/store-configs](https://stageleagues.com/api/stage/store-configs) | Create a store configs record. |
| PATCH | [/api/stage/store-configs/:id](https://stageleagues.com/api/stage/store-configs/:id) | Update one store configs record. |
| DELETE | [/api/stage/store-configs/:id](https://stageleagues.com/api/stage/store-configs/:id) | Delete one store configs record. |

### /api/stage/transfer-windows

Implementation: [transferWindowController.js](../server/src/server/controllers/transferWindowController.js).

| Method | API link | Function |
|---|---|---|
| GET | [/api/stage/transfer-windows](https://stageleagues.com/api/stage/transfer-windows) | List or filter transfer windows. |
| GET | [/api/stage/transfer-windows/:id](https://stageleagues.com/api/stage/transfer-windows/:id) | Read one transfer windows record. |
| POST | [/api/stage/transfer-windows](https://stageleagues.com/api/stage/transfer-windows) | Create a transfer windows record. |
| PATCH | [/api/stage/transfer-windows/:id](https://stageleagues.com/api/stage/transfer-windows/:id) | Update one transfer windows record. |
| DELETE | [/api/stage/transfer-windows/:id](https://stageleagues.com/api/stage/transfer-windows/:id) | Delete one transfer windows record. |

### /api/stage/fixture-admin-actions

Implementation: [fixtureAdminActionController.js](../server/src/server/controllers/fixtureAdminActionController.js).

| Method | API link | Function |
|---|---|---|
| GET | [/api/stage/fixture-admin-actions](https://stageleagues.com/api/stage/fixture-admin-actions) | List or filter fixture admin actions. |
| GET | [/api/stage/fixture-admin-actions/:id](https://stageleagues.com/api/stage/fixture-admin-actions/:id) | Read one fixture admin actions record. |
| DELETE | [/api/stage/fixture-admin-actions/:id](https://stageleagues.com/api/stage/fixture-admin-actions/:id) | Delete one fixture admin actions record. |
| POST | [/api/stage/fixture-admin-actions/force-schedule](https://stageleagues.com/api/stage/fixture-admin-actions/force-schedule) | Administratively force a fixture schedule. |
| POST | [/api/stage/fixture-admin-actions/declare-forfeit](https://stageleagues.com/api/stage/fixture-admin-actions/declare-forfeit) | Declare a fixture forfeit. |
| POST | [/api/stage/fixture-admin-actions/flag-review](https://stageleagues.com/api/stage/fixture-admin-actions/flag-review) | Flag a fixture for administrator review. |

### /api/stage/reward-configs

Implementation: [rewardConfigController.js](../server/src/server/controllers/rewardConfigController.js).

| Method | API link | Function |
|---|---|---|
| GET | [/api/stage/reward-configs](https://stageleagues.com/api/stage/reward-configs) | List or filter reward configs. |
| GET | [/api/stage/reward-configs/:id](https://stageleagues.com/api/stage/reward-configs/:id) | Read one reward configs record. |
| POST | [/api/stage/reward-configs](https://stageleagues.com/api/stage/reward-configs) | Create a reward configs record. |
| PATCH | [/api/stage/reward-configs/:id](https://stageleagues.com/api/stage/reward-configs/:id) | Update one reward configs record. |
| DELETE | [/api/stage/reward-configs/:id](https://stageleagues.com/api/stage/reward-configs/:id) | Delete one reward configs record. |

### /api/stage/club-achievements

Implementation: [clubAchievementController.js](../server/src/server/controllers/clubAchievementController.js).

| Method | API link | Function |
|---|---|---|
| GET | [/api/stage/club-achievements](https://stageleagues.com/api/stage/club-achievements) | List or filter club achievements. |
| GET | [/api/stage/club-achievements/:id](https://stageleagues.com/api/stage/club-achievements/:id) | Read one club achievements record. |
| POST | [/api/stage/club-achievements](https://stageleagues.com/api/stage/club-achievements) | Create a club achievements record. |
| PATCH | [/api/stage/club-achievements/:id](https://stageleagues.com/api/stage/club-achievements/:id) | Update one club achievements record. |
| DELETE | [/api/stage/club-achievements/:id](https://stageleagues.com/api/stage/club-achievements/:id) | Delete one club achievements record. |

### /api/stage/player-achievements

Implementation: [playerAchievementController.js](../server/src/server/controllers/playerAchievementController.js).

| Method | API link | Function |
|---|---|---|
| GET | [/api/stage/player-achievements](https://stageleagues.com/api/stage/player-achievements) | List or filter player achievements. |
| GET | [/api/stage/player-achievements/:id](https://stageleagues.com/api/stage/player-achievements/:id) | Read one player achievements record. |
| POST | [/api/stage/player-achievements](https://stageleagues.com/api/stage/player-achievements) | Create a player achievements record. |
| PATCH | [/api/stage/player-achievements/:id](https://stageleagues.com/api/stage/player-achievements/:id) | Update one player achievements record. |
| DELETE | [/api/stage/player-achievements/:id](https://stageleagues.com/api/stage/player-achievements/:id) | Delete one player achievements record. |

### /api/stage/player-card-backgrounds

Implementation: [playerCardBackgroundController.js](../server/src/server/controllers/playerCardBackgroundController.js).

| Method | API link | Function |
|---|---|---|
| GET | [/api/stage/player-card-backgrounds](https://stageleagues.com/api/stage/player-card-backgrounds) | List or filter player card backgrounds. |
| GET | [/api/stage/player-card-backgrounds/:id](https://stageleagues.com/api/stage/player-card-backgrounds/:id) | Read one player card backgrounds record. |
| POST | [/api/stage/player-card-backgrounds](https://stageleagues.com/api/stage/player-card-backgrounds) | Create a player card backgrounds record. |
| PATCH | [/api/stage/player-card-backgrounds/:id](https://stageleagues.com/api/stage/player-card-backgrounds/:id) | Update one player card backgrounds record. |
| DELETE | [/api/stage/player-card-backgrounds/:id](https://stageleagues.com/api/stage/player-card-backgrounds/:id) | Delete one player card backgrounds record. |

### /api/stage/player-stc-transactions

Implementation: [playerStcTransactionController.js](../server/src/server/controllers/playerStcTransactionController.js).

| Method | API link | Function |
|---|---|---|
| GET | [/api/stage/player-stc-transactions](https://stageleagues.com/api/stage/player-stc-transactions) | List or filter player stc transactions. |
| GET | [/api/stage/player-stc-transactions/:id](https://stageleagues.com/api/stage/player-stc-transactions/:id) | Read one player stc transactions record. |
| POST | [/api/stage/player-stc-transactions](https://stageleagues.com/api/stage/player-stc-transactions) | Create a player stc transactions record. |
| PATCH | [/api/stage/player-stc-transactions/:id](https://stageleagues.com/api/stage/player-stc-transactions/:id) | Update one player stc transactions record. |
| DELETE | [/api/stage/player-stc-transactions/:id](https://stageleagues.com/api/stage/player-stc-transactions/:id) | Delete one player stc transactions record. |

### /api/stage/player-identity-claims

Implementation: [playerIdentityClaimController.js](../server/src/server/controllers/playerIdentityClaimController.js).

| Method | API link | Function |
|---|---|---|
| GET | [/api/stage/player-identity-claims](https://stageleagues.com/api/stage/player-identity-claims) | List or filter player identity claims. |
| GET | [/api/stage/player-identity-claims/:id](https://stageleagues.com/api/stage/player-identity-claims/:id) | Read one player identity claims record. |
| POST | [/api/stage/player-identity-claims](https://stageleagues.com/api/stage/player-identity-claims) | Create a player identity claims record. |
| PATCH | [/api/stage/player-identity-claims/:id](https://stageleagues.com/api/stage/player-identity-claims/:id) | Update one player identity claims record. |
| DELETE | [/api/stage/player-identity-claims/:id](https://stageleagues.com/api/stage/player-identity-claims/:id) | Delete one player identity claims record. |

### /api/stage/player-showcase-videos

Implementation: [playerShowcaseVideoController.js](../server/src/server/controllers/playerShowcaseVideoController.js).

| Method | API link | Function |
|---|---|---|
| GET | [/api/stage/player-showcase-videos](https://stageleagues.com/api/stage/player-showcase-videos) | List or filter player showcase videos. |
| GET | [/api/stage/player-showcase-videos/scouting](https://stageleagues.com/api/stage/player-showcase-videos/scouting) | Read scouting for player showcase videos. |
| POST | [/api/stage/player-showcase-videos/position](https://stageleagues.com/api/stage/player-showcase-videos/position) | Perform position for player showcase videos. |
| POST | [/api/stage/player-showcase-videos/:id/like](https://stageleagues.com/api/stage/player-showcase-videos/:id/like) | Perform like for player showcase videos. |
| GET | [/api/stage/player-showcase-videos/:id/comments](https://stageleagues.com/api/stage/player-showcase-videos/:id/comments) | Read comments for player showcase videos. |
| POST | [/api/stage/player-showcase-videos/:id/comments](https://stageleagues.com/api/stage/player-showcase-videos/:id/comments) | Perform comments for player showcase videos. |
| GET | [/api/stage/player-showcase-videos/:id](https://stageleagues.com/api/stage/player-showcase-videos/:id) | Read one player showcase videos record. |
| POST | [/api/stage/player-showcase-videos](https://stageleagues.com/api/stage/player-showcase-videos) | Create a player showcase videos record. |
| PATCH | [/api/stage/player-showcase-videos/:id](https://stageleagues.com/api/stage/player-showcase-videos/:id) | Update one player showcase videos record. |
| DELETE | [/api/stage/player-showcase-videos/:id](https://stageleagues.com/api/stage/player-showcase-videos/:id) | Delete one player showcase videos record. |

### /api/stage/scouting-reports

Implementation: [scoutingReportController.js](../server/src/server/controllers/scoutingReportController.js).

| Method | API link | Function |
|---|---|---|
| GET | [/api/stage/scouting-reports](https://stageleagues.com/api/stage/scouting-reports) | List or filter scouting reports. |
| GET | [/api/stage/scouting-reports/:id](https://stageleagues.com/api/stage/scouting-reports/:id) | Read one scouting reports record. |
| POST | [/api/stage/scouting-reports](https://stageleagues.com/api/stage/scouting-reports) | Create a scouting reports record. |
| PATCH | [/api/stage/scouting-reports/:id](https://stageleagues.com/api/stage/scouting-reports/:id) | Update one scouting reports record. |
| POST | [/api/stage/scouting-reports/:id/vote](https://stageleagues.com/api/stage/scouting-reports/:id/vote) | Perform vote for scouting reports. |
| POST | [/api/stage/scouting-reports/:id/mark-offered](https://stageleagues.com/api/stage/scouting-reports/:id/mark-offered) | Perform mark offered for scouting reports. |
| POST | [/api/stage/scouting-reports/:id/archive](https://stageleagues.com/api/stage/scouting-reports/:id/archive) | Perform archive for scouting reports. |
| DELETE | [/api/stage/scouting-reports/:id](https://stageleagues.com/api/stage/scouting-reports/:id) | Delete one scouting reports record. |

### /api/stage/rankings

Implementation: [rankingController.js](../server/src/server/controllers/rankingController.js).

| Method | API link | Function |
|---|---|---|
| GET | [/api/stage/rankings/summary](https://stageleagues.com/api/stage/rankings/summary) | Read ranking totals and summary. |
| GET | [/api/stage/rankings/clubs](https://stageleagues.com/api/stage/rankings/clubs) | Read clubs for rankings. |
| GET | [/api/stage/rankings/players](https://stageleagues.com/api/stage/rankings/players) | Read players for rankings. |
| POST | [/api/stage/rankings/rebuild](https://stageleagues.com/api/stage/rankings/rebuild) | Rebuild the rankings. |

### /api/stage/admin-analytics

Implementation: [adminAnalyticsController.js](../server/src/server/controllers/adminAnalyticsController.js).

| Method | API link | Function |
|---|---|---|
| GET | [/api/stage/admin-analytics](https://stageleagues.com/api/stage/admin-analytics) | Read administrator overview, usage trends and tournament health. |

### /api/stage/match-archive

Implementation: [matchArchiveController.js](../server/src/server/controllers/matchArchiveController.js).

| Method | API link | Function |
|---|---|---|
| GET | [/api/stage/match-archive](https://stageleagues.com/api/stage/match-archive) | List or filter match archive. |
| GET | [/api/stage/match-archive/:id](https://stageleagues.com/api/stage/match-archive/:id) | Read one match archive record. |
| POST | [/api/stage/match-archive/:id/correct-score](https://stageleagues.com/api/stage/match-archive/:id/correct-score) | Perform correct score for match archive. |

### /api/stage/admin-mail

Implementation: [adminMailController.js](../server/src/server/controllers/adminMailController.js).

| Method | API link | Function |
|---|---|---|
| GET | [/api/stage/admin-mail/audiences](https://stageleagues.com/api/stage/admin-mail/audiences) | Read audiences for admin mail. |
| GET | [/api/stage/admin-mail/recipients](https://stageleagues.com/api/stage/admin-mail/recipients) | Read recipients for admin mail. |
| GET | [/api/stage/admin-mail/contacts](https://stageleagues.com/api/stage/admin-mail/contacts) | Read contacts for admin mail. |
| GET | [/api/stage/admin-mail/status](https://stageleagues.com/api/stage/admin-mail/status) | Read status for admin mail. |
| GET | [/api/stage/admin-mail](https://stageleagues.com/api/stage/admin-mail) | List or filter admin mail. |
| GET | [/api/stage/admin-mail/:id](https://stageleagues.com/api/stage/admin-mail/:id) | Read one admin mail record. |
| POST | [/api/stage/admin-mail/sync](https://stageleagues.com/api/stage/admin-mail/sync) | Perform sync for admin mail. |
| POST | [/api/stage/admin-mail/drafts](https://stageleagues.com/api/stage/admin-mail/drafts) | Perform drafts for admin mail. |
| DELETE | [/api/stage/admin-mail/drafts/:id](https://stageleagues.com/api/stage/admin-mail/drafts/:id) | Remove drafts for admin mail. |
| POST | [/api/stage/admin-mail/send](https://stageleagues.com/api/stage/admin-mail/send) | Perform send for admin mail. |
| POST | [/api/stage/admin-mail/trash/empty](https://stageleagues.com/api/stage/admin-mail/trash/empty) | Perform trash / empty for admin mail. |
| PATCH | [/api/stage/admin-mail/:id](https://stageleagues.com/api/stage/admin-mail/:id) | Update one admin mail record. |
| DELETE | [/api/stage/admin-mail/:id/permanent](https://stageleagues.com/api/stage/admin-mail/:id/permanent) | Remove permanent for admin mail. |
| DELETE | [/api/stage/admin-mail/:id](https://stageleagues.com/api/stage/admin-mail/:id) | Delete one admin mail record. |

### /api/stage/club-applicants

Implementation: [clubApplicantController.js](../server/src/server/controllers/clubApplicantController.js).

| Method | API link | Function |
|---|---|---|
| GET | [/api/stage/club-applicants](https://stageleagues.com/api/stage/club-applicants) | List or filter club applicants. |
| GET | [/api/stage/club-applicants/:id](https://stageleagues.com/api/stage/club-applicants/:id) | Read one club applicants record. |
| POST | [/api/stage/club-applicants](https://stageleagues.com/api/stage/club-applicants) | Create a club applicants record. |
| PATCH | [/api/stage/club-applicants/:id](https://stageleagues.com/api/stage/club-applicants/:id) | Update one club applicants record. |
| DELETE | [/api/stage/club-applicants/:id](https://stageleagues.com/api/stage/club-applicants/:id) | Delete one club applicants record. |
| POST | [/api/stage/club-applicants/:id/review](https://stageleagues.com/api/stage/club-applicants/:id/review) | Perform review for club applicants. |
| POST | [/api/stage/club-applicants/:id/decline](https://stageleagues.com/api/stage/club-applicants/:id/decline) | Perform decline for club applicants. |
| POST | [/api/stage/club-applicants/:id/withdraw](https://stageleagues.com/api/stage/club-applicants/:id/withdraw) | Perform withdraw for club applicants. |
| POST | [/api/stage/club-applicants/:id/offer-trial](https://stageleagues.com/api/stage/club-applicants/:id/offer-trial) | Perform offer trial for club applicants. |
| POST | [/api/stage/club-applicants/:id/offer-contract](https://stageleagues.com/api/stage/club-applicants/:id/offer-contract) | Perform offer contract for club applicants. |

### /api/stage/club-memberships

Implementation: [clubMembershipController.js](../server/src/server/controllers/clubMembershipController.js).

| Method | API link | Function |
|---|---|---|
| GET | [/api/stage/club-memberships](https://stageleagues.com/api/stage/club-memberships) | List or filter club memberships. |
| GET | [/api/stage/club-memberships/:id](https://stageleagues.com/api/stage/club-memberships/:id) | Read one club memberships record. |
| POST | [/api/stage/club-memberships](https://stageleagues.com/api/stage/club-memberships) | Create a club memberships record. |
| PATCH | [/api/stage/club-memberships/:id](https://stageleagues.com/api/stage/club-memberships/:id) | Update one club memberships record. |
| DELETE | [/api/stage/club-memberships/:id](https://stageleagues.com/api/stage/club-memberships/:id) | Delete one club memberships record. |

### /api/stage/club-staff-roles

Implementation: [clubStaffRoleController.js](../server/src/server/controllers/clubStaffRoleController.js).

| Method | API link | Function |
|---|---|---|
| GET | [/api/stage/club-staff-roles](https://stageleagues.com/api/stage/club-staff-roles) | List or filter club staff roles. |
| GET | [/api/stage/club-staff-roles/:id](https://stageleagues.com/api/stage/club-staff-roles/:id) | Read one club staff roles record. |
| POST | [/api/stage/club-staff-roles](https://stageleagues.com/api/stage/club-staff-roles) | Create a club staff roles record. |
| PATCH | [/api/stage/club-staff-roles/:id](https://stageleagues.com/api/stage/club-staff-roles/:id) | Update one club staff roles record. |
| DELETE | [/api/stage/club-staff-roles/:id](https://stageleagues.com/api/stage/club-staff-roles/:id) | Delete one club staff roles record. |

### /api/stage/club-fixture-availability

Implementation: [clubFixtureAvailabilityController.js](../server/src/server/controllers/clubFixtureAvailabilityController.js).

| Method | API link | Function |
|---|---|---|
| GET | [/api/stage/club-fixture-availability](https://stageleagues.com/api/stage/club-fixture-availability) | List or filter club fixture availability. |
| GET | [/api/stage/club-fixture-availability/:id](https://stageleagues.com/api/stage/club-fixture-availability/:id) | Read one club fixture availability record. |
| POST | [/api/stage/club-fixture-availability](https://stageleagues.com/api/stage/club-fixture-availability) | Create a club fixture availability record. |
| PATCH | [/api/stage/club-fixture-availability/:id](https://stageleagues.com/api/stage/club-fixture-availability/:id) | Update one club fixture availability record. |
| DELETE | [/api/stage/club-fixture-availability/:id](https://stageleagues.com/api/stage/club-fixture-availability/:id) | Delete one club fixture availability record. |

### /api/stage/club-fixture-availabilities

Implementation: [clubFixtureAvailabilityController.js](../server/src/server/controllers/clubFixtureAvailabilityController.js).

| Method | API link | Function |
|---|---|---|
| GET | [/api/stage/club-fixture-availabilities](https://stageleagues.com/api/stage/club-fixture-availabilities) | List or filter club fixture availabilities. |
| GET | [/api/stage/club-fixture-availabilities/:id](https://stageleagues.com/api/stage/club-fixture-availabilities/:id) | Read one club fixture availabilities record. |
| POST | [/api/stage/club-fixture-availabilities](https://stageleagues.com/api/stage/club-fixture-availabilities) | Create a club fixture availabilities record. |
| PATCH | [/api/stage/club-fixture-availabilities/:id](https://stageleagues.com/api/stage/club-fixture-availabilities/:id) | Update one club fixture availabilities record. |
| DELETE | [/api/stage/club-fixture-availabilities/:id](https://stageleagues.com/api/stage/club-fixture-availabilities/:id) | Delete one club fixture availabilities record. |

### /api/stage/club-fixture-lineups

Implementation: [clubFixtureLineupController.js](../server/src/server/controllers/clubFixtureLineupController.js).

| Method | API link | Function |
|---|---|---|
| GET | [/api/stage/club-fixture-lineups](https://stageleagues.com/api/stage/club-fixture-lineups) | List or filter club fixture lineups. |
| GET | [/api/stage/club-fixture-lineups/:id](https://stageleagues.com/api/stage/club-fixture-lineups/:id) | Read one club fixture lineups record. |
| POST | [/api/stage/club-fixture-lineups](https://stageleagues.com/api/stage/club-fixture-lineups) | Create a club fixture lineups record. |
| PATCH | [/api/stage/club-fixture-lineups/:id](https://stageleagues.com/api/stage/club-fixture-lineups/:id) | Update one club fixture lineups record. |
| DELETE | [/api/stage/club-fixture-lineups/:id](https://stageleagues.com/api/stage/club-fixture-lineups/:id) | Delete one club fixture lineups record. |
| POST | [/api/stage/club-fixture-lineups/publish/:clubId/:fixtureId](https://stageleagues.com/api/stage/club-fixture-lineups/publish/:clubId/:fixtureId) | Perform publish for club fixture lineups. |

### /api/stage/club-operation-audit-logs

Implementation: [clubOperationAuditLogController.js](../server/src/server/controllers/clubOperationAuditLogController.js).

| Method | API link | Function |
|---|---|---|
| GET | [/api/stage/club-operation-audit-logs](https://stageleagues.com/api/stage/club-operation-audit-logs) | List or filter club operation audit logs. |
| GET | [/api/stage/club-operation-audit-logs/:id](https://stageleagues.com/api/stage/club-operation-audit-logs/:id) | Read one club operation audit logs record. |

### /api/stage/objective-definitions

Implementation: [objectiveDefinitionController.js](../server/src/server/controllers/objectiveDefinitionController.js).

| Method | API link | Function |
|---|---|---|
| GET | [/api/stage/objective-definitions](https://stageleagues.com/api/stage/objective-definitions) | List or filter objective definitions. |
| GET | [/api/stage/objective-definitions/:id](https://stageleagues.com/api/stage/objective-definitions/:id) | Read one objective definitions record. |
| POST | [/api/stage/objective-definitions](https://stageleagues.com/api/stage/objective-definitions) | Create a objective definitions record. |
| PATCH | [/api/stage/objective-definitions/:id](https://stageleagues.com/api/stage/objective-definitions/:id) | Update one objective definitions record. |
| DELETE | [/api/stage/objective-definitions/:id](https://stageleagues.com/api/stage/objective-definitions/:id) | Delete one objective definitions record. |

### /api/stage/objective-progresses

Implementation: [objectiveProgressController.js](../server/src/server/controllers/objectiveProgressController.js).

| Method | API link | Function |
|---|---|---|
| GET | [/api/stage/objective-progresses](https://stageleagues.com/api/stage/objective-progresses) | List or filter objective progresses. |
| GET | [/api/stage/objective-progresses/:id](https://stageleagues.com/api/stage/objective-progresses/:id) | Read one objective progresses record. |
| POST | [/api/stage/objective-progresses](https://stageleagues.com/api/stage/objective-progresses) | Create a objective progresses record. |
| PATCH | [/api/stage/objective-progresses/:id](https://stageleagues.com/api/stage/objective-progresses/:id) | Update one objective progresses record. |
| DELETE | [/api/stage/objective-progresses/:id](https://stageleagues.com/api/stage/objective-progresses/:id) | Delete one objective progresses record. |

### /api/stage/archetypes

Implementation: [archetypeController.js](../server/src/server/controllers/archetypeController.js).

| Method | API link | Function |
|---|---|---|
| GET | [/api/stage/archetypes](https://stageleagues.com/api/stage/archetypes) | List or filter archetypes. |
| GET | [/api/stage/archetypes/:id](https://stageleagues.com/api/stage/archetypes/:id) | Read one archetypes record. |
| POST | [/api/stage/archetypes](https://stageleagues.com/api/stage/archetypes) | Create a archetypes record. |
| PATCH | [/api/stage/archetypes/:id](https://stageleagues.com/api/stage/archetypes/:id) | Update one archetypes record. |
| DELETE | [/api/stage/archetypes/:id](https://stageleagues.com/api/stage/archetypes/:id) | Delete one archetypes record. |

### /api/stage/chemistry-links

Implementation: [chemistryLinkController.js](../server/src/server/controllers/chemistryLinkController.js).

| Method | API link | Function |
|---|---|---|
| GET | [/api/stage/chemistry-links](https://stageleagues.com/api/stage/chemistry-links) | List or filter chemistry links. |
| GET | [/api/stage/chemistry-links/:id](https://stageleagues.com/api/stage/chemistry-links/:id) | Read one chemistry links record. |
| POST | [/api/stage/chemistry-links](https://stageleagues.com/api/stage/chemistry-links) | Create a chemistry links record. |
| PATCH | [/api/stage/chemistry-links/:id](https://stageleagues.com/api/stage/chemistry-links/:id) | Update one chemistry links record. |
| DELETE | [/api/stage/chemistry-links/:id](https://stageleagues.com/api/stage/chemistry-links/:id) | Delete one chemistry links record. |

### /api/stage/sbcs

Implementation: [sbcController.js](../server/src/server/controllers/sbcController.js).

| Method | API link | Function |
|---|---|---|
| GET | [/api/stage/sbcs](https://stageleagues.com/api/stage/sbcs) | List or filter sbcs. |
| GET | [/api/stage/sbcs/:id](https://stageleagues.com/api/stage/sbcs/:id) | Read one sbcs record. |
| POST | [/api/stage/sbcs](https://stageleagues.com/api/stage/sbcs) | Create a sbcs record. |
| PATCH | [/api/stage/sbcs/:id](https://stageleagues.com/api/stage/sbcs/:id) | Update one sbcs record. |
| DELETE | [/api/stage/sbcs/:id](https://stageleagues.com/api/stage/sbcs/:id) | Delete one sbcs record. |

### /api/stage/sbc-submissions

Implementation: [sbcSubmissionController.js](../server/src/server/controllers/sbcSubmissionController.js).

| Method | API link | Function |
|---|---|---|
| GET | [/api/stage/sbc-submissions](https://stageleagues.com/api/stage/sbc-submissions) | List or filter sbc submissions. |
| GET | [/api/stage/sbc-submissions/:id](https://stageleagues.com/api/stage/sbc-submissions/:id) | Read one sbc submissions record. |
| POST | [/api/stage/sbc-submissions](https://stageleagues.com/api/stage/sbc-submissions) | Create a sbc submissions record. |
| PATCH | [/api/stage/sbc-submissions/:id](https://stageleagues.com/api/stage/sbc-submissions/:id) | Update one sbc submissions record. |
| DELETE | [/api/stage/sbc-submissions/:id](https://stageleagues.com/api/stage/sbc-submissions/:id) | Delete one sbc submissions record. |

### /api/stage/fut-matches

Implementation: [futMatchController.js](../server/src/server/controllers/futMatchController.js).

| Method | API link | Function |
|---|---|---|
| GET | [/api/stage/fut-matches](https://stageleagues.com/api/stage/fut-matches) | List or filter fut matches. |
| GET | [/api/stage/fut-matches/:id](https://stageleagues.com/api/stage/fut-matches/:id) | Read one fut matches record. |
| POST | [/api/stage/fut-matches](https://stageleagues.com/api/stage/fut-matches) | Create a fut matches record. |
| PATCH | [/api/stage/fut-matches/:id](https://stageleagues.com/api/stage/fut-matches/:id) | Update one fut matches record. |
| DELETE | [/api/stage/fut-matches/:id](https://stageleagues.com/api/stage/fut-matches/:id) | Delete one fut matches record. |

### /api/stage/rating-histories

Implementation: [ratingHistoryController.js](../server/src/server/controllers/ratingHistoryController.js).

| Method | API link | Function |
|---|---|---|
| GET | [/api/stage/rating-histories](https://stageleagues.com/api/stage/rating-histories) | List or filter rating histories. |
| GET | [/api/stage/rating-histories/:id](https://stageleagues.com/api/stage/rating-histories/:id) | Read one rating histories record. |
| POST | [/api/stage/rating-histories](https://stageleagues.com/api/stage/rating-histories) | Create a rating histories record. |
| PATCH | [/api/stage/rating-histories/:id](https://stageleagues.com/api/stage/rating-histories/:id) | Update one rating histories record. |
| DELETE | [/api/stage/rating-histories/:id](https://stageleagues.com/api/stage/rating-histories/:id) | Delete one rating histories record. |

### /api/stage/live-match-events

Implementation: [liveMatchEventController.js](../server/src/server/controllers/liveMatchEventController.js).

| Method | API link | Function |
|---|---|---|
| GET | [/api/stage/live-match-events](https://stageleagues.com/api/stage/live-match-events) | List or filter live match events. |
| GET | [/api/stage/live-match-events/:id](https://stageleagues.com/api/stage/live-match-events/:id) | Read one live match events record. |
| POST | [/api/stage/live-match-events](https://stageleagues.com/api/stage/live-match-events) | Create a live match events record. |
| PATCH | [/api/stage/live-match-events/:id](https://stageleagues.com/api/stage/live-match-events/:id) | Update one live match events record. |
| DELETE | [/api/stage/live-match-events/:id](https://stageleagues.com/api/stage/live-match-events/:id) | Delete one live match events record. |

### /api/stage/challenges

Implementation: [challengeController.js](../server/src/server/controllers/challengeController.js).

| Method | API link | Function |
|---|---|---|
| GET | [/api/stage/challenges](https://stageleagues.com/api/stage/challenges) | List or filter challenges. |
| GET | [/api/stage/challenges/:id](https://stageleagues.com/api/stage/challenges/:id) | Read one challenges record. |
| POST | [/api/stage/challenges](https://stageleagues.com/api/stage/challenges) | Create a challenges record. |
| PATCH | [/api/stage/challenges/:id](https://stageleagues.com/api/stage/challenges/:id) | Update one challenges record. |
| DELETE | [/api/stage/challenges/:id](https://stageleagues.com/api/stage/challenges/:id) | Delete one challenges record. |

### /api/stage/competitions

Implementation: [leagueEntityController.js](../server/src/server/controllers/leagueEntityController.js).

| Method | API link | Function |
|---|---|---|
| GET | [/api/stage/competitions](https://stageleagues.com/api/stage/competitions) | List or filter competitions. |
| GET | [/api/stage/competitions/:id](https://stageleagues.com/api/stage/competitions/:id) | Read one competitions record. |
| POST | [/api/stage/competitions](https://stageleagues.com/api/stage/competitions) | Create a competitions record. |
| PATCH | [/api/stage/competitions/:id](https://stageleagues.com/api/stage/competitions/:id) | Update one competitions record. |
| DELETE | [/api/stage/competitions/:id](https://stageleagues.com/api/stage/competitions/:id) | Delete one competitions record. |

### /api/stage/competition-seasons

Implementation: [leagueEntityController.js](../server/src/server/controllers/leagueEntityController.js).

| Method | API link | Function |
|---|---|---|
| GET | [/api/stage/competition-seasons](https://stageleagues.com/api/stage/competition-seasons) | List or filter competition seasons. |
| GET | [/api/stage/competition-seasons/:id](https://stageleagues.com/api/stage/competition-seasons/:id) | Read one competition seasons record. |
| POST | [/api/stage/competition-seasons](https://stageleagues.com/api/stage/competition-seasons) | Create a competition seasons record. |
| PATCH | [/api/stage/competition-seasons/:id](https://stageleagues.com/api/stage/competition-seasons/:id) | Update one competition seasons record. |
| DELETE | [/api/stage/competition-seasons/:id](https://stageleagues.com/api/stage/competition-seasons/:id) | Delete one competition seasons record. |

### /api/stage/competition-fixtures

Implementation: [leagueEntityController.js](../server/src/server/controllers/leagueEntityController.js).

| Method | API link | Function |
|---|---|---|
| GET | [/api/stage/competition-fixtures](https://stageleagues.com/api/stage/competition-fixtures) | List or filter competition fixtures. |
| GET | [/api/stage/competition-fixtures/:id](https://stageleagues.com/api/stage/competition-fixtures/:id) | Read one competition fixtures record. |
| POST | [/api/stage/competition-fixtures](https://stageleagues.com/api/stage/competition-fixtures) | Create a competition fixtures record. |
| PATCH | [/api/stage/competition-fixtures/:id](https://stageleagues.com/api/stage/competition-fixtures/:id) | Update one competition fixtures record. |
| DELETE | [/api/stage/competition-fixtures/:id](https://stageleagues.com/api/stage/competition-fixtures/:id) | Delete one competition fixtures record. |

### /api/stage/competition-standings

Implementation: [leagueEntityController.js](../server/src/server/controllers/leagueEntityController.js).

| Method | API link | Function |
|---|---|---|
| GET | [/api/stage/competition-standings](https://stageleagues.com/api/stage/competition-standings) | List or filter competition standings. |
| GET | [/api/stage/competition-standings/:id](https://stageleagues.com/api/stage/competition-standings/:id) | Read one competition standings record. |
| POST | [/api/stage/competition-standings](https://stageleagues.com/api/stage/competition-standings) | Create a competition standings record. |
| PATCH | [/api/stage/competition-standings/:id](https://stageleagues.com/api/stage/competition-standings/:id) | Update one competition standings record. |
| DELETE | [/api/stage/competition-standings/:id](https://stageleagues.com/api/stage/competition-standings/:id) | Delete one competition standings record. |

### /api/stage/regional-leagues

Implementation: [leagueEntityController.js](../server/src/server/controllers/leagueEntityController.js).

| Method | API link | Function |
|---|---|---|
| GET | [/api/stage/regional-leagues](https://stageleagues.com/api/stage/regional-leagues) | List or filter regional leagues. |
| GET | [/api/stage/regional-leagues/:id](https://stageleagues.com/api/stage/regional-leagues/:id) | Read one regional leagues record. |
| POST | [/api/stage/regional-leagues](https://stageleagues.com/api/stage/regional-leagues) | Create a regional leagues record. |
| PATCH | [/api/stage/regional-leagues/:id](https://stageleagues.com/api/stage/regional-leagues/:id) | Update one regional leagues record. |
| DELETE | [/api/stage/regional-leagues/:id](https://stageleagues.com/api/stage/regional-leagues/:id) | Delete one regional leagues record. |

### /api/stage/regional-league-fixtures

Implementation: [leagueEntityController.js](../server/src/server/controllers/leagueEntityController.js).

| Method | API link | Function |
|---|---|---|
| GET | [/api/stage/regional-league-fixtures](https://stageleagues.com/api/stage/regional-league-fixtures) | List or filter regional league fixtures. |
| GET | [/api/stage/regional-league-fixtures/:id](https://stageleagues.com/api/stage/regional-league-fixtures/:id) | Read one regional league fixtures record. |
| POST | [/api/stage/regional-league-fixtures](https://stageleagues.com/api/stage/regional-league-fixtures) | Create a regional league fixtures record. |
| PATCH | [/api/stage/regional-league-fixtures/:id](https://stageleagues.com/api/stage/regional-league-fixtures/:id) | Update one regional league fixtures record. |
| DELETE | [/api/stage/regional-league-fixtures/:id](https://stageleagues.com/api/stage/regional-league-fixtures/:id) | Delete one regional league fixtures record. |

### /api/stage/regional-league-standings

Implementation: [leagueEntityController.js](../server/src/server/controllers/leagueEntityController.js).

| Method | API link | Function |
|---|---|---|
| GET | [/api/stage/regional-league-standings](https://stageleagues.com/api/stage/regional-league-standings) | List or filter regional league standings. |
| GET | [/api/stage/regional-league-standings/:id](https://stageleagues.com/api/stage/regional-league-standings/:id) | Read one regional league standings record. |
| POST | [/api/stage/regional-league-standings](https://stageleagues.com/api/stage/regional-league-standings) | Create a regional league standings record. |
| PATCH | [/api/stage/regional-league-standings/:id](https://stageleagues.com/api/stage/regional-league-standings/:id) | Update one regional league standings record. |
| DELETE | [/api/stage/regional-league-standings/:id](https://stageleagues.com/api/stage/regional-league-standings/:id) | Delete one regional league standings record. |

### /api/stage/qualification-entries

Implementation: [leagueEntityController.js](../server/src/server/controllers/leagueEntityController.js).

| Method | API link | Function |
|---|---|---|
| GET | [/api/stage/qualification-entries](https://stageleagues.com/api/stage/qualification-entries) | List or filter qualification entries. |
| GET | [/api/stage/qualification-entries/:id](https://stageleagues.com/api/stage/qualification-entries/:id) | Read one qualification entries record. |
| POST | [/api/stage/qualification-entries](https://stageleagues.com/api/stage/qualification-entries) | Create a qualification entries record. |
| PATCH | [/api/stage/qualification-entries/:id](https://stageleagues.com/api/stage/qualification-entries/:id) | Update one qualification entries record. |
| DELETE | [/api/stage/qualification-entries/:id](https://stageleagues.com/api/stage/qualification-entries/:id) | Delete one qualification entries record. |

### /api/stage/ranking-configs

Implementation: [leagueEntityController.js](../server/src/server/controllers/leagueEntityController.js).

| Method | API link | Function |
|---|---|---|
| GET | [/api/stage/ranking-configs](https://stageleagues.com/api/stage/ranking-configs) | List or filter ranking configs. |
| GET | [/api/stage/ranking-configs/:id](https://stageleagues.com/api/stage/ranking-configs/:id) | Read one ranking configs record. |
| POST | [/api/stage/ranking-configs](https://stageleagues.com/api/stage/ranking-configs) | Create a ranking configs record. |
| PATCH | [/api/stage/ranking-configs/:id](https://stageleagues.com/api/stage/ranking-configs/:id) | Update one ranking configs record. |
| DELETE | [/api/stage/ranking-configs/:id](https://stageleagues.com/api/stage/ranking-configs/:id) | Delete one ranking configs record. |

### /api/stage/season-registrations

Implementation: [leagueEntityController.js](../server/src/server/controllers/leagueEntityController.js).

| Method | API link | Function |
|---|---|---|
| GET | [/api/stage/season-registrations](https://stageleagues.com/api/stage/season-registrations) | List or filter season registrations. |
| GET | [/api/stage/season-registrations/:id](https://stageleagues.com/api/stage/season-registrations/:id) | Read one season registrations record. |
| POST | [/api/stage/season-registrations](https://stageleagues.com/api/stage/season-registrations) | Create a season registrations record. |
| PATCH | [/api/stage/season-registrations/:id](https://stageleagues.com/api/stage/season-registrations/:id) | Update one season registrations record. |
| DELETE | [/api/stage/season-registrations/:id](https://stageleagues.com/api/stage/season-registrations/:id) | Delete one season registrations record. |

### /api/stage/game-day-configs

Implementation: [leagueEntityController.js](../server/src/server/controllers/leagueEntityController.js).

| Method | API link | Function |
|---|---|---|
| GET | [/api/stage/game-day-configs](https://stageleagues.com/api/stage/game-day-configs) | List or filter game day configs. |
| GET | [/api/stage/game-day-configs/:id](https://stageleagues.com/api/stage/game-day-configs/:id) | Read one game day configs record. |
| POST | [/api/stage/game-day-configs](https://stageleagues.com/api/stage/game-day-configs) | Create a game day configs record. |
| PATCH | [/api/stage/game-day-configs/:id](https://stageleagues.com/api/stage/game-day-configs/:id) | Update one game day configs record. |
| DELETE | [/api/stage/game-day-configs/:id](https://stageleagues.com/api/stage/game-day-configs/:id) | Delete one game day configs record. |

### /api/stage/transfer-room-configs

Implementation: [leagueEntityController.js](../server/src/server/controllers/leagueEntityController.js).

| Method | API link | Function |
|---|---|---|
| GET | [/api/stage/transfer-room-configs](https://stageleagues.com/api/stage/transfer-room-configs) | List or filter transfer room configs. |
| GET | [/api/stage/transfer-room-configs/:id](https://stageleagues.com/api/stage/transfer-room-configs/:id) | Read one transfer room configs record. |
| POST | [/api/stage/transfer-room-configs](https://stageleagues.com/api/stage/transfer-room-configs) | Create a transfer room configs record. |
| PATCH | [/api/stage/transfer-room-configs/:id](https://stageleagues.com/api/stage/transfer-room-configs/:id) | Update one transfer room configs record. |
| DELETE | [/api/stage/transfer-room-configs/:id](https://stageleagues.com/api/stage/transfer-room-configs/:id) | Delete one transfer room configs record. |

## Server functions

Every function below is a POST endpoint with a JSON body, called in the frontend as `stageClient.functions.invoke(name, params)`. `_auth_user_id` is supplied by the server from the authenticated token. Action values listed here are literal branches found in the handler; some handlers delegate further processing.

| Method | API link | Function / actions |
|---|---|---|
| POST | [/api/stage/functions/createTournamentEntranceLink](https://stageleagues.com/api/stage/functions/createTournamentEntranceLink) | Create tournament entrance link. |
| POST | [/api/stage/functions/listTournamentEntranceLinks](https://stageleagues.com/api/stage/functions/listTournamentEntranceLinks) | List tournament entrance links. |
| POST | [/api/stage/functions/getTournamentInviteLink](https://stageleagues.com/api/stage/functions/getTournamentInviteLink) | Get tournament invite link. |
| POST | [/api/stage/functions/resolveTournamentEntranceToken](https://stageleagues.com/api/stage/functions/resolveTournamentEntranceToken) | Resolve tournament entrance token. |
| POST | [/api/stage/functions/claimTournamentTestGrant](https://stageleagues.com/api/stage/functions/claimTournamentTestGrant) | Claim tournament test grant. |
| POST | [/api/stage/functions/revokeTournamentEntranceLink](https://stageleagues.com/api/stage/functions/revokeTournamentEntranceLink) | Revoke tournament entrance link. |
| POST | [/api/stage/functions/regenerateTournamentEntranceLink](https://stageleagues.com/api/stage/functions/regenerateTournamentEntranceLink) | Regenerate tournament entrance link. |
| POST | [/api/stage/functions/applyTournamentEntranceAccessMode](https://stageleagues.com/api/stage/functions/applyTournamentEntranceAccessMode) | Apply tournament entrance access mode. |
| POST | [/api/stage/functions/releaseTournamentLimitedAccessIfEligible](https://stageleagues.com/api/stage/functions/releaseTournamentLimitedAccessIfEligible) | Release tournament limited access if eligible. |
| POST | [/api/stage/functions/clearTournamentLimitedAccess](https://stageleagues.com/api/stage/functions/clearTournamentLimitedAccess) | Clear tournament limited access. |
| POST | [/api/stage/functions/stripeCheckout](https://stageleagues.com/api/stage/functions/stripeCheckout) | Create a Stripe checkout session for credits. |
| POST | [/api/stage/functions/stripeSubscription](https://stageleagues.com/api/stage/functions/stripeSubscription) | Create a Stripe subscription checkout session. |
| POST | [/api/stage/functions/fixSubscription](https://stageleagues.com/api/stage/functions/fixSubscription) | Fulfil a paid subscription checkout session. |
| POST | [/api/stage/functions/cancelStagePlus](https://stageleagues.com/api/stage/functions/cancelStagePlus) | Cancel stage plus. |
| POST | [/api/stage/functions/fixCredits](https://stageleagues.com/api/stage/functions/fixCredits) | Fulfil a paid checkout session and credit the wallet. |
| POST | [/api/stage/functions/broadcastAnnouncement](https://stageleagues.com/api/stage/functions/broadcastAnnouncement) | Broadcast announcement. |
| POST | [/api/stage/functions/adminSubscriptionGrant](https://stageleagues.com/api/stage/functions/adminSubscriptionGrant) | Admin subscription grant. |
| POST | [/api/stage/functions/transferPayment](https://stageleagues.com/api/stage/functions/transferPayment) | Transfer payment. |
| POST | [/api/stage/functions/tournamentWithdrawal](https://stageleagues.com/api/stage/functions/tournamentWithdrawal) | Tournament withdrawal. |
| POST | [/api/stage/functions/assignGroups](https://stageleagues.com/api/stage/functions/assignGroups) | Assign groups. |
| POST | [/api/stage/functions/simulateScore](https://stageleagues.com/api/stage/functions/simulateScore) | Simulate score. |
| POST | [/api/stage/functions/generateTournamentDraw](https://stageleagues.com/api/stage/functions/generateTournamentDraw) | Generate tournament draw. |
| POST | [/api/stage/functions/startTournament](https://stageleagues.com/api/stage/functions/startTournament) | Start tournament. |
| POST | [/api/stage/functions/seedTournamentTestClubs](https://stageleagues.com/api/stage/functions/seedTournamentTestClubs) | Seed tournament test clubs. |
| POST | [/api/stage/functions/deleteTournamentTestClubs](https://stageleagues.com/api/stage/functions/deleteTournamentTestClubs) | Delete tournament test clubs. |
| POST | [/api/stage/functions/auditLeagueTournamentRounds](https://stageleagues.com/api/stage/functions/auditLeagueTournamentRounds) | Audit league tournament rounds. |
| POST | [/api/stage/functions/cleanupLeagueTournamentRounds](https://stageleagues.com/api/stage/functions/cleanupLeagueTournamentRounds) | Cleanup league tournament rounds. |
| POST | [/api/stage/functions/advanceRound](https://stageleagues.com/api/stage/functions/advanceRound) | Advance round. |
| POST | [/api/stage/functions/createFinalAndThirdPlace](https://stageleagues.com/api/stage/functions/createFinalAndThirdPlace) | Create final and third place. |
| POST | [/api/stage/functions/officializeTournament](https://stageleagues.com/api/stage/functions/officializeTournament) | Officialize tournament. |
| POST | [/api/stage/functions/adminMatchActions](https://stageleagues.com/api/stage/functions/adminMatchActions) | Admin match actions. Actions: `resolve_forfeit`. |
| POST | [/api/stage/functions/adminMembershipActions](https://stageleagues.com/api/stage/functions/adminMembershipActions) | Admin membership actions. Actions: `kick_from_club`. |
| POST | [/api/stage/functions/clubAdminActions](https://stageleagues.com/api/stage/functions/clubAdminActions) | Club admin actions. Actions: `delete`. |
| POST | [/api/stage/functions/createMatchFromLeagueFixture](https://stageleagues.com/api/stage/functions/createMatchFromLeagueFixture) | Create match from league fixture. |
| POST | [/api/stage/functions/syncCompletedMatchToSource](https://stageleagues.com/api/stage/functions/syncCompletedMatchToSource) | Sync completed match to source. |
| POST | [/api/stage/functions/competitionFixtureResult](https://stageleagues.com/api/stage/functions/competitionFixtureResult) | Competition fixture result. |
| POST | [/api/stage/functions/regionalLeagueFixtureResult](https://stageleagues.com/api/stage/functions/regionalLeagueFixtureResult) | Regional league fixture result. |
| POST | [/api/stage/functions/resolveClubContact](https://stageleagues.com/api/stage/functions/resolveClubContact) | Resolve club contact. |
| POST | [/api/stage/functions/adminManageLeagueClub](https://stageleagues.com/api/stage/functions/adminManageLeagueClub) | Admin manage league club. |
| POST | [/api/stage/functions/adminRemoveClubFromCompetition](https://stageleagues.com/api/stage/functions/adminRemoveClubFromCompetition) | Admin remove club from competition. |
| POST | [/api/stage/functions/adminRegisterClubToRegionalLeague](https://stageleagues.com/api/stage/functions/adminRegisterClubToRegionalLeague) | Admin register club to regional league. |
| POST | [/api/stage/functions/simulateRegionalLeagueFixtures](https://stageleagues.com/api/stage/functions/simulateRegionalLeagueFixtures) | Simulate regional league fixtures. |
| POST | [/api/stage/functions/simulateCompetitionFixtures](https://stageleagues.com/api/stage/functions/simulateCompetitionFixtures) | Simulate competition fixtures. |
| POST | [/api/stage/functions/adminResetLeagueCompetitionData](https://stageleagues.com/api/stage/functions/adminResetLeagueCompetitionData) | Admin reset league competition data. |
| POST | [/api/stage/functions/awardClubSeasonPrize](https://stageleagues.com/api/stage/functions/awardClubSeasonPrize) | Award club season prize. |
| POST | [/api/stage/functions/resolvePlayerContact](https://stageleagues.com/api/stage/functions/resolvePlayerContact) | Resolve player contact. |
| POST | [/api/stage/functions/submitPlayerIdentityClaim](https://stageleagues.com/api/stage/functions/submitPlayerIdentityClaim) | Submit player identity claim. |
| POST | [/api/stage/functions/listPlayerIdentityClaims](https://stageleagues.com/api/stage/functions/listPlayerIdentityClaims) | List player identity claims. |
| POST | [/api/stage/functions/reviewPlayerIdentityClaim](https://stageleagues.com/api/stage/functions/reviewPlayerIdentityClaim) | Review player identity claim. |
| POST | [/api/stage/functions/sendNotification](https://stageleagues.com/api/stage/functions/sendNotification) | Send notification. |
| POST | [/api/stage/functions/sendInboxMessage](https://stageleagues.com/api/stage/functions/sendInboxMessage) | Send inbox message. |
| POST | [/api/stage/functions/respondInboxMessage](https://stageleagues.com/api/stage/functions/respondInboxMessage) | Respond to an actionable inbox message. Actions: `accepted`, `declined`, `confirmed`, `date_change_requested`. |
| POST | [/api/stage/functions/eafcApi](https://stageleagues.com/api/stage/functions/eafcApi) | Proxy EA FC club search, club info, overall/member/career stats, league and playoff matches. |
| POST | [/api/stage/functions/spendCredits](https://stageleagues.com/api/stage/functions/spendCredits) | Spend credits. |
| POST | [/api/stage/functions/distributeTournamentPrizes](https://stageleagues.com/api/stage/functions/distributeTournamentPrizes) | Distribute tournament prizes. |
| POST | [/api/stage/functions/getTransferMarket](https://stageleagues.com/api/stage/functions/getTransferMarket) | Read transfer market listings. |
| POST | [/api/stage/functions/contractActions](https://stageleagues.com/api/stage/functions/contractActions) | Contract actions. |
| POST | [/api/stage/functions/contractManagement](https://stageleagues.com/api/stage/functions/contractManagement) | Contract management. Actions: `offer`, `renewal_offer`, `counter`, `reject`, `mark_pending_window`, `cancel_offer`, `accept`, `terminate`, `expire_overdue`, `auto_pay_salaries`, `get_all`, `admin_edit`, `admin_cancel`, `admin_correct_salary`. |
| POST | [/api/stage/functions/transferWindowActions](https://stageleagues.com/api/stage/functions/transferWindowActions) | Transfer window actions. Actions: `get_current`, `open_window`, `close_window`, `execute_pending`. |
| POST | [/api/stage/functions/payWeeklySalaries](https://stageleagues.com/api/stage/functions/payWeeklySalaries) | Pay weekly salaries. |
| POST | [/api/stage/functions/checkExpiredContracts](https://stageleagues.com/api/stage/functions/checkExpiredContracts) | Check expired contracts. |
| POST | [/api/stage/functions/updateMatchStats](https://stageleagues.com/api/stage/functions/updateMatchStats) | Update match stats. |
| POST | [/api/stage/functions/ratingEngine](https://stageleagues.com/api/stage/functions/ratingEngine) | Calculate player ratings and related progression. |
| POST | [/api/stage/functions/matchKickoff](https://stageleagues.com/api/stage/functions/matchKickoff) | Manage match readiness, kickoff and results workflow. Actions: `settle_club_matches`, `kickoff`, `settle_deadlines`, `submit_result`, `amend_result`, `confirm_result`, `propose_correction`, `accept_correction`, `counter_result`, `dispute_result`, `submit_dispute_evidence`, `admin_resolve`. |
| POST | [/api/stage/functions/matchFixtureActions](https://stageleagues.com/api/stage/functions/matchFixtureActions) | Match fixture actions. Actions: `request_cancel`, `request_reschedule`, `confirm_cancel`, `decline_cancel`. |
| POST | [/api/stage/functions/wagerMatchActions](https://stageleagues.com/api/stage/functions/wagerMatchActions) | Wager match actions. Actions: `accept_wager`, `decline_wager`, `cancel_wager`. |
| POST | [/api/stage/functions/processSoloWager](https://stageleagues.com/api/stage/functions/processSoloWager) | Process solo wager. |
| POST | [/api/stage/functions/payMonthlyRent](https://stageleagues.com/api/stage/functions/payMonthlyRent) | Pay monthly rent. |
| POST | [/api/stage/functions/processLifestyleMaintenance](https://stageleagues.com/api/stage/functions/processLifestyleMaintenance) | Process lifestyle maintenance. |
| POST | [/api/stage/functions/payMonthlySalaries](https://stageleagues.com/api/stage/functions/payMonthlySalaries) | Legacy alias that runs weekly salary payments. |
| POST | [/api/stage/functions/stcEngine](https://stageleagues.com/api/stage/functions/stcEngine) | Calculate and award STC for an event. |
| POST | [/api/stage/functions/upgradeLifestyleAsset](https://stageleagues.com/api/stage/functions/upgradeLifestyleAsset) | Upgrade lifestyle asset. |
| POST | [/api/stage/functions/wagerManagement](https://stageleagues.com/api/stage/functions/wagerManagement) | Wager management. Actions: `get_all`, `force_settle`. |
| POST | [/api/stage/functions/stadiumManagement](https://stageleagues.com/api/stage/functions/stadiumManagement) | Stadium management. Actions: `get_config`, `set_level_config`, `edit_club_stadium`, `correct_revenue`, `upgrade_club_stadium`. |
| POST | [/api/stage/functions/backfillPlayerStc](https://stageleagues.com/api/stage/functions/backfillPlayerStc) | Backfill player stc. |
| POST | [/api/stage/functions/buyLifestyleItem](https://stageleagues.com/api/stage/functions/buyLifestyleItem) | Buy lifestyle item. |
| POST | [/api/stage/functions/rentLifestyleItem](https://stageleagues.com/api/stage/functions/rentLifestyleItem) | Rent lifestyle item. |
| POST | [/api/stage/functions/investInLifestyleItem](https://stageleagues.com/api/stage/functions/investInLifestyleItem) | Invest in lifestyle item. |
| POST | [/api/stage/functions/sellLifestyleAsset](https://stageleagues.com/api/stage/functions/sellLifestyleAsset) | Sell lifestyle asset. |
| POST | [/api/stage/functions/collectInvestmentReturn](https://stageleagues.com/api/stage/functions/collectInvestmentReturn) | Collect investment return. |
| POST | [/api/stage/functions/collectPassiveIncome](https://stageleagues.com/api/stage/functions/collectPassiveIncome) | Collect passive income. |
| POST | [/api/stage/functions/lifestyleAdmin](https://stageleagues.com/api/stage/functions/lifestyleAdmin) | Lifestyle admin. Actions: `add`, `edit`, `delete`, `toggle`. |
| POST | [/api/stage/functions/setPlayerResidence](https://stageleagues.com/api/stage/functions/setPlayerResidence) | Set player residence. |
| POST | [/api/stage/functions/changePassword](https://stageleagues.com/api/stage/functions/changePassword) | Change password. |
| POST | [/api/stage/functions/seedLifestyleItems](https://stageleagues.com/api/stage/functions/seedLifestyleItems) | Seed lifestyle items. |
| POST | [/api/stage/functions/clubFinance](https://stageleagues.com/api/stage/functions/clubFinance) | Club finance. Actions: `get_overview`, `adjust_budgets`, `admin_adjust`, `apply_monthly_operating_costs`, `rebalance_starter_club`, `rebalance_all_starter_clubs`, `delete_transaction`. |
| POST | [/api/stage/functions/playerMarketValue](https://stageleagues.com/api/stage/functions/playerMarketValue) | Player market value. Actions: `get_breakdown`, `recalculate`, `recalculate_all`, `get_config`, `set_config`. |
| POST | [/api/stage/functions/deleteClub](https://stageleagues.com/api/stage/functions/deleteClub) | Delete club. |
| POST | [/api/stage/functions/playerWallet](https://stageleagues.com/api/stage/functions/playerWallet) | Player wallet. Actions: `get_balance`, `get_history`, `pay_salary`, `admin_adjust`. |
| POST | [/api/stage/functions/shirtSales](https://stageleagues.com/api/stage/functions/shirtSales) | Shirt sales. Actions: `get_leaderboard`, `get_club_summary`, `generate_for_match`, `get_config`, `set_config`, `correct_revenue`. |
| POST | [/api/stage/functions/adminEconomyControl](https://stageleagues.com/api/stage/functions/adminEconomyControl) | Administrative economy queries and adjustments. Actions: `get_player_wallet`, `set_player_balance`, `add_player_tx`, `get_club_finance`, `set_club_finance`, `add_club_tx`, `search_player_txs`, `search_club_txs`, `health_check`, `backfill_player_wallets`, `backfill_club_finances`, `distribute_competition_reward`, `set_lifestyle_status`, `get_audit_log`. |
| POST | [/api/stage/functions/economyTests](https://stageleagues.com/api/stage/functions/economyTests) | Economy tests. Actions: `list_tests`, `run_test`, `run_suite`. |
| POST | [/api/stage/functions/tournamentRulesAccept](https://stageleagues.com/api/stage/functions/tournamentRulesAccept) | Tournament rules accept. |
| POST | [/api/stage/functions/tournamentRegistration](https://stageleagues.com/api/stage/functions/tournamentRegistration) | Tournament registration. |
| POST | [/api/stage/functions/tournamentRegistrationReview](https://stageleagues.com/api/stage/functions/tournamentRegistrationReview) | Tournament registration review. |
| POST | [/api/stage/functions/tournamentClubAvailability](https://stageleagues.com/api/stage/functions/tournamentClubAvailability) | Tournament club availability. |
| POST | [/api/stage/functions/regionalLeagueClubAvailability](https://stageleagues.com/api/stage/functions/regionalLeagueClubAvailability) | Regional league club availability. |
| POST | [/api/stage/functions/officialStageClubAvailability](https://stageleagues.com/api/stage/functions/officialStageClubAvailability) | Official stage club availability. |
| POST | [/api/stage/functions/adminSetTournamentClubs](https://stageleagues.com/api/stage/functions/adminSetTournamentClubs) | Admin set tournament clubs. |
| POST | [/api/stage/functions/tournamentRegistrationNotify](https://stageleagues.com/api/stage/functions/tournamentRegistrationNotify) | Tournament registration notify. |
| POST | [/api/stage/functions/tournamentCancellation](https://stageleagues.com/api/stage/functions/tournamentCancellation) | Tournament cancellation. |
| POST | [/api/stage/functions/adminDeleteTournament](https://stageleagues.com/api/stage/functions/adminDeleteTournament) | Admin delete tournament. |
| POST | [/api/stage/functions/claimObjectiveReward](https://stageleagues.com/api/stage/functions/claimObjectiveReward) | Claim objective reward. |
| POST | [/api/stage/functions/submitSbc](https://stageleagues.com/api/stage/functions/submitSbc) | Submit sbc. |
| POST | [/api/stage/functions/deleteAccount](https://stageleagues.com/api/stage/functions/deleteAccount) | Delete account. |
| POST | [/api/stage/functions/adminDeleteUserAccount](https://stageleagues.com/api/stage/functions/adminDeleteUserAccount) | Admin delete user account. |
| POST | [/api/stage/functions/repairPlayerPresidentIdentityLinks](https://stageleagues.com/api/stage/functions/repairPlayerPresidentIdentityLinks) | Repair player president identity links. |

Implementation: [legacyFunctions.js](../server/src/server/functions/legacyFunctions.js), dispatcher: [functionsRouter.js](../server/src/server/functions/functionsRouter.js).

## Mobile API

Mobile resources require a bearer token. Authentication endpoints enforce their own token requirements. `/upload` is an alias for `/uploads`.

### /api/mobile/auth

Implementation: [authRoutes.js](../server/src/server/mobile/authRoutes.js).

| Method | API link | Function |
|---|---|---|
| POST | [/api/mobile/auth/register](https://stageleagues.com/api/mobile/auth/register) | Perform register for auth. |
| POST | [/api/mobile/auth/login](https://stageleagues.com/api/mobile/auth/login) | Perform login for auth. |
| POST | [/api/mobile/auth/refresh](https://stageleagues.com/api/mobile/auth/refresh) | Perform refresh for auth. |
| POST | [/api/mobile/auth/logout](https://stageleagues.com/api/mobile/auth/logout) | Perform logout for auth. |
| GET | [/api/mobile/auth/google](https://stageleagues.com/api/mobile/auth/google) | Start Google OAuth sign-in. |
| GET | [/api/mobile/auth/microsoft](https://stageleagues.com/api/mobile/auth/microsoft) | Start Microsoft OAuth sign-in. |
| GET | [/api/mobile/auth/twitch](https://stageleagues.com/api/mobile/auth/twitch) | Start Twitch OAuth sign-in. |
| GET | [/api/mobile/auth/kick](https://stageleagues.com/api/mobile/auth/kick) | Start Kick OAuth sign-in. |
| GET | [/api/mobile/auth/me](https://stageleagues.com/api/mobile/auth/me) | Read me for auth. |

### /api/mobile/users

Implementation: [userRoutes.js](../server/src/server/mobile/userRoutes.js).

| Method | API link | Function |
|---|---|---|
| GET | [/api/mobile/users/me](https://stageleagues.com/api/mobile/users/me) | Read me for users. |
| PUT | [/api/mobile/users/me](https://stageleagues.com/api/mobile/users/me) | Set me for users. |
| GET | [/api/mobile/users/:id](https://stageleagues.com/api/mobile/users/:id) | Read one users record. |
| GET | [/api/mobile/users/:id/availability](https://stageleagues.com/api/mobile/users/:id/availability) | Read availability for users. |
| PUT | [/api/mobile/users/:id/availability](https://stageleagues.com/api/mobile/users/:id/availability) | Set availability for users. |

### /api/mobile/teams

Implementation: [teamRoutes.js](../server/src/server/mobile/teamRoutes.js).

| Method | API link | Function |
|---|---|---|
| GET | [/api/mobile/teams](https://stageleagues.com/api/mobile/teams) | List or filter teams. |
| GET | [/api/mobile/teams/with-members](https://stageleagues.com/api/mobile/teams/with-members) | Read with members for teams. |
| GET | [/api/mobile/teams/:id](https://stageleagues.com/api/mobile/teams/:id) | Read one teams record. |
| POST | [/api/mobile/teams](https://stageleagues.com/api/mobile/teams) | Create a teams record. |
| GET | [/api/mobile/teams/:id/players](https://stageleagues.com/api/mobile/teams/:id/players) | Read players for teams. |
| DELETE | [/api/mobile/teams/:id/players/:userId](https://stageleagues.com/api/mobile/teams/:id/players/:userId) | Remove players for teams. |
| GET | [/api/mobile/teams/:id/formation](https://stageleagues.com/api/mobile/teams/:id/formation) | Read formation for teams. |
| POST | [/api/mobile/teams/:id/formation](https://stageleagues.com/api/mobile/teams/:id/formation) | Perform formation for teams. |
| GET | [/api/mobile/teams/:id/join-request-status](https://stageleagues.com/api/mobile/teams/:id/join-request-status) | Read join request status for teams. |
| POST | [/api/mobile/teams/:id/join-request](https://stageleagues.com/api/mobile/teams/:id/join-request) | Perform join request for teams. |
| GET | [/api/mobile/teams/:id/join-requests](https://stageleagues.com/api/mobile/teams/:id/join-requests) | Read join requests for teams. |
| POST | [/api/mobile/teams/:id/join-requests/:requestId/accept](https://stageleagues.com/api/mobile/teams/:id/join-requests/:requestId/accept) | Perform join requests / accept for teams. |
| POST | [/api/mobile/teams/:id/join-requests/:requestId/decline](https://stageleagues.com/api/mobile/teams/:id/join-requests/:requestId/decline) | Perform join requests / decline for teams. |
| POST | [/api/mobile/teams/:id/leave](https://stageleagues.com/api/mobile/teams/:id/leave) | Perform leave for teams. |
| GET | [/api/mobile/teams/:id/dressing-room](https://stageleagues.com/api/mobile/teams/:id/dressing-room) | Read dressing room for teams. |
| POST | [/api/mobile/teams/:id/chat/read](https://stageleagues.com/api/mobile/teams/:id/chat/read) | Perform chat / read for teams. |
| GET | [/api/mobile/teams/:id/chat](https://stageleagues.com/api/mobile/teams/:id/chat) | Read chat for teams. |
| POST | [/api/mobile/teams/:id/chat](https://stageleagues.com/api/mobile/teams/:id/chat) | Perform chat for teams. |

### /api/mobile/tournaments

Implementation: [tournamentRoutes.js](../server/src/server/mobile/tournamentRoutes.js).

| Method | API link | Function |
|---|---|---|
| GET | [/api/mobile/tournaments/list](https://stageleagues.com/api/mobile/tournaments/list) | Read list for tournaments. |
| GET | [/api/mobile/tournaments](https://stageleagues.com/api/mobile/tournaments) | List or filter tournaments. |
| GET | [/api/mobile/tournaments/:id](https://stageleagues.com/api/mobile/tournaments/:id) | Read one tournaments record. |
| POST | [/api/mobile/tournaments](https://stageleagues.com/api/mobile/tournaments) | Create a tournaments record. |
| POST | [/api/mobile/tournaments/:id/start](https://stageleagues.com/api/mobile/tournaments/:id/start) | Perform start for tournaments. |
| POST | [/api/mobile/tournaments/:id/join](https://stageleagues.com/api/mobile/tournaments/:id/join) | Perform join for tournaments. |
| POST | [/api/mobile/tournaments/:id/invite](https://stageleagues.com/api/mobile/tournaments/:id/invite) | Perform invite for tournaments. |
| GET | [/api/mobile/tournaments/:id/standings](https://stageleagues.com/api/mobile/tournaments/:id/standings) | Read standings for tournaments. |
| GET | [/api/mobile/tournaments/:id/groups](https://stageleagues.com/api/mobile/tournaments/:id/groups) | Read groups for tournaments. |
| GET | [/api/mobile/tournaments/:id/brackets](https://stageleagues.com/api/mobile/tournaments/:id/brackets) | Read brackets for tournaments. |

### /api/mobile/matches

Implementation: [matchRoutes.js](../server/src/server/mobile/matchRoutes.js).

| Method | API link | Function |
|---|---|---|
| GET | [/api/mobile/matches/fixtures](https://stageleagues.com/api/mobile/matches/fixtures) | Read fixtures for matches. |
| GET | [/api/mobile/matches/:id](https://stageleagues.com/api/mobile/matches/:id) | Read one matches record. |
| POST | [/api/mobile/matches/:id/video](https://stageleagues.com/api/mobile/matches/:id/video) | Perform video for matches. |
| POST | [/api/mobile/matches/:id/chat/read](https://stageleagues.com/api/mobile/matches/:id/chat/read) | Perform chat / read for matches. |
| GET | [/api/mobile/matches/:id/chat](https://stageleagues.com/api/mobile/matches/:id/chat) | Read chat for matches. |
| POST | [/api/mobile/matches/:id/chat](https://stageleagues.com/api/mobile/matches/:id/chat) | Perform chat for matches. |

### /api/mobile/social

Implementation: [socialRoutes.js](../server/src/server/mobile/socialRoutes.js).

| Method | API link | Function |
|---|---|---|
| GET | [/api/mobile/social/feed](https://stageleagues.com/api/mobile/social/feed) | Read feed for social. |
| GET | [/api/mobile/social/reels](https://stageleagues.com/api/mobile/social/reels) | Read reels for social. |
| GET | [/api/mobile/social/posts/:id](https://stageleagues.com/api/mobile/social/posts/:id) | Read posts for social. |
| GET | [/api/mobile/social/comments](https://stageleagues.com/api/mobile/social/comments) | Read comments for social. |
| POST | [/api/mobile/social/comments](https://stageleagues.com/api/mobile/social/comments) | Perform comments for social. |
| GET | [/api/mobile/social/messages](https://stageleagues.com/api/mobile/social/messages) | Read messages for social. |
| GET | [/api/mobile/social/messages/:otherUserId](https://stageleagues.com/api/mobile/social/messages/:otherUserId) | Read messages for social. |
| POST | [/api/mobile/social/messages](https://stageleagues.com/api/mobile/social/messages) | Perform messages for social. |

### /api/mobile/uploads

Implementation: [uploadRoutes.js](../server/src/server/mobile/uploadRoutes.js).

| Method | API link | Function |
|---|---|---|
| POST | [/api/mobile/uploads/chat](https://stageleagues.com/api/mobile/uploads/chat) | Perform chat for uploads. |
| POST | [/api/mobile/uploads](https://stageleagues.com/api/mobile/uploads) | Upload a file using multipart form data. |
| POST | [/api/mobile/uploads/avatar](https://stageleagues.com/api/mobile/uploads/avatar) | Perform avatar for uploads. |

### /api/mobile/upload

Implementation: [uploadRoutes.js](../server/src/server/mobile/uploadRoutes.js).

| Method | API link | Function |
|---|---|---|
| POST | [/api/mobile/upload/chat](https://stageleagues.com/api/mobile/upload/chat) | Perform chat for upload. |
| POST | [/api/mobile/upload](https://stageleagues.com/api/mobile/upload) | Upload a file using multipart form data. |
| POST | [/api/mobile/upload/avatar](https://stageleagues.com/api/mobile/upload/avatar) | Perform avatar for upload. |

## Health, public content, files and redirect pages

| Method | API link | Function |
|---|---|---|
| GET | [/health](https://stageleagues.com/health) | Backend health status. |
| GET | [/api/stage/health](https://stageleagues.com/api/stage/health) | Backend health status under the main API prefix. |
| GET | [/api/mobile/health](https://stageleagues.com/api/mobile/health) | Mobile compatibility health status. |
| GET | [/api/stage/public/landing-content](https://stageleagues.com/api/stage/public/landing-content) | Read public landing-page content. |
| GET | [/uploads/:filename](https://stageleagues.com/uploads/:filename) | Serve a previously uploaded file. |
| GET | [/auth/error](https://stageleagues.com/auth/error) | OAuth error page. |
| GET | [/auth/mobile-handoff](https://stageleagues.com/auth/mobile-handoff) | Hand off authentication to the mobile client. |
| GET | [/auth/store-return](https://stageleagues.com/auth/store-return) | Return from store checkout to the client. |
| GET | [/store/mobile-return](https://stageleagues.com/store/mobile-return) | Mobile store return page. |
| GET | [/auth/callback](https://stageleagues.com/auth/callback) | Frontend authentication callback page. |

## Realtime service

Host: `https://stage-7osn.onrender.com` (from `src/lib/resolveSocketUrl.js`). Socket.IO also handles its transport on `/socket.io/`; this is an event connection rather than an entity REST API.

| Method | API link | Function |
|---|---|---|
| POST | [/emit](https://stage-7osn.onrender.com/emit) | Server-to-server broadcast to a Stage channel; requires `x-emit-secret`. |
| GET | [/health](https://stage-7osn.onrender.com/health) | Service uptime and current connections. |
| GET | [/metrics](https://stage-7osn.onrender.com/metrics) | Connection, room and broadcast counters. |

## EA FC integration

The app exposes these through POST `/api/stage/functions/eafcApi`, with JSON `{ "endpoint": "searchClub", "params": { "platform": "...", "clubName": "..." } }`. Upstream base: `https://proclubs.ea.com/api/fc/`.

| Endpoint parameter | Upstream path | Purpose |
|---|---|---|
| `searchClub` | `/clubs/search?platform=:platform&clubName=:clubName` | Find a club by name. |
| `clubInfo` | `/clubs/info?platform=:platform&clubIds=:clubId` | Read club information. |
| `overallStats` | `/clubs/overallStats?platform=:platform&clubIds=:clubId` | Read club totals. |
| `memberStats` | `/clubs/memberStats?platform=:platform&clubId=:clubId` | Read member statistics. |
| `memberCareerStats` | `/clubs/memberCareerStats?platform=:platform&clubId=:clubId` | Read member career statistics. |
| `leagueMatches` | `/clubs/matches?platform=:platform&clubIds=:clubId&matchType=leagueMatch` | Read league matches. |
| `playoffMatches` | `/clubs/matches?platform=:platform&clubIds=:clubId&matchType=playoffMatch` | Read playoff matches. |

## Frontend client helpers

| Helper | Request / behavior |
|---|---|
| `entities.Name.filter(filters, orderBy, limit)` | GET collection with query filters; sorting occurs in the client. |
| `entities.Name.list(...)` | GET collection through the entity helper. |
| `entities.Name.get(id)` | GET collection/:id. |
| `entities.Name.create(body)` | POST collection. |
| `entities.Name.update(id, body)` | PATCH collection/:id. |
| `entities.Name.delete(id)` | DELETE collection/:id. |
| `entities.Name.bulkCreate(rows)` | Multiple POST requests; there is no dedicated bulk-create route. |
| `entities.Name.subscribe(handler)` | Realtime listener for entities wired to socket channels; no REST subscription endpoint. |
| `functions.invoke(name, params)` | POST /api/stage/functions/:name with JSON. |
| `integrations.Core.UploadFile({file})` | POST /api/stage/upload with multipart form data. |

Inventory total: **698 HTTP method/path entries**, including explicit aliases, **107 named server functions**, and **93 main API mounts. Static wildcard frontend fallback routes are excluded.
