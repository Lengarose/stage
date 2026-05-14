# Stage League × EAFC — Prompt d'intégration et faisabilité front/back

> Document opérationnel pour un agent IA (Cursor, Claude, Codex) chargé d'évaluer ou d'implémenter les mécaniques FUT/Clubs Pro dans Stage League.
> Référence : `AGENTS.md`, sections §2 (MVC convention), §3 (exceptions), §4 (frontend), §6 (DB), §7 (audit logging).

---

## 1. Audit rapide de l'existant (au 13 mai 2026)

Avant de rentrer dans les mécaniques, voici ce que **le repo possède déjà** et qui change radicalement la faisabilité :

| Brique existante | Fichier(s) clés | Ce que ça nous donne |
|---|---|---|
| Économie STC | `playerStcTransactionModel.js`, `stcTransactionModel.js`, `playerModel.js` (champ `stc`, `credits`) | Monnaie, ledger transactionnel |
| Moteur de match | `src/lib/scheduleEngine.js`, `matchModel.js`, `matchPlayerStatModel.js`, `liveMatchModel.js` | Hook naturel pour la chimie et les archétypes |
| Saisons | `competitionSeasonModel.js`, `seasonRegistrationModel.js`, `src/lib/seasonLifecycle.js` | Concept de saison déjà rodé |
| Récompenses | `rewardConfigModel.js`, `src/lib/rewardsEngine.js` (`distributeSeasonRewards`) | Battle pass = extension naturelle |
| Achievements | `playerAchievementModel.js`, `clubAchievementModel.js` | Base pour Daily/Weekly Objectives |
| Compétitions | `competitionModel.js`, `tournamentModel.js`, `tournamentEngine.js`, `qualificationEntryModel.js` | Champions weekend ≈ tournoi qualificatif |
| Valeur joueur | `playerValue.js`, `market_value_config` (singleton) | Tarification cohérente déjà en place |
| Audit | `fixtureAdminActionModel.js`, `admin_audit_log` | Tout est traçable côté admin |
| Attributs Player | `position`, `country`, `country_code`, `overall_rating`, `club_id`, `club_roles` | Données suffisantes pour calculer la chimie |
| Realtime | `src/lib/SocketContext.jsx`, `useRealtimeData.js` | Push instantané possible côté UI |
| Fonctions transactionnelles | `functionsController.js` (`POST /:name`) | Bonne sortie pour tout ce qui n'est pas CRUD pur |

**Conséquence majeure** : 6 des 9 mécaniques 7.2 peuvent être branchées **sans refactoring profond**, juste avec des ajouts. Seules les **Evolutions** et les **Cartes spéciales temporaires** demandent une vraie réflexion long terme.

---

## 2. Verdict de faisabilité par mécanique

> Lecture : 🟢 = intégrable sans douleur · 🟡 = effort modéré, pas de breaking change · 🔴 = nouveaux concepts structurants, refactor probable
> « Touche » = ce qu'il faut ajouter ou modifier. « Coût frontend / backend » = estimation pour 1 dev expérimenté du repo.

### 2.1 🟢 Chimie / Cornerstones

**Concept** : bonus de stat collectifs quand des joueurs partagent nationalité, club passé, ligue, etc.

| Côté | Verdict | Détail |
|---|---|---|
| **Backend** | 🟢 facile | Nouvelle table `chemistry_links` (player_a_id, player_b_id, link_type ENUM, bonus_factor). Module `chemistryService.js` qui calcule un multiplicateur à partir d'un line-up. Hook dans `scheduleEngine` au moment de la simulation de match. Aucune table existante à toucher. |
| **Frontend** | 🟢 facile | Ajouter `ChemistryLink` à `ENTITY_NAMES` dans `stageClient.js`. Une vue `ChemistryPanel.jsx` dans le composant de gestion d'équipe qui surligne les liens (compatriote = drapeau, ex-coéquipier = badge). |
| **Risque** | Faible | Le calcul tourne en lecture, n'écrit rien dans les tables critiques. Désactivable par feature flag. |
| **Effort estimé** | Back : ~1.5j · Front : ~1j | Total ~2.5j |

### 2.2 🔴 Evolutions (progression d'un joueur via objectifs)

**Concept** : un joueur humain assigne une « Evolution » à un de ses joueurs (avatar), accomplit des objectifs en match, débloque des paliers qui boostent ses stats.

| Côté | Verdict | Détail |
|---|---|---|
| **Backend** | 🔴 lourd | 3 nouvelles tables : `evolution_definitions` (le catalogue), `player_evolutions` (l'instance pour un joueur donné), `evolution_progress_events` (log des progrès post-match). Hook dans `matchModel` post-match pour incrémenter le compteur. Système de paliers et d'application irréversible des bonus aux stats `players.overall_rating` + futurs « playstyles ». |
| **Frontend** | 🟡 moyen | Nouvelle section « Evolutions » dans la page joueur. Affichage progression / palier / objectifs en cours. Modale d'activation. |
| **Risque** | Élevé | (a) modifie en permanence les stats du joueur → conflit potentiel avec `playerValue.js` et l'économie marché ; (b) le retour arrière est complexe ; (c) cassure potentielle du market value qu'on a déjà vu en FUT 26. |
| **Effort estimé** | Back : ~6-8j · Front : ~3-4j | Total ~10j minimum + prévoir refacto market value |

**Recommandation : différer**. À ne pas faire avant que l'économie soit stable et auditée.

### 2.3 🟢 Archétypes

**Concept** : catégoriser les joueurs par profil (pivot, ailier, libéro, régisseur) avec PlayStyles signature qui modifient le moteur de match.

| Côté | Verdict | Détail |
|---|---|---|
| **Backend** | 🟢 facile | Une nouvelle colonne `archetype` (VARCHAR) sur `players` via `addCol(...)`. Une table légère `archetypes` (id, name, position, base_modifiers JSON, signature_playstyles JSON). Le `scheduleEngine` lit ce modifier au moment de la simulation. |
| **Frontend** | 🟢 facile | Sélecteur d'archétype dans la fiche joueur. Affichage badge sur les cartes. Liste filtrée par archétype dans la recherche joueur. |
| **Risque** | Faible | Aucune écriture rétroactive — un joueur sans archétype tourne avec les modifiers par défaut (1.0). |
| **Effort estimé** | Back : ~2j · Front : ~1.5j | Total ~3.5j |

### 2.4 🟡 SBC (Squad Building Challenges)

**Concept** : défis du type « sacrifier 3 joueurs d'une ligue X pour débloquer un trophée / un slot stade ».

| Côté | Verdict | Détail |
|---|---|---|
| **Backend** | 🟡 moyen | Table `sbcs` (id, name, requirements JSON, reward JSON, max_completions, expires_at). Table `sbc_submissions` (id, sbc_id, player_id, sacrificed_player_ids JSON, status). Logique transactionnelle → **`functionsController.js`** (`submitSbc`), pas de CRUD direct (§3 d'AGENTS.md). Important : décrémente le club du joueur et écrit dans `admin_audit_log`. |
| **Frontend** | 🟢 facile | Page « Défis » avec liste, filtres, drag-and-drop pour assembler la squad. Validation côté client + POST. |
| **Risque** | Moyen | Le « sacrifice » est destructif ; nécessite tests rigoureux et confirmation utilisateur en 2 étapes. |
| **Effort estimé** | Back : ~3j · Front : ~2.5j | Total ~5.5j |

### 2.5 🟢 Pack probabilities transparentes

**Concept** : afficher les odds de tout tirage aléatoire (jeune génération, scouting…).

| Côté | Verdict | Détail |
|---|---|---|
| **Backend** | 🟢 trivial | Si un mécanisme de tirage existe déjà : exposer un endpoint `GET /api/stage/pack-probabilities` qui renvoie les pondérations utilisées par le RNG. Sinon : un fichier de config statique côté front suffit. |
| **Frontend** | 🟢 trivial | Une page Markdown ou un composant tableau accessible depuis chaque pack/tirage. |
| **Risque** | Nul | Aucun impact technique. Bénéfice juridique et image. |
| **Effort estimé** | ~0.5j total | À faire dès qu'un système de tirage aléatoire est introduit. |

**Note** : Stage League n'a pas (encore ?) de mécanisme de pack à ma connaissance dans le repo. Si vous comptez en ajouter, **publiez les odds en même temps**.

### 2.6 🟡 Champions weekend

**Concept** : tournoi élite weekend réservé aux qualifiés de la semaine.

| Côté | Verdict | Détail |
|---|---|---|
| **Backend** | 🟡 moyen | Bonne nouvelle : `tournamentModel`, `tournamentController`, `qualificationEntryModel` existent déjà. Il faut un **scheduler hebdo** (cron ou job) qui crée un nouveau `Tournament` du vendredi au dimanche, et qui sélectionne ses participants via les `qualification_entries` accumulées en semaine. Logique → `functionsController.js` (`spawnChampionsWeekend`). |
| **Frontend** | 🟡 moyen | Nouvelle page `pages/ChampionsWeekend.jsx`. Réutilise les composants tournoi existants (bracket, standings). Ajouter un badge « Qualifié » sur le dashboard si le joueur est éligible. |
| **Risque** | Faible | On bâtit sur du code éprouvé, pas de nouveau modèle de données structurant. |
| **Effort estimé** | Back : ~2.5j · Front : ~2j | Total ~4.5j |

### 2.7 🟡 Saisons (~6 sem) avec battle pass

**Concept** : pass gratuit + pass premium par saison, 30+ paliers de récompenses.

| Côté | Verdict | Détail |
|---|---|---|
| **Backend** | 🟡 moyen | `competitionSeasonModel` et `rewardConfigModel` existent. À ajouter : `battle_pass_tiers` (season_id, tier_number, xp_required, free_reward JSON, premium_reward JSON) + `battle_pass_progress` (player_id, season_id, current_xp, tier_unlocked, premium_owned BOOL). Hook XP gain dans `matchModel` post-match. Endpoint `claimBattlePassTier` dans `functionsController`. |
| **Frontend** | 🟡 moyen | Page `BattlePass.jsx` avec rail horizontal de paliers, indicateur XP, bouton « Réclamer », CTA d'achat du pass premium. |
| **Risque** | Faible-moyen | Si pass premium en argent réel : exige Stripe (déjà présent dans le `playerModel` : `stripe_customer_id`). Conformité Belgique : pass premium en argent réel sans tirage aléatoire = légal. |
| **Effort estimé** | Back : ~3.5j · Front : ~3j | Total ~6.5j |

### 2.8 🟢 Daily / Weekly Objectives

**Concept** : missions ciblées avec récompenses, refresh quotidien et hebdo.

| Côté | Verdict | Détail |
|---|---|---|
| **Backend** | 🟢 facile | Deux tables : `objective_definitions` (id, scope ENUM('daily','weekly'), description, target JSON, reward JSON) + `objective_progress` (player_id, objective_id, current, completed BOOL, claimed_at). Endpoint `claimObjectiveReward` dans `functionsController`. Hook post-match dans `matchModel` qui incrémente. Job cron qui regénère le set quotidien. |
| **Frontend** | 🟢 facile | Widget « Mes objectifs » sur le dashboard. Composant `ObjectiveCard` avec barre de progression. |
| **Risque** | Nul | Greenfield, pas de réécriture. |
| **Effort estimé** | Back : ~2.5j · Front : ~1.5j | Total ~4j |

**C'est le meilleur ROI du lot : faible coût, fort impact rétention.**

### 2.9 🔴 Cartes spéciales temporaires (« In Form »)

**Concept** : version boostée d'un joueur qui a performé X semaines, durée limitée.

| Côté | Verdict | Détail |
|---|---|---|
| **Backend** | 🔴 lourd | Concept de « variante de joueur » — pas trivial dans le modèle actuel où `players.overall_rating` est unique. Soit : nouvelle table `player_variants` (variant_id, base_player_id, overlay_stats JSON, valid_from, valid_to, badge_type) et adapter `playerValue`, `scheduleEngine`, `matchPlayerStatModel` pour gérer la sélection de variante au moment du match. Soit : ajouter des champs `boost_stats JSON` + `boost_expires_at` sur la table players (plus simple, moins flexible). |
| **Frontend** | 🟡 moyen | Affichage du badge « In Form » sur la carte, comparaison stats normale vs in-form, choix au moment de l'aligner. |
| **Risque** | Élevé | Touche au cœur du modèle joueur. Peut casser des invariants existants (player.id étant souvent référencé partout). |
| **Effort estimé** | Back : ~5-7j · Front : ~3j | Total ~9j |

**Recommandation : différer.** Ne pas implémenter tant que l'archétype et la chimie ne tournent pas en prod.

---

## 3. Synthèse — combien de mécaniques sans refacto ?

| Mécanique | Refacto nécessaire ? | Recommandé pour sprint 1 ? |
|---|---|---|
| Chimie / Cornerstones | Non | ✅ Oui |
| Evolutions | **Oui** | ❌ Différer |
| Archétypes | Non | ✅ Oui |
| SBC | Non | ✅ Oui (après chimie) |
| Pack probabilities | Non | ✅ Oui (trivial) |
| Champions weekend | Non | ✅ Oui (réutilise tournoi) |
| Battle pass saison | Non | 🟡 Oui mais après objectives |
| Daily / Weekly Objectives | Non | ✅ **Priorité absolue** (meilleur ROI) |
| Cartes spéciales | **Oui** | ❌ Différer |

**Verdict global : 7 mécaniques sur 9 sont intégrables sans toucher au cœur du modèle existant.** Les seules qui demandent un vrai refacto sont les Evolutions et les Cartes spéciales — précisément les deux qui en FUT cassent le marché et créent de la dette technique.

---

## 4. Prompt prêt-à-coller pour un agent IA

> Suit la forme recommandée dans `AGENTS.md` §12 (Goal / Scope / Acceptance / Constraints). À coller dans Cursor, Claude Code ou Codex, lancé à la racine du repo Stage League.

````
[Goal]
Intégrer dans Stage League quatre mécaniques inspirées d'EAFC Ultimate Team / Clubs Pro, sans modifier les invariants existants du modèle joueur ni casser l'économie STC. Ces quatre mécaniques sont, par ordre de priorité :

  1. Daily / Weekly Objectives        (rétention quotidienne)
  2. Chimie / Cornerstones            (profondeur stratégique team-building)
  3. Archétypes                       (différenciation des profils joueur)
  4. SBC (Squad Building Challenges)  (mécanisme déflationniste, prérequis : chimie + archétypes en place)

Les deux mécaniques différées (Evolutions, Cartes spéciales temporaires) ne doivent PAS être implémentées dans cette PR — elles touchent au cœur du modèle joueur et nécessitent une décision produit séparée.

[Scope]
- Respecter strictement la convention MVC du §2 d'AGENTS.md pour chaque nouvelle entité.
- Utiliser `functionsController.js` (§3) pour toute action transactionnelle non-CRUD (claim de récompense, soumission SBC, etc.).
- Garder `schema.sql` ET les migrations idempotentes de `server/src/server.js` synchronisés.
- Ajouter chaque nouvelle entité PascalCase à `ENTITY_NAMES` dans `src/api/stageClient.js`.
- Écrire un audit log (`admin_audit_log`) pour toute action admin et toute mutation économique (sacrifice SBC, claim de récompense > 1000 STC).
- Toute mécanique exposée doit pouvoir être désactivée via feature flag (table `app_settings` ou variable d'env).

[Acceptance]

A. Daily / Weekly Objectives
   - Tables `objective_definitions` et `objective_progress` créées dans schema.sql + migration de boot.
   - Route `/api/stage/objectives` (GET liste, GET :id) sous `verifyToken`.
   - `functionsController.js` expose `claimObjectiveReward` (transactionnel, crédite STC, marque comme claimé).
   - Hook dans le pipeline post-match (`matchModel` ou `scheduleEngine`) qui incrémente `objective_progress.current` pour les objectifs en cours du joueur.
   - Job cron / endpoint admin qui regénère le pool quotidien de 3 objectifs et le pool hebdo de 5 objectifs.
   - Côté front : entité `Objective` dans `ENTITY_NAMES`, page `pages/Objectives.jsx` + widget compact sur le dashboard.
   - Test manuel : finir un match → l'objectif progresse → on peut claim → le STC est crédité → l'objectif n'est plus claimable.

B. Chimie / Cornerstones
   - Table `chemistry_links` (id, player_a_id, player_b_id, link_type ENUM('nationality','league','club_past','icon'), bonus_factor DECIMAL(3,2), source).
   - Service `server/src/server/services/chemistryService.js` qui calcule `computeChemistry(playerIds[])` → renvoie un coefficient global et la liste des liens actifs.
   - Hook dans `src/lib/scheduleEngine.js` (ou son équivalent côté serveur si la simulation tourne côté backend) qui multiplie les stats agrégées par le coefficient avant le calcul du résultat.
   - Indexes `idx_chem_player_a`, `idx_chem_player_b` dans les deux sources de vérité.
   - Côté front : entité `ChemistryLink` dans `ENTITY_NAMES`, composant `components/team/ChemistryPanel.jsx` qui affiche les liens d'une squad en surimpression.
   - Test manuel : composer une équipe de 11 compatriotes → coefficient > 1.0 affiché ; échanger un joueur par un étranger → coefficient diminue.

C. Archétypes
   - Migration `addCol('players', 'archetype', "VARCHAR(64) NULL")` dans server.js + colonne ajoutée au CREATE TABLE de schema.sql.
   - Table `archetypes` (id, name, position, base_modifiers JSON, signature_playstyles JSON, description).
   - Seed initial avec 13 archétypes (cf. EAFC 26 : régisseur, pivot, libéro, ailier rapide, etc.) DANS la migration de boot (insert-if-empty), pas dans schema.sql (cf. §6 d'AGENTS.md).
   - Le scheduleEngine lit les modifiers d'archétype dans le calcul de match.
   - Côté front : entité `Archetype` dans `ENTITY_NAMES`, sélecteur dans la fiche joueur, badge sur les cartes.
   - Test manuel : assigner un archétype à un joueur → le moteur applique le modifier → la fiche joueur affiche bien le badge.

D. SBC
   - Tables `sbcs` et `sbc_submissions` créées.
   - Route `/api/stage/sbcs` (GET liste, GET :id, POST :id/submit via functionsController).
   - `submitSbc` (functionsController) est transactionnel :
       1. Valide les contraintes (chimie min, note moyenne, ligue, etc.).
       2. Détruit les joueurs sacrifiés (soft delete avec flag `sacrificed_at`).
       3. Crédite la récompense.
       4. Écrit dans `admin_audit_log`.
   - Côté front : entité `Sbc` dans `ENTITY_NAMES`, page `pages/SBC.jsx`, modale de confirmation double avant sacrifice.
   - Test manuel : créer un SBC test, soumettre une squad valide → joueurs sacrifiés disparus de l'inventaire, récompense reçue.

[Constraints]
- NE PAS modifier `players.overall_rating` ni `players.stc` en dehors des transactions atomiques.
- NE PAS toucher aux composants `src/components/ui/*` (shadcn, regénéré via CLI).
- NE PAS créer de hand-written API client par entité — utiliser `makeEntity` via `ENTITY_NAMES` (§4 d'AGENTS.md).
- Garder Radix `<Tabs>` HORS des pages avec URL-routing (cf. §11.2 d'AGENTS.md, bug connu).
- NE PAS introduire de Evolutions, In-Form cards, FC-Points-like, ni d'achat IRL aléatoire dans cette PR.
- Pour la simulation de match, brancher le service `chemistryService` AVANT le calcul des stats agrégées, pas après.

[Verification]
Avant de marquer la PR comme prête :
  1. `npm run lint` clean
  2. `npm run typecheck` clean
  3. `node --check server/src/server.js` ok
  4. Démarrer le backend local et faire les 4 tests manuels ci-dessus.
  5. Vérifier que `stageClient.entities.Objective`, `.ChemistryLink`, `.Archetype`, `.Sbc` existent côté frontend.
  6. Inspecter `admin_audit_log` après une soumission SBC.

[Out-of-scope]
- Champions weekend (à faire dans une PR séparée, réutilise tournamentEngine).
- Battle pass saison (PR séparée, dépend de la mécanique Objectives en place).
- Pack probabilities (trivial, à coupler à toute introduction future de tirage aléatoire).
- Evolutions, In-Form cards : décision produit à séparer.
````

---

## 5. Notes pour l'humain qui lira ce prompt

- **Ordre d'exécution recommandé** : commencer par les Objectives (greenfield, faible coût, fort impact). Puis Chimie + Archétypes (peuvent être travaillés en parallèle). Puis SBC (qui dépend de Chimie pour ses contraintes).
- **Total effort estimé pour le bloc « sprint 1 » (Objectives + Chimie + Archétypes + SBC)** : ~15-17 jours de dev, soit ~3 sprints de 1 semaine.
- **Champions weekend et Battle pass** peuvent venir au sprint 4-5, ils réutilisent énormément l'existant.
- **Evolutions et In-Form cards** : reposer la question dans 3 mois, après stabilisation des autres systèmes.
- **Conformité Belgique** : aucune des 7 mécaniques recommandées ne contient de lootbox payante → pas de blocage juridique en Europe.

---

## 6. Annexe — tableau récap pour décision rapide

| # | Mécanique | Front | Back | Refacto ? | Effort total | Priorité |
|---|---|---|---|---|---|---|
| 1 | Daily/Weekly Objectives | 🟢 | 🟢 | Non | ~4j | ★★★★★ |
| 2 | Chimie / Cornerstones | 🟢 | 🟢 | Non | ~2.5j | ★★★★ |
| 3 | Archétypes | 🟢 | 🟢 | Non | ~3.5j | ★★★★ |
| 4 | SBC | 🟢 | 🟡 | Non | ~5.5j | ★★★ |
| 5 | Pack probabilities | 🟢 | 🟢 | Non | ~0.5j | ★★★ (si tirage) |
| 6 | Champions weekend | 🟡 | 🟡 | Non | ~4.5j | ★★★ |
| 7 | Battle pass saison | 🟡 | 🟡 | Non | ~6.5j | ★★ |
| 8 | Evolutions | 🟡 | 🔴 | **Oui** | ~10j+ | À différer |
| 9 | Cartes In-Form | 🟡 | 🔴 | **Oui** | ~9j | À différer |
