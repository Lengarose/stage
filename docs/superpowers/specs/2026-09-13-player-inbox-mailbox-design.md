# Player Inbox Mailbox Design

Date: 2026-09-13  
Owner: Stage League  
Scope: Player inbox on Stage web (`/inbox`, `/tournaments/inbox`) and EAFC mobile (`/apps/inbox`). Not admin IMAP Mail.

## 1. Goal

The inbox is a **notification-style mailbox**: each event is a new mail at the top of the list. The player **reads** it and, when needed, **acts** on it (Accept, Decline, Propose time, Open Game Day). Those actions run the real business on the server. Web and mobile behave the same.

This is not Gmail. No sent folder, no labels, no conversation threading, no starring.

## 2. Product rules (source of truth)

1. **New event → new mail.** A new match invite, schedule proposal, result, contract offer, loan event, or similar always inserts a new inbox row. It never overwrites an older mail.
2. **New mail is first.** The list is newest `created_date` first. Nothing sits above a newly created mail.
3. **Old pending mails stay.** Previous mails remain visible and stay clickable, including Accept / Decline, until the server rejects the action because the world moved on.
4. **Inbox is for read + action.** The notification bell may ping. Accept / Decline / Propose / Open Game Day exist only on the inbox mail, never on the notification row.
5. **Retry is not a new event.** The same send retried with the same `event_id` updates that one row. A second user action (new invite, new proposal, new offer) gets a new `event_id` and a new mail.

## 3. What is broken today

These are the behaviours this spec replaces:

- Arrange Game keys the mail on the **opponent**, so a second match against the same club rewrites the first mail.
- League / tournament schedule keys the mail on the **fixture**, so a new proposed time rewrites the previous mail.
- Upsert updates `updated_date` but the list sorts by `created_date`, so a rewritten mail stays buried.
- Live sockets replace an existing id in place; only a new id is prepended.
- `tournament_schedule` Accept / Decline on web and mobile patch the mail status locally and do not confirm the match.
- `match_result` / `match_dispute` use `action_type: open_match` but the UI has no Open Game Day control.
- Home links to `/inbox` without `?id=`.
- `/tournaments/inbox` ignores `tournamentId`.
- Web `InboxMessageDetail` calls `respondInboxMessage` only for `match_invite`. Other actionable types update status in the client.

## 4. Delivery

### 4.1 Seam

All player-facing inbox writes go through `sendActionMessage` (today also reached via `sendInboxMessage`).

Callers pass an **`event_id`** that identifies this send, not the opponent, fixture, or contract alone.

Idempotency key shape:

```
{message_type}:{event_id}:{recipient_email}
```

- Same key → UPDATE that row (network retry / double submit of the same send).
- Different `event_id` → INSERT. `created_date = NOW()`. Broadcast create. Notification link `/inbox?id={newId}`.

`related_entity_id` remains metadata (which match, fixture, contract, loan). It is **not** the uniqueness key.

`reuseByRelated` stays false for every player mailbox send, including contracts and loans.

### 4.2 Who generates `event_id`

The producer of the event generates it **once per user action**:

| Producer | Event |
|---|---|
| Arrange Game | Each invite send |
| Cancel / reschedule request | Each request |
| League / competition `proposeTime` | Each proposal |
| Tournament schedule propose | Each proposal |
| Match result negotiation | Each `eventKey` (already unique per event; keep that) |
| Contract offer / counter | Each offer round |
| Loan deliver* | Each loan event (proposal, recall, early end, purchase, terminated) |
| Registrations / phase_ready / wager | Each occurrence |

Client `sendInboxMessage` today builds the key from `related_entity_id`. That builder must stop using opponent/fixture/contract id as the event identity.

The UI generates `event_id` **once per click**. If that HTTP call is retried, the same id is reused (one mail). A second click is a new id (new mail). If `event_id` is omitted, the server generates a UUID so a missing id **creates** a row instead of collapsing onto an old one.

### 4.3 Notifications

Each **new** inbox INSERT may create one notification:

- Title/body describe the mail.
- `link` is `/inbox?id={messageId}` (mobile maps this to `/apps/inbox/[id]`).
- The notification has no Accept / Decline.
- Reuse of a notification is allowed only for the same inbox `event_id` retry, not for a later event.

## 5. List and detail

### 5.1 List

- Query: recipient is the current user, `ORDER BY created_date DESC`, limit 200.
- Empty subject and empty body stay hidden.
- Unread styling + “needs action” when `action_type` is not `none` and `status` is `pending`.
- Timestamp in the list is `created_date`.
- Socket: new id prepends; existing id updates in place (retries only).
- Poll (15s) must not reshuffle a prepended new mail under older `created_date` rows.

### 5.2 Detail

The mail body is read-only.

If the mail is pending and actionable, the action bar shows the controls for that type:

| `message_type` / flag | Controls | Server |
|---|---|---|
| `match_invite` | Accept, Decline, Propose date | `respondInboxMessage` |
| cancel request | Confirm cancel, Keep match | `respondInboxMessage` |
| `league_schedule` | Accept, Decline, Propose | `respondInboxMessage`, which calls `scheduleEngine` internally |
| `tournament_schedule` | Accept, Decline | `respondInboxMessage` |
| `match_result` / `match_dispute` | Open Game Day | Navigate to `/game-day?match=` (metadata.link). Status may stay informational; this is navigation, not Accept/Decline. |
| `contract_offer` | Accept, Decline, Counter (web; mobile at least Accept/Decline) | contract management via `respondInboxMessage` or a dedicated function invoked from it |
| `trial_request` | Accept / offer, Decline | same seam |
| `loan_proposal` / `loan_purchase` / `loan_early_end` | Accept, Decline | same seam |
| `loan_recalled` / `loan_terminated_early` | Read only | none |
| other info mails | Read only | none |

Clicking Accept / Decline **never** only sets `inbox_messages.status` on the client. The server performs the domain change, then marks that mail responded.

### 5.3 Stale actions

Old pending mails stay clickable. If the related entity is no longer in a state where that action is valid (fixture already confirmed, contract already accepted, match already cancelled), the server returns an error. The UI shows that error on the mail. The mail is not silently marked accepted.

## 6. Surfaces

| Surface | Behaviour |
|---|---|
| `/inbox` | Full mailbox |
| `/inbox?id=` | Select that mail, mark read |
| `/tournaments/inbox` | Same mailbox, filtered to that tournament’s mails when `tournamentId` is present |
| Home panel / dashboard glance | Open `/inbox?id=` for the row clicked |
| Push / OneSignal | Open `/inbox?id=` or `/apps/inbox/[id]` |
| `/notifications` | List of alerts. Row click opens the inbox mail. No Accept/Decline on the alert. |
| Game Day | Continues to **create** mails. It does not embed the mailbox. Result mails send the player back to Game Day via Open Game Day. |

Admin IMAP Mail (`MailTab`) is out of scope.

## 7. Architecture

Two deep modules. Callers do not insert inbox rows or invent per-feature upsert keys.

### 7.1 Deliver

Interface: recipient, subject, body, message type, action type, related entity, metadata, **event_id**, notify flag.

Implementation: idempotent INSERT/UPDATE by `event_id` + recipient, broadcast, optional notification.

### 7.2 Respond

Interface: `message_id`, action, optional date/time/payload. Auth: recipient only.

Implementation: load mail, dispatch on `message_type` / metadata flags, run domain logic (create match, confirm fixture via `scheduleEngine`, accept contract via `contractManagement`, loan response, …), mark that mail responded, optionally deliver a **new** informational mail to the other party (new event, new `event_id`).

Web `InboxMessageDetail` and mobile `respondToInboxMessage` both call this one function for every actionable type except pure navigation (`open_match`).

## 8. Platforms

Parity is required, not “web first”:

- Same delivery keys and respond API.
- Mobile already calls `respondInboxMessage` for `match_invite` and `scheduleEngine` for league schedule. League decline and tournament schedule must go through the respond seam. Contract/loan/trial must not fall back to a local status patch when the domain call fails without telling the user.

## 9. Testing (acceptance)

A change is done only if these are true:

1. Two Arrange Game invites to the same opponent produce **two** inbox rows. The newest is first.
2. Retrying the same invite send (same `event_id`) does **not** add a second row.
3. A second time proposal on the same fixture produces a new mail on top. The previous proposal mail remains in the list.
4. Accepting a tournament schedule mail confirms the match on the server.
5. A result mail shows Open Game Day and that control opens `/game-day?match={id}`.
6. Accepting a contract mail from inbox actually accepts the contract.
7. Home / push with `?id=` opens that mail.
8. Notification rows have no Accept/Decline.
9. Web and mobile pass the same cases.

Tests that only assert `sendInboxMessage` was invoked are not enough.

## 10. Out of scope

- Admin IMAP mailbox (`info@`, MailTab).
- Gmail features (sent, folders, archive, snooze, threads).
- Auto-closing or hiding old pending mails.
- Kickoff / lineup as inbox mails (remain notifications unless a later spec adds them).
- Redesign of contract counter UI beyond making Accept/Decline hit the server on both platforms.
