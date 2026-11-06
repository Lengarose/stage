# Competition delivery status

Updated 5 November 2026. This is the current delivery checklist for the user's
request to finish the approved competition programme. Read this before choosing
the next implementation task or reporting overall completion.

The [masterplan](stage-competition-masterplan.md) remains the policy source.
Its B/N/O/L distinctions remain binding. Later confirmations and implementation
appendices supersede earlier status descriptions; they do not erase provenance.
Local implementation, successful tests, deployment, and live verification are
separate milestones. No production repair or deployment is recorded here.

## Delivery checklist

| Work package | Existing local work to preserve | Remaining acceptance evidence |
| --- | --- | --- |
| 1. Decisions and delivery tracking | Masterplan and phase handoffs; this checklist | Keep open decisions below current as each package progresses. |
| 2. Regional season orchestration | Stable league/edition identity, supported structure and growth plans, placement/transition engines, published registration and confirmation windows, official calendar planners, durable Cup/cycle recovery, automatic promotion final and automatic draft-group allocation for newly captured official cycles | Connect the complete approved lifecycle, reminders and rollover with durable retries and visible exceptions; exercise confirmation cutoff through the following edition. Existing recovery does not automatically prepare the first cycle or publish the first calendar. Legacy cycles retain reviewed manual allocation. |
| 3. Match procedures | Semantic score confirmation fix, canonical result evidence, tie decision engine, official selection/preparation, calendar guards; newly published regional windows capture 24-hour response/Admin-review policy with periodic deadline scan | Resolve remaining submission/rescheduling/absence/interruption/withdrawal policy gaps; verify disputes, expiry, corrections and downstream invalidation together. Legacy editions retain their captured conditions. |
| 4. Eligibility and access | Registrar/player personal Plus, minimum three, starters/reserves, readiness/lock and captured kickoff eligibility | Cross-region earned-tier transfers, transfer windows and Cup-tied enforcement; individual cross-event conflicts; agreed premium feature matrix and payment outage handling. |
| 5. Rewards and financial exceptions | Existing league/GOST reward flows, permanent Cup trophy assignments, captured Cup prizes, audited settlement/ledger/trophy recovery | Budget checks at growth, entry fees/refunds/compensation and ambiguous historical promises; verify real persisted recovery without duplicate payments or awards. |
| 6. Pages, rules and guidance | Approved competition designs, directory lists, white text tabs, contextual regional participation, edition rules, public Cup pages, Admin action overview; role tutorials updated in this session | Audit every relevant route and Guide against actual controls; align rule versions and short contextual tutorials; browser/mobile/accessibility checks; English default-copy audit. Preserve useful existing Lifestyle and onboarding content. |
| 7. Other tournaments | Existing player/club tournament creation and registration | Published fixed times or constrained windows, consent and conflict checks, organizer permissions, rules and design parity; inspect current implementation before extending it. |
| 8. Full season verification | Selected local regression suites with controlled persistence/auth | Isolated sufficient test clubs/players; complete season, decisions, Cup, settlement, rollover, retries and reset; real MySQL transactions/locks, JWT roles and browser flows. Controlled HTTP tests alone do not close this package. |
| 9. Production handover | Existing identity/reset repair tooling and deployment instructions | Read-only exact-ID dependency preview, reviewed repair, migrations/deploy/restart and live verification; final Admin/user guide explaining where every feature lives and how it works. |

## Confirmed choices: do not ask again

Latest local step: [closed field assessment](regional-field-assessment-phase6.md).
The Admin overview now validates captured confirmation evidence and reports the
approved capacity or blockers after the common deadline. The assessment itself
remains read-only; the separate allocation follow-up is described below.

Follow-up: [confirmed field → cycle preview](regional-confirmed-cycle-phase6.md)
now derives the canonical source/registration selection on the server and links
the overview directly to the existing controlled preparation. Unattended
activation remains separate from this field-selection automation.

4 November follow-up: [automatic draft allocation](regional-auto-allocation-phase6.md)
now converts final sporting rights into draft groups for newly captured qualifying
cycles. First-cycle preparation and first-calendar publication remain open.

The [allocation notification follow-up](regional-allocation-notifications-phase6.md)
now stores exact-edition in-app notices transactionally with supported cycle
allocation, respecting existing in-app club preferences.

The [confirmation-week reminder follow-up](regional-confirmation-reminders-phase6.md)
now stores one in-app opening notice for pending applications in newly captured
windows. It respects preferences, atomically records a receipt and exposes
stored/muted/pending Admin counts. Other reminder events, email/push delivery and
first-calendar automation remain separate. The recovery follow-up now gives these
notices stored two-minute leases, stale-attempt protection, fifteen-minute failure
backoff and scoped Admin review. Notice receipts still prevent duplicate storage;
closed windows never reopen for retry. 301 selected regressions and the required
local checks pass; real MySQL/JWT/browser/live verification remains open.

The [saved allocation → calendar handoff](regional-cycle-calendar-handoff-phase6.md)
now links the action overview and saved cycle directly to its complete stored
group selection. The existing calendar action derives IDs server-side, validates
the allocation and binds it to the preview revision. Drawing fixtures, selecting
the first playing Monday and reviewed publication remain explicit actions. This
does not close the first-calendar automation or outstanding date-policy gates.
The follow-up in that handoff now inventories actual group fixtures and exposes
the existing audited draw action beside each empty group, with explicit reason,
confirmation and a server-side allocation-pointer recheck. Existing draws are
preserved; failed/uncertain responses require fresh inventory before retry.
333 selected server regressions and eight frontend-helper tests pass locally.

The [calendar notification follow-up](regional-calendar-notifications-phase6.md)
now stores one transactional notice per club with an exact edition/Stages link,
canonical current-president contact and existing match in-app preferences.
Published calendars capture stored/muted counts; old calendars are not backfilled.
338 selected server regressions and required local checks pass. This does not add
email/push delivery, extra reminder schedules or live-verification evidence.

The [regional result-review overview](regional-result-overview-phase6.md) now
surfaces stored disputed/Admin-review matches from active leagues, pathways and
Cups, with exact GameDay evidence and existing general dispute-control links.
It does not infer deadlines or decide outcomes. 341 selected server regressions
and a final 15-test operations run pass; live/browser verification remains open.
The focused-review follow-up in that handoff now loads the exact canonical match
via `/admin/disputes?match=…`, independently of the general list's first fifty
records. Resolved/failed reads cannot offer a guessed decision. Existing single-
match reads support both stored Admin roles; nonparticipant restrictions remain.
347 selected server regressions and three frontend-helper tests pass locally.
The evidence follow-up in the same handoff now shows original proposals and
separate dispute sheets (screenshots, explanations, claimed scores and timestamps)
in both the review page and existing decision dialog. Eight focused frontend
tests, including static rendering, pass; actual browser/mobile QA remains open.
The [Admin snapshot follow-up](admin-result-review-snapshot-phase6.md) now binds
new dialog decisions to the reviewed evidence. Changed proposals/dispute sheets/
state reject before applying a result; formatting and operational reminders do
not create false conflicts. Legacy API callers without a snapshot retain prior
behaviour. 348 selected server regressions and 19 frontend tests pass locally.
The [explicit Admin penalty follow-up](admin-result-penalties-phase6.md) now
verifies the entered final score against existing server deciding-leg/aggregate
context and requires an explicit penalty winner where applicable. Ordinary results
explicitly clear obsolete penalty fields. 358 selected server regressions and
30 frontend tests pass; browser/live verification remains open.
The [GameDay conditions notice](official-result-conditions-phase6.md) now shows
verified captured v1/v2 result terms and the current proposal/correction response
deadline in local time. Older editions are not upgraded; missing dates do not
invent deadlines or results. 358 selected server regressions and 35 frontend tests pass locally;
browser/live verification and the remaining submission policies stay open.
The [public edition-conditions follow-up](public-edition-conditions-phase6.md)
now exposes the selected league's exact linked conditions and the Cup's embedded
snapshot through their existing rules views. Missing/legacy/mismatched sources
never inherit current terms. 365 selected server regressions and 37 frontend
tests pass locally; the full rules/tutorial and browser/live audits remain open.
The accessibility follow-up in the [result-review handoff](regional-result-overview-phase6.md)
now uses a labelled modal evidence preview with opener-focus restoration and
image-load fallback links. 38 selected frontend tests pass; real browser/mobile
keyboard/focus checks remain explicitly open.
The [bounded Admin review list](admin-review-pagination-phase6.md) now loads its
own authenticated cursor pages, distinguishes load failures from verified emptiness
and opens each row through exact-match review. The new read-only route is tested
over local HTTP for both Admin roles, page boundaries and denied/failed reads.
366 selected server regressions and 40 frontend tests pass; browser/live and the
other dashboard-feed audits remain open.
The [GameDay review summary](admin-review-summary-phase6.md) now shares the
bounded review list’s pending predicate and displays a full count plus ten-case
preview. Unavailable reads remain unknown; exact-match links mount Disputes.
Eight controller tests and 44 selected frontend/render tests pass for this step;
other dashboard categories and real database/browser/live checks remain open.
The [shared Admin GameDay feeds](admin-action-feeds-phase6.md) now cover the other
three GameDay categories and the shell/dashboard counts too. Independent failure
states, full fixture paging and a shared unknown-until-verified total replace the
catch-to-empty feeds. Named views and query tabs open their associated lists.
Nine controller and 58 frontend/helper/render tests pass locally. Other Admin
inventories, legacy Match-read scaling, concurrent live paging and real database/
browser/deployment validation remain open.

- Structure and normal promotion/growth tables for
  20/40/60/80/100/120/180/240 clubs: masterplan §§4–5, confirmed 2 November.
- Stored random extra placement draw, first drawn home; two-club decision match,
  three/four-club single round robin and Admin review on unresolved repeats or
  larger ties: confirmed 2 November.
- European league calendar, limits and blocks; week-11 promotion semifinals and
  final: masterplan §7 and calendar appendices, confirmed 3 November.
- Cup inclusion, stored draws/byes, Sunday calendar, six names and no GOST ticket:
  masterplan §11 and Cup handoffs, confirmed 3 November.
- Cup winner 7m STC, finalist 3m, no bronze prize or extra fee, STAGE-funded:
  masterplan §13 and Cup rewards handoff, confirmed 3 November.
- Four registration weeks plus one shared confirmation week; personal Plus for
  registrar and participating players; minimum three, optional keeper, ANY allowed.
- Home normally submits; away may submit after full time if no proposal exists;
  mandatory submitter proof and 24-hour opponent response.
- No response after 24 hours means Admin review for new official regional
  competitions, explicitly confirmed 3 November; silence never approves these results.
- Either-side first reporting is locally implemented under newly published v2
  conditions; see [entry handoff](regional-result-entry-phase6.md). Existing v1
  windows keep their prior entry terms and 24-hour response policy.
- English default app copy, contextual registration, clear user/Admin rules and
  short useful tutorials, plus a final navigation/operation handover.

## Open policy and activation gates

Only the dependent action waits for a missing decision. Continue independent
implementation. A historic isolated A/B answer is not evidence of its question.

| Gate | Needed before |
| --- | --- |
| Unsupported confirmation counts, waiting-list priority, vacancies/shrinkage | Automatically selecting a season field; current service correctly refuses to silently omit confirmed clubs. |
| Absolute launch dates and placement/transition blocks within the twelve-week cycle | Publishing the launch and enabling full calendar orchestration. |
| North American days, hours and timezone | Activating its official calendar. European approval does not apply automatically. |
| 180 → 240 additional five-game expansion calendar | Activating that growth route. |
| Remaining submission deadline, rescheduling, outage, withdrawal and disciplinary details | Automating those decisions. The 24-hour no-response → Admin-review rule is now confirmed and locally implemented for newly published regional conditions. |
| Cross-region priority/pause rights, player transfer/Cup-tied details | Enforcing those precise eligibility rules. |
| Premium feature matrix, payment outages, fees/refunds and growth budgets | Changing access or making new financial promises. |
| EA match settings/resumption capabilities and available evidence | Promising automatic restart/resume behaviour. Verify primary sources when researching. |

GOST qualification activation and D3 activation remain deferred. Their existing
pages and historical records stay available under existing access rules; no new
qualification promise or lower tier is inferred from this delivery request.

## Production identity repair scope

User identified these unwanted records:

- Premier Division, D1 Season 2 draft:
  `46dbb09f-8319-4607-ab97-ec941745bfd8`.
- Reset-created North American D1 Season 1 duplicate:
  `e582c55b-1e72-45f5-ab63-137c3420404a`.

Preserve original North American identity
`e91c6c27-4fd2-45d9-b6ed-6a3591d7b210` and original Premier record
`c2d6e60f-89e0-4813-81a1-967551d8d69f` (IDs shown in user screenshots).
Verify exact live identities and dependencies before a transaction. Legitimate
season evidence belongs under the original permanent identity; preserve dependent
history and financial ledgers. Removing duplicate standalone listings must not
erase a legitimate edition or replace a real historical trophy snapshot.

## Verification record

- Prior handoff: 304 selected regressions plus 19 final targeted checks passed;
  lint/typecheck/backend syntax/build passed. See
  [automatic promotion final](regional-promotion-auto-final-phase6.md).
- These runs use controlled persistence/auth where applicable. Real MySQL/JWT,
  browser and production verification remain open.
- Current guidance update: seven existing tutorial/walkthrough tests passed;
  changes cover all three role paths plus short Regional Leagues/Cups mobile
  Guides and shared English registration/GOST walkthrough copy. Browser checks
  remain open. Final lint/typecheck/backend syntax passed; build passed before
  the final shared-copy adjustment.
- Graphify report/wiki and executable were unavailable in this checkout. Attempt
  `graphify update .` after code edits and record availability honestly.
- Overall completion requires all applicable acceptance evidence above, a recorded
  deployment state, and the final navigation/operation guide. Passing one package
  does not mean the whole programme is finished.
