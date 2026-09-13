# Player Inbox Mailbox Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the player inbox a notification-style mailbox: each event is a new mail at the top; the player reads it and Accept / Decline / Open Game Day run the real server action.

**Architecture:** Delivery uniqueness is `event_id`, not opponent/fixture/contract id. `sendInboxMessage` / `sendActionMessage` INSERT a new row per event (UPDATE only on retry of the same `event_id`). `respondInboxMessage` is the only action seam for Accept / Decline. Web UI never patches `inbox_messages.status` alone for actionable types.

**Tech Stack:** Stage web (Vite/React), Stage server (Node + MySQL), `node --test`, existing `messageDeliveryService` mocks.

**Spec:** `docs/superpowers/specs/2026-09-13-player-inbox-mailbox-design.md`

**Mobile:** Do not implement EAFC in this plan. Prompt for a separate agent: [`/Users/creaafde/Documents/eafc/eafc-app/docs/MOBILE_INBOX_MAILBOX_PROMPT.md`](/Users/creaafde/Documents/eafc/eafc-app/docs/MOBILE_INBOX_MAILBOX_PROMPT.md).

## Global Constraints

- Inbox is a notification-style mailbox (read + Accept / Decline). Not Gmail. Not admin IMAP Mail.
- New event → new mail at the top (`created_date DESC`). Old pending mails stay clickable.
- Retry of the same click (`event_id`) updates that one row.
- Accept / Decline exist only on the inbox mail, never on Notifications.
- Web and mobile must share the same server API; this plan owns server + Stage web.
- Tests that only assert `sendInboxMessage` was invoked are not enough.
- Do not add sent folders, labels, threads, or auto-hide old pending mails.

---

## File Structure

- `src/lib/inboxEventId.js` — `createInboxEventId()` for one UUID per click.
- `server/src/server/services/messageDeliveryService.js` — keep `reuseByRelated` default false; uniqueness is the caller’s `idempotencyKey` / `event_id`.
- `server/src/server/functions/legacyFunctions.js` — `sendInboxMessage` builds `{message_type}:{event_id}:{email}`; `respondInboxMessage` dispatches league_schedule / tournament_schedule / contract / loan / trial.
- `src/components/schedule/ArrangeGameDialog.jsx` — pass `event_id` on each send.
- `src/lib/scheduleEngine.js` — pass `event_id` on each propose / confirm / decline mail.
- `src/pages/TournamentDetail.jsx` — pass `event_id` on tournament schedule propose.
- `src/lib/contractOfferDelivery.js` — pass `event_id` (contract + round is the event).
- `src/components/inbox/InboxMessageDetail.jsx` — always `respondInboxMessage` for actionable types; Open Game Day for `open_match`.
- `src/pages/Inbox.jsx` — filter `/tournaments/inbox` by tournament id.
- `src/pages/Home.jsx` — `/inbox?id=`.
- Tests under `server/src/server/services/__tests__/`, `server/src/server/controllers/__tests__/`, `src/lib/__tests__/`.

---

### Task 1: Event-id delivery keys

**Files:**
- Create: `src/lib/inboxEventId.js`
- Modify: `server/src/server/functions/legacyFunctions.js` (`sendInboxMessage`)
- Test: `server/src/server/services/__tests__/messageDeliveryService.test.js`
- Test: `src/lib/__tests__/actionableInboxDelivery.test.mjs`

**Interfaces:**
- Consumes: `sendActionMessage({ idempotencyKey, reuseByRelated })`
- Produces:
  - `createInboxEventId(): string` (UUID)
  - `sendInboxMessage({ event_id, ... })` uses key `` `${message_type}:${event_id}:${recipient}` ``
  - If `event_id` omitted, server generates a UUID (creates; does not collapse onto opponent/fixture id)

- [ ] **Step 1: Write the failing test**

Add to `messageDeliveryService.test.js`:

```js
test('sendActionMessage inserts a second row when event keys differ but related entity is the same', async () => {
  const queries = [];
  const { service } = loadMessageDeliveryServiceWithDbMock(async (sql) => {
    queries.push(sql);
    if (/FROM inbox_messages WHERE idempotency_key = \?/.test(sql)) return [];
    if (/DELETE FROM inbox_messages/.test(sql)) return { affectedRows: 0 };
    if (/INSERT INTO inbox_messages/.test(sql)) return { affectedRows: 1 };
    if (/FROM inbox_messages WHERE id = \? LIMIT 1/.test(sql)) return [];
    if (/FROM players WHERE LOWER\(email\)=LOWER\(\?\)/.test(sql)) return [{ notification_settings: '{}' }];
    if (/FROM notifications WHERE idempotency_key = \?/.test(sql)) return [];
    if (/FROM notifications WHERE recipient_email = \? AND type = \? AND related_id = \?/.test(sql)) return [];
    if (/INSERT INTO notifications/.test(sql)) return { affectedRows: 1 };
    throw new Error(`Unexpected SQL: ${sql}`);
  });

  await service.sendActionMessage({
    recipientEmail: 'away@example.test',
    subject: 'Invite 1',
    body: 'First match',
    messageType: 'match_invite',
    actionType: 'accept_decline_date',
    relatedEntityId: 'club-opponent',
    relatedEntityType: 'club',
    idempotencyKey: 'match_invite:event-aaa:away@example.test',
    reuseByRelated: false,
  });
  await service.sendActionMessage({
    recipientEmail: 'away@example.test',
    subject: 'Invite 2',
    body: 'Second match',
    messageType: 'match_invite',
    actionType: 'accept_decline_date',
    relatedEntityId: 'club-opponent',
    relatedEntityType: 'club',
    idempotencyKey: 'match_invite:event-bbb:away@example.test',
    reuseByRelated: false,
  });

  assert.equal(queries.filter((sql) => /INSERT INTO inbox_messages/.test(sql)).length, 2);
});
```

- [ ] **Step 2: Run test to verify it fails or already passes (current default is already INSERT when keys differ)**

Run: `npm run test:server -- --test-name-pattern "event keys differ"`
Expected: PASS if `reuseByRelated` stays false. Keep the test as the regression lock.

- [ ] **Step 3: Change `sendInboxMessage` key builder**

In `legacyFunctions.js` `sendInboxMessage`, replace the key that uses `related_entity_id` with:

```js
const eventId = String(event_id || '').trim() || uuidv4();
const idempotencyKey = `${message_type}:${eventId}:${normalizedRecipient}`;
```

Add `event_id` to the destructured args. Pass `idempotencyKey` into `sendActionMessage` as today. Do **not** put opponent id, fixture id, or contract id into the key.

- [ ] **Step 4: Add `createInboxEventId`**

Create `src/lib/inboxEventId.js`:

```js
export function createInboxEventId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `evt-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}
```

- [ ] **Step 5: Extend actionableInboxDelivery test**

In `src/lib/__tests__/actionableInboxDelivery.test.mjs`, assert Arrange Game / scheduleEngine / contractOfferDelivery / TournamentDetail invoke `sendInboxMessage` with `event_id` (after Task 2). For this task, only add the helper file.

- [ ] **Step 6: Run server tests**

Run: `npm run test:server`
Expected: PASS, including the existing “new event key inserts” test.

- [ ] **Step 7: Commit**

```bash
git add src/lib/inboxEventId.js server/src/server/functions/legacyFunctions.js server/src/server/services/__tests__/messageDeliveryService.test.js
git commit -m "$(cat <<'EOF'
Use event_id for inbox delivery keys so a new match is a new mail.

EOF
)"
```

---

### Task 2: Producers pass a new event_id per click

**Files:**
- Modify: `src/components/schedule/ArrangeGameDialog.jsx` (send payload ~253)
- Modify: `src/lib/scheduleEngine.js` (`proposeTime`, `acceptProposal`, `declineProposal`)
- Modify: `src/pages/TournamentDetail.jsx` (`proposeSchedule` ~563)
- Modify: `src/lib/contractOfferDelivery.js`
- Test: `src/lib/__tests__/actionableInboxDelivery.test.mjs`

**Interfaces:**
- Consumes: `createInboxEventId()`
- Produces: every `sendInboxMessage` payload includes `event_id: createInboxEventId()` generated **once per click**, stored in a local const before `invoke`

- [ ] **Step 1: Write the failing source test**

Replace/extend `actionableInboxDelivery.test.mjs`:

```js
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

const srcRoot = path.resolve(import.meta.dirname, "../..");

const EVENT_ID_SOURCES = [
  "components/schedule/ArrangeGameDialog.jsx",
  "lib/scheduleEngine.js",
  "pages/TournamentDetail.jsx",
  "lib/contractOfferDelivery.js",
];

test("actionable inbox sends pass event_id so each click is a new mail", async () => {
  for (const relativePath of EVENT_ID_SOURCES) {
    const source = await readFile(path.join(srcRoot, relativePath), "utf8");
    assert.match(source, /createInboxEventId/, `${relativePath} must generate event_id`);
    assert.match(
      source,
      /event_id/,
      `${relativePath} must send event_id to sendInboxMessage`
    );
  }
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- --test-name-pattern "event_id"`
Expected: FAIL `createInboxEventId`

- [ ] **Step 3: Wire producers**

ArrangeGameDialog — before `invoke`:

```js
import { createInboxEventId } from "@/lib/inboxEventId";
const event_id = createInboxEventId();
await stageClient.functions.invoke("sendInboxMessage", {
  // existing fields
  event_id,
  related_entity_id: selected.id, // metadata only; not the uniqueness key
});
```

Same pattern in `scheduleEngine.js` for each `sendInboxMessage` (propose, accept-notify, decline-notify): `const event_id = createInboxEventId()` inside the map callback or once per recipient send.

TournamentDetail propose: same.

`contractOfferDelivery.js`: `event_id: \`contract:${contractId}:r${round || 0}\`` so the same offer round retries, a new round is a new mail.

- [ ] **Step 4: Run tests**

Run: `npm test -- --test-name-pattern "event_id"`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/components/schedule/ArrangeGameDialog.jsx src/lib/scheduleEngine.js src/pages/TournamentDetail.jsx src/lib/contractOfferDelivery.js src/lib/__tests__/actionableInboxDelivery.test.mjs
git commit -m "$(cat <<'EOF'
Pass a per-click event_id from Game Day, schedule, and contract inbox sends.

EOF
)"
```

---

### Task 3: respondInboxMessage is the action seam

**Files:**
- Modify: `server/src/server/functions/legacyFunctions.js` (`respondInboxMessage` from ~7413)
- Modify: `src/components/inbox/InboxMessageDetail.jsx` (`handleAction` ~76–93)
- Test: `server/src/server/controllers/__tests__/functionsController.test.js`

**Interfaces:**
- Consumes: existing tournament_schedule and match_invite branches
- Produces: `respondInboxMessage({ message_id, action, new_date, new_time })` also handles:
  - `league_schedule` — accept/decline/date_change by calling the same fixture confirm/open logic used by tournament_schedule (update fixture `scheduling_status`, `createMatchFromFixture` / existing server match materialize when accepted)
  - `contract_offer` — `action === 'accepted'|'declined'` delegates to existing `contractManagement` accept/reject
  - loan types — keep existing loan service; mark mail responded only after the loan function succeeds
  - On domain failure: throw; do **not** set `status=accepted`

- [ ] **Step 1: Write failing controller test**

In `functionsController.test.js`, add:

```js
test('respondInboxMessage confirms a tournament schedule instead of only patching mail status', async () => {
  // Reuse the existing tournament_schedule branch: action accepted must UPDATE matches.scheduling_status = confirmed.
});
```

Add:

```js
test('InboxMessageDetail source calls respondInboxMessage for tournament_schedule', async () => {
  const source = await readFile(path.resolve(__dirname, '../../../../../../src/components/inbox/InboxMessageDetail.jsx'), 'utf8');
  // Prefer a web-side source test in src/lib/__tests__/ instead if this path is awkward.
});
```

Put the UI source test in `src/lib/__tests__/inboxActionTypes.test.mjs` or a new `src/lib/__tests__/inboxMessageDetailActions.test.mjs`:

```js
test("InboxMessageDetail sends every actionable type through respondInboxMessage", async () => {
  const source = await readFile(path.join(srcRoot, "components/inbox/InboxMessageDetail.jsx"), "utf8");
  assert.match(source, /respondInboxMessage/);
  assert.doesNotMatch(
    source,
    /message_type === "match_invite"\) \{\s*await stageClient.functions.invoke\("respondInboxMessage"/
  );
});
```

The intent: delete the `if (message.message_type === "match_invite")` gate so **all** Accept / Decline go through `respondInboxMessage`.

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- --test-name-pattern "respondInboxMessage"`
Expected: FAIL on the source gate (still match_invite-only).

- [ ] **Step 3: Change InboxMessageDetail.handleAction**

```js
async function handleAction(action) {
  if (action === "date_change_requested" && !showDatePicker) {
    setShowDatePicker(true);
    return;
  }
  setLoading(action);
  setActionError("");
  try {
    await stageClient.functions.invoke("respondInboxMessage", {
      message_id: message.id,
      action,
      new_date: rescheduleDate || null,
      new_time: rescheduleTime || null,
    });
    onStatusChanged(message.id, action);
  } catch (err) {
    setActionError(err?.response?.data?.error || err?.message || t("matchFlow.actionFailed"));
  }
  setLoading(null);
  setShowDatePicker(false);
}
```

Keep dedicated cards (contract, loan, trial, league_schedule) **if** they already call domain APIs. After this change, generic Accept / Decline (tournament_schedule, match_invite, cancel) all hit the server. Then migrate `InboxScheduleProposal` accept/decline to `respondInboxMessage` as well (or have `respondInboxMessage` call the same fixture SQL the client used to trigger via entity update).

For `league_schedule` on the server, mirror tournament_schedule:

- Read `metadata.fixture_id` / `fixture_type`
- `accepted` / `confirmed` → set fixture `scheduling_status = 'confirmed'`, `confirmed_date`, materialize Match (existing `createMatchFromLeagueFixture` / competition equivalent; throw if not confirmed-gate compliant)
- `declined` → set fixture `scheduling_status = 'open'`, clear proposed dates
- `date_change_requested` → treat as a **new** propose event (new `event_id` mail to opponent)

If porting full scheduleEngine to the server is too large for one task, minimum for this task: **tournament_schedule + match_invite** go through `respondInboxMessage`; league_schedule card keeps calling `acceptProposal`/`declineProposal` (those already mutate fixtures). Do not leave tournament on a local `InboxMessage.update`.

- [ ] **Step 4: Stale actions**

When fixture/contract/match is no longer pending, `respondInboxMessage` throws e.g. `This action is no longer valid`. UI already has `actionError`.

- [ ] **Step 5: Run tests**

Run: `npm run test:server` and `npm test`
Expected: PASS existing respondInboxMessage tests plus new source gate.

- [ ] **Step 6: Commit**

```bash
git commit -m "$(cat <<'EOF'
Route inbox Accept and Decline through respondInboxMessage.

EOF
)"
```

---

### Task 4: Open Game Day + list/deep links

**Files:**
- Modify: `src/components/inbox/InboxMessageDetail.jsx`
- Modify: `src/lib/inboxActionTypes.js`
- Modify: `src/pages/Home.jsx` (InboxPanel links ~585)
- Modify: `src/pages/Inbox.jsx` (use `scopedTournamentId`)
- Test: `src/lib/__tests__/inboxActionTypes.test.mjs`

**Interfaces:**
- Produces:
  - `getEffectiveInboxActionType` returns `open_match` for `match_result` / `match_dispute` when `action_type === 'open_match'` (already if action_type is set)
  - Detail shows a button that `navigate`s to `metadata.link` or `/game-day?match=${related_entity_id}`
  - Home row: `to={\`/inbox?id=${msg.id}\`}`
  - Tournament inbox: filter messages whose `metadata.tournament_id` or related match belongs to `scopedTournamentId`

- [ ] **Step 1: Failing tests**

```js
test("open_match stays an actionable navigation type", () => {
  assert.equal(getEffectiveInboxActionType({
    message_type: "match_result",
    action_type: "open_match",
    status: "pending",
  }), "open_match");
  assert.equal(inboxMessageNeedsAction({
    message_type: "match_result",
    action_type: "open_match",
    status: "pending",
  }), true);
});
```

Source tests:

```js
test("Home inbox rows deep-link to a message id", async () => {
  const source = await readFile(path.join(srcRoot, "pages/Home.jsx"), "utf8");
  assert.match(source, /\/inbox\?id=\$/);
});

test("Inbox page filters tournament mailbox when tournamentId is set", async () => {
  const source = await readFile(path.join(srcRoot, "pages/Inbox.jsx"), "utf8");
  assert.match(source, /scopedTournamentId/);
  assert.match(source, /tournament_id/);
});
```

- [ ] **Step 2: Run tests — expect FAIL**

- [ ] **Step 3: Implement UI**

Open Game Day in the action bar when `effectiveActionType === "open_match"`:

```jsx
{effectiveActionType === "open_match" && (
  <Button size="sm" onClick={() => {
    const meta = parseInboxMetadata(message);
    const href = meta.link || (message.related_entity_id
      ? `/game-day?match=${message.related_entity_id}`
      : "/game-day");
    window.location.assign(href);
  }}>
    {t("nav.gameDay")}
  </Button>
)}
```

`showGenericActions` must include `open_match` (not only accept_decline). Do not show Accept/Decline for results.

Home: change `to="/inbox"` on each row to `to={\`/inbox?id=${msg.id}\`}`.

Inbox.jsx: if `scopedTournamentId`, filter `messages` where `parseInboxMetadata(m).tournament_id === scopedTournamentId` OR `m.related_entity_type === 'match'` with that tournament (metadata). Informational mails without tournament id stay hidden on the tournament route.

- [ ] **Step 4: Run tests — expect PASS**

- [ ] **Step 5: Commit**

```bash
git commit -m "$(cat <<'EOF'
Open Game Day from result mail and deep-link Home rows to /inbox?id=.

EOF
)"
```

---

### Task 5: Notifications stay alerts

**Files:**
- Verify: `src/pages/Notifications.jsx` — row click navigates `link`, no Accept/Decline
- Verify: `messageDeliveryService.notifyForActionMessage` link is `/inbox?id=${messageId}`

- [ ] **Step 1: Source test**

```js
test("Notifications page has no inbox Accept/Decline controls", async () => {
  const source = await readFile(path.join(srcRoot, "pages/Notifications.jsx"), "utf8");
  assert.doesNotMatch(source, /respondInboxMessage/);
  assert.doesNotMatch(source, /handleAction\("accepted"\)/);
});
```

- [ ] **Step 2: Run — PASS (lock)**

- [ ] **Step 3: Commit only if a code change was required**

---

## Spec coverage

| Spec rule | Task |
|---|---|
| New event → new mail | 1, 2 |
| New mail first (`created_date`) | 1 (INSERT) + existing list sort |
| Old pending stay | no auto-close |
| Inbox = read + actions | 3, 4 |
| Retry same event_id | 1 |
| Arrange Game not keyed on opponent | 2 |
| Tournament accept confirms match | 3 |
| Open Game Day | 4 |
| Home `?id=` | 4 |
| Tournament inbox filter | 4 |
| Notifications have no Accept/Decline | 5 |
| Mobile parity | `eafc-app/docs/MOBILE_INBOX_MAILBOX_PROMPT.md` (separate agent) |

## Placeholder scan

No TBD. League_schedule server port is allowed to stay on `scheduleEngine` for this plan **only if** Accept/Decline still run domain code (Task 3 minimum: tournament + match_invite through `respondInboxMessage`).
