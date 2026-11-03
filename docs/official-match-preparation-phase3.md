# Fase 3 — gereedmelden, tijdvergrendeling en reserves

Lokale vervolgstap van 3 november 2026. Alleen de expliciet gemarkeerde nieuwe
regionale edities en plaatsings-/promotiecycli gebruiken deze voorbereiding.
Bestaande edities behouden hun eerdere voorwaarden. Geen productiehandeling,
publicatie van datums, opening van cups, GOST of D3 is uitgevoerd.

## Deelnemersflow

1. Club → Beheer/Operations → Selectie: basisspelers en bank kiezen en publiceren.
   Dit kan pas zodra de officiële wedstrijd een bruikbare geplande aftrap heeft.
2. Vanaf vijftien minuten vóór die aftrap: de gepubliceerde selectie bekijken en
   gereedmelden. Dit kan bij de club én rechtstreeks in GameDay. De server
   controleert opnieuw persoonlijk Plus, speelregistratie en minimaal drie
   basisspelers. Een oude selectieversie kan niet ongemerkt worden gereedgemeld.
3. Vanaf exact vijf minuten vóór de geplande aftrap: gewoon opslaan, publiceren
   of verwijderen van de selectie is geblokkeerd, ongeacht de gebruikte route
   of fixture-ID-alias. De grens werkt ook zonder achtergrondtimer: iedere
   serveractie vergelijkt met de gezaghebbende wedstrijdtijd.
4. Na deze grens, zolang de daadwerkelijke aftrap nog niet heeft plaatsgevonden:
   uitsluitend een eerder gepubliceerde reserve kan een basisspeler vervangen.
   De vertrekkende speler verlaat de inzetbare selectie; er komt geen gastspeler
   of opnieuw toegevoegde speler in. Een ongebruikte reserve kan worden
   teruggetrokken, bijvoorbeeld bij verlopen Plus. Een vertrekkende captain
   draagt in deze flow de captainpositie aan de inkomende basisspeler over.
5. Een reservewijziging controleert de complete nieuwe selectie opnieuw, wist
   de eigen gereedmelding, schrijft audits en maakt in dezelfde transactie een
   in-appmelding voor de tegenstander. Bij een mislukte melding of audit wordt
   de wijziging teruggedraaid. Herhaling van dezelfde laatste wissel vóór de
   werkelijke aftrap veroorzaakt geen tweede wissel of melding.
6. Beide clubs melden hun huidige selectie gereed. Alleen de bestaande bevoegde
   thuisactie kan de wedstrijd starten, vanaf de geplande aftrap. Beide selecties
   worden nogmaals gecontroleerd en vervolgens definitief vastgelegd. Tijdens
   de wedstrijd verlopen Plus maakt die vastgelegde deelname niet ongeldig.

Na tien minuten wachten verschijnt uitleg om bij afwezigheid contact op te nemen
met Admin. Een klok kent geen forfait of winnaar toe. Deze stap voegt geen nieuwe
harde uiterste aftrapgrens toe als beide clubs alsnog aanwezig zijn.

## Vindplaatsen en toegang

- **Club → Beheer/Operations → Selectie:** oorspronkelijke selectie-editor plus
  voorbereiding, tijdstippen, gereedstatus en gecontroleerde reserveacties.
- **GameDay → geselecteerde clubwedstrijd:** dezelfde voorbereiding en
  gereedmeld-/reserveknoppen. Alleen gebruikers met bestaande selectiebevoegdheid
  krijgen de private voorbereiding; een normale speler krijgt geen foutpaneel
  uitsluitend omdat hij geen selectie mag beheren. De server blijft bevoegdheden
  bij elke aanvraag controleren.
- **Tegenstander → Meldingen:** een duurzame operationele in-appmelding bij
  reservewijziging. Deze stap verstuurt geen externe e-mail of pushbericht.
- **Admin:** bestaande club-/Admin-auditopslag bevat gereedmeldingen en wissels;
  een Admin die als clubbeheerder handelt krijgt geen Plusvrijstelling. Een
  afzonderlijke operationele reviewqueue en afwezigheidsbeslissing volgen later.

Nieuwe labels zijn in Nederlands/Engels toegevoegd. De interface toont tijden
in de lokale browserzone; de server rekent met de gepubliceerde wedstrijdzone.
Gepubliceerde MySQL-wandtijden gebruiken de bestaande centrale tijdzonehelper.

## Opslag en routes

`OfficialMatchPreparationModel` bewaart interne `official_match_preparation`-
records in `league_entities`: wedstrijd, editie, geplande tijd, per club de laatst
gepubliceerde selectie, gereedmelding en reservebewijs. Oude tijdgebonden
voorbereiding blijft bij een opgeslagen nieuwe planning als historie bewaard.
Geen nieuwe tabel, kolom, dependency, algemene entiteitenclient of CRUD-route.

Onder de bestaande, JWT-beveiligde `club-fixture-lineups`-route:

- `GET /preparation/:clubId/:fixtureId`: eigen selectie, actuele tijdsgrenzen en
  geschiktheid, plus gereedstatus van de tegenstander; geen betaalgegevens.
- `POST /preparation/:clubId/:fixtureId`: `ready`, `reserve` of
  `withdraw_reserve`, met de bekeken selectierevisie. Identiteit en bevoegdheid
  komen uit de bestaande geauthenticeerde clubcontrole.

Alle bestaande publicatieroutes en generieke selectie-CRUD blijven centraal
gecontroleerd. De frontend doet niet langer twee publicaties voor één klik.
Generieke Match-PATCH mag een nieuwe officiële wedstrijd niet verplaatsen;
gebruik de beschermde planning-/Admin-flow. Bij een gewijzigde gezaghebbende
wedstrijdtijd gelden eerdere voorbereiding en gereedmeldingen niet voor die
nieuwe tijd: opnieuw publiceren en gereedmelden is nodig.

## Nog niet als voltooid aangemerkt

De volledige kalenderautomatisering, synchronisatie en herstel van alle legacy-
fixture-/Match-planningsroutes vormen een volgende stap. Dit is geen bewijs dat
iedere bestaande Admin-verplaatsingsknop de gekoppelde Match al correct bijwerkt.
Een wedstrijd zonder betrouwbare tijd/zone of zonder vóór de deadline
gepubliceerde voorbereiding wordt geblokkeerd; er wordt niets teruggedateerd.
De volledige regionale voorwaarden blijven nog niet productierijp verklaard.

Ook volgen nog de operationele afwezigheids-/storingsreview, uitzonderingen en
uiteindelijke echte MySQL/JWT- en browserverificatie. De daadwerkelijke deelname
binnen EA is nog steeds een verklaring, geen automatisch gemeten aanwezigheid.

## Verificatie

169 gerichte tests slagen, inclusief lokale Express/HTTP-aanvragen naar beide
nieuwe endpoints en bestaande publicatieroutes. Grensgevallen omvatten -15/-5,
ID-aliases, verlopen Plus, eerder opgegeven reserves, terugtrekking, foutrollback,
herhaalde wissel, gewijzigde planning, verouderde selectierevisie en zomertijd.
Deze tests gebruiken gecontroleerde SQL-/authfixtures, geen echte MySQL of JWT.
Lint, typecheck, backend-syntax en productiebuild zijn geslaagd. Na de laatste
controle op herhaalde reservewissels zijn de 14 voorbereidingstests opnieuw
geslaagd. De build meldt de bestaande grote chunks en verouderde Browserslist-data.
`graphify update .` is geprobeerd; de CLI ontbreekt in deze omgeving.

## Vervolg: gecontroleerde kalenderkoppeling

De nieuwe officiële Admin-planning koppelt nu fixture/engine/Match en trekt
voorbereiding bij verplaatsing transactioneel in. Zie
[de kalenderoverdracht](official-calendar-link-phase3.md). Dit vervangt de eerdere
beperking voor die nieuwe officiële planningsroute; de complete seizoensplanner,
legacy-overgang en operationele review blijven afzonderlijk werk.
