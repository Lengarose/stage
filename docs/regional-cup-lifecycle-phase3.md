# Regional Cup-wedstrijden en voortgang — 3 november 2026

Deze lokale bouwstap vervolgt de [beker­voorbereiding](regional-cup-decision-calendar-phase3.md).
Er is niets gedeployed, gepusht of op productie geactiveerd.

De latere [beloningsstap](regional-cup-rewards-phase3.md) sluit STC en de bestaande
awardflow aan. De onderstaande beloningsbeperkingen beschrijven de eerdere
lifecycle-overdracht en zijn daardoor gedeeltelijk opgevolgd.

## Waar staat het?

- **Admin → Regional Leagues → Regional Cups**: vaste beker en catalogustrofee
  voorbereiden, editie voorbereiden en vervolgens bij **Cup activation and official
  progress** de activering controleren. Publiceren vereist een actuele preview,
  reden en expliciete bevestiging. Hetzelfde onderdeel toont voortgangsblokkades.
- **Regional Leagues → Regional Cups** (`/regional-cups`): ingelogde gebruikers
  zien geactiveerde en voltooide edities, trofee, regels, rondevensters, opgeslagen
  byes, echte wedstrijden, bevestigde scores en kampioen. Ontwerpen blijven verborgen.
- Wedstrijdlinks openen **GameDay**. De regionale kalender toont deze wedstrijden
  eveneens, met dezelfde canonieke Match als bron.

## Wat gebeurt automatisch?

Activering maakt uitsluitend echte duels aan. Byes maken geen wedstrijd aan.
Na alle definitieve uitslagen van een ronde wordt een nieuwe open loting opgeslagen
en worden de echte duels van de volgende ronde op het vastgelegde venster gepland.
Een herhaalde verwerking hergebruikt de bestaande ronde en maakt geen tweede loting.
Na de finale worden kampioen en voltooiing vastgelegd.

Gelijke scores vereisen een bevestigde penaltywinnaar. Betwiste, ontbrekende of
uitsluitend door verlopen bevestigingstijd verkregen resultaten laten de beker
niet automatisch doorgaan. Wijzigingen aan reeds gebruikte sportieve uitslagen,
ongeldige bronedities, kalenderconflicten of verstreken rondevensters blokkeren
verwerking. Het systeem kiest daarbij geen vervangende datum of winnaar.

De bestaande selectiecontrole geldt ook voor Cups: minimaal drie speelgerechtigde
menselijke spelers, persoonlijk actief Plus, gereedmelden en een vastgelegde selectie
bij de aftrap. Keeper blijft optioneel en ANY toegestaan. Schemawijzigingen volgen
de bestaande voorbereiding-, audit- en meldingsregels.

## Gegevens en herstel

Cup-edities blijven interne league-entities; wedstrijden gebruiken de bestaande
competition-engine en canonieke Matches. De permanente beker en trofee blijven
bij seizoenwissels bestaan. Een gecontroleerde regionale reset invalideert ook
afhankelijke speelbare Cup-edities, enginefixtures en Matches. Bij meerdere
brondivisies moeten alle betrokken divisies in de reset zitten.

Voor Cup-voorbereiding en activering bestaat nu een aparte leescontrole van
vastgelegde deelnamebevestigingen. Die kan bevestigingen van gestarte leagues lezen,
zonder inschrijving of deelnamebevestiging opnieuw open te stellen. Dit herstelt
een integratieblokkade in de eerdere voorbereiding.

## Nog niet aangesloten

- STC-uitbetaling en daadwerkelijke trofee-uitreiking; de kampioen krijgt voorlopig
  `honours_state: pending_review`. Dit is geen volledige beloningsreviewflow.
- Noord-Amerikaanse speeluren, aanvullende terugtrekkings-/vervangingsregels,
  automatische afhandeling van kalenderuitzonderingen en GOST-toegang.
- Een productieplanner, echte MySQL-concurrentiecontrole of browserverificatie.

## Controlebewijs

270 geselecteerde tests slagen, inclusief een volledige beker met twintig clubs:
vijf rondes, negentien echte wedstrijden, één kampioen. Daarnaast worden byes,
penalty's, onveranderlijke verwerkte uitslagen, herhaalde acties, kalenderconflicten,
Plus/selectie, rollback, privacy en resetafhankelijkheden gecontroleerd.

Lokale HTTP-tests raken echte Express-routes met gecontroleerde opslag en authenticatie.
Ze bewijzen geen werking tegen echte MySQL of echte JWT-authenticatie. De twee eerder
gedocumenteerde functionsController-baselinefouten zijn buiten deze selectie gehouden.
Lint, typecheck, backendsyntax en frontendbuild zijn geslaagd.
Graphify bijwerken is geprobeerd; de CLI ontbreekt (`command not found: graphify`).
