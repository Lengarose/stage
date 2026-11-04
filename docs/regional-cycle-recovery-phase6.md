# Herstel van regionale sportieve cycli — 3 november 2026

Deze lokale stap breidt de [bekerherstelwerking](regional-cup-recovery-phase6.md)
uit naar al opgeslagen regionale plaatsings- en overgangscycli. De nieuwe zichtbare
meldingen zijn Engels.

Latere vervolgstap: [automatische promotiefinales](regional-promotion-auto-final-phase6.md)
publiceren uitsluitend de al goedgekeurde finaletijd na gepubliceerde halve finales.
De grenzen hieronder beschrijven de eerdere cyclusherstelstap.

Vervolg van 4 november: [automatische conceptgroepsindeling](regional-auto-allocation-phase6.md)
gebruikt nu dezelfde herstelworker voor nieuw vastgelegde officiële cycli. Oudere
cycli blijven op de oorspronkelijke handmatige indelingsroute.

## Automatische normale route

Na startup-migraties controleert de server iedere minuut maximaal vijftig
regionale cycli die aan een poging toe zijn. Alleen opgeslagen lopende of
reviewcycli komen in aanmerking. De bestaande `regionalCycleService.progress`
herleest het vastgelegde veld, bronuitslagen, beleidsversies en de opgeslagen loting.
Als geldige definitieve uitslagen nieuwe vervolgduels bepalen, maakt de bestaande
transactionele cyclusactie uitsluitend de ontbrekende fixtures en Matches aan.

Dit herstelt een gemiste resultaatkoppeling of serveronderbreking. Het trekt geen
nieuwe eerste loting en accepteert geen clientgegevens als winnaar of clublijst.
Een gewijzigde bron, onbesliste beslissingsstand of niet-ondersteunde beleidsversie
blijft een blokkade en geeft `review_required` met een technische herhaalpauze.

Een cyclus waarvan de rechten definitief zijn krijgt `ready_for_allocation` als
checkpointstatus. De bestaande groepsindelingsactie moet nog worden gecontroleerd
en toegepast. Nieuwe duels kunnen nog op officiële planning wachten; deze job
publiceert geen aftrappen en verplaatst geen wedstrijden.

## Herstart en gelijktijdigheid

Cup en cyclus gebruiken nu dezelfde interne worker en reserveringsmodelcode.
De bestaande Cup-checkpoint-IDs blijven identiek. Cycluscheckpoints gebruiken
`regional_cycle_progress` met een afzonderlijke stabiele ID per cyclus.
Beide soorten blijven in de bestaande league-entities-store; er zijn geen nieuwe
tabellen, publieke CRUD-routes of clientschrijfrechten toegevoegd.

De eerdere twee minuten durende reservering, unieke pogingcode, hervatting na
verloop, beperkte batch en bescherming tegen oude writes blijven gelden.
Een cyclus die al `ready` of `allocated` is maar nog een verlopen actieve
reservering heeft, mag uitsluitend de onderbroken checkpointverwerking afronden.
De job past geen groepen toe en wijzigt geen reeds toegewezen rechten.

## Vindplaats voor Admin

**Admin → Regional Leagues → Regional action overview** toont:

- **Automatic regional cycle progression requires review** bij een vastgelegde
  herstelblokkade voor een actuele cyclus;
- **Sporting rights are ready** zodra groepsindeling kan worden gecontroleerd,
  ook bij twintig clubs waarvoor geen plaatsingsduels nodig zijn.

De link verwijst naar het bestaande cycluspaneel. De bron-ID helpt de juiste
opgeslagen cyclus te kiezen. Reset-/ongeldig gemaakte bronnen blijven uitgesloten;
private foutdetails en de opgeslagen seed komen niet in dit overzicht.

## Verificatie en grenzen

Veertien gerichte Cup-/cyclushersteltests en 300 geselecteerde regressietests slagen.
De bestaande lokale HTTP-tests controleren de beschermde actieoverzichtroute.
De twee eerder gedocumenteerde functionsController-baselinegevallen blijven buiten
deze selectie. Lint, typecheck, backendsyntax en frontendbuild zijn afzonderlijk
gecontroleerd.

Tests gebruiken gecontroleerde opslag/authenticatie. Echte MySQL-concurrentie,
JWT-authenticatie, browserbediening en Gandi-runtime blijven ongeverifieerd.
Er is niets gepusht, gedeployed of op productie uitgevoerd. Graphify bijwerken
is geprobeerd, maar de CLI ontbreekt.

De volledige seizoensregisseur blijft vervolgwerk: automatisch inschrijfvelden
afhandelen, reserve-/uitzonderingsbeleid, groepsindelingen toepassen en kalenders
publiceren vallen niet binnen deze herstelstap. GOST en D3 blijven afgeschermd.
