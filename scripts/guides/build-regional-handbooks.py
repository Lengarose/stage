"""Build the three matching Admin handbooks from the recorded local walkthrough."""
from pathlib import Path
import html
import json
import shutil

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / 'public/guides/regional-leagues'
SHOTS = ROOT / 'output/playwright/admin-walkthrough-2026-11-09'
OUT.mkdir(parents=True, exist_ok=True)
(OUT / 'images').mkdir(exist_ok=True)

# Same sequence and screenshots in every language; English labels match the app.
chapters = [
('01-admin-empty',
 ['Begin bij Regional Leagues', 'Commencer dans Regional Leagues', 'Start in Regional Leagues'],
 ["Open Admin → Regional Leagues. Gebruik Start guided task voor een nieuwe taak. Leagues & Cups toont bestaande competities; Management bevat afzonderlijke beheeracties. De demo start met 60 fictieve clubs en vier spelers per club, maar zonder leagues. De profielen en testtrofeeën zijn door een lokale testhulp voorbereid. Er is geen productiegegevensbestand gebruikt.",
  "Ouvrez Admin → Regional Leagues. Start guided task lance une tâche. Leagues & Cups affiche les compétitions existantes ; Management contient les opérations distinctes. La démonstration commence avec 60 clubs fictifs et quatre joueurs par club, sans ligues. Les profils et trophées de démonstration ont été préparés par un outil local. Aucune base de production n'est utilisée.",
  "Open Admin → Regional Leagues. Start guided task starts a task. Leagues & Cups lists existing competitions; Management holds separate management actions. This demonstration begins with 60 synthetic clubs and four players per club, but no leagues. A local helper prepared the profiles and demonstration trophies. No production database is used."]),
('02-create-league-fields',
 ['Maak de vaste leagues één keer', 'Créer les ligues permanentes une seule fois', 'Create permanent leagues once'],
 ["Kies Create a league. Maak D1 en D2 binnen hetzelfde regionale systeem en platform. In dit voorbeeld: uk-ireland, cross-platform, telkens Capacity 20. Kies de bestaande catalogustrofee bij Default trophy. D2B wordt later door de sportieve verdeling gemaakt; maak daarvoor geen tweede onafhankelijke D2-league. Een nieuw seizoen is een editie van dezelfde vaste league.",
  "Choisissez Create a league. Créez D1 et D2 dans le même système régional et sur la même plateforme : uk-ireland, cross-platform, Capacity 20 dans cet exemple. Sélectionnez le trophée existant sous Default trophy. La répartition sportive créera ensuite D2B ; ne créez pas une deuxième ligue D2 indépendante. Une nouvelle saison est une édition de la même ligue permanente.",
  "Choose Create a league. Create D1 and D2 in the same regional system and platform: uk-ireland, cross-platform, Capacity 20 in this example. Select the existing catalogue item under Default trophy. Sporting allocation creates D2B later; do not create a second independent D2 league for it. A new season is an edition of the same permanent league."]),
('05-two-permanent-leagues',
 ['Controleer wat is opgeslagen', 'Vérifier les éléments enregistrés', 'Verify the saved leagues'],
 ["Klik Preview dependencies and consequences, lees het overzicht, vink de bevestiging aan en kies Confirm create. Open vervolgens Leagues & Cups: je ziet twee vaste leagues met hun eerste concepteditie. Een concept heeft nog geen gepubliceerde wedstrijden. Na een verversing kan een formulier opnieuw leeg zijn; controleer eerst de lijst voordat je opnieuw op Create drukt.",
  "Cliquez sur Preview dependencies and consequences, lisez le récapitulatif, cochez la confirmation puis Confirm create. Dans Leagues & Cups, vérifiez les deux ligues et leur première édition en brouillon. Un brouillon n'a pas encore de matchs publiés. Après un rafraîchissement, un formulaire peut redevenir vide : consultez la liste avant de recréer quoi que ce soit.",
  "Click Preview dependencies and consequences, read the summary, tick confirmation and choose Confirm create. In Leagues & Cups, verify the two leagues and their initial draft editions. A draft has no published matches yet. A refresh can leave a form empty again: check the saved list before creating anything twice."]),
('08-registration-dates',
 ['Publiceer één inschrijfperiode voor de regio', "Publier une période d'inscription régionale", 'Publish one regional registration period'],
 ["Kies Open registration. Selecteer het D1-systeem als ingang voor de hele regio, niet als belofte van D1. Voorbeeld: Target season 1, Reset series 0, inschrijving vanaf 18 januari 2027, eerste leagueweek vanaf maandag 15 maart. Vier weken inschrijving eindigen 15 februari; de gezamenlijke bevestigingsweek eindigt 22 februari. Reserve-aanvulling sluit uiterlijk 48 uur later. Alle datums zijn trainingsvoorbeelden, geen lanceringsplanning.",
  "Choisissez Open registration. Le système D1 sert de point d'entrée à toute la région, sans promettre une place en D1. Exemple : Target season 1, Reset series 0, inscriptions à partir du 18 janvier 2027, première semaine de ligue le lundi 15 mars. Les quatre semaines d'inscription se terminent le 15 février ; la confirmation commune se termine le 22 février. Le complément de réserves se clôture au plus tard 48 heures après. Ces dates sont des exemples de formation.",
  "Choose Open registration. The D1 system is the entry point for the entire region, not a promise of D1 membership. Example: Target season 1, Reset series 0, registration from 18 January 2027, first league week Monday 15 March. Four registration weeks end on 15 February; the shared confirmation week ends on 22 February. Reserve supplementation closes at most 48 hours later. These are training dates, not a launch schedule."]),
('10-registration-review',
 ['Voorwaarden vóór inschrijving tonen', "Afficher les conditions avant l'inscription", 'Publish conditions before clubs enter'],
 ["Laat Include Regional Cup entry ingeschakeld als de beker deel uitmaakt van deelname. Vul Published edition rules en Administrative reason in. De server voegt de toepasselijke vastgelegde regels toe. Lees Full conditions to be published en de berekende deadlines; kies daarna Confirm and publish these conditions. Dit maakt nog geen deelnemers, groepen of betalingen. Gepubliceerde voorwaarden horen bij die editie en worden niet achteraf via dit formulier herschreven.",
  "Laissez Include Regional Cup entry activé si la Coupe fait partie de la participation. Remplissez Published edition rules et Administrative reason. Le serveur ajoute les règles applicables déjà définies. Lisez Full conditions to be published et les échéances calculées, puis Confirm and publish these conditions. Cette action ne crée ni participants, ni groupes, ni paiements. Les conditions publiées restent attachées à cette édition.",
  "Keep Include Regional Cup entry checked when the Cup is part of participation. Fill Published edition rules and Administrative reason. The server appends the applicable recorded policies. Read Full conditions to be published and the calculated deadlines, then choose Confirm and publish these conditions. This does not create participants, groups or payments. Published conditions belong to that edition and are not rewritten later through this form."]),
('12-club-registration',
 ['De voorzitter schrijft de club in', 'Le président inscrit son club', 'The president applies for the club'],
 ["Vanuit de regio of club opent de voorzitter Your club’s participation. De club kiest de regio en aanvaardt de gepubliceerde deelnamevoorwaarden. Ze kiest geen divisie. De voorzitter heeft persoonlijk STAGE Plus nodig. In de demo is één club via de zichtbare pagina ingeschreven; de andere 59 gebruikten dezelfde beveiligde aanvraagactie via de lokale testhulp.",
  "Depuis la région ou le club, le président ouvre Your club’s participation. Le club choisit sa région et accepte les conditions publiées, sans choisir sa division. Le président doit avoir son abonnement STAGE Plus personnel. Dans la démonstration, un club s'inscrit à l'écran ; les 59 autres utilisent la même action sécurisée via l'outil local.",
  "From the region or club, the president opens Your club’s participation. The club selects a region and accepts its published conditions, without choosing a division. The president needs personal STAGE Plus. One club applied through the visible page in this demonstration; the other 59 used the same protected application action through the local helper."]),
('14-club-confirmation',
 ['Inschrijving en bevestiging zijn verschillend', 'Inscription et confirmation sont distinctes', 'Registration and confirmation are separate'],
 ["Tijdens de gezamenlijke bevestigingsweek selecteert de club minstens drie speelgerechtigde spelers met persoonlijk Plus en bevestigt ze deelname. Een bankplaats is niet hetzelfde als gespeelde deelname. Een keeper is niet verplicht; ANY is toegestaan. Alle clubs hebben dezelfde deadline, ook wie op de laatste inschrijfdag binnenkomt. Admin kan de aanvragen bekijken bij Open registration → Review registration applications.",
  "Pendant la semaine commune de confirmation, le club sélectionne au moins trois joueurs éligibles avec Plus personnel et confirme sa participation. Une place sur le banc n'est pas une participation effective. Aucun gardien n'est obligatoire ; ANY est autorisé. L'échéance est commune, même pour une inscription le dernier jour. Admin consulte les demandes dans Open registration → Review registration applications.",
  "During the shared confirmation week, the club selects at least three eligible players with personal Plus and confirms participation. A bench nomination is not actual match participation. A goalkeeper is optional; ANY is allowed. Every club has the same deadline, including clubs applying on the last registration day. Admin can inspect applications under Open registration → Review registration applications."]),
('17-placement-cycle',
 ['De eerste plaatsing voorbereiden', 'Préparer le placement initial', 'Prepare initial sporting placement'],
 ["Na bevestiging en de gezamenlijke reserveperiode bepaalt het systeem het ondersteunde deelnemersveld. Open Placement & next season en selecteer de opgeslagen cyclus. Gebruik voor de eerste editie de plaatsingsroute. Bij zestig clubs worden tien groepen van zes gevormd: vijf wedstrijden per club, 150 totaal. Deze demonstratie gebruikt die zestigclubroute; de eerder besproken veertigclubroute is anders. Een opgeslagen loting blijft behouden bij opnieuw openen.",
  "Après confirmation et la période commune de réserves, le système détermine la structure possible. Ouvrez Placement & next season et choisissez le cycle enregistré. Pour la première édition, utilisez le placement initial. À 60 clubs : dix groupes de six, cinq matchs par club, 150 au total. La formule à 40 clubs discutée précédemment est différente. Une réouverture conserve le tirage enregistré.",
  "After confirmation and the shared reserve period, the system determines the supported field. Open Placement & next season and select the stored cycle. Use initial placement for the first edition. With 60 clubs: ten groups of six, five matches per club, 150 in total. The previously discussed 40-club format is different. Reopening a stored cycle preserves its draw."]),
('18-placement-calendar',
 ['Speeldata voor de plaatsing vastleggen', 'Fixer les dates du placement', 'Schedule the placement rounds'],
 ["De opgeslagen loting bepaalt tegenstanders, maar nog niet alle aftraptijden. Open de kalender van de plaatsingscyclus en vul per ronde een datum en tijd in. De demo gebruikt 26 februari, 27 februari en 1–3 maart om 20.00 Europe/Brussels. Controleer de preview en publiceer. In echte wedstrijden publiceren clubs hun opstelling, melden ze zich gereed en dienen ze na afloop bewijs en de gespeelde deelnemers in.",
  "Le tirage enregistré définit les adversaires, mais pas toutes les heures. Ouvrez le calendrier du cycle et renseignez chaque tour. La démonstration utilise les 26 et 27 février et les 1–3 mars à 20 h Europe/Brussels. Vérifiez l'aperçu puis publiez. En situation réelle, les clubs publient leur composition, se déclarent prêts et déclarent ensuite preuves et joueurs ayant participé.",
  "The saved draw defines opponents, but not every kickoff time. Open the placement cycle calendar and enter each round's date and time. The demonstration uses 26–27 February and 1–3 March at 20:00 Europe/Brussels. Review and publish. In real matches, clubs publish their lineups, mark ready, then submit evidence and actual participants after playing."]),
('20-allocation-three-groups',
 ['Van resultaten naar D1A, D2A en D2B', 'Des résultats vers D1A, D2A et D2B', 'Allocate D1A, D2A and D2B from results'],
 ["Wacht op definitieve resultaten en eventuele beslissingsduels. Bekijk de definitieve verdeling en bevestig de opgeslagen toewijzing. In deze demo levert de plaatsing drie groepen van twintig op. D2A en D2B delen dezelfde vaste D2-identiteit en trofee. De wedstrijden zijn gesimuleerd via de echte resultaatprocedure; er zijn geen EA-wedstrijden gespeeld of standen rechtstreeks ingevuld.",
  "Attendez les résultats définitifs et les éventuels matchs décisifs. Vérifiez puis confirmez la répartition enregistrée. Ici, le placement produit trois groupes de vingt. D2A et D2B partagent l'identité permanente D2 et son trophée. Les résultats ont été simulés via la vraie procédure de l'application ; aucun match EA n'a été joué et aucun classement n'a été rempli directement.",
  "Wait for final results and any decision matches. Review and confirm the saved allocation. This placement produces three groups of twenty. D2A and D2B share the permanent D2 identity and trophy. Results were simulated through the application's real result workflow; no EA games were played and no standings were directly populated."]),
('22-calendar-preview',
 ['Loting is niet hetzelfde als kalenderpublicatie', 'Le tirage ne publie pas les horaires', 'Drawing fixtures does not publish kickoff times'],
 ["Open Prepare this season calendar vanuit de opgeslagen verdeling. Vul Reason in, bevestig de draw en klik voor elke groep Draw this group’s fixtures. Herhaal dit voor D1A, D2A én D2B. Elke groep krijgt 380 heen- en terugwedstrijden. Kies de eerste speelmaandag en Preview season calendar. De preview moet alle drie groepen bevatten: 1.140 wedstrijden. Bekijk de 38 rondetijden en eventuele blokkades voordat je publiceert.",
  "Ouvrez Prepare this season calendar depuis la répartition enregistrée. Renseignez Reason, confirmez le tirage et utilisez Draw this group’s fixtures pour D1A, D2A et D2B. Chaque groupe reçoit 380 matchs aller-retour. Choisissez le premier lundi et Preview season calendar. L'aperçu doit couvrir les trois groupes : 1 140 matchs. Examinez les 38 horaires de journées et tout blocage avant publication.",
  "Open Prepare this season calendar from the stored allocation. Enter Reason, confirm the draw and use Draw this group’s fixtures for D1A, D2A and D2B. Each group receives 380 home-and-away fixtures. Choose the first playing Monday and Preview season calendar. The preview must cover all three groups: 1,140 matches. Review the 38 round times and any blockers before publishing."]),
('23-calendar-published',
 ['Publiceer de complete leaguekalender', 'Publier le calendrier complet', 'Publish the complete league calendar'],
 ["Vink de kalenderbevestiging aan en kies Publish complete calendar. Controleer de melding dat wedstrijden en GameDay gekoppeld zijn. Europa gebruikt dinsdag/donderdag 20.00 en 20.40 Europe/Brussels, met blokken van veertig minuten. De 38 rondes liggen over tien speelweken. Week 11 is voor promotie; week 12 bevat onder meer de bekerfinale. De demo controleert opgeslagen meldingen, niet of spelers die werkelijk gelezen hebben.",
  "Cochez la confirmation et choisissez Publish complete calendar. Vérifiez le message de liaison avec GameDay. En Europe : mardi/jeudi à 20 h et 20 h 40 Europe/Brussels, blocs de quarante minutes, 38 journées sur dix semaines. La semaine 11 est réservée à la promotion ; la semaine 12 comprend notamment la finale de Coupe. Les notifications enregistrées ne prouvent pas leur lecture.",
  "Tick confirmation and choose Publish complete calendar. Verify that fixtures and GameDay matches are linked. Europe uses Tuesday/Thursday at 20:00 and 20:40 Europe/Brussels, in forty-minute blocks, with 38 rounds over ten playing weeks. Week 11 is for promotion; week 12 includes the Cup final. Stored notification counts do not prove that players read them."]),
('24-cup-calendar',
 ['Eén beker voor alle groepen', 'Une Coupe pour tous les groupes', 'One Cup for all regional groups'],
 ["Kies Regional Cups. Selecteer de vaste Cup en de gepubliceerde leaguekalender. De trofee komt uit dezelfde catalogus als league- en GOST-trofeeën. Review participants and Cup calendar verzamelt de zestig bevestigde clubs die de bekervoorwaarden aanvaardden. De zes rondes staan op zondag in weken 2/4/6/8/10/12. Save draft and record the first draw bewaart vier byes en 28 eerste-rondewedstrijden. Dit start de beker nog niet.",
  "Choisissez Regional Cups, la Coupe permanente et le calendrier de ligue publié. Le trophée vient du même catalogue que ceux des ligues et de GOST. Review participants and Cup calendar rassemble les 60 clubs confirmés ayant accepté les conditions. Les six tours sont le dimanche en semaines 2/4/6/8/10/12. Save draft and record the first draw enregistre quatre exemptions et 28 matchs au premier tour, sans encore lancer la Coupe.",
  "Choose Regional Cups, the permanent Cup and the published league calendar. Its trophy uses the same catalogue flow as leagues and GOST. Review participants and Cup calendar collects all 60 confirmed clubs that accepted Cup entry. The six rounds fall on Sundays in weeks 2/4/6/8/10/12. Save draft and record the first draw stores four byes and 28 first-round matches, without starting the Cup yet."]),
('27-cup-running',
 ['Beker activeren en volgen', 'Activer et suivre la Coupe', 'Activate and follow the Cup'],
 ["Ga naar Manage existing edition of Next: review activation. Selecteer de concepteditie, kies Review activation, lees de preview en vul een reden in. Na bevestiging start Activate Cup de eerste ronde in GameDay. De volgende open loting volgt automatisch zodra de vorige ronde definitief is. Een volledige beker met zestig clubs telt 59 gespeelde duels. GOST geeft deze beker geen automatisch toegangsticket.",
  "Ouvrez Manage existing edition ou Next: review activation. Choisissez le brouillon, Review activation, puis examinez l'aperçu et indiquez un motif. Après confirmation, Activate Cup crée le premier tour dans GameDay. Le tirage suivant intervient automatiquement après les résultats définitifs du tour précédent. À 60 clubs, une Coupe complète compte 59 matchs joués. Elle ne donne aucun billet GOST automatique.",
  "Open Manage existing edition or Next: review activation. Select the draft, choose Review activation, inspect it and enter a reason. After confirmation, Activate Cup adds the first round to GameDay. The next open draw follows automatically when the previous round is final. A complete 60-club Cup has 59 played matches. It provides no automatic GOST ticket."]),
('30-league-table',
 ['Wat clubs op de website zien', 'Ce que voient les clubs', 'What clubs see on the website'],
 ["Compete → Regional Leagues toont de regio, trofeeën en afzonderlijke groepen. Explore league opent Overview, Clubs, Stages, Table, Stats, Rewards en History. Table toont onder meer punten, gespeelde wedstrijden en de sportieve route. In deze zestigclubstructuur degraderen de onderste vier uit D1; uit elke D2-groep promoveren de kampioen en één play-offwinnaar. D2 heeft geen degradatie naar een nog niet bestaande D3.",
  "Compete → Regional Leagues affiche région, trophées et groupes. Explore league ouvre Overview, Clubs, Stages, Table, Stats, Rewards et History. Table montre points, matchs joués et parcours sportif. Dans cette structure à 60 clubs, les quatre derniers de D1 descendent ; chaque groupe D2 fait monter son champion et un vainqueur de barrage. Il n'y a pas de relégation D2 vers une D3 inexistante.",
  "Compete → Regional Leagues shows regions, trophies and individual groups. Explore league opens Overview, Clubs, Stages, Table, Stats, Rewards and History. Table shows points, games played and sporting routes. In this 60-club structure, the bottom four D1 clubs are relegated; each D2 group promotes its champion and one play-off winner. D2 does not relegate into a nonexistent D3."]),
('32-player-statistics',
 ['Statistieken komen uit het wedstrijdverslag', 'Les statistiques viennent du rapport de match', 'Statistics come from the match report'],
 ["Stats → Clubs toont clubtotalen. Individual Players toont goals, assists, beoordelingen en deelnames; kies de ranglijst bij Ranking. Alleen een uitslag invullen is niet genoeg voor spelersstatistieken: de werkelijke deelnemers en hun club, goals en assists moeten in het verslag staan. De demo registreert drie spelers per club en gebruikt synthetische doelpunten. Dit zijn verklaringen binnen STAGE, geen automatische verificatie door EA.",
  "Stats → Clubs montre les totaux des clubs. Individual Players affiche buts, passes, notes et participations ; Ranking choisit le classement. Un score seul ne suffit pas : le rapport doit identifier les participants effectifs, leur club, les buts et les passes. La démonstration déclare trois joueurs par club et des buts synthétiques. Ce sont des déclarations STAGE, pas une vérification automatique par EA.",
  "Stats → Clubs shows club totals. Individual Players shows goals, assists, ratings and appearances; choose a leaderboard under Ranking. A score alone is insufficient: the report must identify actual participants and their club, goals and assists. The demonstration declares three players per club with synthetic goals. These are STAGE declarations, not automatic EA verification."]),
]

chapters.extend([
('35-cup-completed',
 ['Controleer de volledige beker', 'Vérifier la Coupe complète', 'Verify the complete Cup'],
 ["De publieke bekerpagina toont na de finale Completed en de kampioen. In de demo zijn alle zes rondes afgerond: 28 + 16 + 8 + 4 + 2 + 1 = 59 wedstrijden. Vier byes tellen niet als gespeelde wedstrijden of spelersdeelnames. Gebruik Stages & results voor de rondes en History voor andere edities.",
  "Après la finale, la page publique affiche Completed et le champion. Les six tours de la démonstration sont terminés : 28 + 16 + 8 + 4 + 2 + 1 = 59 matchs. Les quatre exemptions ne sont ni des matchs joués ni des participations de joueurs. Stages & results affiche les tours ; History donne accès aux autres éditions.",
  "After the final, the public Cup page shows Completed and its champion. All six demonstration rounds finished: 28 + 16 + 8 + 4 + 2 + 1 = 59 matches. The four byes are neither played games nor player appearances. Use Stages & results for rounds and History for other editions."]),
('36-cup-rewards',
 ['Beloningen en trofee controleren', 'Vérifier récompenses et trophée', 'Verify rewards and the trophy'],
 ["Rewards toont 7.000.000 STC voor de winnaar en 3.000.000 STC voor de finalist, gefinancierd door STAGE. Geen derdeplaatsprijs en geen extra bekerinschrijfgeld. De demo toont Payment status: paid en Trophy: awarded. In Admin vind je de bijbehorende controle onder Regional Cups → Review rewards. Dit zijn uitsluitend STC-boekingen in de lokale testdatabase, geen echte betalingen. Pas bestaande beloningen niet opnieuw toe omdat je de pagina opnieuw opent.",
  "Rewards affiche 7 000 000 STC au vainqueur et 3 000 000 STC au finaliste, financés par STAGE. Aucun prix de troisième place ni frais supplémentaires de Coupe. La démonstration affiche Payment status: paid et Trophy: awarded. Dans Admin : Regional Cups → Review rewards. Il s'agit uniquement d'écritures STC locales, pas de paiements réels. Ne réattribuez pas les récompenses en rouvrant la page.",
  "Rewards shows 7,000,000 STC for the winner and 3,000,000 STC for the finalist, funded by STAGE. No third-place prize or additional Cup entry fee. The demonstration shows Payment status: paid and Trophy: awarded. In Admin, use Regional Cups → Review rewards. These are local test STC ledger entries, not real payments. Reopening a page is not a reason to issue rewards again."]),
('39-promotion-allocation',
 ['Promotie en degradatie volgen', 'Suivre promotion et relégation', 'Follow promotion and relegation'],
 ["Voor seizoen 2 hebben dezelfde zestig clubs opnieuw ingeschreven en bevestigd. De definitieve league-eindstanden leveren vier promotiehalvefinales op, gevolgd door twee finales. Per D2-groep spelen 2 tegen 5 en 3 tegen 4; de winnaar van de finale promoveert samen met de kampioen. In de demo promoveren Demo Club 12, 16, 17 en 22. Demo Club 20, 23, 34 en 37 dalen uit D1. De opgeslagen overgangscyclus bewaart de sportieve toewijzing; er komt geen nieuwe eerste plaatsing voor bestaande clubs.",
  "Les mêmes 60 clubs se réinscrivent et confirment pour la saison 2. Les classements définitifs produisent quatre demi-finales puis deux finales de promotion. Dans chaque groupe D2 : 2 contre 5 et 3 contre 4 ; le vainqueur de finale monte avec le champion. Ici, Demo Club 12, 16, 17 et 22 montent ; Demo Club 20, 23, 34 et 37 descendent. Le cycle de transition conserve l'attribution sportive ; les clubs existants ne refont pas un placement initial.",
  "The same 60 clubs renewed and confirmed for season 2. Final league standings produce four promotion semifinals and two finals. In each D2 group: 2 plays 5 and 3 plays 4; the final winner joins the champion in promotion. Demo Club 12, 16, 17 and 22 were promoted; Demo Club 20, 23, 34 and 37 were relegated. The stored transition cycle preserves sporting allocation; existing clubs do not repeat initial placement."]),
('38-season-selector',
 ['Een nieuw seizoen, dezelfde vaste league', 'Une nouvelle saison, la même ligue', 'A new season in the same permanent league'],
 ["De automatische overgang heeft D1A, D2A en D2B voor seizoen 2 gevuld met elk twintig clubs, de volgende leaguekalender gepubliceerd en de volgende beker voorbereid en geactiveerd. De eerste wedstrijd van seizoen 2 is ook bevestigd in de demo. De vaste D1- en D2-identiteiten en hun trofeeën zijn gelijk gebleven. De editiekiezer laat seizoen 1 en seizoen 2 zien; dat zijn verschillende seizoenen, geen dubbele onafhankelijke leagues.",
  "La transition automatique remplit D1A, D2A et D2B de 20 clubs pour la saison 2, publie le calendrier suivant et prépare puis active la prochaine Coupe. Un premier match de saison 2 est également confirmé dans la démonstration. Les identités permanentes D1/D2 et leurs trophées restent identiques. Le sélecteur donne accès aux saisons 1 et 2 : ce sont des éditions, pas des ligues indépendantes en double.",
  "Automatic rollover filled D1A, D2A and D2B with 20 clubs each for season 2, published the next league calendar and prepared and activated the next Cup. The demonstration also confirmed the first season-2 match. Permanent D1/D2 identities and their trophies stayed the same. The selector exposes seasons 1 and 2 as separate editions, not duplicate independent leagues."]),
('40-admin-handbook',
 ['Waar je alles terugvindt', 'Où tout retrouver', 'Where to find everything'],
 ["Admin → Regional Leagues → Admin handbook · EN / FR / NL opent deze handleidingen. Start guided task opent de wizards. Leagues & Cups → Manage league bevat Setup & actions, Fixtures & results en Standings. Regional Cups bevat voorbereiding, activering en Review rewards. Officiële uitzonderingen staan apart bij Official decisions; reset en verwijderen zijn geen normale seizoenstappen. De drie handleidingen hebben dezelfde stappen en screenshots. De appteksten blijven standaard Engels.",
  "Admin → Regional Leagues → Admin handbook · EN / FR / NL ouvre ces guides. Start guided task ouvre les assistants. Leagues & Cups → Manage league propose Setup & actions, Fixtures & results et Standings. Regional Cups regroupe préparation, activation et Review rewards. Les exceptions sont dans Official decisions ; réinitialiser ou supprimer n'est pas une étape normale de saison. Les trois versions gardent les mêmes étapes et captures. L'interface reste en anglais par défaut.",
  "Admin → Regional Leagues → Admin handbook · EN / FR / NL opens these guides. Start guided task opens the wizards. Leagues & Cups → Manage league contains Setup & actions, Fixtures & results and Standings. Regional Cups contains preparation, activation and Review rewards. Exceptions belong in Official decisions; reset and deletion are not normal season steps. All three guides share the same steps and screenshots. Default application text remains English."]),
])

fields = [
 ('Name','Demo Premier Division', 'Leesbare naam van de vaste league.', 'Nom lisible de la ligue permanente.', 'Display name of the permanent league.'),
 ('Regional system slug','uk-ireland','Technische regiocode. Gebruik dezelfde code voor D1, D2 en de Cup.','Code régional. Utilisez le même pour D1, D2 et la Coupe.','Regional key. Use the same key for D1, D2 and the Cup.'),
 ('Platform','cross-platform','Platformbereik; dezelfde waarde binnen dit systeem.','Périmètre de plateforme, identique dans ce système.','Platform scope; keep it consistent within the system.'),
 ('Division','1 / 2','Het niveau, niet het aantal groepen. D2B blijft Division 2.','Le niveau, pas le nombre de groupes. D2B reste Division 2.','The tier, not the group count. D2B is still Division 2.'),
 ('Capacity','20','Clubs per groep, niet het totale regionale deelnemersveld.','Clubs par groupe, pas le total régional.','Clubs per group, not total regional capacity.'),
 ('Linked division slug','uk-ireland-div-1','Alleen de bestaande gekoppelde divisiecode gebruiken als die route nodig is. Niet zelf een nieuwe regiocode verzinnen.','Utiliser seulement le code de division lié existant si nécessaire. Ne pas inventer de région.','Use the existing linked division key when needed; do not invent another region.'),
 ('Default trophy','Demo D1 Trophy','Bestaand item uit Trophies. Toewijzen toont de trofee; het kent nog geen prijs toe.','Élément existant dans Trophies. Lier ne signifie pas attribuer un prix.','Existing Trophies item. Assignment displays the trophy; it does not award it.'),
 ('Rules (JSON) / Reward defaults (JSON)','{}','Geavanceerd en optioneel. Laat staan tenzij je de ondersteunde configuratie kent; gewone deelnamevoorwaarden staan bij registratie.','Avancé et facultatif. Ne modifier qu’avec une configuration prise en charge ; les conditions normales sont dans l’inscription.','Advanced and optional. Leave unchanged unless using a supported configuration; normal participation terms belong in registration.'),
 ('Reason / Administrative reason','Training: first regional season','Verplichte uitleg voor het auditlog; geen tekst die je als algemene regel aan spelers belooft.','Motif obligatoire pour l’audit ; pas une règle générale promise aux joueurs.','Required audit explanation, not a general rule promised to players.'),
 ('Regional system','uk-ireland · cross-platform','Ingang voor alle divisies en groepen in deze regio/platformcombinatie.','Point d’entrée de toutes les divisions et groupes de cette région/plateforme.','Entry point for all divisions and groups in this regional/platform system.'),
 ('Target season','1','Editienummer. Verhoog dit niet door een nieuwe vaste league te maken.','Numéro d’édition. Ne pas créer une nouvelle ligue permanente pour le changer.','Edition number. Do not create another permanent league to change seasons.'),
 ('Reset series','0','Identiteit van een resetreeks. Geen gewone seizoensknop; voor een normale nieuwe editie niet wijzigen.','Identité d’une série réinitialisée. Ne pas modifier pour une saison normale.','Reset-series identity, not a normal season control. Leave unchanged for ordinary rollover.'),
 ('Registration opens (your local time)','18 Jan 2027, 01:00 Brussels','Start van vier weken inschrijving. De preview rekent de gezamenlijke bevestigingsdeadlines uit.','Début des quatre semaines d’inscription. L’aperçu calcule les échéances communes.','Start of four registration weeks. Preview calculates the shared confirmation deadlines.'),
 ('First league playing Monday (optional)','2027-03-15','Eerste week van de league, na reserves en benodigde plaatsing. Zonder datum kan automatische publicatie wachten op Admin.','Première semaine de ligue, après réserves et placement nécessaire. Sans date, la publication peut attendre Admin.','First league week after reserves and any required placement. Without it, automatic publication can wait for Admin.'),
 ('Include Regional Cup entry','checked','Vermeldt de automatische bekerdeelname vooraf in de geaccepteerde voorwaarden.','Annonce la participation automatique à la Coupe dans les conditions acceptées.','Includes automatic Cup entry in the conditions clubs accept beforehand.'),
 ('Published edition rules','Schedule + minimum players + format','Nuttige editievoorwaarden; lees ook de door de server toegevoegde regels in de preview.','Conditions utiles de l’édition ; lire aussi les règles ajoutées par le serveur.','Edition terms; also read the server-appended policies in the preview.'),
 ('Saved cycle','region / series / season','Hervat de bestaande opgeslagen loting en verdeling. Geen nieuwe cyclus maken omdat je opnieuw opent.','Reprend le tirage et la répartition existants. Ne pas recréer un cycle à chaque ouverture.','Resumes the stored draw and allocation. Reopening does not require another cycle.'),
 ('Confirmed field / Target count','60','Definitief bevestigde clubs; geen schatting van toekomstige inschrijvingen.','Clubs définitivement confirmés, pas une estimation future.','The confirmed field, not a forecast of future registrations.'),
 ('Source groups','D1A, D2A, D2B','Voor een volgende editie: alle bijbehorende huidige groepen, met definitieve resultaten.','Pour l’édition suivante : tous les groupes sources et leurs résultats définitifs.','For a subsequent edition: all current source groups with final results.'),
 ('Round date / time','20:00 Europe/Brussels','Werkelijke aftrap van die plaatsings- of beslissingsronde. Controleer de tijdzone.','Heure effective de ce tour de placement ou de décision. Vérifier le fuseau.','Actual kickoff for that placement or decision round. Verify the timezone.'),
 ('Monday of the first playing week (Europe/Brussels)','2027-03-15','Kalenderanker voor alle geselecteerde leaguegroepen samen.','Lundi de référence de tous les groupes sélectionnés.','Calendar anchor for all selected league groups together.'),
 ('Published league calendar','2027-03-15 · 3 groups','Bron van de bekerdeelnemers en speelweken; niet een willekeurige andere editie.','Source des participants et semaines de Coupe ; pas une autre édition arbitraire.','Source of Cup participants and playing weeks; do not choose an unrelated edition.'),
 ('Cup edition','Season 1 · draft','De seizoenseditie die je voorbereidt, activeert of voor beloningen bekijkt.','Édition saisonnière à préparer, activer ou consulter pour les récompenses.','The seasonal edition being prepared, activated or reviewed for rewards.'),
 ('Expected revision / preview','automatic','Technische versiecontrole uit de preview. Bij gewijzigde gegevens opnieuw bekijken; geen blokkade omzeilen.','Version technique issue de l’aperçu. Si les données changent, refaire l’aperçu.','Technical preview version. Refresh the preview after changes; do not bypass a blocker.'),
]

extra = {
 'nl': ['Veldwijzer', 'Wat betekent dit?', 'Voorbeeld', 'Wie doet wat?',
  'Admin kiest vooraf regio, vaste leagues, trofeeën, datum en editievoorwaarden. Clubs schrijven zich in, bevestigen hun spelers, spelen en leveren bewijs. De server bewaart lotingen, verwerkt bevestigde uitslagen, berekent standen en bereidt ondersteunde vervolgstappen voor. Geschillen, terugtrekkingen, sancties en financiële uitzonderingen blijven expliciete Adminbeslissingen. GOST en D3 worden door deze demo niet geopend.',
  'De volgende editie',
  'De gewone herinschrijving begint in speelweek 5 en duurt tot het einde van week 8. Week 9 is deelnamebevestiging; de gezamenlijke reserveperiode duurt maximaal 48 uur. Promotieplay-offs liggen in week 11: dinsdag halve finales, donderdag finales, 20.00 Europe/Brussels. De nieuwe league begint na week 12 en één overgangsweek. Gebruik nooit Fresh-start reset als gewone knop voor het volgende seizoen. Vaste league-identiteit en standaardtrofee blijven behouden; historische edities blijven apart raadpleegbaar.',
  'Bewijs en grenzen',
  'Deze handleiding gebruikt echte screenshots van een lokale training met fictieve clubs, een versnelde klok en gesimuleerde uitslagen. De Admin-inrichting is via de website doorlopen. Bulkregistraties en wedstrijdafhandeling zijn expliciet door een testhulp via bestaande beveiligde acties uitgevoerd. Er is geen echte e-mail verzonden, geen EA-koppeling aangetoond en geen productiedeployment uitgevoerd. Een trainingsdemo bewijst niet alle uitzonderingen of productieschaal.',
  'Handleiding', 'Print / bewaar als PDF'],
 'fr': ['Dictionnaire des champs', 'Signification', 'Exemple', 'Qui fait quoi ?',
  'Admin choisit région, ligues permanentes, trophées, date et conditions. Les clubs s’inscrivent, confirment leurs joueurs, jouent et fournissent leurs preuves. Le serveur conserve les tirages, traite les résultats confirmés, calcule les classements et prépare les suites prises en charge. Litiges, retraits, sanctions et exceptions financières exigent une décision Admin explicite. Cette démonstration n’ouvre ni GOST ni D3.',
  'L’édition suivante',
  'La réinscription commence en semaine 5 et se termine après la semaine 8. La semaine 9 sert à confirmer ; la période commune de réserves dure au plus 48 heures. Barrages en semaine 11 : demi-finales mardi, finales jeudi, 20 h Europe/Brussels. La ligue suivante commence après la semaine 12 et une semaine de transition. N’utilisez jamais Fresh-start reset pour un passage de saison normal. L’identité permanente et le trophée par défaut restent ; les anciennes éditions demeurent consultables.',
  'Preuves et limites',
  'Ce guide utilise de vraies captures d’une formation locale avec clubs fictifs, horloge accélérée et scores simulés. Les opérations Admin ont été effectuées à l’écran. Les inscriptions en masse et les matchs utilisent explicitement un outil de test et les actions sécurisées existantes. Aucun véritable e-mail, aucune intégration EA démontrée et aucun déploiement de production. Cette démonstration ne prouve pas toutes les exceptions ni la capacité à grande échelle.',
  'Guide', 'Imprimer / enregistrer en PDF'],
 'en': ['Field dictionary', 'Meaning', 'Example', 'Who does what?',
  'Admin chooses the region, permanent leagues, trophies, date and edition conditions. Clubs apply, confirm players, play and provide evidence. The server stores draws, processes confirmed results, calculates standings and prepares supported next steps. Disputes, withdrawals, sanctions and financial exceptions remain explicit Admin decisions. This demonstration opens neither GOST nor D3.',
  'The next edition',
  'Renewal opens in playing week 5 and runs through week 8. Week 9 is confirmation; the shared reserve period lasts at most 48 hours. Promotion play-offs are in week 11: Tuesday semifinals and Thursday finals, 20:00 Europe/Brussels. The next league starts after week 12 and one transition week. Never use Fresh-start reset for normal season rollover. Permanent league identity and its default trophy stay; historical editions remain available separately.',
  'Evidence and limits',
  'This handbook uses actual screenshots from local training with synthetic clubs, accelerated time and simulated scores. Admin setup was performed on the website. Bulk registration and match processing explicitly used a test helper and existing protected application actions. No real emails were sent, no EA integration was demonstrated and nothing was deployed to production. A training run does not prove every exception or production scale.',
  'Handbook', 'Print / save PDF'],
}

# Disclose the simulator's initial metadata omission; do not present partial
# per-competition player totals as a full statistical acceptance result.
extra['nl'][8] += ' In de eerste testbatch ontbrak de clubvermelding bij spelersstatistieken. Die testhulp is gecorrigeerd; de individuele competitiebeelden tonen alleen de latere correct gekoppelde verslagen. De volledige spelersstatistiek over het hele seizoen is daarom niet als geslaagd afgetekend.'
extra['fr'][8] += ' Le premier lot simulé omettait le club dans les statistiques individuelles. L’outil a été corrigé ; les images individuelles ne couvrent que les rapports ultérieurs correctement liés. Les statistiques individuelles de toute la saison ne sont donc pas validées intégralement.'
extra['en'][8] += ' The first simulated batch omitted club metadata in player statistics. The helper was corrected; individual competition screenshots cover only the subsequent correctly linked reports. Full-season individual statistics are therefore not signed off as a complete acceptance pass.'

def generate():
    for stem, _, _ in chapters:
        image = SHOTS / f'{stem}.jpg'
        if image.exists(): shutil.copy2(image, OUT / 'images' / image.name)
    css = '''*{box-sizing:border-box}body{font:16px/1.65 system-ui,sans-serif;margin:0;color:#183042;background:#f3f6f8}header,main{max-width:1050px;margin:auto;padding:32px}header{background:#0b1828;color:white;max-width:none}header>div{max-width:986px;margin:auto}h1{font-size:38px;line-height:1.2}h2{line-height:1.25}nav{display:flex;flex-wrap:wrap;gap:18px}a{color:#08758c}header a{color:#8be6ee}.tag{font-size:12px;letter-spacing:.15em}article{background:white;border:1px solid #d6e0e6;padding:28px;margin:28px 0;scroll-margin:20px}article img{display:block;width:100%;height:auto;border:1px solid #ced7df;margin-top:22px}figcaption{font-size:12px;color:#546875}table{border-collapse:collapse;width:100%;font-size:14px}th,td{border-bottom:1px solid #d6e0e6;vertical-align:top;padding:12px;text-align:left}th{background:#e8f1f5}td:first-child{font-weight:650;width:25%}td:nth-child(2){width:25%;overflow-wrap:anywhere}.notice{border-left:4px solid #167d91;padding:14px 20px;background:#e6f3f6}button{padding:10px 16px;cursor:pointer}@media print{body{background:white;font-size:11pt}header,main{padding:0}header{background:white;color:#183042}header a{color:#183042}.no-print{display:none}article{break-before:page;border:0;padding:0;margin:0}img{max-height:155mm;object-fit:contain}table{font-size:9pt}tr{break-inside:avoid}a{color:inherit}}'''
    (OUT/'style.css').write_text(css)
    for index,lang in enumerate(['nl','fr','en']):
        x=extra[lang]
        parts=[f'<!doctype html><html lang="{lang}"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>STAGE · {x[9]}</title><link rel="stylesheet" href="style.css"><header><div><p class="tag">STAGE / REGIONAL LEAGUES / 09–10 NOV 2026</p><h1>{x[9]} · Admin</h1><nav><a href="guide-nl.html">Nederlands</a><a href="guide-fr.html">Français</a><a href="guide-en.html">English</a><a href="guide-{lang}.pdf">PDF</a></nav></div></header><main><p class="notice">{x[8]}</p><p class="no-print"><button onclick="window.print()">{x[10]}</button></p><ol>']
        parts += [f'<li><a href="#step-{n}">{html.escape(titles[index])}</a></li>' for n,(_,titles,_) in enumerate(chapters,1)]
        parts += [f'</ol><p><a href="#fields">{x[0]}</a></p>']
        for n,(stem,titles,texts) in enumerate(chapters,1):
            parts.append(f'<article id="step-{n}"><p class="tag">STAGE / {n:02}</p><h2>{n:02} · {html.escape(titles[index])}</h2><p>{html.escape(texts[index])}</p>')
            if (OUT/'images'/f'{stem}.jpg').exists(): parts.append(f'<figure><img src="images/{stem}.jpg" alt="{html.escape(titles[index])}" loading="lazy"><figcaption>{n:02} · {stem} · LOCAL TRAINING</figcaption></figure>')
            parts.append('</article>')
        parts.append(f'<article id="fields"><h2>{x[0]}</h2><table><thead><tr><th>UI label</th><th>{x[2]}</th><th>{x[1]}</th></tr></thead><tbody>')
        for row in fields: parts.append('<tr>'+''.join(f'<td>{html.escape(str(v))}</td>' for v in [row[0],row[1],row[index+2]])+'</tr>')
        parts.append(f'</tbody></table></article><article><h2>{x[3]}</h2><p>{x[4]}</p><h2>{x[5]}</h2><p>{x[6]}</p><h2>{x[7]}</h2><p>{x[8]}</p></article></main></html>')
        (OUT/f'guide-{lang}.html').write_text(''.join(parts))
    (OUT/'index.html').write_text('''<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>STAGE Admin handbook</title><link rel="stylesheet" href="style.css"><header><div><p class="tag">STAGE / ADMIN TRAINING</p><h1>Regional competition handbook</h1><p>Follow the same illustrated walkthrough in your preferred language.</p></div></header><main><article><h2>Choose your language</h2><nav><a href="guide-nl.html">Nederlands</a><a href="guide-fr.html">Français</a><a href="guide-en.html">English</a></nav><p>60 demonstration clubs · D1A + D2A + D2B · Regional Cup</p><p>Actual local screenshots. Synthetic clubs, accelerated time and simulated results. English UI labels are retained in all three versions.</p><p>Download: <a href="guide-nl.pdf">PDF Nederlands</a> · <a href="guide-fr.pdf">PDF Français</a> · <a href="guide-en.pdf">PDF English</a></p></article></main></html>''')

def pdf():
    from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Image, PageBreak, Table, TableStyle, KeepTogether
    from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
    from reportlab.lib import colors
    from reportlab.lib.pagesizes import A4
    from reportlab.pdfbase import pdfmetrics
    from reportlab.pdfbase.ttfonts import TTFont
    from PIL import Image as PILImage
    font_root=Path('/System/Library/Fonts/Supplemental')
    pdfmetrics.registerFont(TTFont('Guide',str(font_root/'Arial.ttf')))
    pdfmetrics.registerFont(TTFont('GuideBold',str(font_root/'Arial Bold.ttf')))
    pdfmetrics.registerFontFamily('Guide',normal='Guide',bold='GuideBold',italic='Guide',boldItalic='GuideBold')
    styles=getSampleStyleSheet()
    for key in ['Normal','BodyText','Title','Heading1','Heading2','Heading3']:
        styles[key].fontName='GuideBold' if key.startswith('Heading') or key=='Title' else 'Guide'
        styles[key].textColor=colors.HexColor('#183042')
    styles['BodyText'].fontSize=11;styles['BodyText'].leading=17
    small=ParagraphStyle('SmallGuide',parent=styles['BodyText'],fontSize=8.5,leading=12)
    def p(text,style='BodyText'): return Paragraph(html.escape(text),styles[style])
    for i,lang in enumerate(['nl','fr','en']):
        x=extra[lang]; story=[p('STAGE / ADMIN TRAINING','Heading3'),Spacer(1,20),p(x[9]+' · Regional Leagues','Title'),Spacer(1,20),p('60 clubs · D1A / D2A / D2B · Regional Cup','Heading2'),p(x[8]),Spacer(1,18),p('09–10 November 2026 · English UI labels · NL / FR / EN','BodyText')]
        story += [PageBreak(),p('Contents / Inhoud / Sommaire','Heading1')]
        for n,(_,t,_) in enumerate(chapters,1):story.append(p(f'{n:02} · {t[i]}'))
        for n,(stem,t,texts) in enumerate(chapters,1):
            story += [PageBreak(),p(f'{n:02} / STAGE','Heading3'),p(t[i],'Heading1'),p(texts[i]),Spacer(1,18)]
            image=OUT/'images'/f'{stem}.jpg'
            if image.exists():
                with PILImage.open(image) as im:w,h=im.size
                width=499;height=width*h/w
                if height>430:width*=430/height;height=430
                story.append(Image(str(image),width=width,height=height))
                story += [Spacer(1,8),Paragraph(f'{n:02} · {stem} · LOCAL TRAINING',small)]
        story += [PageBreak(),p(x[0],'Heading1')]
        rows=[[p('UI label'),p(x[2]),p(x[1])]]
        rows += [[Paragraph(html.escape(str(v)),small) for v in [r[0],r[1],r[i+2]]] for r in fields]
        table=Table(rows,colWidths=[129,118,252],repeatRows=1,hAlign='LEFT')
        table.setStyle(TableStyle([('BACKGROUND',(0,0),(-1,0),colors.HexColor('#e6f3f6')),('VALIGN',(0,0),(-1,-1),'TOP'),('BOTTOMPADDING',(0,0),(-1,-1),11),('TOPPADDING',(0,0),(-1,-1),8),('LINEBELOW',(0,0),(-1,-1),.4,colors.HexColor('#d3dee4'))]))
        story += [table,PageBreak(),p(x[3],'Heading1'),p(x[4]),Spacer(1,14),p(x[5],'Heading2'),p(x[6]),Spacer(1,14),p(x[7],'Heading2'),p(x[8])]
        def footer(c,doc):
            c.setFont('Guide',8);c.setFillColor(colors.HexColor('#546875'));c.drawString(48,25,'STAGE / REGIONAL ADMIN / '+lang.upper());c.drawRightString(A4[0]-48,25,str(doc.page))
        SimpleDocTemplate(str(OUT/f'guide-{lang}.pdf'),pagesize=A4,rightMargin=48,leftMargin=48,topMargin=42,bottomMargin=44,title=f'STAGE Regional Admin Handbook — {lang.upper()}',author='STAGE').build(story,onFirstPage=footer,onLaterPages=footer)

if __name__=='__main__':
    generate()
    pdf()
