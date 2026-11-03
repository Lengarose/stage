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
