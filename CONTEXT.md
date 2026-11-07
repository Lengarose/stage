# STAGE — regionale competities

## Begrippen

**Regionaal competitiesysteem:** De gezamenlijke officiële competitieorganisatie
voor één gekozen regio. Omvat divisies, hun groepen en de regionale beker.

**Divisie:** Een sportief niveau binnen een regionaal competitiesysteem.
Divisie 1 staat boven Divisie 2; één divisie kan meerdere parallelle groepen hebben.

**Groep:** Een parallelle competitie binnen één divisie, bijvoorbeeld D1A of D1B.
Een normale gevulde leaguegroep bestaat uit twintig clubs.
_Vermijd_: D1B aanduiden als Divisie 2 of als een nieuw seizoen van D1A.

**Seizoenseditie:** Eén uitvoering van een competitie in een bepaalde cyclus.
Een nieuwe editie is geen nieuwe zelfstandige league.

**Permanente league-identiteit:** De blijvende identiteit waaronder opeenvolgende
edities en hun historie thuishoren. Een parallelle groep moet afzonderlijk
herkenbaar blijven zonder de bestaande league of historie te vervangen.

In het compatibele opslagmodel blijft de oorspronkelijke permanente identiteit
één divisie vertegenwoordigen. `group_code` onderscheidt de parallelle groepen;
ontbrekend betekent historisch groep A. Iedere groep heeft eigen edities en een
eigen huidige-editieverwijzing. Trofee-defaults blijven bij de permanente divisie.

**Sportief recht:** Het door resultaten verdiende recht om op een bepaald niveau
deel te nemen aan een volgende editie. Dit is niet hetzelfde als een definitief
bevestigde deelname of een gegarandeerde plaats in een gekozen andere regio.

**Regionale cyclus:** De gezamenlijke plaatsing of overgang voor één regio,
platform, resetreeks en doelseizoen. Bewaart beleid, loting, bronbewijs en
sportieve rechten. Een bestaande cyclus opnieuw opvragen is geen nieuwe loting.
De uiteindelijke groepsindeling levert conceptedities op, geen automatisch
gepubliceerde wedstrijdkalender of betaalde prijzen.

**Regionale inschrijving:** De aanvraag van een club voor een gepubliceerde
regionale editie. Dit is geen zelfgekozen divisieplaats of groepsindeling.

**Deelnamebevestiging:** De gezamenlijke stap na de inschrijving waarin een club
haar deelname en minimaal drie speelgerechtigde Plus-spelers bevestigt.

**Inschrijfperiode:** Het gepubliceerde tijdvak voor inschrijving en de daarop
volgende gemeenschappelijke bevestigingsweek van een regionale editie.

**Eerste plaatsing:** Het sportieve evenement dat bij de lancering bepaalt welke
clubs in D1 en D2 beginnen. Het vervangt geen al verdiende rechten van bestaande clubs.

**Normale promotie:** Beweging naar een hoger niveau volgens de vooraf vastgelegde
standaardregels van een editie, inclusief de promotieplay-offs.

**Uitbreidingspromotie:** Een vooraf aangekondigde, eenmalige extra route naar een
hoger niveau om nieuwe groepen sportief te vullen. Staat naast normale promotie
en mag dezelfde club niet twee plaatsen opleveren.

**GOST:** De toekomstige wereldwijde Supreme-, Elite- en Challenger-competities.
Nieuwe kwalificatie blijft gesloten totdat toegang en opening zijn vastgesteld.

**Vastgelegde aftrapselectie:** Serverbeheerd historisch bewijs van de geldige
basisspelers en reserves bij de daadwerkelijke app-aftrap van een nieuwe officiële
wedstrijd. Bewaart deelnamegerechtigdheid bij Plusverval tijdens dat duel; een
naam op de bank is nog geen bewijs dat die speler werkelijk heeft meegespeeld.

**Wedstrijdvoorbereiding:** Tijdgebonden publicatie en gereedmelding van de
inzetbare selectie voor een nieuwe officiële wedstrijd. Gewoon wijzigen stopt
op -5 minuten; eerder opgegeven reserves kunnen vóór echte aftrap gecontroleerd
worden ingezet. Een reservewijziging vereist een nieuwe eigen gereedmelding.
Dit is een andere stap dan het definitieve aftrapbewijs.

**Officiële kalenderkoppeling:** De gecontroleerde handeling die voor nieuwe
regionale wedstrijden één aftrapmoment bewaart in fixture, eventuele engine en
GameDay-Match. Een gewijzigd moment trekt eerdere voorbereiding en gereedmelding
blijvend in. Dit is nog geen automatische generator van een volledige kalender.

### Regional season calendar (local, 3 November 2026)
- User explicitly confirmed European Tue/Thu 20:00/20:40 Europe/Brussels, 38 rounds
  in ten playing weeks, league/knockout blocks 40/60min and club caps 2/day,
  7/week, 4 playing evenings. Masterplan §7 separates this from unconfirmed extras.
- Admin Regional Leagues has preview + transactional initial publication via
  POST /regional-leagues/calendar. Complete current official D1/D2 groups only;
  stale source revisions, existing schedules and unresolved identities block it.
- Fixture/optional engine/Match links, audits and summary notices are atomic;
  internal regional_calendar record provides scope idempotence. Official one-off
  scheduling shares its mutex and European load checks.
- See docs/regional-season-calendar-phase3.md for limits and verification.
  No production activation, North America profile, cup/pathway calendar, GOST,
  D3, individual-player conflict solver or newly approved rescheduling policy.

### Regional promotion calendar (local, 3 November 2026)
- Explicit user confirmation: week 11 Tuesday semifinals and Thursday finals,
  both 20:00 Europe/Brussels, 60-minute blocks; unresolved rankings/clashes block.
- New cycle calendar action derives its dates from the published source league
  calendar and reuses fresh sporting evaluation; no client-selected opponents.
- Admin saved transition → Promotion calendar previews/publishes the whole stage.
  Finals require real, reconciled semifinal results. This is not yet an unattended
  publication scheduler. Internal regional_pathway_calendar snapshots only.
- Shared schedule model missing unpack import repaired and directly regression
  tested. See docs/regional-promotion-calendar-phase3.md for scope and handoff.

### Decision calendars and Cup preparation (local, 3 November 2026)
- User confirmed the complete Regional Cup package and six names; masterplan §11
  now B. Europe Sunday20:00/60min, exact round weeks in regionalCupPolicy.json;
  no GOST ticket and no inferred North America time or Cup STC prizes.
- Admin cycle has controlled decision-round calendar preview/publication:
  fresh sporting evidence, 40/60-minute blocks, booking limits, source revisions,
  immutable batch and atomic engine/Match/audit/notices. Source decisions protect
  the fixed promotion semifinal deadline; reports may still require review.
- Admin Regional Cups prepares a permanent identity, shared catalogue assignment,
  consent-checked draft edition, seed/first draw/byes and full round reservations.
  New registration windows can include Cup terms; old accepted rules are preserved.
- At preparation handoff Cup drafts were not playable. The lifecycle step below
  supersedes that limitation; drafts still require explicit activation.
- Regional reset invalidates dependent Cup drafts, preserving Cup/trophy identity.

### Regional Cup lifecycle (local, 3 November 2026)
- Read `docs/regional-cup-lifecycle-phase3.md` when changing Cup activation,
  results, public views, eligibility or reset dependencies.
- Admin Cup lifecycle activates real engine/Match duels; canonical confirmed
  results trigger fresh stored draws only after the whole round is definitive.
  Byes create no Matches. Consumed result revisions freeze sporting evidence;
  conflicts or expired slots block progression. Finals record a champion.
- `/regional-cups`, linked from Regional Leagues, exposes activated/completed
  editions and GameDay links through a sanitized authenticated read endpoint.
- Existing minimum-three/Plus/ready/kickoff selection checks cover Cup Matches.
  Captured registration-field reads now allow started source leagues without
  reopening registration; reset invalidates live Cup Matches too.
- At lifecycle handoff STC/awards were unconnected; the rewards step below supersedes this.
  270 selected tests pass; HTTP uses controlled persistence/auth, not real MySQL/JWT.
  No production changes. Graphify update attempted: CLI unavailable.

### Regional Cup rewards (local, 3 November 2026)
- Read `docs/regional-cup-rewards-phase3.md` for Cup snapshots, settlement,
  legacy adoption, cabinet awards, recovery jobs and reset consequences.
- User confirmed winner 7m STC / runner-up 3m, no bronze prize or extra Cup fee,
  STAGE-funded. New preparations capture `cup_reward_snapshot`; existing editions
  without it require explicit audited adoption, never inferred historical promises.
- Existing CompetitionScope/PrizeService support `regional_cup_edition`, validate
  consumed round/final evidence and reuse payout/ledger/award identities. The
  result hook and existing retry job settle completed Cups; invalidated sources block.
- Admin reward review appears in Regional Leagues and Rewards. Public Cup pages
  distinguish captured amounts from actual payment and trophy status.
- Cup awards participate in scoped regional history reset; finances remain preserved.
  277 selected regression tests pass with controlled persistence/auth. No production
  changes; real MySQL/JWT/browser remain unverified. Graphify CLI unavailable.
  Handoff: docs/regional-cup-rewards-phase3.md.

### Regional operations overview (local, 3 November 2026)
- Read `docs/regional-operations-phase6.md` when changing the Admin action queue.
- Admin Regional Leagues now has a SELECT-only operational snapshot endpoint and
  panel. It links registration, cycle/calendar, Cup and settlement issues to their
  existing review actions. Stored database role controls access; output excludes
  private snapshots, seeds and owner/player details.
- Invalidated records and prior reset windows stay excluded; captured cycles
  suppress duplicate registration-field actions. Storage errors remain errors.
- This is the first phase-6 overview, not durable automation or a full integrity
  oracle. No deadlines, results, rights or money are changed by reading it.
- Eight targeted tests cover the real local HTTP route with controlled storage/auth.
  285 selected regression tests, lint, typecheck, backend syntax and build pass.
  Production MySQL/JWT/browser remain unverified. Graphify CLI unavailable.

### English app copy and Cup recovery (local, 3 November 2026)
- User requires English default UI and visible server messages, including prior
  additions. Cup/decision/operations panels and operation messages were translated;
  AGENTS.md records the requirement. Existing locale support and stored agreements stay intact.
- Read `docs/regional-cup-recovery-phase6.md` for the server recovery worker.
  It reuses Cup reconciliation every minute for already activated editions only.
  Durable `regional_cup_progress` checkpoints use 2-minute transactional leases,
  attempt fencing and retry times. Sporting blockers back off 15 minutes and show
  a generic English Admin review item. Reset sources/drafts are excluded.
- A completed Cup with an interrupted active checkpoint can finish its expired
  lease. Prize recovery remains in the existing settlement job. This is not full
  registration/calendar/rollover orchestration. No new sporting policy is inferred.
- 293 selected regressions and all 8 final recovery tests pass. Real MySQL locking,
  JWT/browser and production remain unverified. No deployment; graphify unavailable.

### Regional cycle recovery (local, 3 November 2026)
- Read `docs/regional-cycle-recovery-phase6.md` for automatic sporting-cycle recovery.
- The server now reconciles existing running/review cycles every minute via the
  existing trusted `progress` action. It can create missing real downstream duels,
  but never prepares new cycles, allocates groups or publishes kickoff times.
- Cup/cycle workers share `regionalProgressWorker` and `RegionalProgressModel`.
  Cup checkpoint IDs are preserved; cycles use separate `regional_cycle_progress`
  identities. Both retain 2-minute leases, attempt fencing and retry backoff.
- Interrupted ready/allocated checkpoints can finish without applying rights again.
  Source changes, unresolved sporting decisions and unsupported snapshots require review.
- English Admin action overview shows cycle recovery blockers and ready allocation,
  including the 20-club placement without matches. Invalidated sources remain excluded.
- 14 targeted recovery tests and 300 selected regressions pass; real MySQL/JWT,
  browser and production remain unverified. No deployment; graphify unavailable.

### Automatic promotion final (local, 3 November 2026)
- Read `docs/regional-promotion-auto-final-phase6.md` before changing this follow-up.
- The cycle recovery worker now calls an internal final planner after normal
  transition progress. It requires previously published semifinals under the exact
  confirmed profile, unchanged Match/kickoff evidence and explicit definitive results.
  Timeout-only confirmations do not enable the final. JSON key order is immaterial.
- The existing transactional planner publishes only week-11 Thursday20:00 Brussels
  finals, retaining load/conflict/cutoff/source guards and idempotent calendar IDs.
  System audit records automatic_followup and parent calendar; no fake Admin actor.
- No published semifinal calendar means not_enabled. The HTTP action stays Admin-only;
  client automatic flags cannot access this internal path. No first-semifinal,
  other calendar, group allocation, GOST or D3 automation added.
- 304 selected regressions plus 19 final targeted checks pass; lint, typecheck,
  syntax and build pass. Real MySQL/JWT/browser remain unverified. No deployment.

## Current competition delivery checklist (3 November 2026)

For remaining competition work or overall completion claims, read
`docs/competition-delivery-status.md` first, then the relevant masterplan policy
and phase handoff. User authorized continuing the whole programme and wants an
explicit final completion notice only after end-to-end/environment verification.
Existing local work must be preserved; GOST/D3 activation remains deferred.
The user confirmed 24-hour no-response → Admin review for new official regional
competitions on 3 November. See `docs/regional-result-review-phase6.md`.

### Competition guidance alignment (local, 3 November 2026)

- Existing role tutorials now explain region application/shared confirmation,
  personal Plus, minimum three, published official kickoff times and checked
  starters/reserves. Existing unrelated onboarding and Lifestyle content stays.
- Regional Leagues and Regional Cups now have short mobile Guide entries in
  `Layout.jsx`. Their routes previously had no matching guide definition.
- Shared English registration/GOST walkthrough copy was also corrected because
  translated guide resolution can override Layout fallback text.
- Seven existing tutorial/walkthrough checks pass. Final lint, typecheck and
  backend syntax pass; build passed before the final shared-copy adjustment.
  Graphify update attempted but executable unavailable. No browser or production
  verification.

### Regional response timeout review (local, 3 November 2026)

- User explicitly confirmed: no opponent response in 24 hours means Admin review
  for new official regional competitions. Read
  `docs/regional-result-review-phase6.md` before changing this boundary.
- Newly published windows capture `regional_result_review_v1` and append English
  conditions before consent. Admin preview exposes full terms. Old window hashes
  and captured editions keep their terms; no automatic historical rewrite.
- Official source context resolves the window/snapshot. New proposals, amendments,
  corrections and counters use 24-hour deadlines. Deadline expiry writes guarded
  `ADMIN_REVIEW` / `disputed` with a versioned history event, without completion,
  stats, progression or settlement. Best-effort Inbox notices go to both clubs.
- New startup worker scans due candidates every minute, with bounded cursor scans,
  local overlap protection, retry and existing snapshot fencing. It skips legacy
  policies rather than invoking their automatic approval. No new schema/endpoint.
- 257 selected service/controller regressions and 43 final targeted checks pass.
  Final lint/typecheck/server syntax pass; build passed before the final server-only
  history-metadata change. Real MySQL/JWT/browser/live job operation remain unverified.
  No deployment. Graphify update attempted; CLI unavailable.

### Either-side first result (local, 3 November 2026)

- Read `docs/regional-result-entry-phase6.md` before changing initial entry or its UI.
  Newly published windows capture `regional_result_review_v2`; v1 retains the
  prior home-first entry behaviour and 24-hour response review. Legacy snapshots
  stay unchanged. V2 terms disclose either-side entry before participation consent.
- Initial entry requires a started official match, a participant, proof and no
  stored proposal; the guarded transaction atomically records the actual submitter.
  A simultaneous opposing entry cannot overwrite it. Review/correction notices and
  the form now follow the stored submitting side in either direction.
- Existing preparation HTTP response exposes the capability plus match ID.
  GameDay passes it to the result dialog/form after matching the selected match.
  A stale control cannot enable entry on another fixture; backend is authoritative.
- 262 selected service/controller regressions, 31 final frontend/snapshot/write
  checks, lint, typecheck, server syntax and build pass. Controlled local HTTP is
  not real MySQL/JWT/browser proof. No deployment.
  Graphify unavailable. Actual-finish evidence and proof-only amendment timing
  remain separate open items; do not claim independently verified EA full time.

### Closed field assessment (local, 3 November 2026)

- Read `docs/regional-field-assessment-phase6.md` for this read-only orchestration
  precursor. Existing Admin operations endpoint/panel now shows counts, approved
  D1/D2 capacity or confirmation blockers after the common deadline.
- Capacity reuses `regionalStructure.structure`; unsupported counts never round
  down or drop clubs. Duplicate identity, conflicting approval, scope/hash/time/
  captured-roster errors or unreadable registration sources block assessment.
  No first draw, group allocation, waitlist selection or calendar is generated.
- Shared `regionalRegistrationPolicy.publicWindow` preserves prior consent JSON
  order/hashes. Legacy windows without recorded policy keep their generic item;
  captured cycles and invalidated sources retain existing suppression rules.
- Final assessment/operations run: 16 tests pass, including controlled local HTTP.
  Registration/cycle/Cup regressions pass; a fixture with a missing window ID in
  its hash was corrected, not application validation. Lint/typecheck/syntax/build
  pass. Real DB/JWT/browser/production unverified; no deployment; graphify absent.

### Confirmed field → cycle preview (local, 3 November 2026)

- Read `docs/regional-confirmed-cycle-phase6.md` for automatic source selection
  and the Admin handoff. Operations links supported fields via `regional_field`
  to RegionalCyclePanel. The server derives canonical input from closed accepted
  confirmations, current source rosters and region/platform/season/reset identity.
- Existing POST `/regional-leagues/cycles` accepts the readonly window-ID-only
  request. No count/participant/apply overrides. The resulting input still passes
  full sporting preview and the existing revision/audited prepare transaction.
  Admin reason and confirmation remain required. No first-calendar automation.
- Returning clubs preserve source rights; missing confirmations, bad/mixed/reset
  identities, malformed/duplicate rosters and captured fields block derivation.
  The shared stored-role Admin check now rejects null roles explicitly.
- 22 focused tests including real controlled HTTP pass. Broad selected run:
  268/269 passed, one calendar fetch ECONNRESET; its isolated 12-test rerun passed
  without changes. Lint/typecheck/syntax/build pass. Real MySQL/JWT/browser/live
  deployment unverified. No deployment; graphify executable unavailable.

### Automatic final-rights allocation (local, 4 November 2026)

- Read `docs/regional-auto-allocation-phase6.md` for internal allocation, capture
  gates and worker behaviour. New prepares under captured registration_v1/result
  review_v2 conditions store `regional_auto_allocation_v1`; old cycles stay manual.
- Ready cycles go through the actual allocation transaction via internal
  `reconcileAllocation`. No HTTP/body flag or fabricated Admin bypasses permission.
  Captured ready-result hashes prevent changed sporting evidence from silently
  allocating. Explicit canonical results are required; timeout-only results block.
- Ready qualifying cycles enter the durable queue, including twenty-club cases
  with no invented matches. Existing leases/backoff/fencing and allocated replay
  completion are retained. Draft groups, standings/registration assignments and
  permanent identities reuse existing allocation writes and audit a system actor.
- Operations exposes pending allocation, ready-cycle recovery failures and unknown
  policy captures. Admin preview handles worker-completed allocation without
  assuming a fresh preview shape. No automatic league fixtures/calendar or GOST/D3.
- 277 selected regressions pass sequentially; six final focused allocation cases
  pass, including a real worker/service handoff and Admin-preview race. Real
  MySQL/JWT/browser/live operation remain unverified. Final lint/typecheck/backend
  syntax/build pass. No deployment; graphify absent.

### Transactional allocation notifications (local, 4 November 2026)

- Read `docs/regional-allocation-notifications-phase6.md` before changing recipient
  resolution, allocation notices, preferences or retry semantics.
- Newly performed allocations of marked official cycles (automatic or reviewed
  manual) store one exact-edition `club_update` notice per club through the same
  transaction. Existing allocated or unmarked cycles are not backfilled.
- Current president contacts use the existing resolver with the transaction query.
  Existing in-app club_updates preferences are respected; muted clubs still receive
  their sporting assignment. No email/push/Inbox/socket delivery is added here.
- Deterministic cycle/club IDs plus allocated-state replay prevent duplicates.
  Notification/settings/contact failures roll back group and delivery writes;
  existing recovery review/backoff applies. Cycle/Admin UI captures stored/muted
  counts, without adding addresses or preference payloads to the summary.
- 281 selected sequential regressions pass; lint/typecheck/backend syntax/build
  and diff checks pass. A random-draw test now preserves the winning side when
  testing changed final evidence. Real MySQL/JWT/browser/live delivery unverified.
  No deployment or production messaging; graphify unavailable.

### Confirmation-week opening reminders (local, 4 November 2026)

- Read `docs/regional-confirmation-reminders-phase6.md` before changing captured
  notice policy, receipts, timing or worker recovery. Newly published windows
  capture `regional_confirmation_notice_v1`; old consent hashes remain unchanged
  and published conditions cannot be preview-upgraded.
- The minute worker scans current eligible windows and bounded pending registered
  applications. Internal reminder transactions use existing edition locks, current
  president contacts and club_updates in-app preferences. They recheck the shared
  closing deadline after contact/settings reads. No deadline or confirmation changes.
- Native notice and deterministic per-window/application receipt commit together;
  rollback/restart/concurrent calls do not duplicate them. Muted applications get
  only a receipt. Admin shows stored/muted/pending counts, not read confirmations.
- Failures log and retry on later scans; no new durable error checkpoint/backoff,
  email/push/Inbox/socket channel or HTTP endpoint. Other reminder schedules and
  first-cycle/calendar/rollover orchestration remain unfinished.
- 297 selected sequential regressions, lint/typecheck/backend syntax/build and
  diff checks pass. Historical two-test exclusions remain. Real MySQL/JWT/browser/
  live delivery unverified. No deployment or production messaging; graphify absent.

### Durable confirmation-notice recovery (local, 4 November 2026)

- The recovery follow-up in `docs/regional-confirmation-reminders-phase6.md`
  supersedes the preceding log-only retry limitation. Existing progress model now
  supports `confirmation_notice`, with deterministic checkpoint IDs in the existing
  league-entities store. No new table, public route or client mutation surface.
- Two-minute leases, unique attempts and finish fencing coordinate workers.
  Failures persist sanitized review status with fifteen-minute backoff; candidate
  SQL also checks due time. Scans remain bounded and require current open windows.
  Receipt transactions remain authoritative: a crash after notice commit cannot
  duplicate delivery even if its operational checkpoint could not finish.
- Admin operations aggregates failed reminders only for pending, unreceipted
  applications during the current confirmation week. No stored error/contact
  details leak; reset, closed and already acknowledged cases do not show stale
  review. No deadlines, consent, sporting rights or external channels change.
- 301 selected sequential regressions pass, including controlled Admin HTTP and
  lease/backoff/restart/fencing cases. Existing two baseline exclusions remain.
  Lint/typecheck/backend syntax/diff checks pass; real MySQL/JWT/browser/live
  operation and complete season orchestration remain unverified/unfinished.
  No deployment or production messaging; graphify command unavailable.

### Saved allocation → calendar preparation (local, 4 November 2026)

- Read `docs/regional-cycle-calendar-handoff-phase6.md`. Action overview and saved
  allocated cycle link to `regional_calendar_cycle` in the existing calendar panel.
  It loads all saved groups, supports retry/manual selection and discards stale
  fetch/preview responses when context changes. New visible copy is English.
- Existing calendar POST accepts either cycle_id or explicit edition_ids. After
  stored-role Admin check and shared lock, cycle lookup uses FOR UPDATE. Server
  derives groups and validates allocated/non-invalidated status, current editions,
  scope, permanent identities, division/group labels and cycle pointers. Existing
  all-populated-group/full-draw/conflict/publication checks remain.
- Cycle evidence is included in the preview revision; apply rereads it. Published
  records from this request retain source_cycle_id. No new table/endpoint, automatic
  draw, first-playing date, published schedule or sporting rule is inferred.
- 304 selected sequential regressions pass, then final 16 calendar cases pass with
  actual controlled HTTP cycle preview/publication and locked model-query coverage.
  Two historical baseline exclusions remain. Lint/typecheck/backend syntax/build/
  diff checks pass. Real MySQL/JWT/browser/live verification remains open; no
  deployment or production changes. Graphify executable unavailable.

### Draw controls within saved-cycle calendar preparation (local, 4 November 2026)

- Follow-up in `docs/regional-cycle-calendar-handoff-phase6.md` describes the UI
  and guard. Calendar panel now loads exact current groups and inventories real
  paginated fixture rows, ignoring cached counters/flags. Empty eligible groups
  offer the existing lifecycle draw with explicit reason/confirmation per action.
- `expected_regional_cycle_id` is an optional guard on regional draws only. It
  checks the edition's allocation pointer/invalidation before reward capture and
  again before inserts; it does not provide permission. Canonical roster checks,
  reward capture, transaction, audit and duplicate-draw rejection remain unchanged.
- Successful draws refresh inventory and Admin list. Any failed or uncertain
  action clears inventory and requires refresh before retry/calendar preview. A
  380-row count does not replace calendar integrity checks. No new endpoint/table,
  automated payout, kickoff publication or GOST/D3 activation was introduced.
- 333 selected sequential server regressions and eight frontend-helper tests pass,
  including actual controlled HTTP contextual draws and a twenty-club draw. Two
  historical unrelated baseline cases stay excluded. Lint/typecheck/backend syntax/
  build/diff checks pass. Real MySQL/JWT/browser/live verification remains open.
  Graphify unavailable; no deployment or production changes.

### Transactional calendar publication notices (local, 4 November 2026)

- Read `docs/regional-calendar-notifications-phase6.md`. Existing calendar summary
  now resolves current president contacts transactionally and respects the existing
  match_reminders in-app preference category. Each club gets its own exact edition/
  Stages link; shared contacts do not collapse different club/group contexts.
- Calendar/club deterministic notice IDs and the existing published replay guard
  prevent duplicate writes. Notice, fixture/engine/GameDay, calendar and audit writes
  share the publication transaction. Contact/settings/notice/final-save errors
  roll everything back. No email/push/Inbox/socket delivery or new timing policy.
- New calendar JSON captures scope plus notification_summary version/stored/muted;
  Admin displays aggregate counts. Existing published calendars and their notices
  are not backfilled. No new table/entity/endpoint. Default visible copy English.
- 338 selected sequential server regressions pass, including controlled HTTP with
  real summary logic and multi-group rollback/retry IDs. Historical two baseline
  exclusions remain. Lint/typecheck/backend syntax/build/diff checks pass. Real
  MySQL/JWT/browser/live verification and overall programme remain unfinished.
  Graphify executable unavailable; no deployment or production messaging.

### Regional result reviews in operations (local, 4 November 2026)

- Read `docs/regional-result-overview-phase6.md`. The existing Admin operations
  overview now lists stored disputed/Admin-review canonical matches from live
  regional league groups, cycles and enabled Cups. Alias duplicates collapse;
  ambiguous multiple-source mappings request identity review with no match link.
- Existing fixture inventory adds SELECT-only ordinary-league source/engine
  mappings. Read errors propagate. Closed/reset/retired/disabled/missing sources
  are excluded, including known retired parents and older reset series.
- Sanitized items carry only match_id plus source metadata, never score/proposal/
  proof/contact payloads. UI links exact GameDay evidence and the existing general
  /admin/disputes page (not exact-match-filtered). No new endpoint/entity, result
  decision, deadline inference, policy upgrade or notification is introduced.
- 341 selected sequential server regressions pass, followed by final 15 operations
  tests after retirement/reset guards. Two historical baseline exclusions remain.
  Lint/typecheck/backend syntax/build/diff checks pass. Real MySQL/JWT/browser/live
  verification and the full programme remain unfinished. Graphify unavailable;
  no deployment or production decisions.

### Exact-match focused dispute handoff (local, 4 November 2026)

- The follow-up in `docs/regional-result-overview-phase6.md` supersedes the general
  dispute-link limitation. Operations now links /admin/disputes?match=<id>.
  DisputesTab fetches that exact match independently of the general 50-row list.
  It hides unrelated rows/economy panels, offers refresh/general-list/evidence
  links and never falls back to a different dispute on failed/malformed reads.
- `adminDisputeFocus.js` returns no decision payload for terminal or no-longer-
  pending states. Resolve rereads before opening the existing canonical Admin
  score dialog. Effect cleanup/version checks prevent stale focus responses or
  rechecks from opening another match after navigation. No automatic decision.
- Existing GET matches/:id now uses existing isAdminRole for stored roles 0/2;
  caller role claims are ignored and non-Admin participant scope stays enforced.
  No new endpoint/schema, write permission or general-list permission change.
- 347 selected sequential server regressions and three frontend-helper tests pass,
  including actual local HTTP stored-role/forged-role/404 checks. Two historical
  baseline exclusions remain. Lint/typecheck/backend syntax/build/diff checks pass.
  Real MySQL/JWT/browser/live verification and the full programme remain open.
  Graphify unavailable; no deployment or production result decisions.

### Separate stored dispute evidence (local, 4 November 2026)

- See the evidence follow-up in `docs/regional-result-overview-phase6.md`.
  Shared `DisputeEvidence` now shows both original proposals and both separate
  dispute sheets on the Admin review page and in the existing decision dialog.
  Claimed scores, proof, explanation, recorded time and sheet-specific penalty
  outcome remain distinct. Match/forfeit attachments are not hidden by other proof.
- `adminDisputeEvidence.js` handles missing/corrupt JSON, incomplete scores and
  bad timestamps without guessing. Only root-relative upload and HTTP(S) links
  are clickable. React escapes explanations. No historical evidence is invented.
- Existing selector still prefills the original proposal, now explicitly labelled;
  invalid scores leave final fields blank. Admin's server decision path is unchanged.
  Dialog scrolls for the longer evidence view. Default new UI text is English.
- Eight frontend helper/static-render tests pass. No backend code changed or full
  backend suite rerun here. Lint/typecheck/backend entry syntax/final build/diff
  checks pass. Real browser/mobile/live attachment access remains
  unverified. Graphify unavailable; no deployment or production decisions.

### Admin browser-review snapshot guard (local, 4 November 2026)

- Read `docs/admin-result-review-snapshot-phase6.md`. Admin's existing resolution
  dialog sends the existing shared resultSnapshot as expected_result_snapshot.
  Existing admin_resolve checks it against current stored evidence immediately
  after Admin authorization/match read, before decision processing or writes.
- Existing semantic comparison ignores JSON formatting and operational history,
  but rejects changed proposals/dispute sheets/meaningful history/state/counters.
  Existing finalization lock/snapshot check still protects subsequent interleaving.
  Legacy callers omitting the optional snapshot keep their previous behaviour.
- Conflict handling closes/clears the stale dialog, shows the actual server reason
  and refreshes Admin data. No automatic retry or new result/penalty policy.
- 348 selected sequential server regressions plus 19 frontend result-flow/snapshot
  tests pass. Actual controlled HTTP conflict test verifies SELECT-only rejection.
  Lint/typecheck/backend syntax/final build/diff checks pass. Two historical
  baseline exclusions remain. Real MySQL/JWT/browser/live validation
  remains open. No deployment or production result decision; Graphify unavailable.

### Explicit Admin penalty decisions (local, 4 November 2026)

- Read `docs/admin-result-penalties-phase6.md`. AdminResolutionPenalty reads the
  existing GameDay penalties endpoint for exact entered scores. Server-derived
  aggregate/deciding-leg context controls an explicit winner choice, separate
  from the original proposal side.
- adminResolutionPenalty keys readiness to match/scores/proposal side. Changes
  and Recheck clear readiness; stale responses cannot enable another decision.
  Loading, missing, blocked or malformed context disables confirmation. Requests
  explicitly send 0/null without a shootout, or 1/the verified chosen side.
- Existing locked completion validator and browser snapshot guard remain final
  authority. No backend production logic/schema/endpoint or sporting rule changed.
  Older API callers keep their previous optional argument behaviour.
- 358 selected sequential server regressions and 30 frontend tests pass. Actual
  controlled HTTP verifies both Admin roles, aggregate orientation, denied viewers
  and missing first-leg blocking. Admin completion verifies explicit penalty
  clearing. Historical two server baseline exclusions remain.
- Lint/typecheck/backend syntax/build/diff checks pass. Real MySQL/JWT/browser/live
  verification and full delivery remain unfinished. Graphify unavailable; no
  deployment, production decision or GOST/D3 activation.

### Captured GameDay result conditions (local, 5 November 2026)

- Read `docs/official-result-conditions-phase6.md`. Existing official preparation
  status exposes sanitized result_policy (match/version/response hours/initial
  capability/timeout action) from the captured edition window. Legacy absent
  policy stays null; participant checks and official:false responses remain.
- GAMEDAY detail and report dialog now use OfficialResultPolicyNotice bound to
  that exact match. It distinguishes v1 home-first from v2 either-side initial
  reporting and explains 24-hour response/Admin-review, never silent approval.
- Current match confirmation_due_at/review_due_at drives local-time display with
  an absolute time element. UTC database deadlines differ from kickoff wall times.
  Bad/missing dates, old/unsupported policies and closed states never invent a
  replacement deadline or action. No initial-submission policy is inferred.
- 358 selected server regressions and 35 frontend helper/render/snapshot tests
  pass; the two historical unrelated server exclusions remain. Official eligibility
  HTTP tests verify the descriptor with controlled storage/auth. Lint/typecheck/
  syntax/build/diff checks pass. No endpoint/schema/stored policy/consent mutation.
- Real MySQL/JWT/browser/live verification and full delivery remain unfinished.
  Graphify unavailable; no deployment, production message or result decision.

### Public edition conditions in league/Cup rules (local, 5 November 2026)

- Read `docs/public-edition-conditions-phase6.md`. League detail rules now include
  their exact linked registration-window text; Cup rules include the embedded
  participation snapshot. Existing identical copied league text is not duplicated.
  Club's existing contextual participation link remains; no navigation expansion.
- publicParticipationConditions projects only state/window/policy labels/rules_text.
  Canonical region/platform/season/reset scope and exact linked IDs must match.
  Legacy absent sources stay null; marked missing/corrupt/unsupported/mismatched
  conditions show review, never today's defaults. No seed/contact/roster leakage.
- Existing regional-public SELECT includes windows; Cup public reads its own
  snapshot. No new endpoint/schema/entity or saved rules/consent/outcome mutation.
  Shared UI renders text safely and explains that opening it does not register.
- 365 selected server regressions and 37 frontend tests pass, including real local
  HTTP league/Cup responses and static rendering. Historical two unrelated server
  baseline exclusions remain. Lint/typecheck/backend syntax/build/diff checks pass.
- Actual MySQL/JWT/browser/mobile/live verification and full rules/tutorial audit
  remain unfinished. Graphify unavailable; no deployment or production decisions.

### Admin evidence-preview accessibility (local, 5 November 2026)

- See the evidence-preview follow-up in `docs/regional-result-overview-phase6.md`.
  DisputeProofDialog replaces the standalone screenshot overlay with existing
  Radix dialog title/description, modal handling, close controls and viewport scroll.
  Screenshot buttons pass their actual opener; closing restores a connected opener
  and otherwise retains default focus handling. No generated UI primitive changed.
- Loading/failure messages preserve original-attachment/download fallback links.
  Existing evidenceLink validation is reused. Viewer changes no evidence/result
  state, server permission, endpoint or dependency; new default text is English.
- 38 selected frontend tests pass, including opener restoration and existing
  evidence/render/snapshot checks. No backend change or new full server-suite run.
  Lint/typecheck/backend entry syntax/build/diff checks pass.
  Actual keyboard/Escape/focus trap/mobile/image loading remain browser/live checks.
  Graphify unavailable; no deployment or production decisions.

### Bounded Admin result-review pagination (local, 5 November 2026)

- Read `docs/admin-review-pagination-phase6.md`. New GET matches/reviews, placed
  before /:id on the existing authenticated Match router, requires stored role 0/2.
  It reads pending review states with terminal exclusions, bound ID cursor/limit
  and at most 51 rows for a 50-row page. No entity/table/write path was added.
- DisputesTab now owns its page load independently of the parent catch-to-empty
  feed. Loading/error/empty-first/empty-later states differ; cursor history offers
  Next/Previous/Refresh. Current-cursor binding and effect cleanup reject stale
  responses. Bad/duplicate/resolved/nonprogressing pages fail rather than look empty.
- Row actions navigate to exact ?match= review before resolution. Existing focused
  rechecks, snapshot guard, penalty controls and audit path remain. Pagination is
  live, not frozen; refresh first page catches newly pending earlier IDs. Other
  dashboard feeds still require their own audit.
- 366 selected server regressions and 40 frontend tests pass; real local HTTP
  covers both Admin roles, 53-case paging, invalid input/denied users and sanitized
  failure. Historical two unrelated server exclusions remain. Lint/typecheck/
  backend syntax/build/diff checks pass. Actual MySQL/JWT/browser/mobile/live
  verification remains open. Graphify unavailable; no deployment or production writes.


### Admin GameDay review summary (local, 6 November 2026)

- Read docs/admin-review-summary-phase6.md. The new authenticated read-only
  matches/reviews/summary checks stored role 0/2 and uses the Match model shared
  pending predicate, one MySQL8 window count + first10 records. SQL count cost
  remains unbounded; returned preview is bounded. No mutation/schema change.
- GameDay cards/Needs Action use that total/preview independently of the parent
  legacy disputes list. Loading/error are unknown; refresh and snapshot wording
  avoid a false All Clear. Other category feeds and outer dashboard counts still
  require audit. Category sums can duplicate matches.
- Fixed focused ?match= links that previously failed to mount Disputes because
  GameDayTab defaulted to Needs Action; selecting another tab clears focus.
- Eight controller tests (actual local HTTP, mocked persistence/auth) and 44
  frontend/render tests passed; lint/typecheck/syntax/build/diff checks passed.
  MemoryRouter render tests stub children, not browser behavior. Real MySQL/JWT/
  browser/live remain open. Graphify absent; no deploy/push/production writes.


### Shared Admin GameDay action feeds (local, 6 November 2026)

- Read docs/admin-action-feeds-phase6.md. Admin owns shared reviews/forfeits/
  scheduling/stuck states loaded via raw HTTP, avoiding generic entity 404-to-[].
  Category errors stay unknown, successful sources remain usable; combined totals
  require all four ready and count category actions, potentially duplicate matches.
  Header/dashboard/GameDay use this same state. Generation guards reject older
  refreshes/unmounted results. Forfeit success refreshes shared feeds.
- Reviews retain bounded summary and independent Disputes pagination/focused
  resolution. Scheduling pages both fixture sources by 200 to a 20k/source ceiling;
  page failure/duplicate/malformed data rejects the category, not a partial count.
  Live offset pages are not transactional; concurrent deletion skips remain a limit.
  Existing Match-filter reads remain unbounded, requiring later scaling work.
- Stuck matching preserves deadline/48h heuristic and excludes final status/result
  rows. Existing action/audit/snapshot/penalty policies remain unchanged.
- Generic GET Match now uses stored roles 0/2 consistently with exact/review reads;
  ordinary users remain participant-scoped. No route/schema/entity/write changes.
- Named /admin/disputes and /admin/forfeits open correct views. GameDay tabs use
  validated ?view=; exact ?match takes priority and is cleared when changing tabs.
- Nine controller tests (local HTTP with controlled DB/auth) plus 58 frontend/helper/
  render tests pass. Lint/typecheck/syntax/build/diff pass. Render boundaries are
  stubbed, not actual browser/JWT/MySQL/live proof. Other Admin inventory audits,
  large-backlog performance and real lifecycle e2e remain open. No deploy/push/
  production writes. Graphify report/wiki and command remain unavailable.


### Bounded forfeit reviews (local, 6 November 2026)

- Read docs/admin-forfeit-pagination-phase6.md. Match model adds shared pending/
  claimant/nonterminal filter for GET matches/forfeit-reviews (cursor, max50+1)
  and /summary (window count + first10). Both stored Admin roles 0/2 only; sanitized
  failures. No schema/entity changes. Summary count work is not bounded by LIMIT.
- Shared Admin feed uses full total/preview; ForfeitsTab owns independent cursor
  pages/errors/empty/refresh/busy state. GameDay labels the preview. Stuck reads
  remain unbounded and fixture offset pages remain live; not closed in this step.
- Parent no longer looks up a selected claim in the preview. adminForfeitReview.js
  rereads the exact ID and compares reviewed claimant/proof/participants/scores/
  lifecycle fields. New action payload carries expected_forfeit_snapshot v1;
  legacy handler checks it after FOR UPDATE before writes/audit, 409 on change.
  No-snapshot legacy behavior remains. Existing audit/progression paths preserved.
- Ten Match HTTP tests, two selected function tests (including guarded and legacy
  approval plus stale guard/rejection) and 65 frontend/helper/render tests pass;
  lint/typecheck/syntax/build/diff pass. Actual MySQL/JWT/browser/lock contention/
  performance/live remain open. Graphify unavailable; no deploy/push/production writes.


### Active full-programme execution and new approvals (6 November 2026)

- User pasted the complete implementation prompt twice; identical SHA256. Latest
  attachment: /Users/chriskalonji/.codex/attachments/60974515-6eb4-42ed-bfac-c3cd6275d837/Pasted text.txt.
  Execute all remaining approved scope, not another isolated pagination package.
  No deployment/push/production repair authorized. Do not make user repeat next step.
- User explicitly confirmed calendar package (48h reserve maximum, two placement
  weeks, 12 playing + 1 transition, calendar >=48h before first kickoff); reserve
  priority; full European rescheduling package; next registration weeks5–8,
  confirmation9/reserve10; §10 absence/withdrawal package; §8 player/transfer/Cup-tied
  package. Masterplan + delivery status now record exact approvals. Do not reask.
- In-progress code: new captured regional_season_orchestration_v1 for newly
  published windows, optional first league Monday, existing durable worker kind
  season, canonical internal prepare, internal audited draw/calendar/Cup activation,
  and new recurring_schedule_v1 next registration ahead of time. Old public window
  hash shape preserved when optional fields absent; no old-window backfill.
- Regression log /private/tmp/season-orchestration-regressions.log is being rerun;
  earlier new test fixes corrected decimal-string assertion, fixture stale window
  copy and real system Cup activation null actor. Do not claim final tests yet.
- mysql and docker CLI are absent; actual MySQL full-season acceptance has not run.
- Still need completion matrix, coherent handoff, unresolved decisions and remaining
  implementation across phases. Initial orchestration != complete programme.

### Orchestration/rescheduling handoff — verified local follow-up, 6 November

- Read docs/regional-season-orchestration-phase6.md and the original eight-phase
  matrix in docs/competition-delivery-status.md before continuing. The entire
  programme is NOT complete; remaining reserve/player/withdrawal/financial/other
  tournament/phase-8 work is explicit. Do not revert to unrelated dashboard work.
- New windows capture regional_season_orchestration_v1, recurring schedule and,
  for Europe, regional_reschedule_europe_v1. Existing accepted hashes unchanged.
  Canonical prepare → cycle progress/allocation → exact draws → explicit initial
  calendar → next registration → accepted Cup startup now uses durable workers.
  Unfinished previous-source results are a normal wait, not a premature cycle.
- Initial start Monday remains Admin-configured. Recurrence: registration weeks
  5–8, confirm9, reserves10, next league after12+1 weeks. DST local dates converted
  separately; no backdating. Existing manually published calendars/windows reused.
- Normal captured transition worker now publishes semifinal Tuesday week11,
  then existing confirmed-results final Thursday. Old cycles retain manual first
  publication. Only initial publication has48h lead; Thursday slot already reserved
  by semifinal policy, no impossible new48h wait after Tuesday results.
- GameDay official reschedule GET/POST use stored club permissions/canonical
  context, quota2 approved requester-only, response/lead/week/slot rules, shared
  schedule lock, transactional match/source/engine/audit/notice, preparation reset.
  Legacy/NA/rounds37–38 retain review. No generic CRUD table/dependency added.
- 401 selected server tests pass (including controlled local HTTP); lint/types/
  server syntax/build/diff pass. Two historical functionsController baseline
  cases remain excluded. Frontend targeted run in /private/tmp/programme-frontend.log.
  Graphify unavailable, mysql/docker unavailable. Real DB/JWT/browser/season
  acceptance remains undone. No production access/mutation/deploy/push this turn.
- User latest confirmations are in masterplan and delivery status; do NOT ask
  again for reserve48h/placement2w/12+1, reserve priority, European rescheduling,
  recurring weeks5–9, §10 withdrawal/no-shows, §8 players/transfers/Cup-tied.

### Remaining-programme execution — reserves and real season acceptance, 6 Nov

- Active user request is the executable full remaining-programme prompt in
  /Users/chriskalonji/.codex/attachments/1732ed2a-9fb6-4918-aa57-cb45182e6d8d/Pasted text.txt.
  No push/deploy/live repair. Do not claim overall completion or rebuild working code.
- New explicit approvals: reserve willingness before common cutoff, final D1
  vacancy allocation after promotion playoffs; all responses by common max48h
  cutoff, no individual extension or new late applicants. Recorded in masterplan.
- New policy regional_reserves_v1: published only on new windows, immutable old
  shapes/hashes. Existing applications get in-app invitations, accept/decline
  with Plus/3-player rechecks, audit and idempotency. Worker waits common48h.
  Late accepted candidates get verified captured reserve timestamps. Transition
  engine preserves source sporting evidence, then final rights remove unconfirmed
  next-season clubs and fill D1 with reserve-willing D2 finalists/remaining positions
  via saved seeded draw; replacements fill D2. Insufficient/unapproved counts review.
- Existing decision-calendar planner/UI now supports placement (5 rounds) and
  placement_decisions (1), explicit Admin dates and existing guards. No invented
  default placement weekdays. Cup-tied enforcement added on new cup_tied_policy_v1
  (actual constant regional_cup_tied_v1) terms: publication/ready/reserve/kickoff;
  actual declared prior Cup participation, not bench; no EA verification claim.
- MySQL8.4 installed via approved brew command. Dedicated data dir
  /private/tmp/stage-season-acceptance-mysql-v2 and socket
  /private/tmp/stage-season-acceptance.sock, skip-networking/mysqlx0. No brew service.
  Temporary mysqld process may still be running. Never substitute production.
- New scripts server/scripts/acceptance/{bootstrap,season,structures,restart-probe}.cjs.
  Bootstrap only allowed temp socket, random stage_acceptance_<12hex> DB and
  ephemeral JWT secrets; actual Express, JWT verification, stored roles, SQL.
  Controlled app clock only; no host-clock changes. Many temporary failed-run DBs
  retained as isolated artifacts, no production/testdata mixing.
- Real MySQL defects fixed: quote schema rank; shirt_sales.player_id nullable for
  existing SET NULL FK; admin audit before/after MEDIUMTEXT; JSON deadline params
  JSON.stringify + SQL JSON_UNQUOTE to avoid shared ISO->DATETIME coercion; club
  form VARCHAR32 (JSON5 needs21 chars); notification related_id VARCHAR255 for
  match:event; remove wrong parent/series/season unique index excluding parallel
  groups, retain unique regional edition key including group. Schema + startup
  aligned. Existing handled duplicate-index/absent-old-table startup logs remain.
- Latest normal season acceptance passed against real MySQL/JWT: 40 clubs, 160
  players,39 confirmations+1 reserve;84 placement;760league;39Cup;3promotion;
  7m/3m Cup payouts, club/player awards, no double settlement;first edition2 match;
  injected notice failure rolls schedule back;opponent-only approval/quota once;
  away-first2-2, stale rejection, unchanged confirmation, retry; fresh Node-process
  worker recovery preserves fixture/payment/award counts.
  Saved report docs/acceptance-results/normal-season-2026-11-06.json.
  complete:false is intentional: normal_season_route_complete:true is not all
  approved exceptions/features. Synthetic inline SVG proof, no actual EA/OCR/payment.
- All8structure capacities20..240 persist on MySQL (not activation or full played
  seasons at all sizes); report docs/acceptance-results/structures-2026-11-06.json.
- 409 selected server tests,32 frontend tests pass;lint/types/syntax/build pass.
  Two known baseline functionsController tests run separately still fail500vs200
  createMatchFromLeagueFixture and registration_upload vs ultimate_team expectation.
  Graphify still missing. Actual browser QA/full exception matrix not done.
- Read docs/competition-acceptance-phase8.md and delivery status next. Missing
  APPROVED code: transfer/free-entry/loan/sanction/individual conflict enforcement;
  withdrawal/no-show/stat corrections/financial exceptions; organizer tournament
  schedule consent; remaining UI/rules/tutorial coverage;full exception tests/reset.
  Unresolved policies remain NA times, unsupported admission/shrinkage,180->240
  extra calendar,cross-region priority/pause,premium/payment/financial/outage detail.
- Do NOT silently treat the normal season baseline as phase8 or full programme done.
- Final real-DB vacancy variant now passes too:41 timely next applications,
 40confirmed (one original D1 club declines), stored post-playoff reserve promotion,
 new entrant D2, preserved outgoing historical standings. A real null-right bug in
 old-source standing flags was fixed (not-confirmed != automatic relegation).
 Latest saved normal report includes this case and fresh-process recovery.
 Final targeted cycle/reserve/Cup-tied run:33pass. Two original baseline failures
 explicitly confirmed. Prepared docs/competition-deployment-manifest-2026-11-06.md
 and docs/repair-previews/regional-identity-readonly.sql; neither deployed/executed
 against production. Exact repair SQL is only a first-level inventory, not deletion
 permission. All unimplemented approved work remains in the handoff/delivery list.

### 7 November 2026 — player transfers and loans removed (ongoing programme)

- User confirmed placement is in-season after shared confirmation; explicitly
  removed loans instead of approving a loan-return policy. No need to ask again.
- Read `docs/official-player-transfers-phase3.md` for code seams, captured policy,
  archived loan data and exact limitations. New windows disclose transfer terms;
  no old window hashes are upgraded. All original dirty work was preserved.
- Actual contract acceptance now requires the recipient's stored linked user;
  the pending worker uses a private Symbol token. Active acceptance retries do
  not double-charge. Generic contract PATCH no longer mutates business fields.
- New official rosters/transfer receipts are checked at publication/readiness/
  kickoff; individual published selection/solo-match overlap is checked. New
  official free-player offers do not depend on a global manual transfer window.
- All active loan UI, entity and action entry points are removed/retired.
  Startup `retirePlayerLoans` snapshots live rows and retires them transactionally;
  no ledger/history deletion, refund or live operation occurred.
- Normal real-MySQL/JWT season rerun passed, report updated from
  `/private/tmp/stage-current-season.log` to the existing normal-season JSON.
- `player-exceptions.cjs` now passes real MySQL/JWT/HTTP (7 November report):
  forbidden/allowed transfers, actual free-player offers, ownership, retries,
  Plus expiry, individual overlap, generic mutation rejection and removed loans.
- Browser fixture uses only the saved normal isolated acceptance DB. It completes
  the synthetic viewer's country for the real onboarding gate; no server workers.
  Vite localhost4174 proxies only to fixture localhost18088, Chrome CDP19222 uses
  `/private/tmp/stage-acceptance-chrome`. Do not connect to production as fallback.
- Browser QA exposed stale `setMyPresidentId` call in Layout (no state exists).
  It aborted identity setup; removed the dead call and unused binding. Rerun QA.
- Current full frontend run: 481 tests, 476 pass, five source-shape failures in
  unchanged Admin/GameDay/photo-frame code or existing HeaderIdentityMenu shape.
  Do not claim full-suite success. Current player/contract server selection79
  passes. Separate player/club paths36/37; known legacy captain-profile case fails.
- Final verification, docs manifest and browser evidence still being finished.
  The whole programme remains incomplete; do not report all phases complete.

Final player-follow-up evidence: combined server164/163pass with one known
legacy captain-edit failure; full frontend481/476pass with five existing source
shape failures. Lint/typecheck/backend syntax/build pass. The corrected Layout
source test passes. Chrome five-view route now passes with zero runtime errors;
normal real season and latest player-exception reports pass, overall complete
remains false. See docs/competition-admin-user-guide.md and the exact combined
7 November deployment manifest (including NEW files and loan retirement).
Graphify update attempted, command absent. No live operation, push or deployment.

Final cross-region refinement: free-player offers and acceptance refuse active
foreign captured-cycle actual participation for Admin review; do not infer cycle
priority/pause rights. Bench-only evidence remains allowed. The updated isolated
HTTP player report passes; combined server remains163/164 with the same baseline.
All temporary API/Vite/Chrome QA processes were stopped; MySQL is left reusable.
