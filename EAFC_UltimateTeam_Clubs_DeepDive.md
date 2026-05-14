# EA Sports FC — Ultimate Team & Clubs Pro

**Deep dive sur les mécaniques, l'économie et la monétisation, avec lecture comparative pour Stage League**

> Document de recherche — version 1.0
> Date : 13 mai 2026
> Auteur : synthèse réalisée pour Lutina
> Périmètre : EA Sports FC 26 (cycle 2025/26), avec rappels historiques FIFA Ultimate Team

---

## Table des matières

1. [Vue d'ensemble : deux modes, deux philosophies](#1-vue-densemble--deux-modes-deux-philosophies)
2. [Ultimate Team — mécaniques de base](#2-ultimate-team--mécaniques-de-base)
3. [Ultimate Team — économie et monétisation](#3-ultimate-team--économie-et-monétisation)
4. [Clubs Pro — mécaniques et progression](#4-clubs-pro--mécaniques-et-progression)
5. [Boucles de rétention et game design](#5-boucles-de-rétention-et-game-design)
6. [Controverses et cadre réglementaire](#6-controverses-et-cadre-réglementaire)
7. [Lecture comparative pour Stage League](#7-lecture-comparative-pour-stage-league)
8. [Sources](#8-sources)

---

## 1. Vue d'ensemble : deux modes, deux philosophies

EA Sports FC (rebaptisé après la rupture avec la FIFA en 2023) fait coexister deux modes en ligne massivement joués mais structurellement opposés :

| Axe | **Ultimate Team (FUT / UT)** | **Clubs Pro (Clubs)** |
|---|---|---|
| Identité du joueur | Manager — tu collectionnes des cartes de joueurs réels | Avatar — tu **es** un seul joueur sur le terrain |
| Unité de jeu | Une équipe de cartes assemblées | Un footballeur custom dans une équipe de 11 humains |
| Boucle économique | Drop de cartes, marché des transferts, packs payants | Progression XP d'un archétype, déblocage perks |
| Monétisation | **FC Points** + packs (lootbox) | Cosmétiques et raccourcis d'archétypes |
| Type de progression | Court terme (saisons, promos hebdo) | Long terme (level 1 → 50, voire +) |
| Plaisir principal | Collection, optimisation, trading | Coopération, rôle, identification |

Ces deux modes représentent ensemble l'essentiel des revenus récurrents d'EA sur la franchise foot et tirent le design produit depuis ~10 ans. Comprendre l'un sans l'autre donne une image incomplète.

---

## 2. Ultimate Team — mécaniques de base

### 2.1 Le concept central

L'utilisateur construit une équipe en récupérant des **cartes de joueurs**, chacune ayant :

- une **note globale** (OVR, 47 à 99),
- 6 attributs principaux (Vit / Tir / Pas / Drib / Déf / Phys),
- une **nationalité, ligue, club**,
- des **PlayStyles** (traits actifs : Power Shot, Finesse, Trivela, Quickstep…) et **PlayStyles+** (versions premium),
- une **rareté** (Or, Or Rare, TOTW, Icon, Hero, TOTS…),
- un **prix marché** dynamique.

L'objectif est d'utiliser cette équipe en **Division Rivals**, **Champions** (le mode compétitif weekend) et **Squad Battles** (vs IA) pour grimper des classements et gagner des récompenses.

### 2.2 La chimie (Chemistry) — version FC 26

La chimie récompense la cohérence de ton équipe (joueurs de même club, ligue, nationalité). Plus deux joueurs partagent ces attributs, plus la chimie augmente.

Évolutions notables en FC 26 :

- Les **Chemistry Styles** donnent désormais des boosts de **+3 / +6 / +9** par attribut (contre +4 / +8 / +12 auparavant). EA a réduit le gap pour resserrer la méta.
- Le système **Cornerstones** désigne certains joueurs comme « pierres angulaires » : ils créent un **lien Club supplémentaire**, ce qui facilite la construction de chimie autour d'un noyau d'équipe.
- Les **Icons** (légendes) et **Heroes** continuent de lier avec tout le monde, ce qui en fait des pivots stratégiques.

### 2.3 Évolutions (Evolutions)

Mécanique introduite récemment et devenue centrale : tu choisis une carte dans ton club et tu lui fais grimper ses stats / PlayStyles / rôles en complétant des objectifs.

- Chaque Evolution a **2 à 4 étapes**.
- Les étapes débloquent des bonus cumulatifs (ex : +2 vitesse, +1 PlayStyle, nouveau rôle tactique).
- Certaines Evolutions permettent à un U23 à note 75 de devenir une bête à **91 OVR avec Icon Chemistry**, ce qui change totalement la méta du team-building.
- Critique communautaire : les Evolutions « cassent » la chimie classique et déprécient les cartes anciennement chères sur le marché.

### 2.4 Squad Building Challenges (SBC)

Les SBC sont des puzzles d'équipe : EA fixe des contraintes (nationalité, ligue, chimie min, note min), et tu **sacrifies une équipe** correspondante pour gagner une récompense (joueur spécial, pack).

Catégories principales :

- **Foundations** : tutoriels à coût bas (2 000 – 8 900 coins) qui enseignent les mécaniques.
- **Marquee Matchups** : SBC hebdo basés sur les vrais matchs réels (~15 000 coins, récompense pack).
- **Upgrades repeatable** : transformer 10 bronze → 1 silver, etc. La pompe à coins « passive ».
- **Player SBC** : verrouille une carte spéciale (souvent un Icon 89+ ou un TOTS).

C'est un puits sans fond de contenu pour le grind, mais aussi un **mécanisme déflationniste** : EA détruit des cartes du marché en les « sacrifiant » pour réguler l'inflation.

### 2.5 Objectives et saisons

- **Saisons** : ~6 semaines, palier 1 à 30+, récompenses gratuites + Premium Pass payant (FC Points).
- **Objectives** : missions journalières / hebdomadaires (marquer X buts avec un attaquant français, gagner Y matchs en Rivals…), récompenses en XP, packs, cartes thématiques.
- **Live Content** : promos hebdo (Team of the Week, TOTS, Future Stars, Heroes…) qui injectent en permanence de nouvelles cartes pour entretenir le besoin.

### 2.6 Calendrier hebdomadaire — la « routine FUT »

Le rythme est très ritualisé, ce qui crée une habitude :

- **Jeudi 18h (UK)** : drop du nouveau Team of the Week.
- **Vendredi** : Champions (le tournoi compétitif weekend).
- **Vendredi / Samedi** : récompenses Champions distribuées par paliers selon les victoires.
- **Jeudi matin** : récompenses Rivals distribuées → pic d'ouverture de packs → baisse temporaire des prix du marché → opportunité de trading.

Cette horloge est une mécanique de game design assumée : elle structure la semaine du joueur autour du jeu.

---

## 3. Ultimate Team — économie et monétisation

### 3.1 Les deux monnaies

| | **Coins** | **FC Points** |
|---|---|---|
| Origine | Gagnés en jouant (match, SBC, objectives) | **Achetés à l'argent réel** (ou via Premium Pass) |
| Usage | Acheter sur le marché, payer SBC, ouvrir packs avec coins | Acheter packs premium, débloquer Premium Pass, draft FUT |
| Transférable | Non (jamais entre comptes officiellement) | Non |
| Fungibilité | Fait tourner le marché entre joueurs | Achète directement chez EA |

Tarifs FC Points typiques (référence FC 26) : 500 FC Points ≈ 4,99 € — palier le plus utilisé : **12 000 FC Points ≈ 99,99 €**.

### 3.2 Le marché des transferts

Le marché est un **vrai marché secondaire** entre joueurs :

- Chaque carte a un **prix min / max** fixé par EA pour empêcher la spéculation extrême et le farming/RMT.
- Les prix fluctuent en temps réel selon l'offre/demande.
- **Buy Now** (instantané, premium tarifaire) vs **Bidding** (enchères, plus patient mais moins cher).
- Les promos, le TOTW, la performance réelle d'un joueur (un attaquant qui marque un triplé en Ligue des Champions le mardi voit sa carte FUT s'envoler le mercredi) font bouger les prix.
- Le **jeudi matin** est célèbre pour le creux du marché (dump de packs ouverts par les vainqueurs Rivals).

### 3.3 Les packs et la transparence des odds

Les packs sont des **lootboxes** : tu paies (coins ou FC Points), tu reçoit un contenu aléatoire selon des probabilités.

- EA publie officiellement les **probabilités de packs** depuis plusieurs années sous pression réglementaire et publique.
- Exemple type : un Premium Gold Pack indique le nombre d'items garantis par rareté, et la probabilité de tirer un joueur 83+, 86+, 88+…
- Les **packs « walkout »** (rares, ouverture cinématique) sont la dopamine clé — EA design la cinématique pour amplifier l'excitation.

### 3.4 Le modèle business

Le modèle FUT a explosé parce qu'il combine trois forces :

1. **Floor élevé** : tu peux jouer 100 % gratuitement et progresser, donc personne ne se sent exclu.
2. **Ceiling très élevé** : les whales peuvent dépenser des dizaines de milliers d'euros par an pour packer des Team of the Year.
3. **FOMO temporel** : les cartes promos sont disponibles **une semaine**, parfois une journée. La peur de manquer drive l'achat impulsif.

Selon les rapports d'EA, **FUT représente historiquement plus de 60 % des revenus opérationnels** de la franchise — c'est la machine.

### 3.5 Mécanismes de rétention monétaire

- **Untradeable cards** : 80 % des cartes obtenues via packs en récompenses sont non-échangeables. Tu ne peux pas les revendre sur le marché → tu es incité à racheter des packs pour avoir des cartes échangeables.
- **Discard Value (DKP / quick sell)** : sacrifier des cartes inutiles te donne un peu de coins, mais bien moins que leur prix marché — incite à les utiliser en SBC.
- **Limited-time SBC** : tu as 7 jours pour assembler une équipe → si tu n'as pas les cartes, tu en achètes (FC Points → marché).
- **Champions Qualifier** : pour participer au mode compétitif weekend, il faut gagner des matchs en semaine. Boucle d'engagement quotidienne.

---

## 4. Clubs Pro — mécaniques et progression

### 4.1 Le concept

Tu crées **un seul joueur** (Virtual Pro) et tu joues uniquement avec lui sur le terrain, dans une équipe composée d'autres humains (jusqu'à 11v11) ou d'IA pour les postes vacants. C'est l'équivalent foot d'un MMO coopératif.

### 4.2 Le système d'Archétypes (FC 26)

C'est la grosse refonte de FC 26. Au lieu de stats à répartir librement, EA a introduit **13 archétypes** :

- Chaque archétype est **inspiré d'une icône du football** (Maradona, Beckenbauer, Ronaldinho, Cruyff, etc.).
- Chacun a une **identité de poste**, des **Signature PlayStyles** (uniquement dispo en Clubs) et des **Perks** spécifiques.
- À la première connexion, tu choisis ton archétype de départ. Les 12 autres se débloquent via :
  - **Clubs Coins** (monnaie in-game gagnée en jouant Clubs),
  - **FC Points** (raccourci payant),
  - **Archetype Unlock items** (récompenses ponctuelles).

### 4.3 Progression XP — la boucle long terme

- Chaque archétype monte de **niveau 1 à 50** au lancement, plafond qui augmentera en cours de saison.
- Tu gagnes de l'**Archetype XP (AXP)** à chaque match.
- L'XP dépend principalement du **Role Rating** : tenir ton rôle (un milieu défensif doit récupérer des ballons, pas marquer 5 buts en sortant de sa zone) maximise l'XP.
- À chaque palier, tu débloques :
  - des **points d'attribut** (+1 vitesse, +1 dribble…),
  - des **upgrades Signature PlayStyle → PlayStyle+** (versions premium des traits),
  - des **Signature Perks** supplémentaires,
  - des **slots de PlayStyle customisables**.

### 4.4 Carte d'archétype

Comme une carte FUT, ton avatar a une « carte » qui évolue visuellement : Bronze → Silver → Gold → Special → ICON. C'est une **récompense esthétique de prestige** très lisible.

### 4.5 Modes de jeu Clubs

- **League matches** : matchs classés entre clubs (11v11 ou hybride avec IA).
- **Drop-In** : tu joues avec des inconnus, parfait pour gagner de l'XP sans engager ton club.
- **Rush** : un mode 5v5 plus arcade (intégré aussi à Ultimate Team) qui sert à grinder l'XP d'archétype rapidement.
- **Crossplay** : entièrement supporté entre PS5, Xbox Series X|S, PC (Origin / Steam / Epic) en Drop-In, Rush et matchs de ligue.

### 4.6 Économie Clubs Pro

Très différente de FUT :

- **Pas de marché secondaire** (tu ne revends pas d'avatars).
- **Clubs Coins** servent à débloquer archétypes, cosmétiques, équipements.
- **FC Points** servent à raccourcir le grind (acheter un archétype au lieu de l'unlock par XP).
- **Pas de lootbox de joueurs**, donc beaucoup moins de pression réglementaire qu'UT.

C'est un modèle plus proche du **battle pass MMO** que de la collection.

---

## 5. Boucles de rétention et game design

Au-delà des modes, EA a structuré FUT autour de boucles imbriquées avec des rythmes différents :

| Boucle | Cadence | Exemple | Objectif design |
|---|---|---|---|
| Micro | 90 secondes – 5 min | Marquer un but, gagner un duel | Plaisir du match |
| Quotidienne | 24h | Daily Objectives, Daily Login | Habitude |
| Hebdomadaire | 7 jours | Champions, Rivals reset, Marquee SBC, TOTW | Pic d'engagement weekend |
| Saisonnière | 4–8 semaines | Saison FUT, level pass | Renouvellement contenu |
| Annuelle | 12 mois | Sortie du nouveau cycle (FC XX) | Ré-achat du jeu |

Cette architecture de boucles imbriquées (« nested loops ») est l'un des fondamentaux les plus copiés du game design service. C'est aussi ce qui fait que **désengager d'un FUT coûte cher psychologiquement** : tu perds 3 ans d'investissement à chaque cycle… sauf que les cartes ne se transfèrent pas d'une année sur l'autre (sauf cosmétiques et Icons via cross-progression limitée).

---

## 6. Controverses et cadre réglementaire

### 6.1 Le débat lootbox = jeu d'argent

Les packs FUT sont au cœur du débat européen sur les lootboxes depuis 2018.

- **Belgique (2018)** : la Commission des jeux de hasard juge que les packs FUT violent la loi sur les jeux de hasard. EA retire la vente de packs **payants** (FC Points) en Belgique en janvier 2019. Les packs gratuits (gagnés en jouant) restent disponibles.
- **Pays-Bas (2018–2022)** : la Kansspelautoriteit attaque EA. En 2020 EA est condamné, puis en **mars 2022 la plus haute juridiction administrative (Conseil d'État)** casse la décision : les packs FUT **ne constituent pas un jeu de hasard autonome** au sens du droit néerlandais. Les packs reviennent.
- **Autriche (janvier 2026)** : la Cour suprême autrichienne rend un arrêt jugeant à son tour que **les lootboxes FIFA/FC ne constituent pas du jeu d'argent**, un précédent européen majeur.
- **UK** : la Gambling Commission n'a pas qualifié les lootboxes de gambling, mais le gouvernement a publié des principes d'auto-régulation pour l'industrie en 2023.

Le compromis qui se dessine en Europe : **transparence obligatoire des probabilités**, **contrôles parentaux renforcés**, **dépenses limitables**, mais **pas d'interdiction**.

### 6.2 Critiques communautaires récurrentes

- **Pay-to-win perception** : les joueurs qui dépensent ont accès plus vite aux meilleures cartes. EA contre-argumente avec les SBC gratuits, mais la perception reste tenace.
- **Inflation contenu** : les promos hebdomadaires donnent l'impression que tes cartes deviennent obsolètes en 3 semaines.
- **Évolutions cassent le marché** : un milieu de terrain à 50k coins devient inutile car tout le monde Evo son joueur favori → carte invendable.
- **Connexion / serveurs Champions** : déconnexion = défaite, problème récurrent qui frustre les compétitifs.

---

## 7. Lecture comparative pour Stage League

> Cette section traduit les enseignements ci-dessus en signaux exploitables pour ton projet **Stage League** (cf. AGENTS.md : Vite/React, MySQL, économie STC, transfer windows, contrats, market values, etc.).

### 7.1 Ce que Stage League partage déjà avec FUT

D'après ton architecture documentée :

- Tu as déjà une **monnaie virtuelle (STC)** et des `PlayerStcTransaction` → équivalent fonctionnel des Coins.
- Tu as des **`market_value_config`, `shirt_sales_config`, `stadium_config`** → équivalent des paramètres économiques single-row de FUT.
- Tu as un **transfer market** (transfer windows, contract renewal) → équivalent du marché des transferts FUT.
- Tu as un **système d'audit** (`admin_audit_log`, `fixture_admin_actions`) → équivalent des contrôles back-office FUT.
- Tu as une **génération de réalité simulée** (matchs, fixtures, forfaits) → là où FUT s'appuie sur la réalité, toi tu génères la tienne.

Ton modèle ressemble donc structurellement plus à **Football Manager + FUT** qu'à un FUT pur.

### 7.2 Mécaniques FUT/Clubs qui peuvent inspirer Stage League

| Mécanique FUT/Clubs | Adaptation possible Stage League | Niveau d'effort |
|---|---|---|
| **Chimie / Cornerstones** | Bonus de performance quand certains joueurs jouent ensemble (compatriotes, anciens coéquipiers, mêmes ligues passées). Crée une stratégie de recrutement non triviale. | Moyen — nouvelle table `chemistry_links` + hook dans `scheduleEngine` |
| **Evolutions** | Permettre aux joueurs (humains) de progresser leurs joueurs (avatars) via objectifs de match. Booste la rétention long terme. | Élevé — vraie boucle de progression |
| **Archétypes** | Catégoriser les joueurs en archétypes (pivot, ailier rapide, libéro, régisseur…) avec PlayStyles signature qui modifient le moteur de match. | Moyen — déjà compatible avec ton `scheduleEngine` |
| **SBC** | Défis : « sacrifier 3 joueurs d'une ligue pour débloquer un trophée / un slot stade ». Mécanisme déflationniste très efficace. | Faible-moyen — un controller dédié type `functionsController` |
| **Pack probabilities transparentes** | Si tu introduis un mécanisme de tirage (jeune génération, scouting), publie les probabilités. Bonne foi + couverture réglementaire. | Faible |
| **Champions weekend** | Tu as déjà des compétitions. Ajoute un **tournoi élite weekend** réservé aux qualifiés de la semaine. Pic d'engagement weekend. | Moyen |
| **Saisons (~6 sem) avec battle pass** | Ton concept de saison s'y prête nativement. Pass gratuit + pass premium (STC ou IRL). | Moyen |
| **Daily / Weekly Objectives** | Récompenses pour des actions ciblées dans tes matchs. Quasi gratuit à implémenter via un controller objectives. | Faible |
| **Cartes spéciales temporaires** | Versions « In Form » d'un joueur si il performe X semaines de suite, durée limitée. Crée du buzz autour des perfs. | Moyen |

### 7.3 Pièges FUT à éviter

- **Inflation incontrôlée** : si tu n'as pas de SBC ou de coin sink, le STC se concentre chez les whales et casse l'économie. Prévois dès le début des **puits de monnaie** (taxe transfer, frais salariaux, maintenance stade).
- **Untradeable abusif** : différencier les récompenses échangeables et non-échangeables est puissant pour la monétisation mais brutal pour la perception « pay-to-win ». Sois transparent.
- **Promos hebdo trop agressives** : si tu sors un Team of the Week chaque jeudi avec des cartes meilleures que les précédentes, tu rends obsolète tout investissement < 1 mois. Le marché s'effondre, les joueurs partent.
- **Lootboxes payantes** : juridiquement viable en Europe en 2026 (cf. arrêts Autriche / Pays-Bas), mais **pas en Belgique**. Si Stage League cible le marché belge, prévois un mode « no-pack-purchase ».
- **Boucle quotidienne trop punitive** : si rater 2 jours te fait perdre ton rang, c'est anti-grand-public. Daily login bonuses oui, pénalités d'absence non.

### 7.4 Recommandation hiérarchisée (court → long terme)

**Sprint 1 — gagner les boucles d'engagement (faible effort, fort impact)**

1. Implémenter **Daily / Weekly Objectives** comme un nouveau controller. Récompenses en STC.
2. Publier explicitement les probabilités de tout tirage aléatoire existant.
3. Mettre en place un **calendrier hebdomadaire ritualisé** (jour de récompense, jour de fixture, jour de marché actif).

**Sprint 2 — densifier la stratégie de team-building**

4. Ajouter une couche **Chimie / synergies** entre joueurs (table `chemistry_links`).
5. Introduire des **archétypes / PlayStyles** consommés par `scheduleEngine` pour différencier les profils.

**Sprint 3 — économie long terme**

6. Ajouter des **SBC-like challenges** (sacrifier des joueurs pour débloquer des bonus club).
7. Mettre en place une **saison ~6 semaines** avec battle pass STC.
8. Tester un **mode Champions weekend** réservé aux top performers de la semaine.

**Hors scope tant que la monétisation n'est pas formalisée**

- Pas de FC Points-like avant d'avoir verrouillé la conformité (Belgique, contrôle parental, plafond de dépense).
- Pas d'Evolutions tant que l'économie n'est pas stable (effet dévastateur sur le marché).

### 7.5 Schéma de table indicatif (à valider avec ton convention AGENTS.md)

Si tu pars sur la chimie, l'implémentation respecterait ta MVC convention (§2 d'AGENTS.md) :

- **Schema** : nouvelle table `chemistry_links` dans `server/schema.sql` + migration idempotente dans `server/src/server.js`.
- **Model** : `server/src/server/models/chemistryLinkModel.js` (`selectByPlayer(player_id)`).
- **Controller** : `chemistryLinkController.js` exposant `GET /`, `GET /:id`, `POST /`, `PATCH /:id`, `DELETE /:id`.
- **Route** : `/api/stage/chemistry-links` sous `verifyToken`.
- **Frontend** : ajouter `ChemistryLink` à `ENTITY_NAMES` dans `src/api/stageClient.js`.
- **Consumer** : `scheduleEngine` lit les chemistry links pour appliquer un modificateur de stats au moment de la simulation de match.

Pour les objectifs daily/weekly, à l'inverse, **ne crée pas de CRUD générique** (cf. §3 d'AGENTS.md) : c'est de la business logic transactionnelle, donc une fonction sous `functionsController.js` (`computeDailyObjectives`, `claimObjectiveReward`).

---

## 8. Sources

### Mécaniques EAFC 26

- [EA SPORTS FC™ 26 Clubs Deep Dive — EA Official](https://www.ea.com/en/games/ea-sports-fc/fc-26/news/pitch-notes-fc26-clubs-deep-dive)
- [FC 26 New Clubs Features — EA Official](https://www.ea.com/en/games/ea-sports-fc/fc-26/features/fc-26-clubs)
- [Cornerstones in Football Ultimate Team — EA Official](https://www.ea.com/en/games/ea-sports-fc/fc-26/news/fc-26-cornerstones)
- [Ultimate Team Chemistry Guide: New Rules & Tips for EA FC 26 — Operation Sports](https://www.operationsports.com/ultimate-team-chemistry-guide-new-rules-tips-for-ea-fc-26/)
- [Complete Guide To Ultimate Team Chemistry In EA Sports FC 26 — The Gamer](https://www.thegamer.com/ea-sports-fc-26-ultimate-team-chemistry/)
- [EA FC 26 Chemistry Styles, Explained — Football Gaming Zone](https://footballgamingzone.com/ea-sports-fc/ea-fc-26-chemistry-styles-explained-all-stat-boosts-changes/)
- [EA FC 26 Evolutions — TeamGullit](https://www.teamgullit.com/ea-fc-26/evolutions)
- [FC 26 Evolutions Are Breaking Chemistry & Market — ItemD2R](https://www.itemd2r.com/en/blog/fc-26/fc-26-evolutions-are-breaking-ultimate-team-chemistry-the-market)
- [How To Level Up Archetypes Fast In EA Sports FC 26 — The Gamer](https://www.thegamer.com/ea-sports-fc-26-all-archetypes-explained/)
- [EA FC 26 Pro Clubs: Best Archetypes for Every Position — Games.gg](https://games.gg/ea-sports-fc-26/guides/ea-fc-26-pro-clubs-best-archetypes/)
- [Everything new in EA FC 26 Pro Clubs — Esports News UK](https://esports-news.co.uk/2025/08/01/ea-fc-26-pro-clubs-new-features/)
- [FC 26 Clubs Guide — Skycoach](https://skycoach.gg/blog/ea-fc/articles/fc-26-clubs-guide)

### Économie, packs, marché

- [Pack Probabilities — EA Official](https://www.ea.com/games/ea-sports-fc/news/fc-pack-probabilities)
- [FC 26 Pack Chances Explained — FifaUTeam](https://fifauteam.com/fc-26-pack-chances/)
- [EA FC 26 Pack Odds & Probabilities — FUTNext](https://www.futnext.com/pack)
- [Get started with Ultimate Team™ Squad Building Challenges — EA Help](https://help.ea.com/en/articles/ea-sports-fc/squad-building-challenges/)
- [EA Sports FC 26 SBC Guide — Games.gg](https://games.gg/ea-sports-fc-26/guides/ea-sports-fc-26-squad-building-challenges/)
- [FC 26 Transfer Market Complete Guide — SuperCoinsy](https://supercoinsy.com/article/fc-26-transfer-market-complete-guide)
- [How the market works in EA FC 26 — TeamGullit](https://www.teamgullit.com/ea-fc-26/market)
- [FC 26 Coins: What They Are, How They Work — FC Coins Hub](https://fccoinshub.com/fc-26-coins/)

### Cross-play et modes

- [Cross-play in EA SPORTS FC™ — EA Help](https://help.ea.com/en/articles/ea-sports-fc/cross-play/)
- [FC 26 Crossplay Guide — FifaUTeam](https://fifauteam.com/fc-26-crossplay/)
- [EA FC 26 Clubs Cross-Play — TeamGullit](https://www.teamgullit.com/ea-fc-26/clubs)

### Cadre réglementaire et lootboxes

- [Loot box — Wikipedia](https://en.wikipedia.org/wiki/Loot_box)
- [Austrian Supreme Court Declares FIFA Loot Boxes Not Gambling — Esports Legal News (janv. 2026)](https://esportslegal.news/2026/01/28/austrian-supreme-court-loot-boxes/)
- [Paid Video Game Loot Boxes Are Not Gambling under Dutch Gambling Regulation — Gaming Law Review](https://www.liebertpub.com/doi/10.1089/glr2.2023.0020)
- [What's the Current Situation Over Loot Boxes in Ultimate Team? — FIFA Infinity](https://www.fifa-infinity.com/ea-sports-fc/whats-the-current-situation-over-loot-boxes-in-ultimate-team/)
- [EA amends FIFA loot boxes in Belgium — Game Developer](https://www.gamedeveloper.com/business/ea-amends-i-fifa-i-loot-boxes-in-belgium-after-regulators-increase-pressure)
- [Breaking Ban: Belgium's Ineffective Gambling Law Regulation of Video Game Loot Boxes — Collabra Psychology, UC Press](https://online.ucpress.edu/collabra/article/9/1/57641/195100/Breaking-Ban-Belgium-s-Ineffective-Gambling-Law)
- [Lootboxes: Advice to the Gambling Commission from ABSG — UK Gambling Commission](https://www.gamblingcommission.gov.uk/guidance/lootboxes-advice-to-the-gambling-commission-from-absg/international-approaches-lootboxes-advice-to-the-gambling-commission-from)
