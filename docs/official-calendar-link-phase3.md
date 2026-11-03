# Fase 3 — koppeling officiële regionale kalender

Lokale bouwstap, 3 november 2026. Er is niets gedeployd, geen kalenderdatum
gepubliceerd en geen productiegegeven gewijzigd. Deze stap geldt voor nieuwe
regionale edities met `regional_registration_v1` en cycli met die vastgelegde
participatieversie. GOST en D3 blijven gesloten; regionale cups worden niet
hiermee aangemaakt. Oude regionale/GOST-/toernooiedities behouden hun eigen flow.

## Probleem en resultaat

De bestaande Admin-force-schedule wijzigde de fixture, terwijl GameDay een
ander tijdstip kon behouden. De oude fixture→Match-conversie schreef bij openen
opnieuw een datum naar de Match en gaf soms de oude rij terug.

Voor nieuwe officiële regionale wedstrijden schrijft nu één beschermde
transactie de planning naar:

- de gewone regionale fixture, indien aanwezig;
- de gekoppelde enginefixture, indien aanwezig;
- de canonieke GameDay-Match, inclusief bevestigingsdatum en tijdzone;
- de interne wedstrijdvoorbereiding, indien het werkelijke aftrapmoment wijzigt;
- de fixtureaudit en duurzame in-appmeldingen voor beide clubcontacten.

Een gewone nieuwe regionale fixture krijgt zo bij de eerste planning één
gekoppelde Match. Native plaatsings-/promotiewedstrijden gebruiken hun bestaande
enginefixture en Match. De actie maakt geen tweede league, seizoen of nieuwe
sportieve plaats. Ontbrekende/tegenstrijdige bestaande Match-links of andere
tegenstanders worden voor review geblokkeerd.

Een gewijzigd tijdstip wist de gepubliceerde voorbereiding en gereedmeldingen.
De oude voorbereiding blijft in de historie van het interne voorbereidingsrecord.
Ook verplaatsen van A naar B en later terug naar A herstelt geen oude
gereedmelding. De clubs moeten opnieuw publiceren en gereedmelden.
Herhalen van hetzelfde werkelijke tijdstip bewaart hun nieuwe voorbereiding en
veroorzaakt geen tweede planningsmelding; herstel van ontbrekende kopieën kan
wel opnieuw als Admin-handeling worden geaudit.

## Bediening

**Admin → Regional Leagues → Officiële regionale kalender**

1. Vul de fixture-ID of de GameDay-wedstrijd-ID in. Bij een opgeslagen cyclus
   staat de GameDay-link in het bestaande overzicht van de gepubliceerde draw;
   het wedstrijd-ID staat achter `match=` in die link.
2. Kies datum/tijd in de expliciet ingevulde IANA-tijdzone, bijvoorbeeld
   `Europe/Brussels`. Dit is de zone waarin de invoer wordt gelezen, onafhankelijk
   van de eigen browserzone. Een absoluut ISO-tijdstip van een bestaande
   API-client behoudt zijn werkelijke moment bij omzetting naar de gekozen zone.
3. Vul de reden in en bevestig de getoonde consequentie voor gereedmeldingen.
4. Publiceer en open de teruggegeven GameDay-link.

De UI-actie gebruikt de bestaande JWT-beveiligde
`POST /fixture-admin-actions/force-schedule`-route. `official_only` voorkomt dat
het nieuwe blok ongemerkt een oude editie via een legacyflow wijzigt. De
bestaande force-schedule-bediening kiest voor nieuwe officiële edities dezelfde
serveractie en schrijft daarna niet nogmaals via de frontend of legacyconversie.

Een Admin-ID uit de body wordt niet vertrouwd: de databasegebruiker wordt op
basis van de authenticatie opnieuw gecontroleerd. Beide bestaande Adminrollen
worden behouden. Het eigenlijke fixturetype wordt uit de opgeslagen relaties
bepaald; `regional_pathway` is nu ook ondersteund door de bestaande actie.

## Controles

- Geldige kalenderdatum, IANA-zone en toekomstig aftrapmoment; niet-bestaande
  lokale uren rond zomertijd en onrepresentabele offsets worden geweigerd.
- Bij een gewijzigd tijdstip meer dan vijf minuten voorbereidingstijd, zodat de
  clubs hun selectie vóór de bestaande vergrendeling kunnen publiceren.
- Geen verplaatsing na aftrap, uitslagmelding, verwerkt resultaat of bestaand
  definitief aftrapbewijs. Gesloten edities/cycli blokkeren via de bestaande
  contextcontrole.
- Geen andere actieve clubwedstrijd met exact hetzelfde aftrapmoment.
- Geen genegeerde database-/audit-/meldingsfout: de gehele nieuwe actie wordt
  teruggedraaid wanneer een onderdeel mislukt.
- Generieke fixture-PATCH, directe Match-wijzigingen en oude inboxuitnodigingen
  kunnen de nieuwe officiële kalender niet omzeilen. Er is hier nog geen nieuwe
  deelnemersprocedure voor verplaatsingsaanvragen of afboeking gebouwd.
- Fixture→GameDay openen is voor deze edities een leesactie. De bestaande
  deelnemercontrole wordt vóór teruggave van de Match toegepast.

## Reikwijdte en resterend werk

Dit is een betrouwbare koppeling van één gecontroleerde planning, geen volledige
twaalfwekenplanner. Exact gelijktijdige wedstrijden worden geweigerd; alle
veertig-/zestigminuten-overlapblokken, maximale avonden, weekbelasting, gelijktijdige
laatste rondes en gezamenlijke cup-/leaguekalenders zijn nog geen complete
planningssolver. Start geen echte editie op basis van alleen deze controles.

Automatisch vullen van de seizoenskalender, preview/activering van een volledige
kalender, spelervensters per regio, quotum-/deadlinebeleid voor verplaatsingen en
operationele afwezigheids-/storingsreview volgen als afzonderlijke stappen.
Oude GOST-/toernooiplanning is niet stilzwijgend naar de nieuwe voorwaarden
omgezet. Er is geen nieuwe editie geopend en geen wedstrijd gesimuleerd.

De interne voorbereiding en de bestaande tabellen worden hergebruikt. Er zijn
geen nieuwe tabellen, kolommen of externe dependencies. `Match.create` kan nu de
transactieverbinding gebruiken; de overige standaardaanroepen blijven werken.

## Verificatie en deployoverdracht

158 gerichte tests geslaagd. Daaronder lokale Express/HTTP-aanvragen naar de
bestaande force-schedule-route, eerste Match-aanmaak, native pathways,
A→B→A-verplaatsing, herhaling, tijdzones, ongeldige datums, toegangscontrole,
rollback, kickoffbewijs en spelersselecties. Lint, typecheck, backend-syntax en
productiebuild geslaagd. Build meldt de bestaande grote chunks en verouderde
Browserslist-data. `graphify update .` is geprobeerd; de CLI ontbreekt.

De HTTP-tests injecteren gecontroleerde authenticatie-/SQLfixtures; er is nog
geen echte MySQL/JWT- of browserverificatie. Er is niets gedeployd.

Twee bestaande tests zijn afzonderlijk ook met de oorspronkelijke HEAD-versie
van `legacyFunctions.js` gecontroleerd en falen daar eveneens. Ze zijn niet
opgenomen in het geslaagde gerichte pakket:

- `createMatchFromLeagueFixture creates match snapshots and links fixture server-side`:
  de testfixture bevat geen bevestigde schedulingstatus, terwijl de bestaande
  conversie die vereist.
- `tournamentRegistration registers player tournaments without an Ultimate Team proof photo`:
  de verwachting `ultimate_team` wijkt af van de bestaande `registration_upload`.

Backendbestanden voor latere gezamenlijke deployment: `officialScheduleService`,
`officialScheduleModel`, `officialMatchEligibilityService`, `matchModel`,
`fixtureAdminActionController`, `leagueEntityController` en `legacyFunctions`.
Frontend: `OfficialSchedulePanel`, `LeaguesTab`, `scheduleEngine` en de
Nederlands-/Engelstalige commonPages-packs. Neem ook de eerdere niet-gedeployde
fase-3-bestanden uit hun overdrachten mee. Geen dependency-installatie nodig.
