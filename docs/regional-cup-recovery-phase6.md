# Bekerprogressie herstellen en Engelse appteksten

Lokale bouwstap van 3 november 2026. Nieuwe standaardteksten in de app en
zichtbare servermeldingen zijn Engels, zoals de gebruiker expliciet heeft gevraagd.
De bestaande ondersteuning voor vertalingen blijft beschikbaar.

## Wat is omgezet?

De toegevoegde teksten in Regional Cups, Cup activation and official progress,
Cup rewards and trophy awards, Additional sporting decision calendar en Regional
action overview zijn Engels. Ook de servermeldingen van het actieoverzicht zijn
vertaald. AGENTS.md bewaart Engels als vereiste voor volgende standaardteksten.
Dit verandert geen namen van competities, opgeslagen uitslagen, aangenomen
deelnamevoorwaarden of reeds vastgelegde prijsafspraken.

## Automatisch herstel

Na de bestaande startup-migraties start de server een controle per minuut.
Deze selecteert maximaal vijftig geactiveerde lopende bekeredities die aan een
nieuwe poging toe zijn. De normale bekerlifecycle bepaalt of alle uitslagen van
de huidige ronde definitief zijn en een volgende ronde kan worden aangemaakt.
De hersteljob kiest zelf geen tegenstanders, datum, winnaar, uitslag of beloning.

Een checkpoint `regional_cup_progress` staat in de bestaande league-entities-store,
één stabiele identiteit per bekereditie. Een transactie reserveert de poging twee
minuten. Andere serverprocessen nemen die taak niet tegelijk over. Een verlopen
reservering kan na een herstart opnieuw worden opgepakt. Een poging met een oude
reserveringscode kan het checkpoint van een nieuwere poging niet overschrijven.

Ook een crash nadat de bekerfinale verwerkt is, maar voordat het checkpoint is
opgeslagen, kan worden afgerond: een voltooide beker met zo'n verlopen actieve
reservering mag uitsluitend zijn bestaande voortgang herlezen. De bestaande
settlement-job blijft verantwoordelijk voor gemiste STC-/trofeeverwerking.

Bij wachten op uitslagen volgt normaal na één minuut een nieuwe controle. Een
sportief/kalenderprobleem bewaart `review_required` met vijftien minuten technische
herhaalpauze. Dat verlengt geen sportieve deadline. Onbekende technische fouten
krijgen een generieke melding, zonder SQL- of verbindingsdetails naar het overzicht.
Een mislukte opslag bij één beker houdt de overige geselecteerde bekers niet tegen.

## Waar zien jullie dit?

**Admin → Regional Leagues → Regional action overview** toont een melding wanneer
de automatische bekerprogressie controle vereist. De link verwijst naar Regional
Cups. De bestaande preview-/herstelacties controleren de actuele bron opnieuw.
Ongeldig gemaakte of geresette bronedities leveren geen nieuwe herstelactie op.
De normale hersteljob vereist geen open browser.

Dit activeert geen bekerontwerpen, maakt geen nieuwe seizoenen of inschrijvingen,
en is nog niet de volledige regionale seizoensregisseur. GOST, D3, reservebeleid,
nieuwe uitslagdeadlines en automatische kalenderuitzonderingen blijven buiten scope.

## Controlebewijs

293 geselecteerde regressietests slagen, inclusief de bestaande lokale HTTP-tests.
Na de laatste aanscherping slagen alle acht gerichte hersteltests opnieuw, inclusief
het checkpoint na een al verwerkte finale. De tests controleren gelijktijdige workers,
herstart, oude reserveringen, backoff, opslagfouten en beperkte taakselectie.
De Engelse operationele meldingen zijn ook via de bestaande HTTP-route geraakt.

Lint, typecheck, backendsyntax en frontendbuild zijn gecontroleerd. De twee eerder
gedocumenteerde functionsController-baselinegevallen blijven buiten de regressieselectie.
Opslag/authenticatie zijn gecontroleerde testfixtures; echte MySQL-locks, JWT,
browserbediening en Gandi-runtime zijn niet geverifieerd. Er is niets gepusht of
gedeployed en geen productieactie uitgevoerd. Graphify CLI ontbreekt.
