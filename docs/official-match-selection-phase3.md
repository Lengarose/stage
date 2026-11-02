# Fase 3 — officiële wedstrijdselecties, lokale bouwstap

Deze stap sluit persoonlijke Plus en speelregistratie aan op de bestaande
wedstrijdselecties en de GameDay-aftrap. Niets is gepubliceerd of in productie
uitgevoerd. GOST, D3 en regionale cups zijn hiermee niet geopend.

## Wat is aangesloten

Alleen regionale edities met `regional_participation_policy_version =
regional_registration_v1` en plaatsings-/promotiecycli met die versie in hun
`participation_window_snapshot` krijgen de nieuwe voorwaarden. Oude edities,
gewone clubtemplates en andere toernooien krijgen geen nieuwe Plusvoorwaarden.
Een onbekende officiële versie wordt geblokkeerd voor review.

- Bij opslaan en bij beide bestaande publicatieroutes controleert dezelfde service
  de werkelijke fixture, club en spelers. Het door de client aangeleverde
  `fixture_type` bepaalt de voorwaarden niet.
- Concepten mogen onvolledig zijn; geselecteerde spelers moeten wel geldig zijn.
  Publiceren vereist minimaal drie menselijke basisspelers. Een speler telt
  eenmaal; maximaal elf basisspelers; een opgegeven captain is basisspeler.
- Iedere geselecteerde speler, inclusief bank, heeft actief persoonlijk Plus en
  de speelregistratie van deze club nodig. Actieve leningen tellen mee; een
  uitgeleende speler telt bij zijn speelclub. Fouten in abonnementsdatums,
  dubbele actieve leningen of ontbrekende officiële context worden niet genegeerd.
- Selecties kunnen niet via PATCH naar een andere club/wedstrijd worden verplaatst.
  Match-, engine- en legacyfixture-ID's verwijzen naar dezelfde selectie; er
  kan niet voor iedere alias nog een tweede selectie worden gepubliceerd.
- De bestaande thuisclubactie `matchKickoff/kickoff` eist een bevestigde/geplande
  wedstrijd en één gepubliceerde geldige selectie per club. Beide rosters worden
  opnieuw geladen en met dezelfde actuele tijd gecontroleerd.
- Binnen één transactie worden een serverbeheerd `official_match_selection`-record
  in de bestaande generieke entiteitenopslag en de aftrap opgeslagen. Het record
  bevat de selectie en het werkelijke app-aftrapmoment, geen betaalgegevens.
  Herhalen van een begonnen aftrap verandert dit bewijs of de uitslagdeadline niet.
- Na de aftrap kan men de selectie niet wijzigen, opnieuw publiceren of verwijderen.
  Plus dat tijdens het duel verloopt maakt vastgelegde deelname niet ongeldig.
- De uitslag-, bevestigings-, correctie- en geschilflows eisen minimaal drie
  gedeclareerde werkelijke deelnemers uit die vastgelegde selectie; statistieken
  en doelpuntenmakers/assists moeten bij deze deelnemers horen. Bankselectie alleen
  bewijst geen daadwerkelijke deelname. Dit blijft een verklaring binnen STAGE,
  geen automatisch door EA bevestigde aanwezigheid.
- Generieke Match-CRUD kan voor nieuwe edities geen officiële fixtures aanmaken en
  geen aftrap, identiteit of uitslagen veranderen/verwijderen. De bestaande
  beschermde GameDay- en Admin-acties blijven de bedoelde routes.
- Selectiewijzigingen krijgen een transactioneel clubauditrecord. Een Admin die
  als clubbeheerder handelt krijgt ook een Admin-auditrecord en geen sportieve
  Plusvrijstelling. Een Admin-aftrap wordt eveneens geaudit.

## Waar zichtbaar

Club → beheer/Operations → selectie: bestaande spelerskeuze, concept/publiceren,
nu met korte uitleg in Nederlands/Engels. Validatiefouten verschijnen via de
bestaande foutmelding. GameDay → aftrap gebruikt dezelfde selectievoorwaarden;
GameDay → uitslag blijft voor werkelijke deelnemers en bewijs bedoeld.

Er is geen nieuwe publieke entiteitenroute voor kickoffbewijzen en er zijn geen
nieuwe tabellen, kolommen of afhankelijkheden. De bestaande algemene
entiteitencontroller heeft geen CRUD-route voor dit interne recordtype.

## Nog nodig vóór volledige activering

Dit voltooit niet de kalender-/wedstrijddeelnamefase. Gereedmelden vanaf -15
minuten, automatisch vergrendelen op -5 minuten, uitsluitend vooraf opgegeven
reserves vóór echte aftrap wisselen en tegenstander daarvan berichten zijn nog
niet gebouwd. Tot die vervolgstap zijn geldige selectieaanpassingen vóór de
werkelijke app-aftrap mogelijk. Ook ontbreken de verdere storings-/sanctie- en
expliciete uitzonderingsprocedures, echte MySQL/JWT- en browserverificatie.

Het interne aftrapbewijs blijft historische evidence bij reset/archivering en
verleent geen rechten aan nieuw aangemaakte wedstrijd-ID's. Een begonnen officiële
wedstrijd zonder bewijs wordt voor review geblokkeerd; er wordt geen bewijs met
terugwerkende kracht verzonnen. Sluiten/resetten van een editie blokkeert verdere
normale deelname- en uitslagwijzigingen.

## Bestanden en verificatie

Backend: `officialMatchEligibilityService.js`, `clubFixtureLineupModel.js`,
`clubFixtureLineupController.js`, beide Club-/Match-controllers,
`matchResultNegotiationService.js` en de aftrap in `legacyFunctions.js`.
Frontend: `ClubOperations.jsx` en `en/nl.commonPages.json`.

Gerichte service- en lokale Express/HTTP-tests gebruiken gecontroleerde SQL-/auth-
fixtures. Zij vervangen geen echte MySQL/JWT-integratietest. Het volledige
bestaande clubcontrollerbestand heeft daarnaast een reeds bestaande fout:
`preserves captain profile edit access` gebruikt `new-logo.png`, dat de huidige
media-URL-validatie afwijst. Dit is ook met de oorspronkelijke HEAD-controller
gecontroleerd en wordt hier niet als selectie-regressie aangepast.

Lokale verificatie van deze stap: 163 gerichte tests geslaagd (inclusief acht
nieuwe selectie-/HTTP-/auditgevallen); na de laatste compatibiliteitsaanpassing
ook de 30 getroffen wedstrijd-/uitslagtests opnieuw geslaagd. Lint, typecheck,
backend-syntax en productiebuild geslaagd. Build meldt de bestaande verouderde
Browserslist-data en grote chunks. `graphify update .` kon niet draaien omdat de
CLI niet geïnstalleerd is; `graphify-out/` is niet beschikbaar. Geen live-API,
echte database, browser of deployment als gecontroleerd aangemerkt.
