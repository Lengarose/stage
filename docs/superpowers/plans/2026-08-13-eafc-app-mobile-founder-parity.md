# EAFC App Mobile Founder Parity Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Update `/Users/creaafde/Documents/eafc/eafc-app` so mobile API actions and onboarding match the StageLeagues backend-owned Player + President founder lifecycle.

**Architecture:** Keep contracts, President identity, player attachment, and club creation backend-owned through `/api/stage/clubs/founder`. Mobile becomes a thin client: it gathers player/club input, calls one lifecycle endpoint, and consumes the returned `{ player, club, playerContract, presidentContract, contracts, membership }` state. Preserve legacy President compatibility for reads only; do not create standalone President profiles in new mobile onboarding.

**Tech Stack:** Expo SDK 54, React Native 0.81, Expo Router, Jest, `@testing-library/react-native`, existing mobile `stageClient`.

## Global Constraints

- Target mobile repo is `/Users/creaafde/Documents/eafc/eafc-app`.
- Ignore obsolete `/Users/creaafde/Documents/workbench stage/stage-app`.
- Do not touch Transfer Room.
- Do not duplicate backend business logic in mobile.
- Mobile high-trust actions must call `/api/stage` action wrappers, not generic CRUD.
- Player + President onboarding must create/reuse two backend contracts: `founder_player` and `ownership`.
- Player + President must not remain a free agent after onboarding succeeds.
- Legacy President entity may remain as compatibility fallback, but must not be the normal public identity source.

---

## File Structure

Files to modify in mobile:

- `/Users/creaafde/Documents/eafc/eafc-app/src/api/stageClient.js`
  - Add `clubs.createFounder`, `posts.likeToggle`, and `comments.createForPost`.
  - Update identity resolver comments and behavior around legacy President fallback.

- `/Users/creaafde/Documents/eafc/eafc-app/src/components/onboarding/ClubSetup.jsx`
  - Replace generic club creation and post-create contract acceptance with `stageClient.clubs.createFounder`.
  - Return full founder lifecycle state to the parent.

- `/Users/creaafde/Documents/eafc/eafc-app/src/app/auth/onboarding.jsx`
  - Remove President-only as normal onboarding choice.
  - Keep `Player` and `Player + President`.
  - Ensure Player + President requires player creation first.

Tests to add in mobile:

- `/Users/creaafde/Documents/eafc/eafc-app/src/__tests__/api/stageClientParity.test.js`
  - Source/runtime guard for new API wrappers.

- `/Users/creaafde/Documents/eafc/eafc-app/src/__tests__/onboarding/clubSetupFounderParity.test.jsx`
  - Source/component guard for founder onboarding behavior.

- `/Users/creaafde/Documents/eafc/eafc-app/src/__tests__/onboarding/onboardingIntentParity.test.jsx`
  - Source guard that President-only is not a normal onboarding choice and Player + President remains.

---

### Task 1: Add Mobile API Wrapper Tests

**Files:**
- Create: `/Users/creaafde/Documents/eafc/eafc-app/src/__tests__/api/stageClientParity.test.js`
- Modify later: `/Users/creaafde/Documents/eafc/eafc-app/src/api/stageClient.js`

**Interfaces:**
- Consumes: `stageClient.http.post(path, body)` already exists.
- Produces:
  - `stageClient.clubs.createFounder(body): Promise<object>`
  - `stageClient.posts.likeToggle(postId): Promise<object>`
  - `stageClient.comments.createForPost(body): Promise<object>`

- [ ] **Step 1: Create the failing source guard test**

Create `/Users/creaafde/Documents/eafc/eafc-app/src/__tests__/api/stageClientParity.test.js`:

```js
const fs = require('fs');
const path = require('path');

const sourcePath = path.join(__dirname, '../../api/stageClient.js');
const source = fs.readFileSync(sourcePath, 'utf8');

describe('mobile stageClient parity wrappers', () => {
  it('exposes backend-owned founder club creation', () => {
    expect(source).toMatch(/const clubs\s*=\s*{/);
    expect(source).toMatch(/createFounder\(body\s*=\s*{}\)/);
    expect(source).toMatch(/http\.post\('\/clubs\/founder',\s*body\)/);
    expect(source).toMatch(/stageClient\s*=\s*{[^}]*clubs/s);
  });

  it('exposes server-owned feed like and comment actions', () => {
    expect(source).toMatch(/const posts\s*=\s*{/);
    expect(source).toMatch(/likeToggle\(postId\)/);
    expect(source).toMatch(/\/posts\/\$\\{encodeURIComponent\(postId\)\\}\/like-toggle/);
    expect(source).toMatch(/const comments\s*=\s*{/);
    expect(source).toMatch(/createForPost\(body\s*=\s*{}\)/);
    expect(source).toMatch(/http\.post\('\/comments',\s*body\)/);
    expect(source).toMatch(/stageClient\s*=\s*{[^}]*posts[^}]*comments/s);
  });
});
```

- [ ] **Step 2: Run the test and confirm it fails**

Run:

```bash
cd "/Users/creaafde/Documents/eafc/eafc-app" && npm test -- src/__tests__/api/stageClientParity.test.js
```

Expected:

- Fails because `clubs.createFounder`, `posts.likeToggle`, and `comments.createForPost` are missing.

- [ ] **Step 3: Add wrappers to `stageClient.js`**

Modify `/Users/creaafde/Documents/eafc/eafc-app/src/api/stageClient.js` near the existing `http` helper:

```js
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

const clubs = {
  createFounder(body = {}) {
    return http.post('/clubs/founder', body);
  },
};
```

Then update the export:

```js
export const stageClient = {
  entities,
  auth,
  integrations,
  functions,
  http,
  identityClaims,
  competitionEngine,
  profileMatches,
  chatReads,
  presidents,
  clubs,
  posts,
  comments,
};
```

- [ ] **Step 4: Run the wrapper test again**

Run:

```bash
cd "/Users/creaafde/Documents/eafc/eafc-app" && npm test -- src/__tests__/api/stageClientParity.test.js
```

Expected:

- Pass.

---

### Task 2: Make Mobile Identity Resolver Treat President Entity As Compatibility

**Files:**
- Modify: `/Users/creaafde/Documents/eafc/eafc-app/src/api/stageClient.js`
- Test: `/Users/creaafde/Documents/eafc/eafc-app/src/__tests__/api/stageClientParity.test.js`

**Interfaces:**
- Consumes: `resolveMyPlayerAndClub()`.
- Produces: Resolver still returns `{ user, player, club, presidentClub, president, activeRoles }`, but comments and lookup order must make `clubs.president_player_id` the canonical President identity when present.

- [ ] **Step 1: Extend the parity test**

Add this test to `/Users/creaafde/Documents/eafc/eafc-app/src/__tests__/api/stageClientParity.test.js`:

```js
it('documents legacy President as compatibility fallback only', () => {
  expect(source).toMatch(/New player-president flows use clubs\.president_player_id as the public identity/);
  expect(source).toMatch(/legacy first-class President entity/i);
});
```

- [ ] **Step 2: Run the test and confirm it fails**

Run:

```bash
cd "/Users/creaafde/Documents/eafc/eafc-app" && npm test -- src/__tests__/api/stageClientParity.test.js
```

Expected:

- Fails because the mobile resolver still says first-class President is separate from club auth.

- [ ] **Step 3: Update resolver comments without breaking return shape**

In `/Users/creaafde/Documents/eafc/eafc-app/src/api/stageClient.js`, replace the resolver section comment:

```js
  // 7) Resolve first-class President entity (profile), separate from club auth.
  // A user may own/preside over a club while their player remains a free agent.
  // Never synthesize player.club_id from presidentClub/ownedClub here.
```

with:

```js
  // 7) Resolve legacy first-class President entity when present. New
  // player-president flows use clubs.president_player_id as the public identity.
  // Keep President rows as compatibility data only; do not synthesize a
  // separate public President identity from them in new flows.
```

- [ ] **Step 4: Run the parity test**

Run:

```bash
cd "/Users/creaafde/Documents/eafc/eafc-app" && npm test -- src/__tests__/api/stageClientParity.test.js
```

Expected:

- Pass.

---

### Task 3: Route ClubSetup Through Founder Lifecycle

**Files:**
- Create: `/Users/creaafde/Documents/eafc/eafc-app/src/__tests__/onboarding/clubSetupFounderParity.test.jsx`
- Modify: `/Users/creaafde/Documents/eafc/eafc-app/src/components/onboarding/ClubSetup.jsx`

**Interfaces:**
- Consumes:
  - `stageClient.clubs.createFounder(body)`
  - `player.id`
  - `user.id`
  - `user.email`
- Produces:
  - `onComplete(founderState)` where `founderState` includes at least `club`, `player`, `playerContract`, `presidentContract`, `membership`.

- [ ] **Step 1: Create failing source guard test**

Create `/Users/creaafde/Documents/eafc/eafc-app/src/__tests__/onboarding/clubSetupFounderParity.test.jsx`:

```js
const fs = require('fs');
const path = require('path');

const sourcePath = path.join(__dirname, '../../components/onboarding/ClubSetup.jsx');
const source = fs.readFileSync(sourcePath, 'utf8');

describe('mobile ClubSetup founder parity', () => {
  it('uses backend-owned founder lifecycle instead of generic Club.create', () => {
    expect(source).toMatch(/stageClient\.clubs\.createFounder/);
    expect(source).not.toMatch(/stageClient\.entities\.Club\.create/);
    expect(source).not.toMatch(/contractManagement/);
  });

  it('requires a player id for Player + President founder club creation', () => {
    expect(source).toMatch(/player\?\.id/);
    expect(source).toMatch(/Player profile is required before creating a founder club/);
  });

  it('passes normalized founder payload fields to the backend', () => {
    expect(source).toMatch(/player_id:\s*player\.id/);
    expect(source).toMatch(/club:\s*{/);
    expect(source).toMatch(/name:\s*name\.trim\(\)/);
    expect(source).toMatch(/tag:\s*tag\.trim\(\)\.toUpperCase\(\)\.slice\(0,\s*5\)/);
  });
});
```

- [ ] **Step 2: Run the test and confirm it fails**

Run:

```bash
cd "/Users/creaafde/Documents/eafc/eafc-app" && npm test -- src/__tests__/onboarding/clubSetupFounderParity.test.jsx
```

Expected:

- Fails because mobile still uses generic club creation and `contractManagement`.

- [ ] **Step 3: Replace generic creation in `ClubSetup.jsx`**

In `/Users/creaafde/Documents/eafc/eafc-app/src/components/onboarding/ClubSetup.jsx`, remove `toPresidentApiPayload(...)` if it becomes unused.

In `handleCreate`, after required club fields validation, add:

```js
    if (!player?.id) {
      setError('Player profile is required before creating a founder club');
      return;
    }
```

Replace:

```js
      const presidentProfile = {
        display_name: displayName,
        role_title: roleTitle,
        country,
        country_code: COUNTRIES.find((c) => c.name === country)?.code || '',
        success_level: 'successful',
        social_link: '',
        bio: '',
        quote: '',
        management_style: '',
      };

      const club = await stageClient.entities.Club.create({
        user_id: user?.id,
        name: name.trim(),
        tag: tag.trim().toUpperCase().slice(0, 5),
        platform,
        region,
        country_code: COUNTRIES.find((c) => c.name === country)?.code || country,
        owner_email: user?.email,
        logo_url: null,
        description: '',
        wins: 0,
        losses: 0,
        draws: 0,
        goals_scored: 0,
        goals_conceded: 0,
        rating: 1500,
        peak_rating: 1500,
        matches_ranked: 0,
        is_provisional: 1,
        trophies: 0,
        credits: 0,
        stc: 2500000,
        wage_budget_stc: 250000,
        transfer_budget_stc: 1000000,
        stadium_level: 0,
        stadium_capacity: 5000,
        tier: 'Silver',
        win_streak: 0,
        loss_streak: 0,
        status: 'active',
        president: toPresidentApiPayload(presidentProfile),
      });

      if (!club?.id) throw new Error('Server returned no club ID');

      const contractId = club.president_contract_id || club.owner_contract_id || null;
      const presidentId = club.president_id || club.president?.id || null;
      if (contractId && presidentId) {
        await stageClient.functions
          .invoke('contractManagement', {
            action: 'accept',
            contract_id: contractId,
            president_id: presidentId,
          })
          .catch(() => {});
      }

      onComplete?.(club);
```

with:

```js
      const founderState = await stageClient.clubs.createFounder({
        user_id: user?.id,
        player_id: player.id,
        club: {
          name: name.trim(),
          tag: tag.trim().toUpperCase().slice(0, 5),
          platform,
          region,
          country_code: COUNTRIES.find((c) => c.name === country)?.code || country,
          owner_email: user?.email,
          logo_url: null,
          description: '',
          status: 'active',
        },
        president_profile: {
          display_name: displayName.trim() || player?.gamertag || user?.email || 'President',
          role_title: roleTitle.trim() || 'President',
          country,
          country_code: COUNTRIES.find((c) => c.name === country)?.code || '',
        },
      });

      if (!founderState?.club?.id) throw new Error('Server returned no club ID');
      onComplete?.(founderState);
```

- [ ] **Step 4: Run the ClubSetup source test**

Run:

```bash
cd "/Users/creaafde/Documents/eafc/eafc-app" && npm test -- src/__tests__/onboarding/clubSetupFounderParity.test.jsx
```

Expected:

- Pass.

---

### Task 4: Remove President-Only From Mobile Onboarding Choices

**Files:**
- Create: `/Users/creaafde/Documents/eafc/eafc-app/src/__tests__/onboarding/onboardingIntentParity.test.jsx`
- Modify: `/Users/creaafde/Documents/eafc/eafc-app/src/app/auth/onboarding.jsx`

**Interfaces:**
- Consumes:
  - `PlayerSetup`
  - `IdentityClaimSetup`
  - `ClubSetup`
- Produces:
  - Normal choices: `Player`, `Player + President`
  - No normal `President`-only choice.

- [ ] **Step 1: Create failing source guard test**

Create `/Users/creaafde/Documents/eafc/eafc-app/src/__tests__/onboarding/onboardingIntentParity.test.jsx`:

```js
const fs = require('fs');
const path = require('path');

const sourcePath = path.join(__dirname, '../../app/auth/onboarding.jsx');
const source = fs.readFileSync(sourcePath, 'utf8');

describe('mobile onboarding intent parity', () => {
  it('keeps Player and Player + President as normal choices', () => {
    expect(source).toMatch(/>Player</);
    expect(source).toMatch(/>Player \+ President</);
  });

  it('does not offer President-only as a normal onboarding card', () => {
    expect(source).not.toMatch(/setOnboardingIntent\('president'/);
    expect(source).not.toMatch(/setStep\('owner_club'\)/);
    expect(source).not.toMatch(/>President</);
  });

  it('routes Player + President through player setup before club setup', () => {
    expect(source).toMatch(/setOnboardingIntent\('both',\s*'player'\)/);
    expect(source).toMatch(/intent === 'both'\)\s*setStep\('club'\)/);
  });
});
```

- [ ] **Step 2: Run the test and confirm it fails**

Run:

```bash
cd "/Users/creaafde/Documents/eafc/eafc-app" && npm test -- src/__tests__/onboarding/onboardingIntentParity.test.jsx
```

Expected:

- Fails because `onboarding.jsx` still renders President-only and `owner_club`.

- [ ] **Step 3: Remove President-only role card and owner-club branch**

In `/Users/creaafde/Documents/eafc/eafc-app/src/app/auth/onboarding.jsx`:

Remove this normal role card:

```jsx
                  <TouchableOpacity
                    style={[s.roleCard, { borderColor: 'rgba(245,158,11,0.35)' }]}
                    onPress={() => {
                      setOnboardingIntent('president', 'club');
                      setClubSetupPhase('president');
                      setStep('owner_club');
                    }}
                  >
                    <STText style={[s.roleTitle, { color: '#FBBF24' }]}>President</STText>
                    <STText style={s.roleDesc}>
                      Found a club, build a squad, and enter competitions as club owner.
                    </STText>
                  </TouchableOpacity>
```

Remove the `owner_club` render block:

```jsx
              {step === 'owner_club' ? (
                <ClubSetup
                  onComplete={finishOnboarding}
                  onPhaseChange={setClubSetupPhase}
                  player={player}
                  user={user}
                  required
                />
              ) : null}
```

Change `getStepMeta(...)` so `owner_club` is no longer needed:

```js
  if (step === 'club' && dual) {
    return phase === 'club'
      ? { label: 'Club profile', index: 4, total: 5 }
      : { label: 'President status', index: 3, total: 5 };
  }
```

Keep the `Player + President` card:

```jsx
                  <TouchableOpacity
                    style={[s.roleCard, { borderColor: 'rgba(52,211,153,0.35)' }]}
                    onPress={() => {
                      setOnboardingIntent('both', 'player');
                      setStep('player');
                    }}
                  >
                    <STText style={[s.roleTitle, { color: '#34D399' }]}>Player + President</STText>
                    <STText style={s.roleDesc}>
                      Compete as a player and run your own club at the same time.
                    </STText>
                  </TouchableOpacity>
```

- [ ] **Step 4: Run the onboarding parity test**

Run:

```bash
cd "/Users/creaafde/Documents/eafc/eafc-app" && npm test -- src/__tests__/onboarding/onboardingIntentParity.test.jsx
```

Expected:

- Pass.

---

### Task 5: Refresh Identity After Founder Onboarding

**Files:**
- Modify: `/Users/creaafde/Documents/eafc/eafc-app/src/app/auth/onboarding.jsx`
- Modify if needed: `/Users/creaafde/Documents/eafc/eafc-app/src/services/onboardingService.js`
- Test: `/Users/creaafde/Documents/eafc/eafc-app/src/__tests__/onboarding/clubSetupFounderParity.test.jsx`

**Interfaces:**
- Consumes: `ClubSetup` calls `onComplete(founderState)`.
- Produces: After founder onboarding, app marks onboarding complete and routes to dashboard only after backend state exists.

- [ ] **Step 1: Add source assertion for founder completion shape**

Add this test to `/Users/creaafde/Documents/eafc/eafc-app/src/__tests__/onboarding/clubSetupFounderParity.test.jsx`:

```js
it('returns full founder state to onboarding completion', () => {
  expect(source).toMatch(/onComplete\?\.\(founderState\)/);
  expect(source).toMatch(/founderState\?\.club\?\.id/);
});
```

- [ ] **Step 2: Run the focused onboarding tests**

Run:

```bash
cd "/Users/creaafde/Documents/eafc/eafc-app" && npm test -- src/__tests__/onboarding/clubSetupFounderParity.test.jsx src/__tests__/onboarding/onboardingIntentParity.test.jsx
```

Expected:

- Pass after Tasks 3 and 4.

- [ ] **Step 3: Keep onboarding completion simple**

Do not add client-side contract acceptance. The backend founder endpoint has already created:

```js
{
  player,
  club,
  contract,
  playerContract,
  presidentContract,
  contracts,
  membership
}
```

The existing `finishOnboarding()` can remain the final transition:

```js
const finishOnboarding = () => {
  stageClient.auth.updateTimezone(timezone).catch(() => {});
  if (isDiscordConfigured()) setStep('discord');
  else setTutorialOpen(true);
};
```

If identity appears stale after manual testing, add a narrow refresh before `finishOnboarding`:

```js
const handleFounderComplete = async () => {
  await resolveMyPlayerAndClub().catch(() => null);
  finishOnboarding();
};
```

Then pass `onComplete={handleFounderComplete}` to `ClubSetup`.

Do not add this refresh unless the focused tests or manual smoke show stale identity after founder creation.

---

### Task 6: Verification

**Files:**
- No additional files.

**Interfaces:**
- Consumes all previous tasks.
- Produces verified mobile M1 + M2 parity.

- [ ] **Step 1: Run focused mobile tests**

Run:

```bash
cd "/Users/creaafde/Documents/eafc/eafc-app" && npm test -- src/__tests__/api/stageClientParity.test.js src/__tests__/onboarding/clubSetupFounderParity.test.jsx src/__tests__/onboarding/onboardingIntentParity.test.jsx
```

Expected:

- All focused tests pass.

- [ ] **Step 2: Run full mobile test suite**

Run:

```bash
cd "/Users/creaafde/Documents/eafc/eafc-app" && npm test
```

Expected:

- All existing tests pass.

- [ ] **Step 3: Run syntax/import smoke**

Run:

```bash
cd "/Users/creaafde/Documents/eafc/eafc-app" && node -c src/api/stageClient.js
```

Expected:

- Syntax check passes for the CommonJS-compatible parse path if Node accepts the file. If Node rejects ESM syntax, rely on Jest/Babel test pass and note the reason.

- [ ] **Step 4: Run Stage repo status check**

Run:

```bash
cd "/Users/creaafde/Documents/workbench stage/stage" && git status --short
```

Expected:

- Stage repo only contains intentional analysis/plan docs and any pre-existing `Layout.jsx` modification.

- [ ] **Step 5: Run mobile repo status check**

Run:

```bash
cd "/Users/creaafde/Documents/eafc/eafc-app" && git status --short
```

Expected:

- Only intended mobile files are modified/added.

---

## Plan Self-Review

Spec coverage:

- M1 API wrappers: Task 1.
- Founder onboarding parity: Tasks 3-5.
- President-only removal: Task 4.
- Legacy President compatibility wording: Task 2.
- Tests and verification: Tasks 1-6.
- Transfer Room untouched: global constraint.

Known deferred work:

- M3 President-as-Player profile parity.
- M4 canonical profile tabs.
- M5 feed media/trust UI.
- Backend Slice 15 match result lifecycle.
- M6 mobile match result proof UX.
- M7 competition progression visibility.

This plan deliberately does not implement those later slices.
