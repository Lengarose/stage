# Regional action overview — eerste stap van fase 6

Lokaal gebouwd op 3 november 2026. Dit is het operationele overzicht van bestaande
gegevens, niet de volledige automatische seizoensregisseur.

## Vindplaats en bediening

**Admin → Regional Leagues → Regional action overview** staat boven de regionale
beheerpanelen. **Refresh overview** haalt een nieuwe momentopname op en toont
de controletijd. Iedere regel verwijst naar het relevante paneel op dezelfde
pagina of naar **Admin → Rewards**. De bron-ID helpt de juiste opgeslagen editie
of cyclus in het bestaande paneel te selecteren; een link voert geen actie uit.

Het overzicht onderscheidt:

- lopende bevestigingsweek en een gesloten veld dat nog cycluscontrole nodig heeft;
- opgeslagen groepsindelingen waarvoor nog geen volledige leaguekalender bestaat;
- plaatsings-/promotieduels zonder officiële Match of planning en cycli waarvan
  de opgeslagen duels allemaal definitief zijn;
- bekerontwerpen die nog moeten worden geactiveerd, ontbrekende Match-koppelingen,
  gewijzigde reeds verwerkte uitslagen, ontbrekende rondevensters en uitblijvende
  definitieve resultaten na een rondevenster;
- afgeronde bekers met onvolledige betaling of trofee-uitreiking en opgeslagen
  mislukte/geblokkeerde/gedeeltelijke regionale settlements;
- onleesbare opgeslagen gegevens, die expliciet review vragen.

Oude resetreeksen en ongeldig gemaakte edities leveren geen nieuwe inschrijf-,
wedstrijd- of betalingsacties op. Een inschrijfperiode met een al vastgelegde
deelnamecyclus blijft niet onterecht vragen om een nieuwe cyclus.

## Grenzen van de momentopname

Alleen Admin/Superadmin krijgt toegang; de rol komt uit de database. De nieuwe
`GET /api/stage/regional-leagues/operations` retourneert beperkte meldingen en
tellingen, zonder volledige snapshots, spelerslijsten, eigenaarse-mails of seeds.
De modelqueries zijn uitsluitend SELECTs. De service verandert geen deadlines,
rechten, scores, planning, prijsafspraken of rekeningen en kent geen forfait toe.

De bestaande uitvoerende acties blijven hun eigen verse integriteitscontrole,
autorisatie en audit uitvoeren. Geen meldingen in dit overzicht is geen bewijs
dat alle wedstrijdregels, jobs of competitiegegevens volledig gecontroleerd zijn.
Een opslagfout geeft een foutmelding met vernieuwmogelijkheid, geen lege succeslijst.

De volledige duurzame orchestratie, automatische inschrijf-/reserveafhandeling,
herinneringen en beoordeling van nog open uitzonderingsbeleid volgen afzonderlijk.
Dit overzicht publiceert of activeert niets zonder de bestaande bevestigingsactie.

## Verificatie

Acht gerichte tests controleren deadlinegrenzen, gekoppelde cycli, kalenders,
bekeruitslagwijzigingen, resetreeksen, onleesbare gegevens, SELECT-only queries,
rechten en de echte lokale Express-route met gecontroleerde opslag/authenticatie.
285 geselecteerde regressietests slagen; de twee eerder gedocumenteerde
functionsController-baselinegevallen blijven buiten de selectie. Lint, typecheck,
backendsyntax en frontendbuild zijn geslaagd.

Echte MySQL/JWT, browserbediening en productie zijn niet getest in deze stap.
Er is niets gepusht, gedeployed, gestart, gereset of uitbetaald op productie.
Graphify bijwerken is geprobeerd; de CLI ontbreekt.
