# Fase 3 — regionale inschrijving en bevestiging

Lokale bouwstap van 2 november 2026. Dit is de registratie-/bevestigingsbasis,
niet de volledige afronding van fase 3, wedstrijdgerechtigdheid of productie.
Er is geen echte inschrijfdatum gepubliceerd en er is niets gedeployed.

## Wat werkt in deze lokale stap

- Admin publiceert vooraf één onveranderlijke periode per regio, platform,
  resetreeks en doelseizoen, met editievoorwaarden en een gecontroleerde preview.
  De gekozen opening wordt in UTC opgeslagen; sluiting volgt 28 dagen later en
  de gezamenlijke bevestigingsdeadline nog 7 dagen later. Dit zijn verstreken
  UTC-intervallen; de lokale weergave kan bij een zomertijdwissel een uur verschuiven.
  De concrete datums zijn vóór publicatie zichtbaar. Er wordt geen lanceringsdatum
  geraden en hiermee wordt geen twaalfwekenwedstrijdkalender gepubliceerd.
- Clubs schrijven voor een regio in, zonder gegarandeerde divisie of groep.
  De server leest club, huidige voorzitter/eigenaar, platform en persoonlijk Plus.
  Clientvelden voor eigenaar, goedkeuring of divisietoewijzing gelden niet als bewijs.
- Registreren mag tot de gedeelde sluiting, ook op de laatste dag. Bevestigen kan
  alleen in de gezamenlijke week; laat aanmelden levert geen individuele extra week.
- Bevestiging vereist minimaal drie verschillende geselecteerde spelers met
  persoonlijk actief Plus en de juiste speelregistratie. Actieve huurregistraties
  tellen voor de spelende club; uitgeleende spelers tellen niet voor de moederclub.
  Tegenstrijdige huurregistraties of leesfouten worden niet stil geaccepteerd.
- Niet-deelnemende leden hoeven geen Plus. ANY is toegestaan; een keeper is niet
  verplicht. Een onleesbare abonnementsvervaldatum geeft bij dit nieuwe beleid
  review; de oude globale abonnementshelper en oude editievoorwaarden veranderen niet.
- De voorzitter ziet spelersnamen en geschiktheidsstatus, zonder Stripegegevens,
  bedragen of abonnementsvervaldatums van teamgenoten. Admin kan dezelfde status
  alleen-lezen bekijken; dat geeft geen algemene sportieve Plus-vrijstelling.
- Gelijktijdige verzoeken/retries leveren één inschrijving en bevestiging op.
  Een late herhaling van een geslaagde bevestiging verandert niets. De deadline
  wordt na het laden van het roster opnieuw gecontroleerd vóór opslaan.
- Bestaande, begonnen en reeds ingedeelde edities krijgen geen nieuwe voorwaarden
  achteraf. Gepubliceerde periodes kunnen niet via dit formulier worden gewijzigd.
  Gepubliceerde registraties kunnen niet met generieke CRUD worden goedgekeurd,
  herschreven of verwijderd, of via de oude handmatige league-toewijzing omgezet.

## Waar Admin en gebruikers dit vinden

| Wie | Plaats | Gedrag |
| --- | --- | --- |
| Admin | Admin → Regional Leagues → Regional registration periods | Kies permanente D1-identiteit van het systeem, doelseizoen/resetreeks, lokale openingsdatum en editievoorwaarden. Preview toont alle drie datums; bevestiging publiceert met reden en audit. |
| Voorzitter | Regional Leagues → Your club’s participation | Kies de regio, lees gepubliceerde voorwaarden, registreer en bevestig tijdens de gezamenlijke week. |
| Voorzitter | Leaguepagina → Your club’s participation | Dezelfde flow, gefilterd op die regio. |
| Voorzitter | Club → Fixtures → Your club’s regional participation | Dezelfde flow voor de betreffende club. |
| Admin | Registration Applications → All → Review eligibility | Alleen-lezen controle van Plus-/speelregistratiestatus. Nieuwe inschrijvingen worden niet met oude Approve/Waitlist-knoppen toegewezen. |
| Bestaande link | `/register-league` | Blijft bruikbaar als compacte deelnamepagina; optioneel `?region=…` of `?club=…`. |

De losse Registratie-link verdwijnt uit de navigatiemenu’s. De korte bestaande
registratierondleiding is aangepast aan de regio-/bevestigingsflow. Andere
tutorials zijn hiermee niet als volledig vernieuwd afgetekend. Gewone leden kunnen
de gepubliceerde voorwaarden blijven lezen; de voorzitter voert deelnameacties uit.

## Koppeling met de sportieve cyclus

Als voor het doel een periode is gepubliceerd, wacht de cyclus tot de gezamenlijke
bevestigingsdeadline. Iedere opgenomen club moet exact één geldige bevestiging
hebben. Bevestigde clubs mogen niet stil worden weggelaten om bijvoorbeeld dertig
clubs in een twintigclubsgroep te persen: daarvoor blijft beleidsreview nodig.
De bevestigingen en publicatie zijn onderdeel van het bronbewijs van de cyclus.

Na de sportieve indeling krijgen zowel nieuwkomers als bevestigde terugkerende
bronclubs hun juiste editie/groep toegewezen. Nieuwe conceptgroepen bewaren
`regional_registration_window_id` en
`regional_participation_policy_version: regional_registration_v1`.
Zij gebruiken de gepubliceerde regeltekst, zonder een oud reglementbestand als
stilzwijgend nieuwe versie mee te geven. Historische bestanden blijven behouden.
De deelnamepagina toont daarna de toegewezen groep en een link.

Geen publicatie voor een bestaande editie betekent behoud van haar bestaande
voorwaarden. De cyclusactie betaalt niets uit, koopt geen abonnement en kent geen
trofee toe. GOST en D3 blijven gesloten.

## API, opslag en deploymentbestanden

Alle acties onder `/api/stage/regional-leagues` blijven achter `verifyToken`:

| Route | Toegang |
| --- | --- |
| `GET /registration-windows` | Ingelogde gebruiker; gepubliceerde voorwaarden/datums. |
| `POST /registration-windows` | Admin, preview en bevestigde publicatie met revisie/reden. |
| `GET /registration-readiness/:clubId` | Huidige voorzitter/eigenaar, of Admin alleen-lezen. |
| `POST /registration-windows/:id/apply` | Huidige voorzitter/eigenaar met persoonlijk Plus. |
| `POST /registrations/:id/confirm` | Huidige voorzitter/eigenaar met Plus en minimaal drie geldige geselecteerde spelers. |

Nieuwe businessmodule: `lib/regionalRegistrationPolicy.js`,
`models/regionalRegistrationModel.js`, `services/regionalRegistrationService.js`.
De bestaande flexibele store bewaart periodes als `regional_registration_window`
en aanvragen als `season_registration`. Geen nieuwe tabel, migratie of generieke
frontendentiteit. ID’s zijn stabiel en schrijfacties gebruiken de bestaande
transactionele regionale mutex. Adminmutaties krijgen een auditrij.

Verder gewijzigd: regionale controller, cyclus-, editie-, management- en publieke
services en de herstelde `functions/legacyFunctions.js` voor bescherming tegen
oude handmatige toewijzing. Frontend: nieuwe Admin-/deelnamepanelen, compacte
`SeasonRegistrations`-pagina, regionale hub/detail, clubdetail, LeaguesTab en Layout.
Deploy deze samen met de eerdere fasen en herstart na backendupload de Gandi-app.
Er is niets geüpload, herstart of in productie uitgevoerd.

## Verificatie en open werk

**118 gerichte tests slagen**, inclusief de vijf nieuwe acties via echte lokale
HTTP-verzoeken met geïsoleerde model/databasefixtures en geïnjecteerde identiteit.
Getest: deadlinegrenzen, laatste-dag-aanmelding, minimum drie, verlopen/misvormde
Plus, vreemde club, huurregistratie, Admin-leesrechten, retries, rollback,
onveranderlijke voorwaarden, complete bevestigde velden en uiteindelijke toewijzing.
Ook bestaande Plus-, cyclus-, uitslag-, prijs- en presentatiecontroles zijn meegenomen.
Lint, typecheck, backend-syntax en frontendbuild slagen. De build houdt de bestaande
waarschuwingen over browserdata en chunkgrootte. Graphify is niet geïnstalleerd.

Nog niet geverifieerd: echte MySQL/JWT, SQL-locking tegen MySQL, desktop/mobiel/
toetsenbord in de browser. Eerder geweigerde lokale browsertoegang is niet omzeild.

Nog niet gebouwd of vastgesteld in deze stap:

- Plus-/minimumcontrole bij daadwerkelijke wedstrijdselectie, vergrendeling en
  reservewissel; geldigheid bewaren wanneer Plus tijdens een begonnen duel afloopt.
- Reserves/wachtlijst, herinneringen en duurzame automatische afhandeling na een
  gemiste bevestiging. De bewaarde 48-uursdetails en terugkerende week-10/11-planning
  blijven N-beleid; zij zijn niet stilzwijgend als goedgekeurd geïmplementeerd.
- Automatische regio-overstap, reserveprioriteiten, krimp en niet-ondersteunde aantallen.
  Geen bestaand sportief recht is door deze stap verwijderd.
- Exacte Plus-grens voor uitgebreide statistieken, betaalproviderstoringen en
  expliciete uitzonderingen. Er is geen nieuwe statistiekpaywall of betaalprijs.
- Absolute openings-/speeldatums en de volledige kalender. Een Admin-publicatie
  is een bewuste latere actie, geen datum die nu is gekozen.

Activeer de volledige nieuwe competitievoorwaarden niet in productie voordat ook
de ontbrekende wedstrijddaghandhaving en operationele verificatie gereed zijn.

## Vervolg: wedstrijdselecties en aftrap, 2 november 2026

De centrale Plus-/speelregistratiecontrole voor selecties, beide publicatieroutes,
nieuwe officiële aftrappen en uitslagdeelnemers is nu lokaal toegevoegd. De
vijfminutenvergrendeling, gereedmeldvensters en reservewisselprocedure blijven
open. Zie [de selectiestap](official-match-selection-phase3.md) voor precieze
reikwijdte, vindplaatsen en beperkingen. De eerdere waarschuwing tegen volledige
productieactivering blijft gelden.
