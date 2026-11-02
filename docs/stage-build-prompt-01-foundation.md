# Bouwprompt 1 — Competitie-identiteit, seizoenen, trofeeën en herstel

Status: klaar om als afzonderlijke bouwopdracht te gebruiken. Het schrijven van
dit bestand voert de opdracht niet uit. Geen deployment of productiereparatie
is door deze documentatiesessie uitgevoerd.

## Prompt

Werk in de STAGE-repository. Implementeer fase 1 van het masterplan: een betrouwbaar
fundament voor permanente leagues en hun seizoensedities. Controleer en hergebruik
de bestaande oplossing; herstel ontbrekende of incorrecte onderdelen. Lever de
lokale implementatie, verificatie en een uitvoerbaar overdrachtsdocument op.

### Lees eerst

1. `AGENTS.md` in de repository.
2. `docs/stage-competition-masterplan.md`, met name §1–2, §13, §15–18 en §22–26.
3. `docs/league-identity-lifecycle.md` voor de reeds beschreven lokale oplossing.
4. `docs/regional-edition-identity-review.md` voor de oudere diagnose en preview.
5. `docs/competition-regional-redesign.md`, `docs/gost-overview-redesign.md` en
   `docs/gost-detail-redesign.md` voor de bestaande consumers en trofeeflow.

Lees het graphify-rapport en de wiki als die beschikbaar zijn. Als ze ontbreken,
meld dat en volg de actuele relevante code. Inventariseer de werkboom en behoud
werk buiten deze opdracht. Behandel historische testresultaten in documenten als
historische informatie; verifieer de actuele implementatie opnieuw.

Beslisstatus B/N/O/L staat in het masterdocument. Alleen de fase-1-afspraken zijn
hier uitvoerbaar. Onbekende groepsgroei, wedstrijddeadlines, prijzen of toelating
zijn geen aanleiding om zelf nieuw beleid vast te stellen.

### Doel

Een league behoudt één permanente identiteit. Season 2, Season 3 enzovoort zijn
edities daaronder. Een volgend seizoen wordt geen tweede zelfstandige league in
Regional Leagues, Admin of Rewards. Trofeeën en standaardconfiguratie blijven aan
de permanente league verbonden; historische editiegegevens blijven intact.

Dit moet werken voor regionale leagues en voor de bestaande GOST-competitie/
seizoenstructuur. Deze fase opent GOST niet en activeert geen D3.

### 1. Controleer de huidige toestand

Volg de daadwerkelijke frontend- en serverpaden voor:

- Seeding en aanmaken van leagues; opnieuw proberen en twee gelijktijdige verzoeken.
- Voltooien, afbreken, volgend seizoen en herstellen/resetten.
- Permanente roots, edities, resetseries en links naar vorige/volgende editie.
- Regional-hub, detailpagina, Admin Regional Leagues/GOST en Rewards-bronselectie.
- Trofeeselectie, rewarddefaults, editiecapture en toegekende awards.
- De bestaande draw-, complete-, abandon- en rollover-acties en hun bevoegdheden.

Leg kort vast wat aantoonbaar al bestaat, wat ontbreekt en wat wordt aangepast.
Gebruik de bestaande lifecycle-services en endpoints wanneer die voldoen. Bouw
geen tweede parallel systeem alleen omdat dit een nieuwe prompt is.

### 2. Houd permanente league en editie uit elkaar

- Hergebruik het bestaande compatibele parent/edition-model waar correct.
  Behoud bestaande IDs, routes en fixture-/historieverwijzingen.
- Een permanente league heeft één ondubbelzinnige huidige editie. Oude edities
  blijven via hun eigen ID en de seizoenselector bereikbaar.
- Nieuwe edities erven de defaults van de permanente league. Captured configuratie,
  betaalde bedragen en toegekende trofeeën van oude edities blijven ongewijzigd.
- Gelijke namen zijn geen bewijs van gelijke identiteit. Normaliseer expliciete
  regio-, divisie- en platformvelden; behoud werkelijk verschillende platforms.
- Bewaak unieke identiteit server-side en in de database waar nodig. Bestaande
  ambigue data zichtbaar rapporteren; geen stille merge tijdens startup.
- Volgend seizoen en seeding zijn atomair en idempotent. Twee verzoeken of een
  verloren response leveren dezelfde opvolger, niet twee roots of twee edities.
- Neem echte groepidentiteit als aparte toekomstige dimensie in het ontwerp op.
  Een geldige D1A en D1B mogen later niet als duplicate worden behandeld. Maak
  nu geen groepen of groeiregels aan: daadwerkelijke groepengine hoort bij fase 2.
- Registreer deelnemers niet blind opnieuw. Nieuwe editie begint met de juiste
  bestaande bevestigings-/registratieroute; automatiseer nog geen onbeslist beleid.

### 3. Bereid herstel van de exact genoemde vermeldingen voor

De gebruiker wil de extra zelfstandige leaguevermeldingen weg en de oorspronkelijke
leagues behouden. Controleer deze expliciete mapping aan echte gegevens zodra
doelomgeving en geautoriseerde toegang beschikbaar zijn:

| Extra zelfstandige vermelding | Oorspronkelijke te behouden league |
| --- | --- |
| Premier: `46dbb09f-8319-4607-ab97-ec941745bfd8` | `c2d6e60f-89e0-4813-81a1-967551d8d69f` |
| North American D1: `e582c55b-1e72-45f5-ab63-137c3420404a` | `e91c6c27-4fd2-45d9-b6ed-6a3591d7b210` |

Gebruikersverklaring: bij North America werd na een gespeeld Season 1 een Season 2
gemaakt; reset liet de extra league staan en hernummerde die naar Season 1.
Premier Season 1 werd beëindigd zonder wedstrijden omdat de draw-actie ontbrak.
Deze verklaring is context, geen zelfstandig geverifieerde databasegeschiedenis.

De bestaande lokale lifecycle-oplossing stelt voor:

- Premier Season 2 behouden als editie onder de oorspronkelijke Premier-league,
  zodat die geen tweede zelfstandige Rewards-/hubbron meer is.
- De bewezen ongebruikte colliderende NA-resetroot als vervallen kind behandelen,
  zonder een onbekende herkomst als bewezen Season 2 te herschrijven.

Controleer of dit voorstel bij de actuele data past. Het einddoel is één juiste
zelfstandige vermelding, met legitieme geschiedenis behouden. Een geldige editie
mag een database-ID blijven hebben. Alleen proven-unused data komt voor fysieke
verwijdering in aanmerking; verberg conflicterende actieve historie niet simpelweg
in de frontend.

Gebruik de bestaande read-only diagnostics en dependency-preview. Inventariseer
registraties, deelnemers, standings, fixtures, matchreports, lineups, schema’s,
kwalificaties, promotie/degradatie, rewards, captures, payouts, ledgers, awards,
kastplaatsingen, archief en audit. Rapporteer ontbrekende bewijsbronnen als blocker.

Voor Premier expliciet aangeven of de lege ‘completed’-editie onterechte prijzen,
kampioenschap, promotie of kwalificatie heeft veroorzaakt. Corrigeer dit niet door
wedstrijden te verzinnen of betaalde boekingen stil te wissen.

Productie: maak eerst een concrete preview met bron/retained IDs, afhankelijkheden,
voor/na, blockers en reviewrevision. Toon die vóór een afzonderlijk goedgekeurde
apply. Voer in deze bouwopdracht geen productie-apply, reset, simulatie of betaling
uit. Ontbrekende toegang blokkeert de live verificatie, niet het lokale bouwen en
testen van de herstelroute. Gebruik geen fictieve gegevens als live bevindingen.

### 4. Trofeeën blijven gekoppeld

- Bestaande Trophies-catalogus en expliciete toewijzings-ID hergebruiken.
  Geen nieuwe uploader en geen koppeling op alleen naam of afbeelding.
- Selectie werkt op permanente league; volgende editie hergebruikt dat ontwerp.
  Conflicterende toewijzingen tonen in plaats van willekeurig kiezen.
- Actuele defaults onderscheiden van editie-/award-snapshots. Nieuw ontwerp of
  consolidatie verandert nooit automatisch een eerder verdiende trofee.
- Alleen selecteren of een pagina lezen geeft geen award en betaalt geen STC.
- Admin kan bestaande toewijzing zien, bewaren en opnieuw laden. Geef nuttige
  informatie bij ontbrekend ontwerp zonder een verzonnen vervangtrofee te tonen.

### 5. Herstel reset zonder de oude collision terug te brengen

Hergebruik de bestaande scoped preview/apply-oplossing en resetseries als die
correct zijn. Een nieuw Season 1 behoort tot een nieuwe reeks onder dezelfde
permanente league. Historische edities worden niet allemaal naar Season 1 omgezet.

- Expliciete scope: regionaal, GOST of beide, eventueel concrete permanente IDs.
- Preview toont de werkelijk geraakte records, historie, honours en verplichtingen.
- Apply vereist geldige revision, bevoegdheid, reden en expliciete bevestiging.
- Bestaande ambigue roots eerst oplossen; uniqueness niet uitschakelen om reset
  te laten ‘werken’.
- Defaults, ontwerpen, accounts, clubs, spelers en ongerelateerde historie blijven
  behouden. Volg voor geraakt gegenereerd verleden de bestaande auditeerbare
  invalidatie-/revocatieflow; geen blinde ledgerverwijdering of herbetaling.
- Exacte retry van dezelfde bewerking maakt geen nieuwe resetreeks of tweede
  fresh Season 1. Een bewust nieuwe reset is een andere expliciete bewerking.
- Een mislukte apply rolt terug; een gewijzigd preview wordt opnieuw beoordeeld.
- GOST blijft na reset gesloten/draft; geen publieke open inschrijving of tickets.

### 6. Minimale lifecycle-bediening in Admin

Controleer de reeds bestaande acties en herstel gaten die dit fundament blokkeren:

- Per exacte regionale en GOST-editie ‘Fixtures trekken’, met capaciteit-, format-
  en deelnemerscontrole. Voor een actieve editie zonder fixtures mag de correcte
  herstelroute beschikbaar zijn; bestaande fixtures nooit blind overschrijven.
- Herhaalde draw-aanvraag maakt geen duplicaten. Bij een gedeeltelijk of
  tegenstrijdig schema nuttige blokkade/herstelpreview, geen stil nieuw schema.
- Simulatie alleen via bestaande expliciete geautoriseerde beheeractie, met
  geschikte ongespeelde fixtures. Geen productiesimulatie tijdens verificatie.
- Voltooien valideert de vereiste wedstrijden en definitieve uitkomsten.
  Een leeg seizoen levert geen verzonnen kampioen, prijzen of sportieve rechten.
- Afbreken is een afzonderlijke handeling met reden en behoud van bewijs en
  verplichtingen; niet hetzelfde als sportief voltooien.
- Controleer dat bestaande completion/rollover-acties geen nieuwe GOST-kwalificatie
  activeren zolang GOST gesloten is. Bewaar al bestaande historische gegevens.
- Beheer van permanente leagues blijft mogelijk via gecontroleerd toevoegen,
  uitfaseren en verwijderen van bewezen ongebruikte drafts. Geen actief verleden
  hard verwijderen. Verwijder de Admin-beheerfunctie niet omdat later automatische
  groepsgroei komt; volledige structuurbediening wordt verder uitgewerkt in fase 2/6.

De nieuwe kalender-, selectie- en matchregels vallen buiten deze fase. Behoud het
huidige geldige format; bouw niet alvast een concurrerende scheduling-engine.

### 7. Laat alle consumers dezelfde identiteit gebruiken

Regional-hub, Admin-lijst, Rewards-bronselectie en trofeetoewijzing tonen dezelfde
permanente league met haar huidige editie. Werkelijke oude edities horen onder
History/seizoenskeuze, niet als nieuwe zelfstandige league.

Behoud oude detail-URLs en edition-links. History kiest de juiste editie; browser
Back/Forward blijft werken. Herhaald response-ID één keer renderen; verschillende
conflicterende IDs niet op label dedupliceren. Fouten tonen als fout met Retry,
niet als een lege lijst of ‘0 clubs’. Reset/repair moet relevante caches verversen.
Toon technische identity-diagnostiek bij Admin; houd openbare teksten begrijpelijk.

### Grenzen van fase 1

Wel: identiteit, lifecycle-betrouwbaarheid, trofee-erfenis, herstelpreview en minimaal
benodigde Admin/consumer-correcties.

Latere fases: groepsgroei, plaatsingsformats, nieuwe promotie-engine, persoonlijke
Plus-handhaving, Regional Cups, nieuwe kalender/deadlines, volledige automatisering,
pagina-redesign en tutorials. Behoud bestaande goede UI en betaal-/uitslaglogica.
Geen GOST-opening, D3, bedragenwijziging, deployment of productiegegevensmutatie.

### Technische uitvoering

Volg `AGENTS.md`: bestaande generieke league-entiteiten hergebruiken waar passend,
transactionele businessacties via bevoegde serveracties, adminactor uit authcontext,
voor/na met reden auditen. Schema en startupmigraties blijven gelijkwaardig en
idempotent. Startup doet geen verborgen productieconsolidatie of verwijdering.
Hanteer SQL-transacties/locking op één transactieverbinding; lokale fixturetests
zijn geen bewijs van echte MySQL-concurrency.

### Acceptatie — drie resultaten

1. **Identiteit:** seed, rollover en herhaalde/concurrente verzoeken behouden één
   permanente league en de juiste unieke edities. Huidige lijsten zijn consistent,
   oude routes werken, echte platforms en latere groepen worden niet samengevoegd.
2. **Behoud en herstel:** trofee-defaults erven correct; historische captures,
   awards en betaalde ledgers blijven behouden. Beide expliciete ID-mappings en
   scoped reset hebben controleerbare previews, stale-reviewbescherming,
   autorisatie, audit en herhaalbare lokale verificatie. Live status apart rapporteren.
3. **Lifecycle en overdracht:** draw/complete/abandon/rollover zijn per editie
   bruikbaar met juiste controles; leeg voltooien en dubbel genereren falen veilig.
   Lever testresultaten, resterende blockers, vindplaatsen en operationele stappen.

### Verificatie en oplevering

Test gericht: huidige en oude editie, meerdere platforms, toekomstige aparte
groepidentiteit, duplicate-ID-mapping, dubbele root met activiteit, ontbrekende
bewijsbron, gelijktijdig seed/rollover/draw, retry na verloren response, gedeeltelijk
schema, onterecht complete leeg seizoen, stale preview, resetrollback en exact
dezelfde resetretry. Verifieer behoud van ledger/award/capture en bestaande D2.

Voer `npm run lint`, `npm run typecheck`, `node --check server/src/server.js`,
passende regressies en bij frontendwijzigingen de build uit. Raak nieuwe of
gewijzigde endpoints over lokale HTTP; gebruik een geïsoleerde database/fixtures.
Vermeld wat met echte MySQL/auth getest is en wat niet. Test geraakte Admin-flows
op desktop, mobiel en toetsenbord. Werk graphify bij na codewijzigingen als tooling
beschikbaar is; meld ontbrekende tooling. Claim geen groene checks die niet liepen.

Werk `docs/league-identity-lifecycle.md` bij met de actuele implementatiestatus,
geen tweede tegenstrijdige handleiding. Noteer de fase-1-uitkomst en open punten
in het masterdocument. Lever voor de gebruiker kort op:

- Wat is veranderd en waarom; welke bestaande oplossing behouden bleef.
- Waar in Admin en gebruikerspagina’s de acties/status staan.
- Testresultaten, inclusief oude failures en concrete beperkingen.
- Exacte deploymentbestanden, migraties, Gandi-restart en verificatieprocedure,
  zonder deployment uit te voeren.
- Indien toegang bestaat: beide concrete read-only productiepreviews met blockers;
  anders exacte ontbrekende verificatie en een uitvoerbare previewprocedure.
- Welke productiestappen nog afzonderlijk moeten worden goedgekeurd en waarom.

Ga door met onafhankelijk lokaal werk wanneer alleen live toegang ontbreekt.
Rond af met een eerlijk onderscheid tussen lokaal gebouwd, lokaal getest,
live geverifieerd en nog niet uitgevoerd.
