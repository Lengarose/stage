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
