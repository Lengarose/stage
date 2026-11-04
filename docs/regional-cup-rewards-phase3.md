# Regional Cup-beloningen — 3 november 2026

Deze stap sluit aan op de [bekerlifecycle](regional-cup-lifecycle-phase3.md).
De gebruiker bevestigde de prijsstandaard expliciet tijdens deze bouwstap:
winnaar 7.000.000 STC, finalist 3.000.000 STC, geen derdeplaatsprijs,
geen extra bekerinschrijfgeld, financiering door STAGE.

## Waar vind je het?

- **Admin → Regional Leagues → Regional Cups → Cup rewards and trophy awards**.
- Hetzelfde controlepaneel staat in **Admin → Rewards**.
- **Regional Leagues → Regional Cups → Cup rewards** toont spelers de vastgelegde
  bedragen, financiering en afzonderlijke betalings-/trofeestatus.
- Verdiende trofeeën gebruiken de bestaande club-/spelerskast en titelregistratie.
  Hun archieflink opent de oorspronkelijke bekereditie.

## Normale werking

Bij voorbereiding van een nieuwe editie bewaart de server de prijsafspraken,
deelnemers en toegewezen catalogustrofee in `cup_reward_snapshot`. De finale
moet definitief zijn en alle gebruikte ronde-uitslagen moeten ongewijzigd zijn.
De canonieke winnaars bepalen de twee ontvangers; invoer vanuit de client kan
geen winnaar, bedrag of ontvanger aanwijzen.

Na normale resultaatverwerking volgt de bestaande transactionele prijsverwerking.
STC gaat naar de twee clubrekeningen, met bestaande ledger- en payoutbewijzen.
De kampioenstrofee en bijbehorende spelersonderscheidingen gebruiken de bestaande
awardflow: die bewaart bij de eerste uitreiking de betrokken spelers en het ontwerp.
Dit introduceert geen nieuwe Cup-specifieke selectie- of erecriteria voor spelers.
Een latere transfer of cataloguswijziging maakt geen tweede gewonnen trofee.

Een retry betaalt uitsluitend bewezen ontbrekende bedragen. De bestaande
minuutjob herstelt ook de onderbreking tussen bekerafronding en het aanmaken van
een settlement. Ontbrekende/tegenstrijdige brongegevens blokkeren verwerking.
Betalingsstatus en trofeestatus blijven afzonderlijk zichtbaar: een geblokkeerde
trofee mag niet als uitgereikt verschijnen omdat het geld al betaald is.

## Bestaande edities en uitzonderingen

Een bestaande editie zonder vastgelegde prijsafspraken krijgt niet automatisch
de nieuwe standaard. Kies de editie, bekijk **Preview reward terms for an existing edition**,
controleer het voorstel en bevestig met reden. Dit is een nieuwe gecontroleerde
belofte, geen bewijs van een historische afspraak. Bestaande betalingsbewijzen
blokkeren vervanging; betaald geld wordt niet automatisch teruggedraaid.

**Review payments and trophy** is alleen-lezen. Een afzonderlijke bevestigde
actie kan daarna bewezen ontbrekende bedragen en de trofee verwerken. De server
controleert de actuele gegevens opnieuw; wijzigingen vereisen zo nodig review.
Adminrechten komen uit de database en mutaties worden geaudit.

Een gecontroleerde regionale history-reset omvat nu ook de geselecteerde
bekeronderscheidingen. Geldgeschiedenis blijft behouden. Ongeldig gemaakte
bekeredities kunnen niet opnieuw uitbetalen of een gewonnen titel herstellen.

## Verificatie en grenzen

277 geselecteerde regressietests slagen. Ze omvatten de tweevoudige verwerking
van een penaltyfinale, precies twee betalingen, rollback bij een fout tussen de
ontvangers, crashherstel zonder settlement, historische adoptie, trofeeontwerp,
kasttitels, reset en beschermde lokale HTTP-routes. Twee eerder gedocumenteerde
functionsController-baselinegevallen blijven buiten deze selectie.

Na de laatste aanscherping slagen ook de 29 gerichte beker-/beloningstests opnieuw.
Lint, typecheck, backendsyntax en frontendbuild zijn geslaagd.

De HTTP-tests gebruiken gecontroleerde opslag en authenticatie, geen echte MySQL
of JWT. Productieconcurrentie, browserbediening en Gandi-deployment zijn niet
geverifieerd. Er zijn geen productiebetalingen, resets, pushes of deploys uitgevoerd.
Graphify bijwerken is geprobeerd; de CLI ontbreekt.
