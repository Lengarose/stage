# Fase 2 — opgeslagen regionale cycli, 2 november 2026

Deze lokale bouwstap sluit de sportieve berekening aan op opgeslagen cycli,
officiële wedstrijden, Admin en de gebruikerspagina. Geen productiegegevens,
deployment, betalingen, GOST-kwalificaties of trofee-awards zijn uitgevoerd.

## Wat gebouwd is

- Eén cyclus per regio/platform/resetreeks/doelseizoen met opgeslagen serverseed,
  beleidsversie, structuur, bronrosters/-uitslagen en fixtureverwijzingen.
- Read-only preview; apply controleert bronnen opnieuw, gebruikt transacties en
  locking, en schrijft Admin-audit. Retries hergebruiken de bestaande operatie.
- Deelnemers komen uit actuele bronrosters en goedgekeurde inschrijvingen voor
  het exacte doelseizoen, regio, platform en resetreeks. De client kan geen
  clublijst, scores, winnaars, seed of rechten als waarheid doorgeven.
- Officiële duels in `competition_instances`, `competition_participants`,
  `competition_fixtures` en `matches`, met brontypes `regional_cycle` en
  `regional_pathway`. Bestaande GAMEDAY-/uitslag-/straf-schoppenflows blijven de
  bron. Bevestigde resultaten en forfaits proberen vervolgrundes te verwerken.
- Voor normale overgang: twintig clubs en alle 380 bevestigde officiële
  leaguewedstrijden per groep; de standen moeten met die uitslagen overeenkomen.
  Een legacy-score zonder gekoppeld officieel matchrecord is onvoldoende.
- Definitieve indeling pas na alle vereiste uitslagen: twintig unieke clubs per
  conceptgroep, dezelfde permanente divisie en trofee-default, groepspointers en
  opgeslagen sportieve rechten. De indeling start geen leaguekalender.
- Beheerde groepen gebruiken de regionale cyclus voor hun volgende editie.
  Zelfstandige oude promotie en individuele rollover schrijven daar geen
  afzonderlijke rechten naast. Bronseizoenen met een vastgelegde loting kunnen
  niet apart fixtures trekken, eindigen of worden opgegeven.
- Reset maakt de cyclus en haar duels/matches eveneens ongeldig. Voor een cyclus
  met meerdere divisies moet de volledige betrokken set worden geselecteerd.
- Een gewoon account kan niet via generieke registratie-CRUD zelf goedkeuren.

## Waar het staat en hoe het werkt

1. **Admin → Regional Leagues → Regional cycles and sporting allocation**:
   kies eerste plaatsing of volgend seizoen, doelveld, actuele brongroepen en
   eventuele aanvullende goedgekeurde inschrijvingen. Geef een reden.
2. **Preview structure and source checks**: controleert de bronnen en structuur.
   Daarna legt een bevestiging één loting en de officiële duels vast.
3. **Saved regional cycle**: heropen dezelfde cyclus, lees officiële resultaten
   opnieuw en open duels in GAMEDAY. Dit loten gebeurt niet opnieuw bij refresh.
4. **Preview final group allocation**: pas beschikbaar als de sportieve uitkomst
   definitief is. Een tweede bevestiging schrijft de conceptgroepen.
5. **Regionale league → Stages → Placement and promotion draw**: thuis/uit,
   gepubliceerde duels en GAMEDAY-links. Geen serverseed, Adminbewijs, e-mails of
   financiële gegevens in deze beperkte gebruikersweergave.

## API en opslag

Onder `/api/stage/regional-leagues`, reeds beschermd door `verifyToken`:

| Route | Gedrag |
| --- | --- |
| `POST /cycles` | Preview; met apply, reden en revisie: één cyclus vastleggen. |
| `GET /cycles` | Adminoverzicht. |
| `GET /cycles/:id` | Volledige Adminsnapshot. |
| `GET /cycles/:id/draw` | Beperkte lotingsweergave voor ingelogde gebruikers. |
| `POST /cycles/:id/progress` | Admin herleest uitslagen en maakt ontbrekende vervolgrundes. |
| `POST /cycles/:id/allocate` | Preview; met apply, reden en revisie: conceptgroepsindeling. |

`RegionalCycleModel` bewaart businesssnapshots als `regional_cycle` in de
bestaande flexibele store. Dit volgt de businessactie-uitzondering uit AGENTS:
geen nieuwe tabel/migratie, geen onbeveiligde generieke CRUD-route en geen nieuwe
frontendentiteit. Mutaties controleren de Adminrol en auditen transactioneel.

## Nog open

- Voor nieuwe plaatsings- en extra promotiegroepen is het op 2 november
  bevestigde beslissingsformat aangesloten: twee gelijke clubs spelen één duel
  met strafschoppen indien nodig; drie/vier spelen eenmaal tegen elkaar.
  Thuisverdeling gebruikt de opgeslagen serverseed. Alleen bevestigde officiële
  resultaten bepalen de indeling; oorspronkelijke leaguepunten blijven intact.
  Meer dan vier gelijke clubs of opnieuw een beslissende gelijkheid geven review.
  Admin toont dan clubs, gedeelde plaatsen en de betrokken sportieve grens.
  Niet-beslissende gelijkheid binnen dezelfde kwalificatiecategorie wordt niet
  als extra-dueltrigger gebruikt. Nieuwe cycli bewaren
  `tie_policy_version: regional_sporting_decisions_v1`; oudere cycli zonder deze
  snapshot behouden hun bestaande reviewgedrag. Geen stille beleidswijziging.
  De extra promotieroute 180→240 blijft bovendien kalendergeblokkeerd.
- Nieuwe overgangscycli bewaren `regional_source_decisions_v1`. Zij passen de
  onderlinge criteria op gewone league-eindstanden toe en maken zo nodig extra
  beslissingsduels vóór promotieplay-offs. Een volledig uitgespeelde groep mag
  hiervoor nog `in_progress`/`active` zijn. Onvolledige groepen en historische
  gelijke standen met een reeds geregistreerde kampioen vereisen vooraf review.
  Definitieve plaatsen en voltooiing volgen bij de definitieve cyclusindeling.
- Gewijzigd bronbewijs na publicatie blokkeert. Een afzonderlijke gecontroleerde
  herstel-/amendementprocedure mag geen automatische herloting worden.
- De bestaande inschrijfinterface krijgt in fase 3 de nieuwe regio-/Plus-flow.
  Aanvullende inschrijvingen zonder exacte seizoensmetadata zijn nu ongeschikt;
  de server raadt die gegevens niet. Bronrosters uit bestaande seeding werken.
- Tijdkalender in fase 4. De groei 180→240 blijft voor activering geblokkeerd
  totdat de extra vijf wedstrijden aantoonbaar in de kalender passen.
- Duurzame achtergrondretries en bredere automatisering in fase 6. Admin kan nu
  na een storing de officiële resultaten opnieuw laten lezen.
- Echte MySQL/JWT-test en desktop-/mobiele/toetsenbordcontrole. Browsertoegang
  tot de lokale preview werd geweigerd; er is geen visuele QA uitgevoerd. De
  tijdelijke eigen Vite-server is gestopt. GOST en D3 zijn niet geopend.

## Verificatie en deploymentgrens

De gerichte suite omvat volledige veertigclubsplaatsing, normale 40→40-overgang,
60→80-provisioning, 180→240-kalenderblokkade, wedstrijden/strafschoppen/forfaits,
retries, gelijktijdige apply, rollback na een schrijffout, reset en HTTP-acties.
HTTP-tests gebruiken geïsoleerde databasefixtures en een geïnjecteerde identiteit;
dit is geen echte MySQL/JWT-verificatie. Lint, typecheck, syntax en build worden
afzonderlijk gecontroleerd. Graphify ontbreekt in deze omgeving.

Uitkomst van deze lokale controle: **119 gerichte tests geslaagd**; lint,
typecheck, backend-syntax en frontendbuild geslaagd. De bestaande buildmeldingen
betreffen browserdata en chunkgrootte. Goedgekeurde inschrijvingen worden bij
eerste plaatsing eveneens naar de werkelijk toegewezen groep verwezen;
historische inschrijvingen van een vorige cyclus worden niet stilzwijgend
omgeschreven naar een nieuw seizoen. Browsercontrole blijft onuitgevoerd.

Nieuwe backendbestanden: `models/regionalCycleModel.js`,
`services/regionalCycleService.js`. Daarnaast wijzigen de regionale controller,
edition-, lifecycle-, reset-, publieke-, competition-engine- en penaltyservices.
De frontend voegt `RegionalCyclePanel` en `RegionalCycleDraw` toe en sluit ze aan
op `LeaguesTab` en `LeagueDetail`; `RegionalLeagues` toont de juiste promotieroute.
Deploy deze samen met de voorafgaande fase-1/2-bestanden. De Gandi-app moet na
backendupload herstart worden. Er is niets gedeployed.

`scripts/regional-cycle-qa.html` is een geïsoleerde UI-fixture met voorbeelddata;
zij vervangt geen API-test of echte browsercontrole.

## Aanvullende bouwstap — beslissende gelijkheid

Het aanvullende format is tijdens deze stap expliciet bevestigd en vastgelegd
in het masterdocument. Nieuwe aanvullende wedstrijden verschijnen in dezelfde
Admin-cyclus, gepubliceerde loting en GAMEDAY-flow als de bestaande duels.
Herlezen van uitslagen behoudt hun fixture-ID, koppeling en thuisverdeling.
Een gelijke stand zonder bevestigde strafschoppenwinnaar geeft geen plaats.

**Controle van deze aanvulling:** 29 gerichte tests geslaagd (sportieve planner,
cyclusintegratie inclusief lokale HTTP, engine-hooks en strafschoppenbeleid).
Daaronder: één beslissingsduel, drie/vierclubsminicompetitie, opnieuw gelijke
mini-league, ontbrekende/betwiste resultaten, retries en oude beleidsnapshots.
Lint, typecheck, backend-syntax, diffcontrole en frontendbuild slagen. Bestaande
buildwaarschuwingen over browserdata/chunkgrootte blijven. Graphify ontbreekt.
Geen nieuwe endpoint toegevoegd; bestaande HTTP-acties zijn met geïsoleerde
databasefixtures getest. Geen browser- of echte MySQL/JWT-verificatie en geen
deployment.

## Aanvullende bouwstap — gewone league-eindstanden

In **Admin → Regional Leagues → Regional cycles → Next season** worden eerst
alle volledige brongroepen geselecteerd. Preview controleert rosters, gekoppelde
officiële uitslagen en standen. De opgeslagen cyclus maakt eerst noodzakelijke
`source:D1A`/`source:D2A`-beslissingsduels. Thuisverdeling blijft vast; retries
loten niet opnieuw. Meer dan vier gelijke clubs of opnieuw gelijk blijven in
review. De kalender wordt hiermee nog niet ingepland.

Pas na deze beslissingen verschijnen promotieduels. Definitieve toepassing legt
de eindvolgorde vast zonder leaguepunten/goals te wijzigen en sluit de broneditie
af. Een ontbrekende kampioen wordt uit de definitieve rangschikking vastgelegd;
bestaande historische kampioenen worden niet overschreven. De broneditie blijft
in History, terwijl de huidige groepspointer de volgende editie opent.
**League → Stages** houdt de beslissingscyclus bereikbaar; **Table** gebruikt
de vastgelegde eindvolgorde. Gewone CRUD kan de eindvolgorde of revisie niet zetten.

De bestaande prijzencontrole kan deze volgorde lezen. Eindposities en een revisie
van de oorspronkelijke officiële league-uitslagen worden gecontroleerd; gewijzigde
uitslagen/beschadigde snapshots blokkeren verwerking. De cyclusactie betaalt zelf
niets uit en kent geen trofee toe. Bedragen en overige betalingscontroles blijven
gelijk. Oude cycli krijgen geen nieuw bronrangschikkingsbeleid. GOST en D3 blijven
gesloten. Er is geen productie gewijzigd.

Deze aanvulling is gecontroleerd met **92 gerichte tests**, inclusief officiële
bronbeslissingen, strafschoppen, opnieuw gelijke minicompetitie, eindposities,
promotie/degradatie, behoud punten, snapshots, prijzencontrole en bestaande lokale
HTTP-acties met geïsoleerde databasefixtures. Lint, typecheck en backend-syntax
slagen; de frontendbuild slaagt met de bestaande browserdata/chunkwaarschuwingen.
Graphify ontbreekt; browser- en echte MySQL/JWT-verificatie blijven open.
