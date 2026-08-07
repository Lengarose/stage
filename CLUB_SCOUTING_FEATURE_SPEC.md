# Stage League — Scouting de club (spec de concept)

> Document de cadrage, pas encore implémenté. Objectif : figer le concept avant de l'ouvrir en session de build.
> Référence : `AGENTS.md`, §2 (convention MVC), §4 (frontend), §7 (audit logging).
> Rédigé le 2026-08-07, à partir d'une idée orale de Lutina.

---

## 1. Pourquoi "Scouting" et pas "Recruiting"

Le nom "Recruiting/Recruitment" est déjà pris par une fonctionnalité existante et différente :
- `src/pages/Recruitment.jsx` + `recruitmentPostController.js` / `recruitmentInterestController.js` — un **tableau d'annonces public**, plateforme-wide : joueurs qui postent "je cherche un club", clubs qui postent "on recrute", et des demandes d'essai (`trial_request`).

Ce qu'on décrit ici est différent sur trois points : c'est **privé au club** (pas public), c'est un **pipeline structuré** (repérage → preuve vidéo → avis d'équipe → décision → offre), et ce sont les **membres du club** qui scoutent, pas le joueur lui-même qui se présente. D'où le nom **"Scouting"** pour éviter toute confusion dans le code et l'UI (onglet, entité, route).

---

## 2. Concept validé

**Accès** : uniquement les joueurs actuellement membres d'un club (`player.club_id` non nul). Un free agent n'a pas accès au scouting. Nouvel onglet "Scouting" dans la page club, visible seulement par les membres de ce club.

**Cible du scouting** : n'importe quel joueur de la plateforme, y compris un joueur déjà sous contrat dans un autre club. Aucune restriction à la création de la fiche — les règles de contrat existantes (`assertCanCreateContractOffer`, fenêtre de transfert, contrat actif ailleurs, etc.) s'appliquent normalement au moment de l'offre, pas au moment du scouting. Ça évite de dupliquer une logique de blocage qui existe déjà.

**Flux** :
1. Un membre du club cherche un joueur (réutilise la recherche existante de `src/pages/Search.jsx` / logique similaire) et crée une **fiche de scouting** : joueur ciblé + un ou plusieurs liens vidéo (Drive, OneDrive, YouTube, ou autre URL).
2. La fiche apparaît dans la liste "Scouting" du club, triée par date, avec le nom du membre scouteur ("scouté par ...") et les vidéos affichées en lecteur intégré.
   - **YouTube** : embed natif direct (iframe `youtube.com/embed/<id>`), fiable.
   - **Google Drive / OneDrive** : tentative d'embed (Drive : `drive.google.com/file/d/<id>/preview` ; OneDrive : lien "embed" s'il est fourni par l'utilisateur). Si le lien ne correspond à aucun format connu, ou si l'iframe échoue à charger, **fallback en simple lien cliquable** "Ouvrir la vidéo" (nouvel onglet). Détection best-effort par pattern d'URL, pas de garantie à 100% côté Drive/OneDrive (permissions de partage variables).
3. Le président a deux actions sur chaque fiche : **"Recruter directement"** ou **"Ouvrir un vote"**.
4. Si vote ouvert, tous les membres du club votent pour/contre. Le score s'affiche sur la fiche, mais **le vote est purement consultatif** — le président garde la main pour recruter ou classer sans suivre le résultat.
5. "Recruter" déclenche une **offre de contrat classique** vers le joueur ciblé, via le système existant (`contractManagement` action `offer`, type `squad` par défaut, ou autre type choisi par le président). Aucun nouveau mécanisme de contrat à inventer — le scouting s'arrête à la création de l'offre.
6. Le joueur accepte/refuse comme n'importe quelle offre aujourd'hui. La fiche de scouting passe en statut "offert" puis "signé"/"refusé" une fois l'issue connue.

---

## 3. Ce qu'on peut réutiliser (rien à casser)

| Brique existante | Fichier(s) | Ce que ça donne pour le scouting |
|---|---|---|
| Recherche de joueurs | `src/pages/Search.jsx` | Base pour choisir le joueur à scouter |
| Offres de contrat | `contractManagement` (action `offer`), `OfferContractDialog.jsx` | "Recruter" = une offre standard, pas de nouveau flux de signature |
| Règles de contrat | `assertCanCreateContractOffer`, `requireContractOfferAccess` | Blocage automatique si le joueur ciblé n'est pas éligible (déjà sous contrat, fenêtre fermée, etc.) |
| Rôles de club | `players.club_roles`, `presidents` (depuis le fix récent player/président) | Vérifier que l'auteur de la fiche est bien membre du club, et que seul le président voit les boutons de décision |
| Audit | `admin_audit_log` / pattern d'audit club (`club_operation_audit_log`) | Tracer qui a recruté qui, et sur quelle fiche |
| Entité générique | `ENTITY_NAMES` dans `src/api/stageClient.js` | Enregistrement du nouveau type `ScoutingReport` sans client à écrire à la main |

---

## 4. Ce qu'il faut ajouter

### 4.1 Backend (suit la recette MVC standard, §2 de AGENTS.md)

- **Table `scouting_reports`** : `id`, `club_id`, `scouted_by_player_id`, `target_player_id`, `video_links` (JSON — liste d'URLs), `status` (`open` / `voting` / `offered` / `declined` / `signed` / `archived`), `notes` (texte libre optionnel), `created_date`, `updated_date`.
- **Table `scouting_votes`** (optionnelle si on veut le détail par joueur plutôt qu'un simple compteur JSON) : `id`, `report_id`, `player_id`, `vote` (`for` / `against`), `created_date`. Alternative plus simple : stocker les votes en JSON directement sur `scouting_reports` (`votes_json: {player_id: 'for'|'against'}`) si on ne veut pas de table séparée — suffisant vu que le vote est consultatif, pas de logique complexe dessus.
- **Modèle** `scoutingReportModel.js` — CRUD standard + `selectByClub(club_id)`.
- **Contrôleur** `scoutingReportController.js` — `GET /`, `GET /:id`, `POST /`, `PATCH /:id` (statut, vote, notes), monté sur `/api/stage/scouting-reports`. Le `POST /` doit vérifier côté serveur que l'auteur est bien membre actif d'un club (pas juste confiance au frontend).
- **Action "Recruter"** : pas une nouvelle fonction dédiée — le frontend appelle simplement `contractManagement` (action `offer`) avec le `target_player_id` de la fiche, puis fait un `PATCH` sur la fiche pour passer son statut à `offered` avec le `contract_id` généré en référence.

### 4.2 Frontend

- Enregistrer `ScoutingReport` dans `ENTITY_NAMES` (`stageClient.js`).
- Nouvel onglet "Scouting" dans la page club (à côté de "Contracts"/"Operations" existants) — liste des fiches + bouton "Nouvelle fiche".
- Composant `ScoutingReportCard.jsx` : nom du joueur ciblé, "scouté par X", lecteurs vidéo (avec la logique d'embed/fallback décrite en §2), score de vote si applicable, boutons de décision (visibles seulement si `role === 'president'` côté club).
- Composant `VideoEmbed.jsx` (réutilisable) : détecte YouTube / Drive / OneDrive par pattern d'URL, retente en iframe, sinon lien cliquable. Isolé dans son propre composant pour être robuste et testable indépendamment.
- Formulaire de création de fiche : recherche joueur + champ répétable pour coller des liens vidéo.

---

## 5. Points restés ouverts pour la session de build

- Faut-il limiter le nombre de fiches actives par joueur ciblé (éviter que 3 membres scoutent la même personne en même temps) ou laisser doublons visibles ?
- Le vote a-t-il une date de clôture, ou reste-t-il ouvert tant que le président n'a rien décidé ?
- Faut-il notifier le joueur scouté qu'il a été repéré (avant l'offre), ou seulement au moment de l'offre formelle comme aujourd'hui ?
- Une fiche refusée/déclinée peut-elle être relancée plus tard, ou est-elle archivée définitivement ?

---

## 6. Effort estimé (ordre de grandeur, un dev familier du repo)

| Lot | Estimation |
|---|---|
| Backend (table + modèle + contrôleur + route + audit) | ~1.5j |
| Frontend (onglet club, liste, formulaire de création) | ~1.5j |
| Composant vidéo (YouTube/Drive/OneDrive + fallback) | ~1j |
| Vote consultatif (UI + stockage JSON) | ~0.5j |
| Intégration à l'offre de contrat existante | ~0.5j |
| **Total** | **~5j** |

Risque faible : aucune table existante modifiée, aucun flux de contrat changé (le scouting ne fait que déclencher une offre standard).
