# Player Profile, Social, Showcase Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rework the player profile, career, posts, notifications, showcase, and scouting flows so STAGE career data is authoritative, deprecated UI is removed, social interactions work immediately, and scouting is powered by player-uploaded showcase videos.

**Architecture:** Move domain-heavy aggregation and interaction rules into backend services/controllers, then keep React pages focused on rendering and small local UI state. Use dedicated endpoints for likes, comments, notification reads, career summaries, and showcase uploads instead of generic entity updates where side effects matter. Remove follow and EA/FUT profile flows as deliberate product deletions, not hidden inactive features.

**Tech Stack:** Vite, React 18, react-router-dom, Tailwind, Radix UI, Express, MySQL 8, mysql2, multer, socket.io notifications, Node `--test`.

## Global Constraints

- Follow `AGENTS.md`: new persisted entities require schema, model, controller, route mount, frontend entity registration, and consumer update.
- Keep `server/schema.sql` and `server/src/server/migrations/startupMigrations.js` in sync.
- Admin mutations must write audit logs; this plan mostly adds user-facing actions, not admin mutations.
- Do not use generic entity updates for social side effects that must notify or validate ownership.
- Showcase videos are uploaded local files with a title, no URL input.
- Users cannot like or comment on showcase videos from the player profile.
- In Scouting, showcase videos can be liked and commented on, and the video owner receives notifications.
- Remove follow/follower/following UI and backend flow as if the feature never existed.
- Remove EA Pro Clubs and Ultimate Team panels from Player Profile and Dashboard.
- Minimum final verification: `npm run lint`, `npm run typecheck`, `node --check server/src/server.js`, targeted `npm run test:server`, targeted `npm run test`.

---

## File Structure

**Backend**

- Modify `server/schema.sql`: update showcase video columns, add showcase reactions/comments if needed, add post mention support indexes/columns, eventually remove `follows`.
- Modify `server/src/server/migrations/startupMigrations.js`: mirror schema changes with idempotent migrations.
- Modify `server/src/server/routes/registerStageRoutes.js`: mount new action controllers and remove follows route after callers are gone.
- Create `server/src/server/services/playerCareerService.js`: aggregate club career and PVP career from matches, match player stats, competitions, regional leagues, Game Day, and trophies.
- Create `server/src/server/controllers/playerCareerController.js`: expose read-only career endpoint.
- Modify `server/src/server/controllers/postController.js`: add `POST /:id/like` and mention-aware create/update flow.
- Modify `server/src/server/controllers/commentController.js`: resolve author Gamertag/avatar server-side, increment counts, notify post owner and mentions.
- Modify `server/src/server/controllers/notificationController.js`: add owner-safe `POST /:id/read` and `POST /read-link` helpers for click-through reliability.
- Modify `server/src/server/controllers/playerShowcaseVideoController.js`: accept uploaded video files, validate ownership/title/duration metadata, expose scouting list filters.
- Modify `server/src/server/models/playerShowcaseVideoModel.js`: replace URL fields with uploaded media metadata and add scouting counters.
- Modify `server/src/server/models/postModel.js` and `server/src/server/models/commentModel.js`: support mentions and server-owned author fields.
- Modify `server/src/server/services/accountDeletion.js`: remove follow cleanup and add showcase/social cleanup if missing.
- Modify trophy award flow in `server/src/server/functions/legacyFunctions.js` or extracted trophy service if present: award club trophies to club plus active squad players.

**Frontend**

- Modify `src/pages/PlayerProfile.jsx`: remove stats tab, follow state, EA/FUT state, and render new career sections.
- Modify `src/pages/Dashboard.jsx`: remove EA/FUT panels and imports.
- Modify `src/pages/Social.jsx`: call dedicated like/comment endpoints, render immediate optimistic state, support @Gamertag mentions.
- Modify notification UI files found by `rg "Notification|notifications"`: mark read before navigation and update unread count locally.
- Modify `src/components/scouting/PlayerShowcase.jsx`: use local video upload with title, 10-second validation UI, owner-only edit controls, no player-profile likes/comments.
- Modify `src/pages/Scouting.jsx`: rebuild as public showcase discovery with filters, video modal, comments/likes, and profile links.
- Modify `src/api/stageClient.js`: remove `Follow` from `ENTITY_NAMES`, add helper methods if dedicated endpoints are easier to consume.
- Modify translation packs: remove deleted copy and add career/showcase/scouting social labels.

**Tests**

- Add `server/src/server/services/__tests__/playerCareerService.test.js`.
- Add `server/src/server/controllers/__tests__/postActionsController.test.js` or extend existing controller tests.
- Add `server/src/server/controllers/__tests__/notificationReadController.test.js`.
- Update `server/src/server/models/__tests__/playerShowcaseVideoModel.test.js`.
- Add frontend utility tests under `src/lib/__tests__/` for mention parsing and scouting filters.

---

### Task 1: Product Deletion Pass For Profile And Dashboard

**Files:**
- Modify: `src/pages/PlayerProfile.jsx`
- Modify: `src/pages/Dashboard.jsx`
- Modify: `src/api/stageClient.js`
- Modify: translation files under `src/translations/`

**Interfaces:**
- Consumes: existing profile route `/players/:id`.
- Produces: Player Profile tabs `posts`, `career`, `matches`, `showcase`, `trophies`, and optional `lifestyle`.

- [ ] **Step 1: Remove profile follow state and UI**

Delete these state values and any derived calls from `src/pages/PlayerProfile.jsx`:

```js
const [isFollowing, setIsFollowing] = useState(false);
const [followId, setFollowId] = useState(null);
const [followersCount, setFollowersCount] = useState(0);
const [followingCount, setFollowingCount] = useState(0);
const [followersList, setFollowersList] = useState([]);
const [followingList, setFollowingList] = useState([]);
const [followersModalOpen, setFollowersModalOpen] = useState(false);
const [followingModalOpen, setFollowingModalOpen] = useState(false);
```

Also delete `toggleFollow()`, `FollowList`, follower modal markup, and the `followers={...}` prop passed to `GamerProfileHero`.

- [ ] **Step 2: Remove profile Stats tab**

Change `profileTabs` in `src/pages/PlayerProfile.jsx` to:

```js
const profileTabs = [
  { id: "posts", label: t("commonPages.ppTab_posts") },
  { id: "career", label: t("commonPages.ppTab_career") },
  { id: "matches", label: t("commonPages.ppTab_matches") },
  { id: "showcase", label: t("commonPages.ppTab_showcase") },
  { id: "trophies", label: t("commonPages.ppTab_trophies") },
  ...(!limitedTournamentId ? [{ id: "lifestyle", label: t("commonPages.ppTab_lifestyle") }] : []),
];
```

Remove the whole `activeTab === "stats"` render block and unused imports `TrendingUp`, `GamerProfileStatsPanel`, `calculatePlayerValue`, and `getValueTier`.

- [ ] **Step 3: Remove EA/FUT panels from Player Profile**

Delete imports and state in `PlayerProfile.jsx`:

```js
import EafcClubLinkPanel from "@/components/dashboard/EafcClubLinkPanel";
import FutMatchLogPanel from "@/components/dashboard/FutMatchLogPanel";
import DashboardFutChart from "@/components/dashboard/DashboardFutChart";
import DashboardFormStrip from "@/components/dashboard/DashboardFormStrip";
import { loadFutMatches, loadEafcSummary, buildFutFormStrip, buildFutWeeklyBuckets } from "@/lib/dashboardData";
```

Delete `futMatches`, `eafcSummary`, their load block, and the EA/FUT career render block. Temporarily show an empty career card until Task 2 replaces it.

- [ ] **Step 4: Remove EA/FUT panels from Dashboard**

In `src/pages/Dashboard.jsx`, remove imports and render blocks for:

```js
DashboardFutChart
EafcClubLinkPanel
FutMatchLogPanel
```

Remove related `loadFutMatches`, `loadEafcSummary`, `buildFutFormStrip`, and `buildFutWeeklyBuckets` usage if present.

- [ ] **Step 5: Run frontend checks**

Run:

```bash
npm run typecheck
npm run lint
```

Expected: no new errors from removed imports, missing state, or dead translation keys.

---

### Task 2: Backend Player Career Summary

**Files:**
- Create: `server/src/server/services/playerCareerService.js`
- Create: `server/src/server/controllers/playerCareerController.js`
- Create: `server/src/server/services/__tests__/playerCareerService.test.js`
- Modify: `server/src/server/routes/registerStageRoutes.js`

**Interfaces:**
- Produces: `GET /api/stage/player-careers/:playerId`
- Response shape:

```js
{
  player_id: "player-1",
  club_career: {
    games: 0,
    goals: 0,
    assists: 0,
    avg_rating: 0,
    wins: 0,
    draws: 0,
    losses: 0,
    motm: 0,
    trophies_won: 0,
    ranking_points: 0,
    history: []
  },
  player_career: {
    games: 0,
    goals_for: 0,
    goals_against: 0,
    wins: 0,
    draws: 0,
    losses: 0,
    trophies_won: 0,
    history: []
  }
}
```

- [ ] **Step 1: Write service tests**

Create `server/src/server/services/__tests__/playerCareerService.test.js` with cases for:

```js
test('club career includes match_player_stats and affects ranking fields', async () => {});
test('player career includes solo player-vs-player matches and does not change ranking fields', async () => {});
test('career history labels arranged games, community tournaments, STAGE tournaments, regional leagues, and competitions', async () => {});
test('missing rows return zeroed career sections', async () => {});
```

Mock `EXECUTESQL` using the existing test style from nearby service tests.

- [ ] **Step 2: Implement `playerCareerService.js`**

Export:

```js
async function getPlayerCareerSummary(playerId) {}
function classifyMatchSource(match) {}
function summarizeClubCareer({ player, stats, matches, trophies }) {}
function summarizePlayerCareer({ player, matches, trophies }) {}

module.exports = {
  getPlayerCareerSummary,
  classifyMatchSource,
  summarizeClubCareer,
  summarizePlayerCareer,
};
```

Rules:

- Club career reads `match_player_stats` joined to `matches`.
- Exclude `matches.type = 'friendly'` unless it is an arranged Game Day match that product confirms as ranked.
- Include `goals`, `assists`, `rating`, `is_motm`.
- Determine W/D/L from the player stat row club against match home/away club scores.
- Player career reads solo matches where `home_player_id = playerId OR away_player_id = playerId`.
- Player career records `goals_for`, `goals_against`, opponents, final score, and source label.
- Player career never writes or returns ranking deltas.

- [ ] **Step 3: Add read-only controller**

Create `server/src/server/controllers/playerCareerController.js`:

```js
const express = require('express');
const router = express.Router();
const { getPlayerCareerSummary } = require('../services/playerCareerService');

router.get('/:playerId', async (req, res) => {
  try {
    const summary = await getPlayerCareerSummary(req.params.playerId);
    res.json(summary);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
```

- [ ] **Step 4: Mount route**

In `server/src/server/routes/registerStageRoutes.js`:

```js
app.use('/api/stage/player-careers', verifyToken, require('../controllers/playerCareerController'));
```

- [ ] **Step 5: Run targeted tests**

Run:

```bash
npm run test:server -- server/src/server/services/__tests__/playerCareerService.test.js
node --check server/src/server/controllers/playerCareerController.js
node --check server/src/server.js
```

Expected: tests pass and syntax checks succeed.

---

### Task 3: Player Profile Career UI

**Files:**
- Modify: `src/pages/PlayerProfile.jsx`
- Create: `src/components/profile/PlayerCareerSummary.jsx`
- Modify: translation files under `src/translations/`

**Interfaces:**
- Consumes: `GET /api/stage/player-careers/:playerId`.
- Produces: reusable `PlayerCareerSummary`.

- [ ] **Step 1: Add career fetch state**

In `PlayerProfile.jsx`, add:

```js
const [career, setCareer] = useState(null);
const [careerLoading, setCareerLoading] = useState(false);
```

After `setPlayer(p)`, fetch:

```js
setCareerLoading(true);
stageClient.http.get(`/player-careers/${p.id}`)
  .then(setCareer)
  .catch(() => setCareer(null))
  .finally(() => setCareerLoading(false));
```

- [ ] **Step 2: Create `PlayerCareerSummary`**

Render two sections:

- My Club Career: Games, Goals, Assists, AVG Rating, Wins, Draws, Losses, MOTM, Trophies Won, Ranking Points.
- My Player Career: Games, Goals For, Goals Against, Wins, Draws, Losses, Trophies Won, recent opponents/final scores/source.

Use compact stat tiles and history rows. Do not show EA/FUT copy.

- [ ] **Step 3: Replace career tab render**

In `PlayerProfile.jsx`:

```jsx
{activeTab === "career" ? (
  <div className="pt-2">
    <PlayerCareerSummary career={career} loading={careerLoading} />
  </div>
) : null}
```

- [ ] **Step 4: Run checks**

Run:

```bash
npm run typecheck
npm run lint
```

Expected: profile compiles with no unused imports or missing JSX symbols.

---

### Task 4: Reliable Post Likes, Comments, Gamertags, Notifications, And Mentions

**Files:**
- Modify: `server/src/server/controllers/postController.js`
- Modify: `server/src/server/controllers/commentController.js`
- Modify: `server/src/server/models/postModel.js`
- Modify: `server/src/server/models/commentModel.js`
- Modify: `server/schema.sql`
- Modify: `server/src/server/migrations/startupMigrations.js`
- Create: `server/src/server/services/socialMentionService.js`
- Create: `server/src/server/controllers/__tests__/postSocialActions.test.js`
- Modify: `src/pages/Social.jsx`
- Create: `src/lib/mentions.js`
- Create: `src/lib/__tests__/mentions.test.mjs`

**Interfaces:**
- Produces: `POST /api/stage/posts/:id/like`
- Produces: `POST /api/stage/comments`
- Produces: `parseGamertagMentions(text): string[]`

- [ ] **Step 1: Add mention utility tests**

Create `src/lib/__tests__/mentions.test.mjs`:

```js
import test from "node:test";
import assert from "node:assert/strict";
import { parseGamertagMentions } from "../mentions.js";

test("parses unique gamertag mentions", () => {
  assert.deepEqual(parseGamertagMentions("gg @Alpha_10 and @Alpha_10 vs @Beta-FC"), ["Alpha_10", "Beta-FC"]);
});

test("ignores email addresses", () => {
  assert.deepEqual(parseGamertagMentions("mail me a@b.com and ping @Player"), ["Player"]);
});
```

- [ ] **Step 2: Implement frontend mention utility**

Create `src/lib/mentions.js`:

```js
export function parseGamertagMentions(text = "") {
  const seen = new Set();
  const matches = String(text).matchAll(/(^|\\s)@([A-Za-z0-9_-]{2,32})\\b/g);
  for (const match of matches) seen.add(match[2]);
  return [...seen];
}
```

- [ ] **Step 3: Add backend social mention service**

Create `server/src/server/services/socialMentionService.js`:

```js
function parseGamertagMentions(text = "") {
  const seen = new Set();
  for (const match of String(text).matchAll(/(^|\\s)@([A-Za-z0-9_-]{2,32})\\b/g)) {
    seen.add(match[2]);
  }
  return [...seen];
}

async function resolveMentionedPlayers(EXECUTESQL, content) {
  const names = parseGamertagMentions(content);
  if (!names.length) return [];
  const placeholders = names.map(() => "?").join(",");
  return EXECUTESQL(
    `SELECT id, gamertag, email, avatar_url FROM players WHERE gamertag IN (${placeholders})`,
    names
  );
}

module.exports = { parseGamertagMentions, resolveMentionedPlayers };
```

- [ ] **Step 4: Make likes a dedicated backend action**

In `postController.js`, add `POST /:id/like`. It must:

- Load current user by `req.user.id`.
- Load existing post.
- Toggle current user's email in `likes`.
- Persist `likes` and `likes_count`.
- Create a notification for `post.author_email` when liker is not author.
- Broadcast updated post.
- Return updated post.

- [ ] **Step 5: Make comments server-owned**

In `commentController.js`, change POST so request body only controls `post_id` and `content`. Server resolves:

```js
author_email = currentUser.email
author_name = player.gamertag || currentUser.full_name || currentUser.email
author_avatar = player.avatar_url || ""
```

Then increment `posts.comments_count`, create notifications for post owner and mentioned players, and return the created row.

- [ ] **Step 6: Update Social UI**

In `src/pages/Social.jsx`, change:

```js
await stageClient.entities.Post.update(post.id, { likes: newLikes, likes_count: newLikes.length });
```

to:

```js
const updated = await stageClient.http.post(`/posts/${post.id}/like`, {});
setPosts(prev => prev.map(p => p.id === post.id ? { ...updated, _type: "post", _sortDate: updated.created_date } : p));
```

Change comment create to:

```js
const c = await stageClient.entities.Comment.create({
  post_id: post.id,
  content: commentInput.trim(),
});
```

- [ ] **Step 7: Run targeted checks**

Run:

```bash
npm run test -- src/lib/__tests__/mentions.test.mjs
npm run test:server -- server/src/server/controllers/__tests__/postSocialActions.test.js
npm run lint
```

Expected: mentions parse, social actions notify, and frontend has no stale client-owned author fields.

---

### Task 5: Notification Read Reliability

**Files:**
- Modify: `server/src/server/controllers/notificationController.js`
- Create: `server/src/server/controllers/__tests__/notificationReadController.test.js`
- Modify: notification UI component found by `rg "stageClient.entities.Notification|notifications" src`

**Interfaces:**
- Produces: `POST /api/stage/notifications/:id/read`
- Optional: `POST /api/stage/notifications/read-link` with `{ link }`

- [ ] **Step 1: Add backend read endpoint**

In `notificationController.js`, add before `GET /:id`:

```js
router.post('/:id/read', async (req, res) => {
  // load current user, load notification, ensure recipient matches or admin,
  // update `read` = 1, broadcast, return updated row
});
```

- [ ] **Step 2: Add click-through frontend helper**

In the notification UI, replace direct navigation with:

```js
async function openNotification(notification) {
  const updated = await stageClient.http.post(`/notifications/${notification.id}/read`, {}).catch(() => null);
  setNotifications(prev => prev.map(n => n.id === notification.id ? { ...n, read: 1, ...(updated || {}) } : n));
  navigate(notification.link || "/notifications");
}
```

- [ ] **Step 3: Run checks**

Run:

```bash
npm run test:server -- server/src/server/controllers/__tests__/notificationReadController.test.js
npm run typecheck
```

Expected: unread count drops immediately and cannot mark another user's notification.

---

### Task 6: Showcase Uploads And Player Profile Viewer

**Files:**
- Modify: `server/schema.sql`
- Modify: `server/src/server/migrations/startupMigrations.js`
- Modify: `server/src/server/models/playerShowcaseVideoModel.js`
- Modify: `server/src/server/controllers/playerShowcaseVideoController.js`
- Modify: `server/src/server/models/__tests__/playerShowcaseVideoModel.test.js`
- Modify: `src/components/scouting/PlayerShowcase.jsx`
- Modify: `src/components/scouting/VideoEmbed.jsx`

**Interfaces:**
- Showcase row fields:

```js
{
  id,
  player_id,
  title,
  media_url,
  media_type: "video",
  duration_seconds,
  description,
  sort_order,
  likes_count,
  comments_count
}
```

- [ ] **Step 1: Schema migration**

Add columns to `player_showcase_videos`:

```sql
title VARCHAR(120) NULL,
media_url TEXT NULL,
media_type VARCHAR(30) DEFAULT 'video',
duration_seconds DECIMAL(6,2) NULL,
likes_count INT DEFAULT 0,
comments_count INT DEFAULT 0
```

Keep `url` nullable temporarily during migration, then stop writing it from new UI.

- [ ] **Step 2: Model update**

Update `PlayerShowcaseVideo` constructor to accept `title`, `media_url`, `media_type`, `duration_seconds`, `likes_count`, `comments_count`. `create()` should insert new fields and no longer require URL for new uploaded videos.

- [ ] **Step 3: Controller validation**

In `playerShowcaseVideoController.js`, POST should require:

- `player_id`
- `title` length 1-120
- uploaded/returned `media_url`
- `duration_seconds <= 10`
- ownership via existing `requireOwnership`

Return `400` when duration is over 10 seconds.

- [ ] **Step 4: Frontend upload UI**

In `PlayerShowcase.jsx`, replace URL input with:

```jsx
<input type="file" accept="video/*" />
<Input value={title} onChange={...} placeholder={t("commonPages.showcaseTitlePlaceholder")} />
```

Use `document.createElement("video")` with object URL metadata to check duration before upload. If duration is over 10 seconds, show an error and do not upload.

- [ ] **Step 5: Player profile video modal**

On player profile showcase cards, clicking the video opens a Radix Dialog with a larger `<video controls autoPlay={false}>`. Do not show like or comment controls in this component.

- [ ] **Step 6: Run checks**

Run:

```bash
npm run test:server -- server/src/server/models/__tests__/playerShowcaseVideoModel.test.js
npm run typecheck
npm run lint
node --check server/src/server/controllers/playerShowcaseVideoController.js
```

Expected: local upload flow works, URL input is gone, player profile has no showcase likes/comments.

---

### Task 7: Public Scouting Discovery From Showcase Videos

**Files:**
- Modify: `src/pages/Scouting.jsx`
- Create: `src/components/scouting/ScoutingVideoCard.jsx`
- Create: `src/components/scouting/ScoutingVideoModal.jsx`
- Modify: `server/src/server/controllers/playerShowcaseVideoController.js`
- Modify: `server/schema.sql`
- Modify: `server/src/server/migrations/startupMigrations.js`

**Interfaces:**
- Produces: `GET /api/stage/player-showcase-videos/scouting?filter=recent&position=ST&country=BE`
- Produces: `POST /api/stage/player-showcase-videos/:id/like`
- Produces: `POST /api/stage/player-showcase-videos/:id/comments`

- [ ] **Step 1: Backend scouting list**

Add a route before `/:id`:

```js
router.get('/scouting', async (req, res) => {});
```

Return showcase videos joined with player fields:

```js
{
  id,
  title,
  media_url,
  duration_seconds,
  likes_count,
  comments_count,
  player_id,
  gamertag,
  avatar_url,
  position,
  country_code
}
```

Support filters:

- `recent`: newest first.
- `position`: exact player/showcase position.
- `country`: exact country code.
- `trending`: `likes_count + comments_count DESC`.

- [ ] **Step 2: Backend scouting interactions**

Add showcase like/comment endpoints that:

- Work only in Scouting, not in `PlayerShowcase`.
- Toggle like by current user email.
- Create notifications for video owner on like/comment when actor is not owner.
- Return updated video/comment.

- [ ] **Step 3: Rebuild Scouting page**

Replace `ScoutingReport` creation flow with showcase discovery. Remove `CreateReportDialog`, vote UI, archive UI, and manual scouting-report posting from the public page.

Keep:

- filters
- video modal
- like/comment controls
- link to `/players/:id`
- contract/contact affordance only if existing product rules allow it

- [ ] **Step 4: Run checks**

Run:

```bash
npm run typecheck
npm run lint
node --check server/src/server/controllers/playerShowcaseVideoController.js
```

Expected: Scouting shows uploaded showcase videos only; users cannot post directly in Scouting.

---

### Task 8: Trophy Award Semantics

**Files:**
- Modify: `server/src/server/functions/legacyFunctions.js` or create `server/src/server/services/trophyAwardService.js`
- Create or modify: `server/src/server/services/__tests__/trophyAwardService.test.js`
- Modify: `src/components/profile/PlayerTrophyCabinet.jsx` only if display filtering is wrong

**Interfaces:**
- Produces: helper:

```js
async function awardClubTrophyToClubAndPlayers({ clubId, trophyItemId, tournamentId }) {}
async function awardPlayerOnlyTrophy({ playerId, trophyItemId, tournamentId }) {}
```

- [ ] **Step 1: Extract trophy placement helper**

Move repeated insert/update logic for `trophy_placements` into a service helper if it is currently embedded in `legacyFunctions.js`.

- [ ] **Step 2: Club trophies unlock for squad players**

When a club wins a club competition, insert/update one `owner_type = 'club'` placement for the club and one `owner_type = 'player'` placement for each active club player.

- [ ] **Step 3: Player trophies stay player-only**

When a player wins a player/community/STAGE player tournament, insert/update only `owner_type = 'player'`.

- [ ] **Step 4: Run tests**

Run:

```bash
npm run test:server -- server/src/server/services/__tests__/trophyAwardService.test.js
node --check server/src/server/functions/legacyFunctions.js
```

Expected: club win creates club and player placements; player win does not create a club placement.

---

### Task 9: Remove Follow Backend Flow

**Files:**
- Modify: `server/src/server/routes/registerStageRoutes.js`
- Delete or freeze: `server/src/server/controllers/followController.js`
- Delete or freeze: `server/src/server/models/followModel.js`
- Modify: `server/schema.sql`
- Modify: `server/src/server/migrations/startupMigrations.js`
- Modify: `server/src/server/services/accountDeletion.js`
- Modify: `src/api/stageClient.js`
- Modify: `src/pages/GameDay.jsx`
- Search and modify all remaining files from `rg -n "Follow|follow|followers|following|follows" src server`

**Interfaces:**
- Produces: no frontend or backend caller references `Follow`.

- [ ] **Step 1: Remove frontend entity registration**

Remove `'Follow'` from `ENTITY_NAMES` in `src/api/stageClient.js`.

- [ ] **Step 2: Remove Game Day follow dependency**

In `src/pages/GameDay.jsx`, delete followed-club/player fetches and replace feed sections with neutral upcoming/relevant matches based on current player/club only.

- [ ] **Step 3: Remove route mount**

In `server/src/server/routes/registerStageRoutes.js`, delete:

```js
app.use('/api/stage/follows', verifyToken, require('../controllers/followController'));
```

- [ ] **Step 4: Schema cleanup**

Do not drop production table automatically unless the deploy owner approves destructive migration. In schema for fresh installs, remove `CREATE TABLE IF NOT EXISTS follows`. In startup migrations, stop creating the table. Leave an explicit comment if old DBs may retain historical `follows` rows unused.

- [ ] **Step 5: Account deletion cleanup**

Remove follow cleanup queries from `server/src/server/services/accountDeletion.js` after the app no longer writes/reads follows.

- [ ] **Step 6: Run global search and checks**

Run:

```bash
rg -n "Follow|follow|followers|following|follows" src server
npm run typecheck
npm run lint
node --check server/src/server.js
```

Expected: remaining matches are translation leftovers, changelog/docs, or unrelated words only.

---

### Task 10: Final Integration, Endpoint Verification, And Graph Update

**Files:**
- Modify only files touched by prior tasks if bugs are found.
- Update: `graphify-out/` by running graphify update per repo rule.

**Interfaces:**
- Produces: deploy-ready working tree.

- [ ] **Step 1: Full verification**

Run:

```bash
npm run lint
npm run typecheck
npm run test
npm run test:server
node --check server/src/server.js
```

- [ ] **Step 2: API smoke tests**

With local API running and a valid token:

```bash
curl -s -H "Authorization: Bearer $TOKEN" "http://localhost:8080/api/stage/player-careers/<player-id>" | jq .
curl -s -H "Authorization: Bearer $TOKEN" "http://localhost:8080/api/stage/player-showcase-videos/scouting?filter=recent" | jq .
curl -s -X POST -H "Authorization: Bearer $TOKEN" "http://localhost:8080/api/stage/notifications/<notification-id>/read" | jq .
```

Expected: JSON responses match the route contracts and permission rules.

- [ ] **Step 3: Manual UI walkthrough**

Check:

- Player profile tabs: no Stats, no follow, Career renders two sections.
- Dashboard: no EA/FUT panels.
- Feed: like heart updates immediately, comments use Gamertag, owner gets notification.
- Mentions: `@Gamertag` notifies mentioned users.
- Notification click: unread count clears before/when navigating.
- Showcase: local video upload only, rejects videos over 10 seconds, title required, modal plays video.
- Scouting: uploads from Showcase appear, filters work, video modal supports Scouting likes/comments, no direct posting.
- Trophies: club win appears on club and player profiles; player win appears only on player profile.

- [ ] **Step 4: Update graph**

Run:

```bash
graphify update .
```

Expected: graph update completes after code modifications.

---

## Self-Review

**Spec coverage:** All user requirements are represented: Stats tab removal, Career split, form badge removal, EA/FUT removal, trophy semantics, post likes/comments/notifications, @mentions, follow removal, notification read reliability, local showcase uploads, Scouting discovery and filters.

**Known sequencing dependency:** Task 9 should happen after Tasks 1 and 7, because existing pages still reference `Follow` and `ScoutingReport` during early phases.

**Risk:** The trophy award logic currently appears partly embedded in `legacyFunctions.js`; if extraction is too broad, keep helper functions local and add focused tests first.

**No destructive DB action:** Fresh schema can remove follows, but startup migrations should not automatically drop an existing production table without explicit owner approval.
