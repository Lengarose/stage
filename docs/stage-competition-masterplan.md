# STAGE — Masterdocument competities, toegang en begeleiding

Versie 1 — 2 november 2026. Taal: Nederlands.

Actuele bouwstatus en resterende acceptatiecriteria:
[Competition delivery status](competition-delivery-status.md). Lees die checklist
naast de beleidsstatus hieronder; latere bevestigingen en bouwstappen vervangen
oudere beschrijvingen van wat nog niet gebouwd of bevestigd was.

## 1. Doel en gebruik

Dit document bundelt het afgesproken doel voor Regional Leagues, Regional Cups,
GOST, toernooipagina’s, STAGE Plus, Admin, regels en tutorials. Het vormt de
inhoudelijke basis voor acht afzonderlijke bouwfases. Het document zelf voert
geen wijziging aan competities, accounts, abonnementen of productiegegevens uit.

Lees vóór een bouwfase de relevante onderdelen hier, de fasevoorwaarden in §24
en de bijbehorende bestaande implementatiedocumentatie in §22. Controleer daarna
de actuele code. Hergebruik wat aantoonbaar werkt. Een oudere implementatie is
geen reden om een later goedgekeurde beleidswijziging te negeren.

### Beslisstatus

| Code | Betekenis | Gebruik in een bouwprompt |
| --- | --- | --- |
| B | Expliciete afspraak herkenbaar in het beschikbare gesprek | Als eis opnemen. |
| N | Detail bewaard in overgedragen gespreksnotities; oorspronkelijke vraag/goedkeuring niet volledig beschikbaar | Behouden, maar bron terugvinden of gericht laten bevestigen vóór dit detail uitvoerbaar beleid wordt. |
| O | Open beslissing, tegenstrijdigheid of technische verificatie | Niet stilzwijgend invullen; alleen het betrokken onderdeel blokkeren. |
| L | Bestaande lokale implementatie beschreven in repositorydocumentatie | Actuele code en tests controleren; dit bewijst geen deployment of live werking. |

Losse antwoorden zoals ‘A’, ‘B’, ‘C’ en ‘Akkoord’ hebben alleen betekenis met hun
bijbehorende vraag. Dit document geeft zulke antwoorden geen verzonnen betekenis.
N-regels zijn geen nieuwe voorstellen en ook geen bewezen goedkeuringen: ze
bewaren eerder besproken details zonder de onzekerheid te verbergen.

Prioriteit: latere expliciete gebruikersbeslissing, daarna eerdere expliciete
beslissing, daarna gecontroleerde gespreksnotitie. Bestaande code beschrijft de
huidige toestand; die beslist niet zelfstandig over toekomstig beleid.

## 2. Kern van het systeem

- **B:** Een regio is een competitiesysteem. Daaronder bestaan divisies,
  parallelle groepen en opeenvolgende seizoensedities.
- **B:** Een nieuwe editie wordt geen extra zelfstandige league in de openbare
  lijst of in Admin Rewards. De oorspronkelijke league-identiteit blijft bestaan.
- **B:** Groepen bestaan uit twintig clubs. Groei moet zowel parallelle groepen
  als latere divisies ondersteunen; geen eindeloze verplichte klim vanaf D10.
- **B:** Start met D1 en D2. GOST opent pas als voldoende deelname en de precieze
  toegang zijn vastgesteld. D3 blijft afgeschermd tot zijn regels gereed zijn.
- **B:** Geen verplichte rusteditie voor succesvolle D1-clubs. Sportieve rechten,
  promotie en degradatie bepalen hun niveau; geen kunstmatige beurtrol.
- **B:** Het sportieve niveau volgt de club wanneer zij van regio verandert.
- **B:** Normale processen moeten zoveel mogelijk automatisch verlopen, met
  inzichtelijke status en uitzonderingen voor Admin.

De eerdere gedachte ‘eerste inschrijvers vullen D1, daarna D2’ mag niet tegelijk
met een sportieve eerste plaatsing actief blijven. De gekozen plaatsingsroute
bepaalt bij de lancering wie D1 en D2 krijgt.

## 3. Kalender, lancering en bevestiging — punten 1–3

### Expliciete basis

- **B:** Twaalf weken als gekozen seizoensduur.
- **B:** Vier weken inschrijving en daarna één gemeenschappelijke week
  deelnamebevestiging. Ook een inschrijving op de laatste inschrijfdag valt onder
  diezelfde bevestigingsweek; geen individuele extra week.
- **B:** Wacht niet verplicht op 120 clubs per regio. Alleen ondersteunde,
  volledig gevulde structuren openen. Nieuwe clubs voegen zich niet halverwege
  bij een al begonnen leaguegroep.
- **B:** Bij veertig clubs wordt één D1 en één D2 gebruikt, met sportieve plaatsing.
- **B:** Wachtende clubs moeten hun status en vervolgstap kunnen zien.

### Kalenderpakket bevestigd op 6 november 2026 [B]

De gebruiker bevestigde expliciet: maximaal 48 uur reserve-aanvulling na de
bevestigingsweek; daarna twee weken voor de eerste plaatsing; twaalf
competitieweken plus één overgangsweek; definitieve kalender minimaal 48 uur
vóór de eerste aftrap. Concrete datums worden vooraf door Admin ingesteld.
Dit promoveert deze onderdelen van de onderstaande bewaarde uitwerking naar B.
Het beslist niet de reservevolgorde, behandeling van niet-ondersteunde aantallen,
Noord-Amerikaanse uren of de precieze volgende inschrijfperiode binnen die cyclus.

### Bewaarde uitwerking [N]

- Na de bevestigingsweek maximaal 48 uur om vrijgekomen plaatsen via reserves
  te vullen. Daarna twee weken voor de eerste plaatsing.
- Kalender minimaal 48 uur vóór de eerste wedstrijd publiceren.
- Twaalf competitieweken plus één overgangsweek: startcadans van dertien weken
  voor volgende normale edities. Plaatsing bij de lancering is een apart blok.
- Nieuwe inschrijvers na sluiting: wachtlijst voor de volgende editie, met
  afzonderlijke tussentijdse evenementen als aanbod; geen automatische promotie
  omdat een nieuwe groep ontstaat.
- Bij minder dan twintig bevestigde clubs geen officiële twintigclubsgroep.
  Eventueel een apart, duidelijk benoemd introductietoernooi.

**O:** Absolute openingsdatum, sluitingsdatum, plaatsingsdata en eerste aftrap
zijn nog niet vastgelegd. De verhouding tussen ‘twaalf weken’ en de volledige
lanceringskalender moet vóór publicatie zichtbaar worden uitgetekend.

## 4. Groepsverdeling en eerste plaatsing — punten 4–5

**B — opnieuw bevestigd op 2 november 2026:** de gebruiker bevestigde de tabellen
uit §4–5 als uitgangspunt voor fase 2, inclusief 20/40/60/80/100/120/180/240 clubs,
de normale promotieplay-offs en de aparte uitbreidingsroutes. De onderstaande
verdelingen zijn daarmee geen onbevestigde gespreksnotities meer. Kalender-
haalbaarheid blijft een controle vóór activering; absolute start- en groeidata
worden hiermee niet ingevuld.

| Bevestigde clubs in één regio | D1-groepen | D2-groepen | Eerste plaatsing |
| --- | --- | --- | --- |
| 20 | 1 | 0 | Eén gevulde groep; geen niet-bestaande D2 suggereren. |
| 40 | 1 | 1 | Acht groepen van vijf, vier wedstrijden per club. Top twee per groep levert zestien D1-clubs. Acht nummers drie spelen vier beslissingswedstrijden voor de laatste vier D1-plaatsen. Overige twintig naar D2. |
| 60 | 1 | 2 | Tien groepen van zes; top twee naar D1. |
| 80 | 2 | 2 | Zestien groepen van vijf; top twee levert 32 D1-clubs. Zestien nummers drie spelen acht beslissingswedstrijden voor acht extra D1-plaatsen. |
| 100 | 2 | 3 | Twintig groepen van vijf; top twee naar D1. |
| 120 | 2 | 4 | Twintig groepen van zes; top twee naar D1. |
| 180 | 3 | 6 | Groei na een eerdere editie, volgens de uitbreidingsroute in §5. |
| 240 | 4 | 8 | Groei na een eerdere editie, volgens de uitbreidingsroute in §5. |

Plaatsing geldt voor de eerste verdeling. Bestaande clubs verliezen hun verdiende
recht niet door elk seizoen alle clubs opnieuw in een plaatsingstoernooi te zetten.
Clubs kiezen bij inschrijving de regio, niet zelf een gegarandeerde D1-plaats.

**B — bevestigd op 2 november 2026:** De nummers drie die na de eerste
plaatsingsgroepen een extra beslissingsduel spelen, worden door een vastgelegde
willekeurige loting gekoppeld. De eerst getrokken club speelt thuis. Koppels en
thuisverdeling zijn vóór de duels zichtbaar; opnieuw laden mag niet opnieuw loten.
Deze loting vervangt geen sportieve beslissing bij een beslissende gelijke stand.

**O:** Exacte startbeslisregel bij bijvoorbeeld 13, 30, 50 of 130 bevestigingen,
rangorde van gelijkwaardige nieuwe inschrijvers en financiering van eventuele
plaatsingsprijzen. Maak geen extra officiële halve groep en verzin geen prijs.

## 5. Promotie, degradatie en uitbreiding — punt 6

### Basis [B]

Promotieplay-offs blijven onderdeel van het systeem. Degradatie kan niet leiden
naar een divisie die niet bestaat. Een nieuwe D1-groep moet sportief gevuld worden;
nieuwe inschrijvers krijgen die plaatsen niet automatisch. Regels worden vooraf
gepubliceerd en niet achteraf aangepast om een gewenst resultaat te krijgen.

### Normale beweging [B — bevestigd op 2 november 2026]

Per D2-groep gaan twee clubs omhoog: de kampioen en de winnaar van de play-offs.
Nummer 2 tegen 5 en nummer 3 tegen 4, daarna de finale. Enkelvoudige wedstrijden;
de hoger geëindigde club speelt thuis. Geen aparte kampioenstrofee voor promotie.

| Structuur | Naar D1 | Uit D1 naar D2 | Onderste niveau |
| --- | --- | --- | --- |
| 40: 1 D1 / 1 D2 | 2 | Onderste 2 van D1 | Geen D2-degradatie zonder D3. |
| 60: 1 D1 / 2 D2 | 4 | Onderste 4 van D1 | Idem. |
| 80: 2 D1 / 2 D2 | 4 | Onderste 2 per D1-groep | Idem. |
| 100: 2 D1 / 3 D2 | 6 | Onderste 3 per D1-groep | Idem. |
| 120: 2 D1 / 4 D2 | 8 | Onderste 4 per D1-groep | Idem. |
| 180: 3 D1 / 6 D2 | 12 | Onderste 4 per D1-groep | Idem. |
| 240: 4 D1 / 8 D2 | 16 | Onderste 4 per D1-groep | Idem. |

### Eenmalige uitbreidingsbeweging [B — bevestigd op 2 november 2026]

| Overgang | Verdeling vóór de nieuwe editie |
| --- | --- |
| 20 → 40 | Bestaande twintig blijven D1; twintig nieuwe clubs vullen D2. |
| 40 → 60 | Normale uitwisseling van twee clubs; twintig nieuwe clubs naar D2. |
| 60 → 80 | D1 behoudt top zestien. Per bestaande D2-groep promoveren top tien plus winnaars van 11–14 en 12–13: twaalf per groep. Samen veertig D1-clubs. Twintig nieuwe clubs vullen D2 aan. |
| 80 → 100 | Normale uitwisseling van vier clubs; twintig nieuwe clubs naar D2. |
| 100 → 120 | Normale uitwisseling van zes clubs; twintig nieuwe clubs naar D2. |
| 120 → 180 | D1 behoudt 32 clubs. Per vier D2-groepen top vijf plus winnaars van 6–9 en 7–8: zeven per groep, 28 totaal. Samen zestig D1-clubs. Zestig nieuwe clubs vullen D2 aan. |
| 180 → 240 | D1 behoudt 48 clubs. Twaalf normale promovendi plus twintig extra. Dertig kandidaten — volgende vijf per bestaande D2-groep — spelen vijf groepen van zes met één club per brongroep; top vier promoveert. Samen tachtig D1-clubs. Zestig nieuwe clubs vullen D2 aan. |

De extra twintig promovendi bij 180 → 240 komen boven op de twaalf normale
promovendi; tel dezelfde club nooit tweemaal. Die route bevat vijf extra
wedstrijden per kandidaat en is nog geen bewezen haalbare kalender.

Groepen worden binnen het verdiende niveau evenwichtig verdeeld. Geen aparte
groep met uitsluitend alle nieuwe clubs wanneer dat structureel oneerlijk uitpakt.
Krimp mag niet door onvoorziene extra degradatie worden afgedwongen.

**O:** Controleer plaatsingsvolgorde, unieke kandidaten en kalenderbelasting.
Ondersteun geen tussenstap of groei boven 240 zonder vastgelegde regels. Leg de
latere D3-structuur en gekoppelde degradatie vast vóór D3 wordt ingeschakeld.

### Terugkerende inschrijving bevestigd op 6 november 2026 [B]

Voor volgende normale edities: vier weken inschrijving in speelweken 5–8,
één bevestigingsweek in week 9 en uiterlijk 48 uur reserve-aanvulling aan het
begin van week 10. Promotieplay-offs blijven in week 11. Na twaalf speelweken
en één overgangsweek begint de volgende league. Dit vervangt de oudere
N-beschrijving van bevestiging in weken 10–11 in §15. Het creëert geen vrijstelling
voor ontbrekende rechten, onbesliste wedstrijden of een onhaalbare kalender.

## 6. Regiokeuze, overstappen en pauzeren — punt 7

- **B:** Het niveau volgt de club bij een regio-overstap; degraderen kan niet
  worden omzeild door ergens anders opnieuw D1 te kiezen.
- **N:** Clubland en competitie-aansluiting zijn verschillende gegevens. Deelname
  staat open voor andere clublanden als de club de gepubliceerde speeluren en
  overige voorwaarden accepteert. Eén actieve regionale aansluiting per club.
- **N:** Wisselen alleen tussen edities en vóór de bevestigingsdeadline, bij
  passende beschikbare plaatsen. Overdracht atomair: oude plaats pas opgeven als
  nieuwe aansluiting geldig is.
- **N:** Lokale sportieve rechten en reserves gaan vóór inkomende clubs met een
  recht op hetzelfde niveau; daarna pas nieuwe instroom op het laagste niveau.
  Gelijkwaardige instroom eventueel via transparante loting, niet ruwe punten
  uit onvergelijkbare groepen.
- **N:** Eén vrijwillige pauze behoudt één cyclus het niveau als toelatingsrecht,
  maar reserveert geen concrete plek. Daarna gewone herinstroom.

**O:** Geografische toelating en pauzeregel broncontroleren. Buitenlandse
aansluiting verandert de speeltijd van een competitie niet voor één club.

## 7. Wedstrijdkalender en verplaatsingen — punten 8–10

### Bevestigd Europees kalenderpakket [B] — 3 november 2026

- Europese leagueavonden: dinsdag en donderdag, 20.00 en 20.40 uur,
  tijdzone `Europe/Brussels`. Toon tijden ook in de lokale tijdzone van de gebruiker.
- Weken 1–9: vier leaguewedstrijden per club per week, samen 36.
- Week 10 dinsdag: wedstrijden 37 en 38; donderdag voor toegestane uitzonderingen.
- Laatste speelronde tegelijk binnen dezelfde groep. De automatische leagueplanner
  publiceert alle rondes van een groep telkens op hetzelfde tijdstip.
- Over alle officiële competities samen maximaal twee wedstrijden per avond,
  zeven per week en vier speelavonden. Ook inhaal- en plaatsingswedstrijden tellen.
- Leagueblok veertig minuten, knock-outblok zestig minuten.

De gebruiker bevestigde dit volledige kalenderpakket expliciet op 3 november 2026.
Dit bevestigt geen startdatum, Noord-Amerikaans profiel of aanvullend verplaatsingsbeleid.

### Promotiekalender [B — bevestigd 3 november 2026]

- Week 11 dinsdag: promotiehalve finales; donderdag: promotiefinales, telkens
  20.00 uur in `Europe/Brussels`, met blokken van zestig minuten.
- Een onbesliste league-eindstand of een kalenderconflict blokkeert de planning.
  Geen automatische winnaar, nieuwe datum of geforceerde publicatie.

### Aanvullende bewaarde planning [N]

- Week 12: bekerfinale en noodzakelijke beslissingen. De leagueplanner reserveert
  deze weken zonder deze nog niet getekende wedstrijden te publiceren.
- Normale verplaatsingen van rondes 37/38 niet toestaan: aparte handhaving nog uitwerken.
- Zes minuten per helft als gekozen uitgangspunt; werkelijke EA FC-instelbaarheid
  nog verifiëren.

### Verplaatsingen [B — bevestigd 6 november 2026]

De gebruiker bevestigde het onderstaande Europese pakket expliciet. Het geldt
niet automatisch voor Noord-Amerika of de nog open uitzonderingen voor rondes
37–38. Deze bevestiging promoveert alleen de hieronder genoemde termijnen,
quota, afboeking en speelvensters van N naar B.

- Twee goedgekeurde aanvragen per club per editie; elke wedstrijd afzonderlijk.
  Alleen bij de aanvrager afboeken wanneer de aanvraag is goedgekeurd.
- Aanvragen minimaal 48 uur vóór de oorspronkelijke aftrap. Tegenstander heeft
  24 uur om te reageren. Akkoord minimaal 24 uur vóór de nieuwe aftrap.
- Binnen dezelfde maandag–zondagweek en beschikbare vensters: maandag–vrijdag
  20.00/20.40; zaterdag 18.00–21.00.
- Stilte geeft geen akkoord. Zonder geldig akkoord blijft de oorspronkelijke
  aftrap gelden. Algemene platformstoringen vallen onder de uitzonderingsprocedure.

**O:** Noord-Amerikaanse dagen, uren en IANA-tijdzone; precieze conflictbuffers;
club versus speler met meerdere evenementen; haalbaarheid van zestigminutenblokken
ten opzichte van ‘maximaal twee per avond’; zomertijd; deadlines bij overlappende
aanvragen. Voor toekomstige wereldwijde GOST: vooraf bekende weekendvensters,
lokale tijdweergave en een procedure als geen overlap bestaat.

## 8. Spelers, selectie en wedstrijddeelname — punt 11

- **B:** Minimaal drie menselijke spelers per club bij deelname. Keeper optioneel.
  ANY/‘Elk’ toegestaan; dezelfde mens telt daardoor niet als meerdere spelers.
- **N:** Niet verplicht met hetzelfde aantal mensen als de tegenstander spelen.
- **N:** Gereedmelden vanaf vijftien minuten vóór de wedstrijd. Voorzitter of
  captain meldt de geldige selectie. Tien minuten wachttijd; geen automatische
  forfait op basis van alleen een klok.
- **N:** Selectie vijf minuten vóór de geplande aftrap vergrendelen. Alleen reeds
  opgegeven speelgerechtigde reserves mogen vóór de echte aftrap vervangen;
  wijziging loggen en tegenstander informeren. Geen gastspelers.
- **N:** Eén officiële club per speler. Deelname/statistieken baseren op werkelijke
  verschijning, niet alleen op een naam op de bank.
- **N:** Transfers tussen seizoenen en in week 6, maandag 00.00–zondag 23.59
  `Europe/Brussels`. Vrije spelers buiten het venster alleen wanneer zij die
  cyclus niet voor een andere officiële club speelden. Cup-tied na daadwerkelijke
  bekerdeelname. Bestaande sancties volgen de speler.

**B — spelerspakket bevestigd 6 november 2026:** één officiële club per speler;
transfers tussen seizoenen en in week 6 van maandag 00.00 tot zondag 23.59
Europe/Brussels. Vrije spelers buiten dat venster alleen als zij die cyclus niet
voor een andere officiële club speelden. Cup-tied na daadwerkelijke bekerdeelname;
sancties volgen de speler. Deze onderdelen van bovenstaande N-notities zijn
hiermee bevestigd; daadwerkelijke aanwezigheid niet als EA-gevalideerd presenteren.

**O:** Oorspronkelijke selectie-, transfer- en tijdregels terugvinden. Controleer
welke deelnamegegevens echt beschikbaar zijn; presenteer handmatige verklaringen
niet als automatisch door EA bevestigde aanwezigheid.

## 9. Uitslagen, bewijs en rangschikking — punt 12

### Indiening [B]

- Thuisclub is standaardverantwoordelijke; uitclub mag direct na afloop indienen
  als er nog geen voorstel bestaat.
- Eén actueel voorstel. Het eerste geldige voorstel opent de bevestiging voor
  de tegenstander. Een andere score wordt wijziging of betwisting.
- Indiener levert verplicht bewijs. Tegenstander krijgt 24 uur om te reageren.
- De genoemde indieningstermijn van twee uur hoort bij het afgesproken voorstel.

### Verwerking [N]

- **B — bevestigd 3 november 2026:** Geen reactie binnen 24 uur geeft bij nieuwe
  officiële regionale competities Admin-review, geen automatische bevestiging of
  verzonnen uitslag. Zie [lokale uitvoering](regional-result-review-phase6.md).
- **N:** Twee uur indieningstermijn rekenen vanaf het werkelijke einde.
- Scorewijziging maakt eerdere bevestiging ongeldig en opent opnieuw 24 uur.
  Alleen bewijs toevoegen verandert niet de score-identiteit of bevestigingstermijn.
- Geschil en correctie na definitieve uitslag via bevoegde Admin, met reden en audit.
- Uitslag, ranglijst, spelersstatistieken en vervolgronde één keer verwerken;
  retries of twee gelijktijdige verzoeken mogen niets dubbel boeken.

### Ongewijzigde 2–2 ten onrechte afgewezen [B/L]

Het gemelde conflict moet aantoonbaar weg zijn zonder echte wijzigingen te
accepteren. De lokale oplossing staat in `result-confirmation-semantic-fix.md`.
Behoud semantische voorstelvergelijking, transactie en idempotentie. Tijdstempel,
JSON-sleutelvolgorde of alleen bewijs mogen geen fictieve scorewijziging worden.
Een werkelijk gewijzigde score eerst opnieuw laten bekijken en nooit stil
automatisch accepteren. Live oplossing voor het oorspronkelijke duel is onbewezen.

### Gelijke stand [B]

1. Punten.
2. Totaal doelsaldo.
3. Totaal gescoorde doelpunten.
4. Onderling resultaat; bij meerdere clubs een onderling klassement.
5. Nog gelijk voor titel, divisieplaats, promotie of kwalificatie: een
   beslissingswedstrijd of minitoernooi.

### Onderling klassement — uitwerking [N]

Onderling klassement: punten, doelsaldo, gescoorde goals; geen uitdoelpuntenregel.

### Aanvullende beslissing [B — bevestigd 2 november 2026]

Twee clubs: één beslissingswedstrijd, met verlenging/strafschoppen bij gelijkspel.
Drie/vier clubs: iedere club speelt eenmaal tegen iedere andere club.
De thuisverdeling gebeurt via een opgeslagen loting. Meer dan vier gelijke clubs
of opnieuw een beslissende gelijkheid na de minicompetitie: Admin-review,
zonder automatische winnaar of automatische nieuwe reeks. Loting bepaalt geen
sportieve winnaar. Kalender moet de aanvullende duels kunnen dragen.

Lokaal aangesloten voor nieuwe plaatsings-/uitbreidingscycli met expliciete
`regional_sporting_decisions_v1`-snapshot. Oudere opgeslagen cycli krijgen dit
format niet stilzwijgend. Gewone league-eindstanden zijn lokaal aangesloten via
nieuwe overgangscycli met `regional_source_decisions_v1`: eerst alle 380
bevestigde officiële leaguewedstrijden per brongroep, dan zo nodig extra duels,
dan promotieplay-offs en de definitieve indeling. Een league die wegens gelijkheid
nog `in_progress` is mag deze beslissingsfase bereiken. Oorspronkelijke
leaguepunten blijven intact. Oude cyclus-snapshots krijgen geen nieuw format.

**O:** Techniek voor werkelijke eindtijd, deadlines bij gewijzigde aftrap en
lopende geschillen, onbesliste niet-beslissende posities en volledige minitoernooien.
Nieuwe gepubliceerde regionale deelnamevoorwaarden leggen de 24-uursreviewregel
vast. Oudere edities zonder deze vastgelegde beleidsversie behouden hun eerdere
voorwaarden; de legacy-timeoutcode blijft daarvoor bestaan.

## 10. Afwezigheid, storingen en terugtrekking — punt 13

**B — bevestigd op 6 november 2026:** forfait 3–0 pas na bewijs en beslissing,
geen fictieve individuele goals; beide afwezig of drie no-shows naar Admin.
Terugtrekking vóór negentien definitieve heenwedstrijden: alle leaguewedstrijden
van de club uitsluiten uit stand en stats. Daarna heenronde behouden en alle
returns administratief 3–0 voor tegenstanders, zonder individuele goals. Iedere
definitieve ingreep vereist een expliciete Adminbeslissing en behoud van bewijs
en betaalhistorie. De overige details over onderbreking/hervatting hieronder
blijven N/O waar niet expliciet bevestigd.

- Forfait 3–0 pas na vaststelling en bewijs, zonder verzonnen spelersgoals/assists.
  Beide afwezig: Admin beslist. Drie no-shows: review, geen blinde uitsluiting.
- Algemene storing onderscheiden van clubafwezigheid. Selectie moet bij de
  aftrap aan minimum voldoen; onbedoeld daarna onder drie komen is niet meteen
  een automatische forfait.
- Als de game kan doorgaan: procedure volgen. Bij afgebroken wedstrijd resterende
  tijd en bestaande score bewaren wanneer beide partijen dat eens zijn; anders
  Admin-review. Geen automatische claim dat EA dit technisch exact ondersteunt.
- Terugtrekking vóór start: reserveprocedure.
- Terugtrekking voordat alle negentien heenwedstrijden van die club definitief
  zijn: alle betreffende leaguewedstrijden uitsluiten uit stand en afgeleide stats.
- Daarna: heenronde behouden; alle terugwedstrijden 3–0 voor tegenstanders,
  inclusief al gespeelde returns. Oorspronkelijke returnstats uitsluiten; geen
  fictieve individuele goals. De definitieve ingreep vereist Admin-bevestiging.
- Bewijs en oorspronkelijke gebeurtenissen behouden voor audit. Afgeleide
  carrièretotalen corrigeren zonder betaalde financiële geschiedenis te wissen.
  Noodzakelijke financiële correctie via afzonderlijke compensatieboeking.

**O:** Herneming, extra tijd, strafschoppen, verbindingsbewijs, disciplinaire
gevolgen en vrijgekomen promotieplaatsen volledig uitschrijven en technisch toetsen.

## 11. Regional Cups — punt 14

### Goedgekeurde basis [B]

Regional Cups moeten worden gebouwd. Namen per regio vastleggen. Trofeeën koppelen
via dezelfde bestaande Trophies-catalogus en toewijzingsflow als leagues en GOST.
Geen nieuw uploadmechanisme voor dezelfde trofeeën.

### Namen en format [B — bevestigd 3 november 2026]

| Regio | Bekernaam |
| --- | --- |
| UK & Ireland | STAGE UK & Ireland Cup |
| France | STAGE Coupe de France |
| Germany | STAGE Deutschland-Pokal |
| Benelux | STAGE Benelux Cup |
| Spain | STAGE Copa de España |
| North America | STAGE North American Cup |

De huidige zes regio-slugs zijn zichtbaar in `src/lib/qualificationConfig.js`;
De gebruiker bevestigde bovenstaande zes bekernamen expliciet op 3 november 2026.

- Eén beker per regionaal competitiesysteem, over alle actieve divisies/groepen.
- Alle bevestigde clubs automatisch opnemen; deelname vooraf bij inschrijving
  bekendmaken. Afzonderlijke bekereditie per cyclus en koppeling aan broneditie.
- Enkelvoudige knock-out; open loting per ronde pas nadat de hele vorige ronde
  definitief is. Transparante byes bij niet-machten van twee.
- Europees: zondag 20.00 in Europe/Brussels, blokken van zestig minuten.
  Geen automatische GOST-plaats.
- 20 clubs: speelweken 4, 6, 8, 10, 12.
- 40–60 clubs: 2, 4, 6, 8, 10, 12.
- 80–120 clubs: 1, 2, 4, 6, 8, 10, 12.
- 180–240 clubs: week 3 toevoegen voor acht rondes.

**O:** Noord-Amerikaanse bekeruren, afmeldingen,
vervangers, bekerrechten bij regio-overstap en conflict met andere beslissingsduels.

## 12. GOST en internationale planning — punten 15–16

- **B:** Supreme, Elite en Challenger blijven de drie GOST-competities.
- **B:** De wereldwijde eindtoernooien behouden 36 deelnemers per competitie.
- **B:** GOST blijft gesloten zolang onvoldoende clubs en definitieve
  kwalificatievoorwaarden bestaan. Eerst Regionals en Cups degelijk laten werken.
- **B:** Geen huidige kwalificatie starten, plaatsen opsparen of retroactieve
  tickets beloven zolang GOST gesloten is. D1 winnen blijft een eigen prestatie.
- **B:** Pagina mag de toekomstige route uitleggen en duidelijk ‘Nog niet geopend’
  tonen. Geen inschrijfknop die deelname suggereert.
- **N:** Latere genoemde route: D1 posities 1–4 Supreme-kwalificatie, 5–8 Elite,
  9–12 Challenger. Dit zijn geen gegarandeerde eindtoernooitickets.
- **O:** Definitieve kwalificatieplaatsen per regio/groep, toegangstoernooien,
  opencriteria, minimaal aantal actieve regio’s, internationale vensters en
  regels bij ontbrekende overlap zijn niet uitvoerbaar vastgesteld.

De vroegere 1–6 / 7–12 / 13–18-verdeling op screenshots en in bestaande code is
geen geldige actuele belofte zolang GOST gesloten is. Ook de N-route mag niet
zonder besluit live kwalificaties genereren. Nieuwe continentale GOST-varianten
zijn geen onderdeel van de huidige goedgekeurde bouwscope.

## 13. STC, prijzen en trofeeën — punt 17

### Toewijzing en historie [B]

- Trofeeontwerp aan de permanente competitie koppelen via bestaande Trophies.
  Nieuwe seizoenen hergebruiken standaard die toewijzing.
- Iedere editie en toegekende prijs bewaart zijn eigen historische gegevens.
  Een later aangepast ontwerp verandert eerder verdiende trofeeën niet.
- Ontwerp selecteren geeft nog geen gewonnen trofee. Toekenning is een apart,
  definitief en eenmalig proces.
- Rewards toont echte deelnamevergoeding en winnaar/finalist-bonus, niet alleen
  het trofeeënarchief. Configuratie en werkelijk betaalde status onderscheiden.

### Bewaarde bedragen [N]

| Competitie | Prijzen | Totaal |
| --- | --- | --- |
| D1 per groep van 20 | Eerste 54.000.000 STC; elke volgende plaats 1.700.000 minder; twintigste 21.700.000 | 757.000.000 STC |
| D2 per groep van 20 | Eerste 33.000.000 STC; elke volgende plaats 1.700.000 minder; twintigste 700.000 | 337.000.000 STC |
| Regional Cup | Winnaar 7.000.000; finalist 3.000.000; geen derdeplaatsprijs | 10.000.000 STC |

**B — Regional Cup, expliciet bevestigd 3 november 2026:** bovenstaande Cup-prijzen,
financiering door STAGE en geen extra bekerinschrijfgeld zijn definitief bevestigd
voor nieuwe edities. Dit bevestigt niet automatisch de overige financiële open punten.

Deze leaguebedragen staan ook beschreven in bestaande lokale documentatie;
financiering en toepasbaarheid op het uitgebreide systeem moeten alsnog kloppen.
Bewaard uitgangspunt: STAGE financiert; bestaande deelnamekosten apart behouden;
geen extra bekerinschrijfgeld. Geen nieuwe prijs voor plaatsing of promotie verzinnen.

Per groep een kampioenstrofee met regio, divisie, groep en editie. Uitbetaling en
toekenning pas wanneer vereiste uitslagen/geschillen definitief zijn; één keer,
ook na crash of retry. Eventuele plaatsing in de persoonlijke/clubkast volgt de
bestaande kastflow en mag geen tweede award maken.

**O:** Begroting bij groepsgroei; bestaande deelnamekosten, financieringszekerheid,
Plus-prijs, restitutiebeleid en overgang van bestaande financiële verplichtingen.
Geen bedragen als definitief betaald presenteren op basis van alleen ‘afgelopen’.

## 14. STAGE Plus — expliciet goedgekeurd aanvullend pakket [B]

### Wie heeft Plus nodig?

| Situatie | Toegang |
| --- | --- |
| Voorzitter/bevoegde inschrijver schrijft officiële club in | Eigen actief Plus vereist. |
| Speler op een inzetbare officiële wedstrijdselectie, inclusief reserve | Eigen actief Plus vereist. |
| Voorzitter speelt zelf | Hetzelfde persoonlijke abonnement volstaat; geen tweede clubabonnement. |
| Clublid neemt niet deel | Mag clublid blijven zonder Plus. |
| Bezoeker volgt competitie | Competitie, clubs, tabellen, wedstrijden, uitslagen, regels, prijzen en kampioenen zichtbaar zonder Plus. |
| Uitgebreide statistieken en analyses | Plus. Exacte grens per bestaande statistiekfunctie bij implementatie zichtbaar vastleggen. |

Dit geldt voor Regional Leagues, Regional Cups, plaatsing, promotieplay-offs en
later GOST. Voor andere toernooien de eigen gepubliceerde voorwaarden hanteren;
geen ongemerkte uitbreiding naar alle activiteiten van de app.

### Handhaving

- Bij deelnamebevestiging minimaal drie speelgerechtigde Plus-spelers.
- Op wedstrijddag opnieuw minimaal drie inzetbare Plus-spelers.
- Servercontrole bij selectie, selectievergrendeling en reservewijziging vóór
  aftrap. Autorisatie mag niet alleen door verborgen knoppen worden bepaald.
- Status per speler: speelgerechtigd, Plus nodig, Plus verlopen; meld vooraf
  bijna verlopen toegang. Geen betaalgegevens van teamgenoten tonen.
- Speler zonder Plus kan niet officieel worden ingezet; club kan een geldige
  reserve nemen. Niet de hele club blokkeren vanwege een niet-deelnemend lid.
- Geldige deelname aan een begonnen wedstrijd blijft geldig als het abonnement
  tijdens die wedstrijd afloopt. Oude resultaten, stats en trofeeën blijven staan.
- De app kan deelname binnen EA FC niet fysiek blokkeren. Gebruik selectie,
  bewijs en protestprocedure; geef geen valse garantie over EA-integratie.
- Admin krijgt inzicht in deelnameproblemen en gelogde uitzonderingen.

### Invoering

Vanaf de eerstvolgende nieuwe competitie-editie. Lopende edities behouden de
bestaande deelnamevoorwaarden. Voorwaarden vóór deelnamebevestiging tonen; tijdens
de bevestigingsweek controleren. Onvoldoende geldige spelers bij sluiting:
afgesproken reserveprocedure, geen stilzwijgende definitieve plaats.

**O:** Maak een exacte ingangsmarkering per editie; bepaal abonnementsfouten,
respijt bij betaalproviderstoring, terugboekingen en beheerder die zelf meespeelt.
Leid uit een administratieve bypass voor inschrijven geen algemene sportieve
vrijstelling voor adminspelers af. Gratis zichtbaar betekent hier zonder Plus;
het wijzigt niet automatisch de bestaande loginvereiste voor de app/API.

**L — lokale registratiestap, 2 november 2026:** Nieuwe vooraf gepubliceerde
inschrijfperiodes gebruiken `regional_registration_v1`. De cyclus bewaart die
voorwaarden en toegewezen nieuwe groepen krijgen een expliciete periode-/beleid-
verwijzing. Bij bevestiging worden persoonlijk Plus en minimaal drie gekozen
Plus-spelers server-side gecontroleerd. Lopende/reeds ingedeelde edities blijven
behouden. Dit sluit niet de open betaal-/statistiekdetails of wedstrijddaghandhaving.
Zie [fase-3-overdracht](regional-registration-phase3.md).

## 15. Volgende seizoenen, vacatures en reset — punt 18

### Basis [B]

Nieuwe editie onder dezelfde league; standaard dezelfde trofee. Automatisering
behoudt historie. Nieuwe groepen zijn echte nieuwe groepen, nieuwe seizoenen zijn
dat niet. Een leeg afgelopen seizoen mag geen gespeelde prestaties fabriceren.

### Bewaarde procedure [N]

**B — reservevolgorde, bevestigd 6 november 2026:** eerst verliezende
D2-promotiefinalisten, daarna de hoogst geëindigde nog niet gepromoveerde clubs.
Gelijkwaardige kandidaten uit verschillende groepen via opgeslagen loting, niet
via ruwe punten/doelsaldo. Bestaande sportieve rechten blijven behouden;
onbevestigde krimp blijft Admin-review. De bevestigde maximale reserveperiode
staat in §3. Overige hieronder bewaarde details blijven N waar niet bevestigd.

- Volgende deelnamebevestiging vanaf week 10 tot eind week 11.
- Week 12 en overgangsweek: vrijgekomen plaatsen afhandelen. Reserve-uitnodiging
  48 uur geldig; definitieve kalender minimaal 48 uur vóór eerste aftrap.
- Voorrang voor verliezende D2-promotiefinalisten, vervolgens hoogste nog niet
  gepromoveerde posities; gelijkwaardige kandidaten uit verschillende groepen
  transparant loten in plaats van ruwe punten/GD vergelijken.
- Onbesliste rechten zichtbaar als in behandeling; niet voortijdig toewijzen.
  Geen stil verschuiven van de gepubliceerde startdatum.
- Geautomatiseerde overgang controleert alle sportieve en financiële afsluitingen.
  Een mislukte taak kan veilig opnieuw lopen zonder dubbel seizoen of dubbele award.

### Reset [B/L]

De gemelde fout luidde: ‘Reset would collapse distinct editions into the same
Season 1’. Herstellen door identiteit en resetseries correct te behandelen,
niet door alle historische edities het label Season 1 te geven. De bestaande
lokale lifecycle-oplossing eerst controleren (§22).

Reset is een uitzonderlijke Admin-actie met concrete scope, preview, reden,
bevestiging en audit. Permanente league-instellingen en trofeeontwerpen behouden;
financiële historie niet blind verwijderen of opnieuw uitbetalen. Geen productie-
reset uitvoeren door alleen deze masterplan- of bouwprompt te lezen.

## 16. De twee genoemde dubbele league-identiteiten [B/L/O]

De gebruiker wees deze extra zelfstandige vermeldingen aan als te verwijderen:

| Extra ID | Gebruikersomschrijving | Te behouden oorspronkelijke ID volgens lokale lifecycle-documentatie |
| --- | --- | --- |
| `46dbb09f-8319-4607-ab97-ec941745bfd8` | STAGE Premier Division, D1, Season 2, uk-ireland, cross-platform, draft | `c2d6e60f-89e0-4813-81a1-967551d8d69f` |
| `e582c55b-1e72-45f5-ab63-137c3420404a` | North American League, D1, Season 1, north-america, Cross-Platform, registration | `e91c6c27-4fd2-45d9-b6ed-6a3591d7b210` |

Gebruikersverklaring: NA Season 1 gespeeld, beëindigd, volgende editie gemaakt;
oude reset liet de extra root staan en hernummerde Season 2 terug naar Season 1.
Premier Season 1 werd beëindigd zonder wedstrijden omdat de fixtureactie ontbrak.
Dit is de verklaarde ontstaansgeschiedenis, geen in deze sessie getraceerde DB-audit.

Doel: oorspronkelijke leagues behouden; extra vermeldingen als zelfstandige
league weg uit Admin, Rewards en gebruikerslijsten. Geen duplicaten alleen op
naam verbergen en geen canonieke ID kiezen op lijstpositie.

De lokale lifecycle-documentatie beschrijft een oplossing waarbij een geldige
Premier Season 2 als kindeditie behouden blijft, terwijl de extra zelfstandige
identiteit verdwijnt. Een bewezen ongebruikte NA-resetroot kan als vervallen
kind worden gemarkeerd. Dat bereikt het lijstdoel zonder legitieme referenties
te vernietigen. Het is niet hetzelfde als onvoorwaardelijk beide DB-rijen wissen.

**O:** Controleer de exacte vier IDs en alle gekoppelde inschrijvingen, fixtures,
uitslagen, statistieken, toewijzingen, snapshots, betalingen, awards en audit.
Productiereparatie vereist een concrete preview; verschillen of historie niet
stil weggooien. Gebruiker vroeg eerder uitdrukkelijk planning zonder uitvoering.
Deze sessie voert geen diagnostiek tegen productie en geen verwijdering uit.

## 17. Wat gaat automatisch, wat blijft bij Admin? — punt 19

**B:** Automatisering is het doel. De precieze triggers hieronder zijn
implementatievoorwaarden; onbesliste beleidsdetails blijven uitgeschakeld.

| Proces | Automatische normale route | Menselijke taak / uitzondering |
| --- | --- | --- |
| Registratie | Voorwaarden, Plus, clubrechten en bevestigingsstatus controleren; herinneren. | Regels, data en vensters vooraf instellen; uitzonderingen beoordelen. |
| Structuur | Alleen ondersteunde volle structuur voorstellen/toepassen op beslismoment. | Onbekende groei/krimp, onbesliste rechten en beleidswijziging. |
| Plaatsing | Geconfigureerd format, loting, stand en geldige vervolgronde. | Niet-ondersteunde beslissingen of bewijsconflict. |
| Fixtures | Exacte editie, deelnemers, rondes en tijden genereren; conflictcontrole. | Handmatige herstelactie, expliciete formatwijziging. |
| Selectie | Registratie, minimum, Plus en vergrendeling controleren. | Betwist feitelijk meespelen of registratiegeschil. |
| Resultaat | Geldige overeenstemming één keer verwerken. | Geschil, verlopen reactie zonder akkoord, storing, no-show. |
| Promotie | Definitieve standen → play-offs → verdiende rechten → nieuwe groepen. | Onbekende vacature/krimp of nog onbesliste sportieve kwestie. |
| Cup | Bevestigde deelnemers, rondes, byes en vervolg volgens vastgesteld format. | Onvoorziene uitval of niet-oplosbaar kalenderconflict. |
| Prijzen | Definitieve gefinancierde rechten één keer betalen/toekennen. | Compensatie, geschil of ontbrekende financiering. |
| Volgend seizoen | Nieuwe editie, geërfde defaults, bevestiging en reserveprocedure. | Annuleren, reset, herstel en wijzigingen van regels. |
| GOST / D3 | Gesloten status bewaken; geen tickets of indeling aanmaken. | Eerst volledige voorwaarden vaststellen en opening expliciet besluiten. |

Technische betrouwbaarheid: autorisatie op de server, transactionele acties,
unieke bewerkingssleutels, gelijktijdigheidscontrole, duurzame taakstatus en
herstartbare verwerking. Geen browser die open moet blijven om een seizoen te
laten doorgaan. Geen claim van algemene realtime zolang de betrokken entiteiten
nog niet op sockets zijn aangesloten.

**N:** Twee hoofdadmins bij de start; aanvullende competitie- en geschilrollen
volgens bevoegdheid. Geen beslissing over eigen club. Eén verantwoordelijke per
zaak; dringende meldingen direct, routine gebundeld.

## 18. Admin-beheer en fixtureacties [B]

- Per Regional League en GOST-editie duidelijke ‘Fixtures trekken’-actie, ook
  voor een begonnen editie die aantoonbaar nog geen fixtures heeft.
- Server valideert deelnemers, format, bestaande fixtures en gekozen editie.
  Herhaald klikken maakt geen tweede schema. Geldige bestaande fixtures niet wissen.
- Simuleren pas mogelijk met geschikte bestaande fixtures en juiste bevoegdheid.
  Een simulatie is een expliciete test/beheeractie, geen automatisch normaal spel.
- Geen voltooiing met prijs/progressie zonder vereiste wedstrijden. Afbreken is
  een afzonderlijke actie met heldere gevolgen en behoud van bewijs.
- Divisiebeheer niet zomaar verwijderen: omvormen naar structuurbeleid,
  groeilimieten, groepsoverzicht en gecontroleerde uitzonderingen.
- Bevoegde Admin kan regionale systemen/divisies toevoegen of uitfaseren.
  Een bewezen ongebruikte draft kan verwijderd; actieve/historische structuren
  gecontroleerd uitfaseren met behoud van edities en verplichtingen.
- Normale groepsgroei door de engine; geen verplicht handmatig aanmaken voor elke
  twintig extra clubs. De groeidrempels moeten eerst definitief worden vastgesteld.
- Beheeracties tonen waarom een knop beschikbaar of geblokkeerd is. Audit bevat
  echte actor, reden en voor/na. Geen actor-ID uit een onbeveiligde requestbody.

## 19. Pagina’s en visueel ontwerp [B]

### Gedeelde stijl

Rustige moderne vormgeving, donkere basis, ademruimte, duidelijke titels, subtiele
accenten, rechte kaders en echte toegewezen trofeeën. Geen parallellogrammen rond
tabellen of deelnemerslijsten. Bestaande bovenste hoofdnavigatie behouden behalve
de afgesproken verplaatsing van competitie-inschrijving.

Tabs: witte tekst in donker thema, zachte gloed voor actieve tab en hover/focus,
geen blauwe onderstreping, geen schuifstrip of horizontale tabscrollbar. Op smal
scherm laten doorlopen naar een volgende regel. Actieve status toegankelijk
aanduiden; licht thema leesbaar houden. Deze latere keuze gaat vóór mockups met
een onderstreepte actieve tab. Tabellen mogen lokaal horizontaal scrollen wanneer
nodig; dit is niet dezelfde eis als het verwijderen van de tabscrollbar.

### GOST-hub en drie detailpagina’s

- Supreme: lichtblauw, Elite: geel, Challenger: groen.
- Echte Supreme-, Elite- en Challenger-PNG via toegewezen catalogus-ID; geen
  nieuw getekende vervanger. Afbeelding volledig zichtbaar, niet vervormd.
- Hub: drie open trofeekolommen, seizoen/archief, persoonlijke route en reis.
- Details: compacte trofeeheader, naam, tier, seizoen en werkelijke status.
  Oude grote banners/logo’s en drie herhalende introductiepanelen vervangen.
- Overview op toestand aanpassen: voorbereiding, live competitie of afgelopen.
  Eigen club, volgende fixtures, uitslagen, route en historische kampioen waar bekend.
- Clubs als directory, niet als ranglijst: crest, naam, land, bronleague en
  historische kwalificatiepositie waar bekend. Zoek/filter/sorteer over volledige
  collectie; eigen club subtiel markeren; klik naar juiste clubprofiel.
- Op mobiel details onder naam; geen onnodige horizontale directoryscroll.
- Geen fictieve kwalificatiepositie, ‘matchday 1’, prijzen of kampioen invullen.
- Stages, Table en Stats qua bestaande functie behouden; alleen afgesproken
  gedeelde frame/tabstijl en afzonderlijke beleidswijzigingen toepassen.
- Rewards: bedragen, componenten, trofee en betaalstatus; History: edities en
  echte kampioenen. Historische editie kiezen opent zijn Overview en juiste URL.
- Geen publieke Join, Fixtures trekken of Simuleren voor GOST.
- Eén deelnemersbron voor telling en directory; geen afwijkende telling uit
  standings. ‘Stages (100)’ niet gebruiken als 100 het aantal wedstrijden is.
- Laadfout met Opnieuw proberen onderscheiden van werkelijk lege editie;
  oude requests mogen een later gekozen seizoen niet overschrijven.

### Toernooidetail voor spelers én clubs

- Geüploade banner behouden. Organisator kan de bestaande afbeelding positioneren;
  geen herupload eisen om alleen uitsnede aan te passen.
- Afbeelding met donkere overgang en subtiele rook laten aansluiten op de pagina;
  titel en toegewezen trofee leesbaar. De Liverpool/EA FC-afbeelding uit het gesprek
  is een ontwerpvoorbeeld, geen banner die alle toernooien moeten krijgen.
- Werkelijke naam, type, platform, deelnemers, datum en status tonen.
- Prijzenbalk met uitsplitsing, regelslink en bij afgerond toernooi echte kampioen.
- Rechte league-/groepstabellen met juiste profielkoppelingen; geen wijziging van
  uitslag of rangschikkingslogica als bijeffect van alleen het ontwerp.
- Spelers-/clublijst als rustige directory met zoeken, passend filter, alfabetische
  sortering, avatar/crest en relevante deelnemergegevens. Een lijstnummer niet
  voorstellen als sportieve rang.
- Alleen relevante tabs voor het werkelijke format; geen lege leaguefunctie
  fabriceren voor een puur knock-outtoernooi. Deelname/organisatoracties per rol.
- Geen persoonlijke walletvergelijkingen voor toeschouwers na inschrijving.

### Regional Leagues-hub

- Verwant aan GOST, eigen identiteit: sectie per regio met kleine contextkolom en
  naast elkaar de werkelijk ondersteunde divisies/groepen.
- Per divisie toegewezen trofee met subtiele rook, naam, niveau, groepinformatie,
  huidig seizoen, status, deelnemers/capaciteit en Explore league.
- Zoekveld, regiofilter en huidige editie/archief. Geen dubbele leaguekaart omdat
  een volgende editie bestaat. Regelslink per regio en ‘Jouw club’-route.
- Automatische groepen zichtbaar onder de juiste divisie; geen verwarring tussen
  bijvoorbeeld tweede D1-groep en nieuwe seizoeneditie.
- Regionale rook als rustige achtergrond; geen grote concurrerende reclamebanner.
- D2 toont promotieroute. GOST-gesloten status respecteren, geen huidige tickets
  beloven met oude routebeschrijvingen.

### Regionale league-/groepsdetailpagina

- Compacte header met toegewezen trofee, subtiele rook, regio/divisie/groep,
  titel, seizoen, capaciteit, actuele status, regels en seizoenselector.
- Overview, Clubs, Stages, Table, Stats, Rewards en History waar van toepassing.
- Voor start: deelname/status en uitleg wanneer fixtures verschijnen; geen vier
  grote nulcounters die inhoud vervangen.
- Tijdens seizoen: jouw club, stand, volgende wedstrijd, recente uitslagen en
  sportieve inzet. Na afloop: definitieve stand, kampioen en vervolgstatus.
- Route naar hogere divisie/GOST contextueel en uitsluitend volgens geldend beleid.
- Rewards en History gekoppeld aan echte editiegegevens; geen historisch gat
  opvullen met een nieuwe actuele configuratie.
- Vanuit Overview een specifieke fixture openen moet de juiste ronde en match
  tonen, niet standaard Matchday 1.

## 20. Regels, inschrijving en tutorials [B]

### Waar komen regels?

Eén versiegebonden regelbron per editie; centrale Regels/help plus contextlinks
op regio, league, cup, toernooi, inschrijving en GAMEDAY. Korte uitleg naast acties
met consequenties: selectie, Plus, score, bewijs, verplaatsing en protest.
Admin ziet dezelfde gepubliceerde versie plus configuratie, uitzonderingen en audit.
Geen nieuwe regel achteraf stil op een al begonnen editie toepassen.

### Inschrijving vindbaar maken

De losse ‘Registratie’ in de topnavigatie omvormen naar contextuele inschrijving
vanuit Regional Leagues, de betreffende competitie en het cluboverzicht.
Bestaande directe links blijven bruikbaar of krijgen een passende doorverwijzing.
Toon actuele status, deadlines, ontbrekende voorwaarden en volgende stap. Gebruiker
kiest regio; engine wijst na bevestiging/plaatsing de sportieve groep toe.

### Tutorial

- Bestaande tutorial eerst inventariseren. Goede delen behouden, foutieve of
  verouderde uitleg corrigeren. Alleen nuttige nieuwe informatie toevoegen.
- Korte introductie: beginnen, regio/deelname, eigen club en vervolgstap.
- Gerichte rondleiding waar nuttig: clubbeheer, inschrijving, selecties,
  GAMEDAY/uitslag, competitieoverzicht en Lifestyle.
- Lifecycle/Plus/kalender in de relevante stap kort toelichten, geen hele
  reglementen door de rondleiding laten lezen.
- Lifestyle: kopen, huren of verhuren alleen uitleggen voor functies die werkelijk
  beschikbaar zijn; ontbrekende functies niet suggereren of hiervoor stil bouwen.
- Ongeveer drie tot vijf stappen als richtlijn, geen verplicht aantal. Overslaan,
  later opnieuw openen via Uitleg/? en uitleg afstemmen op rol en bevoegdheid.
- Niet iedere pagina heeft een tutorial nodig. Geen rondleiding die telkens
  opnieuw verschijnt; voortgang/versie en toegankelijke bediening uitwerken.

## 21. Andere georganiseerde toernooien — punt 20

**N:** Admin- en gebruikerstoernooien werken met vooraf gepubliceerde vaste uren
of begrensde speelvensters. Organisator kiest die bij creatie; deelnemers accepteren
vóór inschrijving. Bekende conflicten met officiële wedstrijden controleren;
officiële verplichtingen hebben de afgesproken prioriteit. Organisator beheert
alleen zijn eigen toernooi; onafhankelijk geschilproces blijft mogelijk.

Prijzen en financiering vóór deelname duidelijk; gebruikersprijzen komen niet
automatisch uit STAGE-budget. Controleer huidige organisatierechten, betaalflow,
toegestane formats, annuleringsvoorwaarden en Plusvoorwaarden vóór wijziging.

## 22. Bestaande lokale implementatie: eerst hergebruiken, dan aanvullen [L]

Deze bronnen zijn op 2 november 2026 gelezen. Hun historische testresultaten zijn
niet opnieuw uitgevoerd en bewijzen geen actuele live status.

| Onderwerp | Bestaand document | Betekenis voor de bouw |
| --- | --- | --- |
| Permanente identiteit, rollover, draw, complete/abandon, reset en beheer | [league-identity-lifecycle.md](league-identity-lifecycle.md) | Beschrijft al een lokale oplossing inclusief exacte bron-/doel-IDs. Controleer dit vóór opnieuw bouwen. |
| Oudere diagnose/preview duplicates | [regional-edition-identity-review.md](regional-edition-identity-review.md) | Historische oorzaak en herstelgrenzen; nieuwere permanente-parentoplossing meenemen. |
| GOST-hub, catalogus en snapshots | [gost-overview-redesign.md](gost-overview-redesign.md) | Toewijzing en behoud van historie hergebruiken; oude kwalificatietekst actualiseren. |
| GOST-detail en directory | [gost-detail-redesign.md](gost-detail-redesign.md) | Veel presentatie, tellingen en History-routering lokaal beschreven. |
| Toernooi- en regionale pagina’s | [competition-regional-redesign.md](competition-regional-redesign.md) | Bannerpositie, rechte kaders, gloeiende tabs, directory en fixtureshortcut lokaal beschreven. |
| Ongewijzigde 2–2 afgewezen | [result-confirmation-semantic-fix.md](result-confirmation-semantic-fix.md) | Semantische guard behouden; oude timeoutpolicy apart vervangen indien bevestigd. |

Overgedragen bronnotities wijzen ook op bestaande Plus-controle van alleen de
inschrijvende account en club/loancontrole bij lineups. Deze specifieke codepaden
zijn in deze documentatiesessie niet opnieuw geaudit. Bij fase 3 actuele checks
opnieuw volgen van API tot selectie; geen livegedrag afleiden uit de notitie.

De huidige checkout heeft geen `graphify-out/GRAPH_REPORT.md` of wiki-index.
Er is een reeds bestaand ongetrackt `src/lib/playerProfileStatus.js`; dit bestand
is buiten deze documentatietaak gehouden.

## 23. Open punten en consistentiecontrole vóór uitvoerbaar beleid

| ID | Te sluiten punt | Wanneer nodig |
| --- | --- | --- |
| O01 | N-regels aan oorspronkelijke vragen koppelen of gebundeld bevestigen; losse A/B-antwoorden niet raden. | Vóór implementatie van de betreffende numerieke regel. |
| O02 | Echt aantal bevestigingen → ondersteunde structuur, wachtlijst en groeibeslisdatum. | Fase 2–3. |
| O03 | Bevestigde uitbreidingstabellen technisch/rekenkundig verifiëren; krimp en de kalender voor 180 → 240 met extra vijf wedstrijden blijven open. | Fase 2 en kalender. |
| O04 | Absolute lanceringsdata, twaalfwekenbegrip, plaatsing, overgang en reserves samen. | Fase 3–4, vóór publicatie. |
| O05 | Noord-Amerikaanse tijden, tijdzones/zomertijd en alle evenementbuffers. | Fase 4. |
| O06 | Spelinstellingen, echte duur, hervatting, extra tijd, strafschoppen en bewijsbare data. | Fase 4. |
| O07 | Resterende uitslag-, storings-, sanctie-, terugtrekkings- en beslissingsdetails. | Fase 4. |
| O08 | Bekernamen, loting/byes, kalender, vervangers en geldige bekerrechten. | Fase 5. |
| O09 | Prijsbudget bij groei, deelnamekosten, terugbetaling en compensaties. | Fase 3/5, vóór financieel handelen. |
| O10 | GOST-toegang/opencriteria en D3-regels. | Uitgesteld; functies gesloten houden. |
| O11 | Exacte productie-ID-preview, afhankelijkheden, migraties en deploymentstatus. | Fase 1 vóór daadwerkelijke reparatie. |
| O12 | Plus-functiematrix, ingangsmarkering, betaalstoringen en expliciete uitzonderingen. | Fase 3. |
| O13 | Rollen, geschilbevoegdheden, meldingen en toepasselijke huidige tutorials. | Fase 6–7. |

Rekenkundige controles: twintig clubs × 38 wedstrijden / twee = 380 wedstrijden
per normale groep; sportieve beweging behoudt twintig per groep; elke cup heeft
n−1 gespeelde duels bij n werkelijke deelnemers; ieder definitief GOST-veld heeft
36 unieke geldige clubs. Controleer aantallen naast planning, niet los ervan.

Elke complete testkalender moet de maximale clubbelasting én individuele
beschikbaarheid controleren. Een kalender met plaatsings-, beker-, play-off- en
beslissingswedstrijden mag niet alleen op de 38 gewone duels worden beoordeeld.

Gebruik een geïsoleerd testpakket met voldoende clubs/spelers voor de te testen
structuur; minimum drie echte gesimuleerde speleridentiteiten per club. Testdata
maken is een latere bouwtaak. Geen testclubs of gesimuleerde wedstrijden aan
productie toevoegen. Omvang en scenario’s per fase vastleggen.

## 24. Acht bouwfases en hun acceptatie

Elke bouwprompt vermeldt: doel, relevante paragrafen hier, actuele bestaande
implementatie, scope, uitsluitingen, open blokkades en controleerbaar resultaat.
Open beleid blokkeert alleen de afhankelijke functie; onafhankelijke fundamenten
kunnen worden voorbereid. Elke fase documenteert eventuele afwijking met reden.

| Fase | Scope | Acceptatie vóór vervolg |
| --- | --- | --- |
| 1 | Identiteit, edities, duplicates, trofee-erfenis en reset; bestaande lifecycle-acties auditen. | Eén permanente identiteit per bedoelde league; rollover/reset herhaalbaar zonder dubbele roots; concrete herstelpreview voor de genoemde IDs met historie behouden. Live apply apart onderscheiden. |
| 2 | Structuur, groepidentiteit, plaatsing, normale beweging en uitbreiding. | Ondersteunde deelnemersaantallen leveren sluitende twintigclubsgroepen, expliciete rechten en testbare promotiebalansen. GOST/D3 dicht. |
| 3 | Regionale inschrijving, bevestiging, reserves, Plus en speelgerechtigheid. | Exacte deadlines/status; servergecontroleerde persoonlijke toegang; overgang per editie en minimaal drie spelers; geen verloren rechten door retries. |
| 4 | Kalender, fixtures, selecties, uitslagen, rangschikking en uitzonderingen. | Geen ongeldige dubbele schema’s; belasting/vensters gecontroleerd; ongewijzigde 2–2 bevestigbaar en echte wijziging geblokkeerd; vastgestelde nieuwe timeoutpolicy; geschillen en herstel aantoonbaar. |
| 5 | Regional Cups, prijzen, catalogustoewijzing en awards. | Eén cup per regio/cyclus; geldige loting/progressie; edition snapshots; juiste gefinancierde betaling/award precies één keer. |
| 6 | Orchestratie, Admin-overzichten, rollen en meldingen. | Normale cyclus zonder open browser; crashes/retries veilig; één duidelijk overzicht voor menselijke uitzonderingen; autorisaties/audit getest. |
| 7 | Goedgekeurde pagina’s, inschrijfnavigatie en korte tutorials. | Huidige goede lokale ontwerpen behouden; mobiele tabs zonder scrollbar/underline; directories, editie-URL’s, regels en rolgerichte uitleg kloppen. |
| 8 | Eindcontrole, overgang en overdracht. | Volledige geïsoleerde seizoenflow, foutscenario’s en echte omgevingstests waar beschikbaar; bekende beperkingen vermeld; vindplaatsen en bediening opgeleverd. |

Regels, relevante uitleg en betekenisvolle tests worden per functie meegebouwd;
ze wachten niet allemaal op fase 7/8. Vroege Admin-bediening hoort bij de acties
die zij bestuurt; fase 6 maakt de volledige automatisering samenhangend.

### Verificatie per latere codefase

Volg repository-AGENTS.md: lint, typecheck, backend-syntax en passende regressies;
nieuwe endpoints daadwerkelijk via HTTP raken. Fixturetests onderscheiden van
echte MySQL-transacties, echte auth en productie. Tijd/concurrency-tests omvatten
deadlinegrenzen, twee gelijktijdige inschrijvers/resultaten, verloren responses,
verlopen Plus, annulering en herstart tijdens rollover/settlement.

Voor financiële en identiteitwijzigingen oude/nieuwe snapshots en ledgers
vergelijken. Ontwerp desktop/mobiel en toetsenbord controleren. Grafiek bij
codewijzigingen bijwerken volgens AGENTS wanneer tooling beschikbaar is.
Deployment volgt Gandi FTP/SFTP plus expliciete apprestart; documenteren wat
werkelijk is uitgevoerd. Geen ‘werkt live’-claim op basis van lokale tests.

## 25. Overdracht: waar vindt iedereen alles?

Dit is de beoogde informatiearchitectuur, geen claim dat deze onderdelen al live
staan. De uiteindelijke overdracht vermeldt exacte routes, menu’s en screenshots.

| Gebruiker | Beoogde vindplaats | Inhoud |
| --- | --- | --- |
| Speler/voorzitter | Regional Leagues-hub | Regio’s, groepen, status, inschrijfactie, eigen route. |
| Speler/voorzitter | Club → Competities | Aansluiting, bevestiging, Plus/selectiegereedheid, deadlines. |
| Iedereen met toegestane app-toegang | League/cup/toernooidetail | Overview, deelnemers, wedstrijden, stand, passende stats, rewards, historie en regels. |
| Deelnemer | GAMEDAY | Selectie, tijden, bewijs, uitslag, reactie en protest. |
| Speler/voorzitter | Plus/account en selectie | Eigen abonnementsstatus; deelnamegeschiktheid zonder andermans betaalgegevens. |
| Gebruiker | Regels/help en contextuele links | Gepubliceerde versie, samenvatting en volledige voorwaarden. |
| Gebruiker | Uitleg/? op nuttige pagina’s | Korte opnieuw te openen tutorial; Lifestyle alleen echte functies. |
| Admin | Regional Leagues / GOST | Structuurbeleid, edities, fixtures, voortgang, trofeetoewijzing en gecontroleerde herstelacties. |
| Admin | Trophies | Ontwerpen/artwork beheren; geen automatische award door upload. |
| Admin | Rewards | Bronconfiguratie, editieprijzen, snapshots, betaalstatus en afwijkingen. |
| Admin | Acties/geschillen | Zaken met deadline, ontbrekende toegang, storingen, besluiten en audit. |

Lever na de bouw ook op: wat automatisch loopt, wat Admin moet doen, hoe regels
worden gewijzigd voor een volgende editie, hoe herstel werkt en welke onderdelen
nog gesloten zijn. Alle oorspronkelijke 20 punten zijn gekoppeld aan de paragrafen
hierboven; Plus, ontwerp en tutorials zijn aanvullingen op die lijst.

## 26. Status van deze documentatiesessie

Opgeleverd: dit masterdocument met beslisstatus, alle twintig oorspronkelijke
onderwerpen, aanvullende Plus-/ontwerp-/tutorialafspraken, bestaande lokale
documentatie, openpuntenregister en acht bouwfases.

Niet uitgevoerd: applicatiecode wijzigen, testclubs maken, leaguegegevens lezen
in productie, fixtures trekken/simuleren, prijzen uitbetalen, trofeeën toekennen,
abonnementen veranderen, records verwijderen, reset of deployment.

Aanvullend opgeleverd: [bouwprompt 1 — fundament](stage-build-prompt-01-foundation.md),
op basis van §15–16, §18, §22 en fase 1 in §24. Die prompt begint met controle van
de bestaande lokale lifecycle-oplossing en maakt de gevraagde productie-uitkomst
concreet met een herstelpreview. Het opleveren van de prompt is geen uitvoering
van de bouwfase; lokaal bouwen en eventuele latere productiereparatie blijven
afzonderlijke stappen.

### Fase 1 — lokale uitvoering op 2 november 2026

De bestaande parent/edition-, herstelpreview-, reset- en lifecycle-oplossing is
opnieuw gecontroleerd en behouden. De ontbrekende centrale `legacyFunctions.js`
is met expliciet gebruikersakkoord uit de laatste Git-versie hersteld. Nieuwe
GOST-kwalificaties zijn nu gesloten in de engine, generieke kwalificatiewrites,
oude frontendhelpers en actuele toegangsteksten. Historie is niet gewist.

Gerichte verificatie: 95 backendtests en 15 frontendtests geslaagd; lint,
typecheck, syntax en build geslaagd. Volledige suites houden de eerder beschreven
vier fouten per suite (frontend 438/442; backend 799/804, één overgeslagen).
Browsercontrole met geïsoleerde data op desktop en 390px iframeviewport uitgevoerd.

Operationele afronding blijft open: de echte twee ID-mappings, MySQL-locking,
migraties en deployment zijn niet tegen productie gecontroleerd of toegepast.
Zie [actuele fase-1-overdracht](league-identity-lifecycle.md) voor exacte vindplaatsen,
gewijzigde bestanden, beperkingen en de concrete previewprocedure. De historische
‘niet uitgevoerd’-lijst hierboven beschrijft uitsluitend het maken van dit
masterdocument; deze paragraaf beschrijft de daaropvolgende lokale bouwfase.

### Fase 2 — opdracht voorbereid op 2 november 2026

De gebruiker heeft de tabellen uit §4–5 opnieuw expliciet bevestigd. Alleen deze
tabellen zijn daarmee van N naar B gegaan; andere open beleidsdetails blijven
open. [Bouwprompt 2](stage-build-prompt-02-structure.md) beschrijft groepsidentiteit,
plaatsing, normale promotie/degradatie en uitbreidingsroutes, met werkende
server-/Admin-integratie als acceptatie. Het begrippenoverzicht staat in
`CONTEXT.md` in de repositoryroot. Deze voorbereiding heeft geen applicatiecode
of productiegegevens gewijzigd; fase 2 is hiermee niet als gebouwd afgetekend.

### Fase 2 — daaropvolgende lokale bouwstappen, 2 november 2026

Groepsidentiteit, pure sportieve berekening en daarna opgeslagen cycli met
officiële uitslagkoppeling en Admin-bediening zijn lokaal toegevoegd. De
oorspronkelijke league-identiteiten en trofee-defaults blijven behouden.
Zie [actuele cyclusoverdracht](regional-cycle-phase2.md) voor bediening, tests,
deploymentbestanden en de nog open gelijke standen, kalender- en herstelpaden.
Dit tekent de volledige fase 2 of productie niet af. GOST en D3 zijn niet geopend.

### Fase 3 — eerste lokale bouwstap, 2 november 2026

Vooraf gepubliceerde regionale inschrijving, gedeelde bevestigingsweek,
persoonlijke Plus-/speelregistratiecontrole en koppeling aan de sportieve cyclus
zijn lokaal toegevoegd. Contextuele toegang vervangt de losse navigatielink;
bestaande directe links en oude inschrijvingen blijven beschikbaar. Er is geen
datum gepubliceerd of productie gewijzigd. [De fase-3-overdracht](regional-registration-phase3.md)
beschrijft de vindplaatsen, 118 gerichte tests en het nog open werk, waaronder
wedstrijddaghandhaving, reserves, automatisering en echte MySQL/browsercontrole.

### Fase 3 — lokale selectiestap, 2 november 2026

Nieuwe regionale edities/cycli controleren persoonlijke Plus en speelregistratie
bij selectie/publicatie en opnieuw bij GameDay-aftrap. Een transactioneel
vastgelegde aftrapselectie beschermt geldige deelname tegen Plusverval tijdens
het duel. Uitslagdeelnemers/statistieken worden aan die selectie getoetst.
[De selectiestap](official-match-selection-phase3.md) beschrijft ook wat nog
ontbreekt: onder meer gereedmeldvensters, -5-minutenvergrendeling en beperkte
reservewissels. Deze stap activeert geen productievoorwaarden en opent geen
GOST, cups of D3.

### Fase 3 — lokale voorbereidingsstap, 3 november 2026

Gereedmelden vanaf -15 minuten, selectie vergrendelen vanaf -5 minuten en
gecontroleerde reservewijzigingen vóór de echte aftrap zijn aangesloten voor
nieuwe regionale edities/cycli. Bedienbaar bij Club → Selectie en in GameDay,
met persoonlijke geschiktheidscontrole, verse selectierevisie en transactionele
tegenstandermelding/audits. Beide clubs moeten gereed zijn; geen vroegtijdige
start en geen automatisch forfait na tien minuten. Zie
[de voorbereidingsoverdracht](official-match-preparation-phase3.md) voor de
precieze reikwijdte. De volledige kalender-/legacyplanningsintegratie, operationele
review en productievalidatie blijven open; GOST, cups en D3 blijven gesloten.

### Fase 3 — lokale kalenderkoppeling, 3 november 2026

Nieuwe officiële regionale planning is gekoppeld via één transactionele
Admin-actie: fixture, eventuele enginefixture, canonieke Match, voorbereiding,
audit en in-appmelding. Wijzigingen trekken oude voorbereiding blijvend in;
GameDay openen schrijft geen nieuwe datum. Een Admin-formulier is toegevoegd
onder Regional Leagues. [De kalenderoverdracht](official-calendar-link-phase3.md)
beschrijft de exacte scope en 158 geslaagde gerichte tests, met twee afzonderlijk
bevestigde bestaande testfouten. Dit bouwt nog geen automatische volledige
seizoenskalender, verplaatsingsquota of storingsreview en activeert geen productie.

### Fase 3 — volledige regionale leaguekalender, 3 november 2026

Het bevestigde Europese kalenderpakket is verwerkt in een lokale preview- en
publicatieactie, met groeps-/identiteitscontrole, complete draws, clubbelasting,
zomertijd, bronrevisie en transactionele GameDay-koppeling. Zie
[seizoenskalenderoverdracht](regional-season-calendar-phase3.md) voor bediening,
controlebewijs en beperkingen. Dit activeert geen productie of uitgestelde Cup-,
GOST-, D3-, spelerconflict- of verplaatsingsregels.

### Fase 3 — promotiekalender, 3 november 2026

De gebruiker bevestigde dinsdag/donderdag in speelweek 11, telkens 20.00 uur
Europe/Brussels, met zestigminutenblokken en blokkering bij onbesliste bronstanden
of conflicten. De lokale Admin-preview/publicatie volgt de bronleaguekalender en
de sportieve cyclus. Finals worden pas gepland met echte deelnemers na verwerking
van de halvefinaleresultaten. Zie [promotiekalenderoverdracht](regional-promotion-calendar-phase3.md).
Dit is geen onbemande publicatieplanner en kiest nog geen tijden voor beker-,
plaatsings-, uitbreidings- of aanvullende beslissingsduels. Geen productieactivatie.

### Fase 3 — beslissingskalender en Regional Cup-voorbereiding, 3 november 2026

De gebruiker bevestigde het Regional Cup-pakket en de zes bekernamen. Nieuwe
inschrijfvoorwaarden kunnen bekerdeelname vooraf opnemen; oude bevestigingen
worden niet achteraf gewijzigd. Admin kan een vaste beker, catalogustrofee en
een ontwerpeditie met bevestigd veld, eerste opgeslagen loting/byes en alle
rondevensters voorbereiden. Dit maakt nog geen speelbare Cup-wedstrijden,
resultaten, uitbetalingen of GOST-rechten. De Cup-wedstrijdlifecycle volgt apart.

Voor al getekende aanvullende beslissingsduels is een gecontroleerde kalenderactie
aangesloten, met expliciete Admin-aftrappen per ronde, clubbelasting, bronrevisie,
Match-/enginekoppeling en transactionele audits/meldingen. Bronbeslissingen die
promotie beïnvloeden mogen niet na de gereserveerde halve finales worden gepland.
[Overdracht en bediening](regional-cup-decision-calendar-phase3.md). Geen productieactivatie.

### Fase 3 — speelbare Regional Cups, 3 november 2026

De lokale bekerlifecycle koppelt geactiveerde edities aan GameDay, de regionale
kalender en bestaande Plus-/selectiecontroles. Iedere volledig bevestigde ronde
opent automatisch een nieuwe opgeslagen loting; byes maken geen wedstrijden.
Gewijzigde verwerkte resultaten en kalenderproblemen blokkeren de voortgang.
De finale legt de kampioen vast. Deelnemers vinden edities via Regional Leagues
→ Regional Cups. STC-uitbetaling en daadwerkelijke trofee-uitreiking volgen apart.
[Bediening, verificatie en beperkingen](regional-cup-lifecycle-phase3.md).
270 geselecteerde tests slagen; productie is niet geactiveerd.

### Fase 3 — Regional Cup-prijzen en awards, 3 november 2026

Nieuwe edities bewaren de bevestigde 7/3 miljoen STC-prijzen en catalogustrofee
vooraf. Bestaande edities zonder afspraken vereisen expliciete adoptie. De bestaande
settlement- en kastflow verwerkt na een definitieve finale bewezen ontbrekende
betalingen en trofeeën; retries en crashherstel behouden eenmalige uitreiking.
Admin vindt de controles zowel in Regional Leagues als Rewards; de bekerpagina
toont bedragen en werkelijke status. [Bediening en beperkingen](regional-cup-rewards-phase3.md).
277 geselecteerde regressietests slagen. Geen productieactivatie.

### Fase 6 — eerste operationele Admin-overzicht, 3 november 2026

Regionale actiepunten bundelt opgeslagen signalen uit inschrijving, cycli,
kalenders, bekers en beloningen. Het overzicht toont een controletijd en verwijst
naar de bestaande geautoriseerde acties. Het schrijft zelf geen competitiegegevens
en behandelt fouten niet als lege succeslijsten. Dit is nog geen duurzame
automatiseringsregisseur en beslist geen open beleidsvragen.
[Bediening, scope en verificatie](regional-operations-phase6.md).

### Fase 6 — bekerherstel en Engelse appteksten, 3 november 2026

De gebruiker heeft Engels als standaard voor alle toegevoegde appteksten bevestigd.
Eerdere Nederlandse Cup-/beslissings-/actiepanelen en operationele servermeldingen
zijn omgezet. De server controleert voortgang van reeds geactiveerde bekers nu
zonder open browser, met opgeslagen reserveringen en bescherming tegen oude retries.
Sportieve blokkades blijven voor review zichtbaar; ontwerpen, datums en seizoenen
worden niet automatisch geopend of gewijzigd. [Overdracht en beperkingen](regional-cup-recovery-phase6.md).

### Fase 6 — herstel van plaatsings-/promotiecycli, 3 november 2026

De server herleest al opgeslagen regionale cycli zonder open browser, via dezelfde
sportieve voortgangsactie als de resultaatkoppeling. Gedeelde reserveringscode
beschermt zowel Cup als cyclus tegen gelijktijdige en verouderde pogingen, met
afzonderlijke checkpoint-identiteiten. Admin ziet blokkades en definitieve rechten
die klaar zijn voor groepsindelingscontrole. Groepen toepassen en aftrappen
publiceren blijven bestaande gecontroleerde acties.
[Overdracht en verificatie](regional-cycle-recovery-phase6.md). Geen productieactivatie.

### Fase 6 — automatische promotiefinale, 3 november 2026

Na reeds gepubliceerde halve finales kan de herstelworker de finale publiceren
op het bevestigde donderdagvenster in speelweek 11. Alle vereiste uitslagen,
bronidentiteiten en halvefinaletijden worden herlezen; belasting/conflicten en
cutoff blijven blokkeren. De interne route gebruikt systeemaudit en is niet via
een clientflag toegankelijk. Eerste publicaties en uitzonderingen blijven aparte
gecontroleerde acties. [Bediening en verificatie](regional-promotion-auto-final-phase6.md).

### Fase 3–4/6–7 — gekoppelde seizoensstart, herinschrijving en verplaatsing, 6 november 2026

Nieuw gepubliceerde periodes bewaren expliciet de automatische seizoenspolicy.
De server koppelt het bestaande bevestigde deelnemersveld aan cyclusvoorbereiding,
sportieve voortgang, opgeslagen groepsindeling, fixtures, de expliciet gedateerde
leaguekalender en de geaccepteerde beker. De volgende inschrijfperiode wordt volgens
de bevestigde weken 5–8/9 voorbereid; geen ontbrekende datums worden verzonnen.
Normale promotiehalvefinales kunnen voor zulke overgangscycli eveneens automatisch
volgen uit definitieve bronstanden en de bestaande week-11-kalender. Oudere edities
worden niet stilzwijgend opgewaardeerd.

Het Europese verplaatsingspakket is aangesloten op GAMEDAY: voorstel, reactie,
verval/weigering/intrekking en afboeking uitsluitend bij goedkeuring. De bestaande
kalender- en selectiekoppelingen blijven leidend. Nieuwe standaardteksten zijn Engels.

Zie [uitvoering en vindplaatsen](regional-season-orchestration-phase6.md) en de
[actuele oorspronkelijke achtfase-matrix](competition-delivery-status.md).
Deze stap voltooit het volledige programma niet. Reserve-aanvulling, de bevestigde
spelers- en terugtrekkingspakketten en andere resterende onderdelen blijven zichtbaar
als bouwwerk; hun beleidsbevestiging is geen bewijs van implementatie.
Geen productieherstel, reset, push, deployment of live uitbetaling uitgevoerd.
