# Regional season calendar — 3 November 2026

User confirmation: the European calendar package was explicitly approved on
3 November 2026. The masterplan §7 records that approval separately from the
unconfirmed rescheduling and future pathway/cup details.

## Where to find it

Admin → Regional Leagues → **Complete regional season calendar**
(Dutch: **Volledige regionale seizoenskalender**).
The separate single-fixture scheduling form remains directly below it.

1. Finish official registration/placement and draw each group's league fixtures.
2. Select all populated current groups of one regional system/season/platform.
3. Choose the **Monday of the first playing week**, not registration opening.
   No actual launch date is assumed or prefilled.
4. Preview and inspect all 38 round times and any conflict messages.
5. Enter an administrative reason, review the checkbox, then publish.

The action is `POST /api/stage/regional-leagues/calendar`, with `edition_ids`,
`start_monday`, and, for publication, `apply:true`, `expected_revision`, `reason`.
It is an Admin-only business action under the existing authenticated router.
There is no generic CRUD route for the internal calendar record.

## What it does

- Requires current, unambiguous, non-retired official D1/D2 editions carrying the
  `regional_registration_v1` participation policy. Existing/legacy schedules
  are not silently adopted. Every group needs 20 unique clubs and a complete,
  consistent 380-fixture, 38-round home/away draw.
- Applies the confirmed European profile: Tuesday/Thursday 20:00 and 20:40,
  `Europe/Brussels`, four rounds per week in weeks 1–9 and rounds 37/38 on
  Tuesday in week 10. All fixtures within a round share their kickoff time.
- Keeps local kickoff times stable across daylight-saving changes.
- Checks existing club matches, native engine events and legacy competition/
  regional fixtures. Linked aliases count once. Match blocks are 40 minutes
  for known league formats and conservatively 60 for other/unknown formats.
  Missing timezone evidence requires review rather than an invented timezone.
- Rejects overlapping blocks, >2 matches/day, >7/week or >4 playing days/week.
  Existing dated club bookings are checked conservatively, including bookings
  outside the new official regional system.
- A source revision covers policy, editions, draw and existing bookings. Apply
  re-reads those sources in the transaction and refuses a stale preview.
- Writes the existing fixture IDs, optional engine mappings and canonical
  GameDay Matches together; preserves existing unscheduled Match IDs.
  Conflicting pointers, unrelated source identities, played/scheduled matches
  or existing official preparation evidence require review.
- Publishes per-fixture audit rows (`publish_calendar`), one calendar Admin audit,
  one immutable internal `regional_calendar` record and summary in-app notices
  to the clubs' current contacts. Missing contacts/failed writes roll back the
  whole operation. It does not send external email.
- Repeating publication for the same scope and Monday returns the saved record,
  without creating duplicate matches or notifications. Changing an already
  published calendar uses the existing controlled single-fixture action.
- That European single-fixture action now also checks block lengths and club
  load limits, and shares the official calendar write mutex with publication.

## Deliberate limits

- This generates the **league portion**, not a complete multi-competition solver.
  Weeks 11/12 remain reserved; cup, promotion, placement and decision draws are
  not invented or auto-scheduled by this action. 180→240 expansion is not unlocked.
- No North American calendar profile, GOST launch or D3 activation.
- Individual players' future selections across multiple events cannot be inferred
  from this club calendar. Their availability integration remains separate.
- This is initial publication, not bulk rescheduling. Existing schedules and
  preparation evidence are preserved by rejecting initial publication over them.
- Rescheduling quotas, last-round exceptions, outage handling and precise
  publication lead-time/buffer policy are not newly approved by this calendar
  confirmation. The existing >5-minute selection-lock safety still applies.
- The mutex covers these official schedule writers. Legacy/third-party scheduling
  writers and MySQL transaction/concurrency behavior need staging integration
  checks before production activation. Database queries conservatively lock
  involved club records; real-host throughput is not benchmarked.
- Existing public fixture/GameDay views read the saved times through their normal
  data flow. This step does not add a second public calendar page.

## Verification

171 selected local service/HTTP regression tests pass. They cover complete draws, multiple
D1/D2 groups, DST, intervals/load caps, stale previews, identity/pointer conflicts,
Admin authorization, idempotence and rollback after notification failure.
The real Express route is exercised over local HTTP with controlled model/auth
fixtures. This does **not** validate a real MySQL database or production JWTs.
Lint, typecheck, backend syntax and production frontend build are checked.
The two previously documented functionsController baseline failures remain outside
the selected passing suite; they are not claimed fixed here.
No production data, deployment, reset, financial transaction or browser session
was used. Graphify report/wiki are absent and `graphify update .` cannot run
because the CLI is not installed.
