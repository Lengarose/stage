# Stage League × EAFC — Implémentation livrée

> Date : 13 mai 2026
> Branche : code écrit directement dans `/stage/` (pas de PR créée — à faire côté humain)
> Conventions suivies : `AGENTS.md` §2 (MVC), §3 (functions transactionnels), §6 (DB), §7 (audit log)

---

## Fichiers créés

### Backend — modèles (`server/src/server/models/`)

| Fichier | Table | Rôle |
|---|---|---|
| `objectiveDefinitionModel.js` | `objective_definitions` | Catalogue d'objectifs daily/weekly |
| `objectiveProgressModel.js` | `objective_progress` | Progrès par joueur |
| `archetypeModel.js` | `archetypes` | 13 archétypes (seedés au boot) |
| `chemistryLinkModel.js` | `chemistry_links` | Liens de chimie pairwise |
| `sbcModel.js` | `sbcs` | Squad Building Challenges |
| `sbcSubmissionModel.js` | `sbc_submissions` | Log des soumissions SBC |

### Backend — contrôleurs (`server/src/server/controllers/`)

| Fichier | Route | Verbes |
|---|---|---|
| `objectiveDefinitionController.js` | `/api/stage/objective-definitions` | GET / · GET /:id · POST · PATCH · DELETE |
| `objectiveProgressController.js` | `/api/stage/objective-progresses` | GET / · GET /:id · POST · PATCH · DELETE |
| `archetypeController.js` | `/api/stage/archetypes` | GET / · GET /:id · POST · PATCH · DELETE |
| `chemistryLinkController.js` | `/api/stage/chemistry-links` | GET / · GET /:id · POST · PATCH · DELETE |
| `sbcController.js` | `/api/stage/sbcs` | GET / · GET /:id · POST · PATCH · DELETE |
| `sbcSubmissionController.js` | `/api/stage/sbc-submissions` | GET / · GET /:id · POST (pending) · PATCH · DELETE |

### Backend — service

- `server/src/server/services/chemistryService.js` — calcule la chimie d'un squad
  - Combine les liens stockés (`chemistry_links`) avec des liens dérivés (même nationalité, même club courant)
  - Support du **Cornerstone** (FUT 26) — doublement des liens touchant le joueur désigné
  - Bonus capé à **+15%** absolu sur le squad
  - Appelé par `submitSbc` pour valider `min_chem`, à brancher dans `scheduleEngine` pour appliquer le multiplicateur au match

### Backend — fonctions transactionnelles (`functionsController.js`)

Deux nouveaux handlers ajoutés au `HANDLERS` map :

- **`claimObjectiveReward({ progress_id })`**
  - Vérifie ownership, completed, not-yet-claimed
  - Crédite STC + écrit dans `player_stc_transactions`
  - Marque `claimed_at`
  - Audit log dans `admin_audit_log`
  - Le tout dans `withTransaction()` → atomique avec rollback

- **`submitSbc({ sbc_id, sacrificed_player_ids, cornerstone_player_id? })`**
  - Pré-vol : SBC active, non-expirée, `max_completions` non dépassé
  - Validation requirements : `squad_size`, `min_rating`, `nationality`, `archetype`, `min_chem`
  - Si échec → écrit une ligne `failed` dans `sbc_submissions` (best-effort), lève
  - Sinon, dans une transaction :
    1. Soft-delete des joueurs sacrifiés (`sacrificed_at = NOW()`, `club_id = NULL`)
    2. Crédit STC + `player_stc_transactions`
    3. Trophy placement si `reward.trophy_item_id`
    4. Ligne `completed` dans `sbc_submissions`
    5. Audit log dans `admin_audit_log`

### Backend — migrations

- `server/src/server.js` — ajout dans `runStartupMigrations()` :
  - `objective_definitions`, `objective_progress`
  - `archetypes` (+ seed de 13 archétypes EAFC 26 si table vide)
  - `chemistry_links`
  - `sbcs`, `sbc_submissions`
  - 2 nouvelles colonnes sur `players` : `archetype` (VARCHAR 64) et `sacrificed_at` (DATETIME)

- `server/schema.sql` — ajout des 6 tables (en miroir des migrations)

### Backend — montage des routes

`server/src/server.js` lignes 64-69 : 6 nouveaux `app.use(... verifyToken, require(...))`.

### Frontend — registre d'entités

`src/api/stageClient.js` — 6 entités ajoutées à `ENTITY_NAMES` :
- `ObjectiveDefinition`, `ObjectiveProgress`
- `Archetype`
- `ChemistryLink`
- `Sbc`, `SbcSubmission`

### Frontend — composants

- `src/components/objectives/ObjectivesWidget.jsx` — widget dashboard
  - Liste les objectives du joueur via `stageClient.entities.ObjectiveProgress.filter({ player_id })`
  - Bouton **Claim** qui appelle `stageClient.functions.invoke('claimObjectiveReward', { progress_id })`
  - Barre de progression, libellé scope (DAILY/WEEKLY), reward STC + XP

- `src/components/team/ChemistryPanel.jsx` — panneau chimie d'un squad
  - Reproduit côté front la **même logique** que `chemistryService` côté serveur (sécurise la cohérence affichée / appliquée)
  - Affiche un chem score 0–100 (style FUT) + le détail des liens (nationalité, club, cornerstone)
  - Props : `players: Array<{id, gamertag, country, country_code, club_id}>`, `cornerstonePlayerId?`

---

## Comment utiliser bout-en-bout

### Backend

Au prochain démarrage du serveur, `runStartupMigrations` crée les 6 tables (+ 2 colonnes sur players) et seed les 13 archétypes si la table est vide. **Aucune action manuelle requise.**

Vérification API (avec un token valide) :

```bash
TOKEN="<bearer>"
# Liste des archétypes (seed automatique)
curl -s -H "Authorization: Bearer $TOKEN" http://localhost:8080/api/stage/archetypes | jq .

# Création d'un objectif daily (admin)
curl -s -X POST http://localhost:8080/api/stage/objective-definitions \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"scope":"daily","title":"Score 3 goals today","metric":"goals_scored","target_value":3,"reward_stc":1000}'

# Création d'un SBC test
curl -s -X POST http://localhost:8080/api/stage/sbcs \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"name":"Squad Français","requirements":{"squad_size":3,"nationality":"FRA"},"reward":{"stc":50000}}'
```

### Frontend

```jsx
import ObjectivesWidget from '@/components/objectives/ObjectivesWidget';
import ChemistryPanel from '@/components/team/ChemistryPanel';

// Dans le dashboard
<ObjectivesWidget playerId={currentPlayer.id} />

// Dans le team-builder
<ChemistryPanel players={selectedPlayers} cornerstonePlayerId={captainId} />
```

### Pipeline post-match (à brancher manuellement)

Ces composants supposent qu'un hook post-match incrémente `objective_progress.current_value` pour les objectifs en cours du joueur. **Ce hook reste à écrire** — il vit logiquement dans `matchModel` ou dans `scheduleEngine` :

```js
// pseudo-code à placer après le finalisation d'un match
const objectives = await EXECUTESQL(
  `SELECT op.* FROM objective_progress op
     JOIN objective_definitions od ON od.id = op.objective_id
    WHERE op.player_id = ? AND op.claimed_at IS NULL AND od.is_active = 1`,
  [playerId]
);
for (const op of objectives) {
  const delta = computeMetricDelta(op.objective_id, matchStats); // e.g. goals scored in this match
  if (!delta) continue;
  const newValue = (op.current_value || 0) + delta;
  const completed = newValue >= (op.target_value || 1) ? 'NOW()' : 'completed_at';
  await EXECUTESQL(
    `UPDATE objective_progress
        SET current_value = ?,
            completed_at = CASE WHEN ? >= target_value AND completed_at IS NULL THEN NOW() ELSE completed_at END,
            updated_date = NOW()
      WHERE id = ?`,
    [newValue, newValue, op.id]
  );
}
```

### Branchement chimie dans `scheduleEngine`

Au moment du calcul d'agrégat d'équipe, appeler côté serveur :

```js
const { computeChemistry } = require('../services/chemistryService');
const chem = await computeChemistry(homePlayerIds, { cornerstonePlayerId: homeCaptainId });
homeStrength *= chem.multiplier;
```

---

## Conformité AGENTS.md

| Convention | Statut |
|---|---|
| §2.1 — Schema dans `schema.sql` + migration `server.js` | ✅ Les deux mis à jour |
| §2.2 — Models class-based avec selectAll/selectOne/create/update/delete + sélecteurs custom | ✅ 6 modèles |
| §2.3 — Controllers express.Router avec GET/POST/PATCH/DELETE + filtres query-string | ✅ 6 contrôleurs |
| §2.4 — Route mount sous `/api/stage/<kebab-plural>` + `verifyToken` | ✅ 6 routes |
| §2.5 — Entity name PascalCase dans `ENTITY_NAMES` | ✅ 6 entités |
| §3 — Actions transactionnelles dans `functionsController` (pas en CRUD) | ✅ `claimObjectiveReward` + `submitSbc` |
| §6 — `addCol` idempotent pour `players.archetype` et `players.sacrificed_at` | ✅ |
| §7 — Audit log écrit pour `claim_objective_reward` et `submit_sbc` | ✅ |
| §11.1 — Entité PascalCase ajoutée à `ENTITY_NAMES` | ✅ |
| §11.4 — Pluralisation `entityToPath` respectée (`ObjectiveProgress` → `/objective-progresses`) | ✅ corrigé |

---

## Hors-scope (pas implémenté, à faire dans des PR séparées)

- **Hook post-match incrémentation objectives** : doit vivre dans `matchModel` ou `scheduleEngine` (cf. snippet ci-dessus)
- **Job cron regénération du pool daily/weekly d'objectifs** : à écrire (cron + `objective_definitions.active_until`)
- **Branchement chimie dans `scheduleEngine`** : 1-liner, mais touche au moteur de simulation
- **Pages admin** pour gérer le catalogue objectives/SBCs/archétypes (réutiliser les patterns d'`Admin.jsx`)
- **Lint / Typecheck** : non exécutables ici (pas de sandbox bash) — à passer côté humain avec `npm run lint && npm run typecheck`
- **Test runtime** : nécessite un serveur local démarré (`cd server && npm run dev`)

---

## Pre-deploy checklist (cf. AGENTS.md §8)

À cocher avant déploiement :

- [ ] `npm run lint` clean
- [ ] `npm run typecheck` clean
- [ ] `node --check server/src/server.js` ok
- [ ] Toutes les nouvelles tables sont **et** dans `schema.sql` **et** dans `server.js` (confirmé : oui)
- [ ] Toutes les nouvelles entités sont dans `ENTITY_NAMES` (confirmé : oui)
- [ ] Test manuel : créer un objectif → progress → claim → STC crédité → audit log écrit
- [ ] Test manuel : créer un SBC → submit valide → joueurs détachés du club → reward crédit → audit log écrit
- [ ] Test manuel : créer un SBC → submit invalide → ligne `failed` dans sbc_submissions, transaction rollback

---

## Fichiers touchés — récap

```
server/schema.sql                                              (+118 lignes)
server/src/server.js                                            (+143 lignes)
server/src/server/models/objectiveDefinitionModel.js            (NEW)
server/src/server/models/objectiveProgressModel.js              (NEW)
server/src/server/models/archetypeModel.js                      (NEW)
server/src/server/models/chemistryLinkModel.js                  (NEW)
server/src/server/models/sbcModel.js                            (NEW)
server/src/server/models/sbcSubmissionModel.js                  (NEW)
server/src/server/controllers/objectiveDefinitionController.js  (NEW)
server/src/server/controllers/objectiveProgressController.js    (NEW)
server/src/server/controllers/archetypeController.js            (NEW)
server/src/server/controllers/chemistryLinkController.js        (NEW)
server/src/server/controllers/sbcController.js                  (NEW)
server/src/server/controllers/sbcSubmissionController.js        (NEW)
server/src/server/controllers/functionsController.js            (+~290 lignes : claimObjectiveReward + submitSbc)
server/src/server/services/chemistryService.js                  (NEW, NEW DIR)
src/api/stageClient.js                                          (+16 lignes — 6 entités)
src/components/objectives/ObjectivesWidget.jsx                  (NEW, NEW DIR)
src/components/team/ChemistryPanel.jsx                          (NEW, NEW DIR)
```

15 fichiers créés, 4 fichiers modifiés.
