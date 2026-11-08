# Competition exceptions and organizer scheduling — 8 November 2026

Local implementation; no production connection, reset, deletion, payout,
subscription mutation, push or deployment. Chat approvals are recorded in the
[masterplan](stage-competition-masterplan.md). Default application text is English.

## Locations and behaviour

| Location | Implemented behaviour |
| --- | --- |
| `/admin/leagues` → permanent league management → Official competition decisions | Absence evidence, reviewed absence closure, club withdrawal preview/application, explicit player suspension impose/revoke and regional transfer review. |
| `/admin/forfeits`, expired fixture actions | Evidence-backed explicit 3–0 decisions, canonical/source scores and original audited evidence. No artificial individual goals. |
| `/admin/rewards` → Competition financial exceptions | Explicit refund or signed compensation, club/player recipient, original transaction and reason. Separate deterministic ledger entry; no paid obligation or historical ledger overwritten. |
| `/register-league` → Change regional system | President reads destination conditions and requests a same-earned-tier vacancy after final sporting rights. Historical source roster remains; the future affiliation changes atomically. |
| `/tournaments/:id` → Tournament schedule | Fixed phase/round dates or bounded windows, participant consent before entry/fees, organizer publication before entry. Creation opens this same setup panel. |
| Same tournament → Request a fixture time change | Original kickoff remains until both actual participants accept. Decline/cancel leaves it unchanged. Final agreement rechecks conflicts and stores a per-match exception; the rest of the published calendar stays. |
| League Table and overview | Withdrawn clubs stay visible after eligible clubs, retain the required historical totals and show ineligible status. They cannot be shown as league leader or inherit new entry rights from an excluded standing. |
| Regional participation conditions | New windows capture withdrawal terms and their version. Already accepted windows are not rewritten. |

The Admin forms use existing business POST routes with database-derived roles and
transactional audit. Internal competition records use the existing `league_entities`
store. Organizer schedule policy is a nullable tournament column in both fresh
schema and startup migration; older tournaments retain their prior behaviour.
No new external package or hosted service is required.

## Withdrawal and sporting limits

An explicit evidence-backed withdrawal before all nineteen first-half fixtures
are definitive cancels/excludes every league fixture of that club. After that
threshold, the nineteen first-half results remain and all returns become 3–0 for
the opponents, including previously played returns. Raw appearance/evidence rows
remain as history. Derived player career totals are rebuilt from real remaining
results; administrative scores generate no individual goals.

The stored decision explicitly excludes the club from title/prizes/promotion and
provides no guaranteed next-season place. Central prize placements omit it and
advance eligible clubs. Withdrawal cannot blindly rewrite an already allocated
cycle, captured qualification or paid settlement. Those dependencies are held for
existing Admin review and their history remains intact.

**Completion follow-up:** an explicitly approved annulment now satisfies fixture
resolution for league completion and source-cycle preparation, while remaining
excluded from standings and player statistics. The original group roster and
all fixture identities remain historical. Corrected eligible rankings feed the
existing sporting decisions and reserve allocation. Withdrawn old rights are
removed even if the club submits a fresh timely application; that application
enters as an ordinary replacement at the lowest existing tier. A D1-only
20-club region therefore admits its confirmed replacement in D1; no imaginary
D2 is created. Where D2 exists, the established D2 reserve priority remains.

Already pending/confirmed applications for the immediately following edition in
the same regional system are withdrawn as part of the explicit decision, with
original records preserved in its receipt/audit. The preview lists these
applications before confirmation. A fresh application is possible during the
published registration period and must complete normal confirmation. No new
registration deadline, grace period or automatically restored sporting right is
introduced. Reopening preserves the original application ID, including IDs
created by an earlier regional transfer.

The captured reward budget and position amounts remain unchanged. An empty
finishing position after withdrawal is shown as not awarded, with its original
amount retained as unawarded budget; it is not redistributed. Existing paid or
ambiguous obligations continue through the existing explicit financial review.
Lack of enough confirmed reserves, an unsupported count, unresolved sporting
decisions or unapproved shrinkage still uses the existing exception route.
These genuine exceptions are not replaced with newly invented admission rules.
No new tests or test scenarios were added/run for this completion follow-up.

Absence facts are separate from scores. Both clubs absent or three confirmed
absence facts in the same edition require review. Review closure does not itself
award a result or impose a suspension. Only explicit dated/scoped Admin
suspensions are enforced, including after a player moves clubs.

## Regional and financial exceptions

A successful regional move needs final earned tier, personal Plus, at least three
eligible squad players, current destination conditions and a matching available
place. Confirmed clubs are never displaced. Drawn fixtures, captured Cups,
unmatched season calendars or missing rights remain review. Admin can return the
request to the president or reject it; review cannot force an unearned place.
Original cycle plan, source registrations/standings and historical memberships
are preserved. A vacancy left in the source future group is exposed for review.

Refunds reference the same account's actual debit and cannot exceed it after
previous refunds. Compensation may reference the original other-recipient payment
without modifying that payment. Negative corrections cannot overdraw the balance.
Concurrent retries create one ledger entry. Both player and club existing ledger
schemas are used; the short ledger type `adjustment` fits both schemas. No default
refund amounts or financial eligibility policies were invented.

## Organizer schedules

New editions capture `organizer_schedule_v1`. Publication is organizer/Admin-only;
entry acceptance is by the actual player or club president. Accepted competition
terms cannot be changed through generic PATCH. Protected roster/lifecycle fields
also use their existing actions. First draws validate the complete plan before
writes, including actual round-robin rounds rather than assigning every first-leg
match to round one. Old stored round numbers are not silently changed.

League/group blocks are forty minutes; knockout blocks sixty. A bounded window
must fit the complete block. Conflicts are checked against stored participant
matches, official schedules and declared individual club appearances. These are
app declarations and schedules, not automatic proof of what occurred in EA.
Per-match changes require both participants, preserve the old time until approval,
then recheck the current source state and conflicts. Idempotent retries do not
repeat notifications or writes. No new automatic expiry policy was invented.

## Acceptance evidence and limits

- [Normal season, rerun](acceptance-results/normal-season-2026-11-07.json):
  40 clubs, 84 placement games, 760 league fixtures, 39 Cup games, three promotion
  games, settlement and next-edition play with fresh-process recovery.
- [Match/financial exceptions](acceptance-results/match-exceptions-2026-11-08.json):
  real isolated MySQL/JWT/HTTP forfeits, withdrawal at eighteen/nineteen, played
  return corrections, raw stats/career totals, explicit sanctions after physical
  transfer, concurrent refunds, player ledger, compensation without rewriting paid
  history, both-absent/third-absence review and stable retries.
- [Regional transfers](acceptance-results/regional-transfers-2026-11-08.json):
  earned D2 cannot use empty D1; full D2 refuses; free D2 place admits atomically;
  original roster/plan kept; one affiliation; Admin review, notification and retry.
- [Organizer schedules](acceptance-results/organizer-schedule-2026-11-08.json):
  real creation/version, owner permissions, consent before fee, conflicting entry,
  actual round-based draw, controlled changes/participant roles and window bounds.
- [Chrome desktop/mobile](acceptance-results/browser-exceptions-2026-11-08/report.json):
  real Vite/API pages, actual schedule acceptance, management and financial forms,
  no horizontal overflow or runtime exceptions in those recorded routes. Screenshots
  were inspected. This is not an assertion that every Admin/browser action was
  exercised or that production matches the local build.

Reports intentionally retain `complete: false` for the overall programme and a
separate true route-completion flag. Read the current [delivery status](competition-delivery-status.md)
for remaining implementation, open policy and production milestones. Graphify is
unavailable in this workspace; no graph update is claimed.


## Implementation flow and verification scope

The user invoked `ask-matt`; its direct implementation route used the existing
masterdocument as the specification and the existing local ticket convention
under `.scratch/competition-completion/`. No interview, external tracker or new
policy framework was introduced. The user expressly excluded new checks/tests;
no test files or scenarios changed and no tests were run for this delta. Existing
lint/typecheck and backend syntax commands were used as repository requirements.
The saved acceptance reports above predate this delta.

The implementation flow's source review found two issues that were corrected:

| Axis | Finding and correction |
| --- | --- |
| Standards | No hard documented-standard violation. Reopening now preserves an existing application ID, so transferred registrations update their actual row. |
| Spec | The D1-only twenty-club replacement route now uses the lowest existing tier instead of requiring a nonexistent D2 reserve candidate. |

Production deployment, the exact live duplicate-ID repair, launch dates and
intentionally deferred policy remain separate. GOST and D3 stay closed.
