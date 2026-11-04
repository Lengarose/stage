# Competition delivery status

Updated 4 November 2026. This is the current delivery checklist for the user's
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
