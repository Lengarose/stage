# Bouwprompt 2 — Divisies, groepen, plaatsing en sportieve beweging

Status: bouwopdracht voorbereid en lokale uitvoering gestart op 2 november 2026.
De gebruiker heeft de tabellen in §4–5 van het masterdocument expliciet bevestigd.
De daadwerkelijke voortgang en resterende integratie staan in
`docs/regional-structure-phase2-progress.md`. Productie is niet aangepast.

## Prompt

Implementeer fase 2 van STAGE: regionale divisies met parallelle groepen, eerste
plaatsing, normale promotie/degradatie en de bevestigde uitbreidingsroutes.
Werk voort op fase 1; behoud bestaande permanente league-identiteiten, edities,
trofeeën, financiële historie, geldige routes en herstelpreviews.

### Lees eerst en controleer de basis

- `AGENTS.md` en `CONTEXT.md`.
- `docs/stage-competition-masterplan.md`, §1–6, §12–13, §15–19 en §22–26.
- `docs/league-identity-lifecycle.md`, met de gedateerde fase-1-uitkomst.
- Actuele identity-, hierarchy-, lifecycle-, reset-, public-view- en
  competition-engine-code; bestaande tests en de werkboom.
- Graphify-rapport/wiki indien beschikbaar; meld ontbrekende tooling.

Maak onderscheid tussen al lokaal gebouwd, actueel getest en daadwerkelijk
live geverifieerd. De twee productieconsolidaties uit fase 1 zijn nog niet
uitgevoerd. Gebruik die oorspronkelijke IDs niet als wegwerp-testgegevens.

### Doel en domein

Een regio bevat divisies; een divisie kan parallelle groepen hebben; groepen
hebben seizoensedities. D1A en D1B zijn hetzelfde niveau. Season 2 van D1A is
geen D1B en geen nieuwe zelfstandige league.

Kies een compatibel model dat dit onderscheid server-side afdwingt, inclusief
unieke identiteit bij gelijktijdige verzoeken. Leg het gekozen model en de reden
vast. Behoud oude IDs en URLs; behandel een historische league met één groep
ondubbelzinnig zonder een nieuw recht, tweede root of nieuwe historie te verzinnen.

Alle fasen gebruiken dezelfde groeps- en editie-identiteit: aanmaken, seeding,
volgende editie, resetseries, linked divisions, sportieve rechten, trofee-defaults,
Admin, Rewards, publieke overzichten en archief. Alleen een letter toevoegen aan
een kaarttitel of slug is onvoldoende. Regio, platform, niveau, groep en cyclus
moeten expliciet te onderscheiden zijn.

### 1. Ondersteunde structuren

Iedere groep heeft twintig clubs. De bevestigde verdelingen per regio zijn:

| Clubs | D1-groepen | D2-groepen |
| --- | --- | --- |
| 20 | 1 | 0 |
| 40 | 1 | 1 |
| 60 | 1 | 2 |
| 80 | 2 | 2 |
| 100 | 2 | 3 |
| 120 | 2 | 4 |
| 180 | 3 | 6 |
| 240 | 4 | 8 |

Gebruik stabiele groepsaanduidingen A, B, enzovoort binnen het niveau. Ondersteun
deze structuren als expliciete versiegebonden configuraties, niet als een formule
die willekeurige aantallen/groei verzint. Maak niet alvast alle lege groepen live.
Bereid provisioning voor het gekozen volgende seizoen voor; pas haar toe via een
bevoegde serveractie met preview, audit, herhaalbaarheid en passende broncontrole.

Groei gebeurt vóór een volgende editie; een begonnen groep blijft intact. Het
startbeslismoment, een onvolledig deelnemersaantal zoals dertig of vijftig, krimp
en groei boven 240 zijn open beleid. Toon daarvoor een begrijpelijke reviewstatus.
Rond aantallen niet stil naar boven/beneden af en laat Admin niet ongemerkt
sportieve rechten schrappen om de structuur passend te maken.

### 2. Eerste plaatsing bij lancering

Dit is een eenmalige sportieve indeling. Clubs schrijven in voor een regio,
niet voor een zelf gekozen gegarandeerde D1-plaats. De bevestigde formats zijn:

| Clubs | Plaatsing |
| --- | --- |
| 20 | Eén D1-groep; geen promotie/degradatie naar een niet-bestaande D2. |
| 40 | Acht groepen van vijf, enkelvoudig round-robin. Top twee per groep levert zestien D1-clubs. De acht nummers drie spelen vier beslissingswedstrijden; hun vier winnaars vullen D1 tot twintig. De overige twintig gaan naar D2. |
| 60 | Tien groepen van zes; top twee naar D1, overige veertig naar twee D2-groepen. |
| 80 | Zestien groepen van vijf; top twee levert 32 D1-clubs. De zestien nummers drie spelen acht beslissingswedstrijden; winnaars vullen D1 tot veertig. Overige veertig naar D2. |
| 100 | Twintig groepen van vijf; top twee naar D1, overige zestig naar D2. |
| 120 | Twintig groepen van zes; top twee naar D1, overige tachtig naar D2. |

Plaatsingsgroepen hebben vier of vijf wedstrijden per club; geen heen/terug-
league van 38 duels voor dit evenement. Voor 180/240 clubs gelden de onderstaande
uitbreidingsroutes na een eerdere editie. Een directe lancering met 180/240 heeft
geen vastgesteld eerste-plaatsingsformat en mag niet worden afgeleid uit groei.

Herbruik de bestaande wedstrijd-/toernooi-engine waar die dit ondersteunt, met
expliciete brontypes en referenties. Einduitslagen en bevestigde beslissingsduels
bepalen rechten; fixtures trekken of voorlopige standen doen dat niet. Verzamel
resultaten via de bestaande officiële uitslagflow; accepteer geen onbeveiligde
clientlijst van ‘winnaars’ als waarheid.

Leg vóór activering de loting, thuisverdeling en koppeling van de beslissingsduels
vast. Op 2 november 2026 is bevestigd: willekeurige koppeling van de nummers drie,
eerst getrokken club thuis, koppels en thuisverdeling vóór de duels zichtbaar.
Bewaar het lotingsresultaat; een retry mag niet opnieuw loten.
Gebruik de goedgekeurde sportieve tiebreakers; onopgeloste beslissende
gelijkheid geeft een beslissingswedstrijd/minitoernooi, geen plaatsing op naam/ID.
Een transparante loting voor gelijkwaardige indeling is iets anders dan een
loting die een sportief gelijke beslissende positie oplost.

Bij veertig clubs is het controlegetal: tachtig groepswedstrijden plus vier
beslissingsduels, daarna exact twintig unieke clubs per divisie.

### 3. Normale promotie en degradatie

Per D2-groep promoveren twee clubs:

- De kampioen rechtstreeks.
- De winnaar van play-offs: 2 tegen 5 en 3 tegen 4, daarna finale.
- Enkelvoudige wedstrijden; de hoger in de league geëindigde club speelt thuis.

| Structuur | Promovendi totaal | D1-degradatie |
| --- | --- | --- |
| 40: 1 D1 / 1 D2 | 2 | Onderste 2 van de D1-groep. |
| 60: 1 D1 / 2 D2 | 4 | Onderste 4 van de D1-groep. |
| 80: 2 D1 / 2 D2 | 4 | Onderste 2 per D1-groep. |
| 100: 2 D1 / 3 D2 | 6 | Onderste 3 per D1-groep. |
| 120: 2 D1 / 4 D2 | 8 | Onderste 4 per D1-groep. |
| 180: 3 D1 / 6 D2 | 12 | Onderste 4 per D1-groep. |
| 240: 4 D1 / 8 D2 | 16 | Onderste 4 per D1-groep. |

Er bestaat geen D2-degradatie zolang D3 niet actief bestaat. Dat is geen garantie
op een plaats in iedere gewenste andere regio; deelnamebevestiging en aansluiting
volgen hun eigen voorwaarden. Deze fase opent D3 niet.

Bereken beweging op het niveau van het hele regionale systeem. De oude
één-op-één linked-league-selector of ‘altijd top twee rechtstreeks’ mag niet
parallel de verkeerde rechten blijven schrijven. Wacht op alle noodzakelijke
groepsuitslagen en promotieduels. Geef clubs inzicht in voorlopig versus definitief.

### 4. Eenmalige uitbreidingsroutes

| Groei | Verdeling voor volgende editie |
| --- | --- |
| 20 → 40 | Bestaande twintig behouden D1; twintig nieuwe clubs naar D2. |
| 40 → 60 | Normale uitwisseling van twee clubs; twintig nieuwe clubs vullen D2 aan. |
| 60 → 80 | D1 behoudt top zestien. Per bestaande D2-groep top tien direct plus winnaars van 11–14 en 12–13: twaalf per groep. Samen veertig D1-clubs. Twintig nieuwe clubs vullen D2 aan. |
| 80 → 100 | Normale uitwisseling van vier clubs; twintig nieuwe clubs naar D2. |
| 100 → 120 | Normale uitwisseling van zes clubs; twintig nieuwe clubs naar D2. |
| 120 → 180 | D1 behoudt 32 clubs. Per vier D2-groepen top vijf plus winnaars van 6–9 en 7–8: zeven per groep, 28 samen. Zestig D1-clubs totaal. Zestig nieuwe clubs vullen D2 aan. |
| 180 → 240 | D1 behoudt 48 clubs. Twaalf normale promovendi plus twintig extra uit dertig kandidaten. De volgende vijf nog niet gepromoveerde clubs per bestaande D2-groep vormen vijf groepen van zes, één club uit iedere brongroep. Top vier per groep promoveert. Tachtig D1-clubs totaal. Zestig nieuwe clubs vullen D2 aan. |

Bij 180 → 240 dezelfde club nooit zowel normaal als extra laten promoveren.
Kandidaten pas kiezen nadat normale promotie definitief is. De vijf extra
wedstrijden moeten in de kalender passen; geen automatische activering zolang
dat niet bewezen is. Een goedgekeurde sportieve route is geen automatische
goedkeuring van onmogelijke speeltijden.

De directe plaatsen en beslissingsduels in 60 → 80 en 120 → 180 vormen de volledige
uitbreidingsroute. Tel daar niet nogmaals de normale twee promovendi per groep bij.

Bestaande rechten en uitbreidingsrechten samen bepalen de volgende verdeling.
Verdeel clubs evenwichtig over de groepen binnen hun verdiende niveau. Gebruik
een controleerbare loting/indeling; niet alle nieuwkomers stelselmatig apart zetten.
Pas een regio-overstap niet toe als omweg rond een verdiende degradatie.

### 5. Betrouwbare toepassing en integratie

- Scheid pure berekening van schrijven. Eén duidelijke berekeningsinterface geeft
  structuur, benodigde duels, voorlopige/definitieve rechten, deelnemers en blockers.
- Elke berekening benoemt broncyclus, broneditie/groep, gekozen beleidsversie en
  doelcyclus. Season 1 na reset is niet Season 1 uit een vorige reeks.
- Bij apply opnieuw de bron controleren en locking/transactionele garanties
  gebruiken. Gewijzigde standen, een betwist duel, ingetrokken club of andere
  groepsstructuur maakt een oude preview ongeldig.
- Idempotente toepassing: dezelfde club krijgt één recht per cyclus; een retry
  maakt geen tweede groep, plaatsingswedstrijd of toewijzing.
- Deelnemers moeten echte geldige club-IDs zijn; geen dubbele club in twee
  officiële groepen van dezelfde cyclus. Behoud bewijs en verwijzingen bij fouten.
- Geen uitbetaling of extra trofeetoekenning door alleen indelen/promoveren.
  Groepen erven het toegewezen divisieontwerp via de bestaande catalogusflow;
  historische awards en snapshots blijven intact.
- Backendrollen en Admin-audit volgens AGENTS. Nieuwe concepten in de bestaande
  generieke league-store opnemen waar passend. Gebruik de MVC-receptuur of de
  expliciete businessactie-uitzondering; geen losse clientside mutatieketen.

### 6. Admin en gebruikersinformatie

Pas de bestaande Admin-beheerflow aan: regio → divisies → groepen → editie.
Toon huidige structuur, geplande volgende structuur, deelnemers/capaciteit,
promotieroutes en eventuele blockers. Normale provisioning door de engine;
uitzonderingen via gecontroleerde preview/apply, met reden en audit.

Gebruikers zien de juiste groep en cyclus en een korte geldende uitleg bij de
stand en play-offs. Zet nieuwe regels bij de functie, met versie/ingangseditie.
Een volgende editie mag de regels van een al lopend seizoen niet herschrijven.
Behoud de goedgekeurde rustige UI, witte gloeiende tabs en rechte kaders; volledig
visueel herontwerp en tutorials komen later.

De inschrijvings-/Plus-flow hoort bij fase 3, de volledige tijdkalender en
wedstrijduitzonderingen bij fase 4, Cups/settlement bij fase 5 en de duurzame
automatische orkestratie bij fase 6. Lever fase 2 met werkende serveracties en
bruikbare Admin-bediening, niet alleen ongebruikte berekeningshelpers.

### Open punten en grenzen

GOST blijft gesloten; geen nieuwe tickets of continentale toernooien. D3 blijft
afgeschermd. Geen nieuwe prijzen of restitutievoorwaarden. Geen krimpformule,
willekeurige tussenstructuur, nieuwe absolute startdatum, of spelinstelling
verzinnen. Open details alleen aan het afhankelijke activeringspad laten blokkeren.
Maak een concreet voorstel bij een ontbrekende beslissingsduelloting; voer
onafhankelijk werk ondertussen uit.

Geen deployment, livegroepaanmaak, productiesimulatie, financiële mutatie of
productiereparatie. De fase-1-ID-previews blijven een afzonderlijke operationele stap.

### Acceptatie — drie resultaten

1. **Identiteit en structuur:** parallelle groepen zijn echte verschillende
   groepen binnen hetzelfde niveau; edities, reset, routes, trofee-defaults en
   Admin/Rewards blijven consistent. Alle ondersteunde structuren hebben exact
   twintig unieke clubs per definitief gevulde groep, zonder historieverlies.
2. **Sportieve routes:** eerste plaatsing, normale beweging en iedere bevestigde
   groei hebben gecontroleerde aantallen en echte bronverwijzingen; één kampioen
   plus één play-offwinnaar per D2-groep normaal; geen niet-bestaande degradatie,
   dubbel recht of premature toepassing. Onvolledige/betwiste bronnen blokkeren.
3. **Werkende integratie:** serveracties en Admin-bediening zijn lokaal getest,
   met audit, concurrentie/retries, foutafhandeling en korte versiegebonden uitleg.
   Open kalender-/beleidsgrenzen zijn zichtbaar; GOST en D3 blijven gesloten.

### Verificatie en overdracht

Test iedere structuur en groei, veertigclubsplaatsing volledig, alle play-off-
uitslagen, gelijkheden en betwistingen, ontbrekende wedstrijden, verkeerde regio/
platform/cyclus, resetseries, dubbele clubs, withdrawal tijdens preview, retries,
gelijktijdige apply en rollback. Controleer behoud van geldige fase-1-ID-mappings,
oude één-groepsroutes, trophies, snapshots en ledgers.

Voer lint, typecheck, backend-syntax en passende gerichte tests uit. Raak nieuwe
endpoints echt via HTTP; onderscheid fixtures van echte MySQL/auth. Build en
desktop-/mobiele/toetsenbordcontrole voor gewijzigde UI. Behoud en rapporteer
onverwante bestaande testfailures; werk graphify bij waar beschikbaar.

Werk masterdocument en lifecycle-/fase-2-overdracht bij met daadwerkelijke uitkomst,
vindplaatsen, gebruikte beleidsversie, open punten, deploymentbestanden en
migraties. Beschrijf wat Admin nu kan, wat later automatisch wordt en welke
activering nog geblokkeerd is. Claim geen live werking zonder live verificatie.
