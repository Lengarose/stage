# CD01 — Mettre `auth.me()` en cache

**Urgence : 1/5 (la plus haute).** Mesuré en direct sur
`https://stageleagues.com/clubs/a48b6b7f-...` : **16 appels à `GET /api/stage/auth/me`
pour un seul affichage de la page.**

**Ce qu'il se passe :** `stageClient.auth.me()` (`src/api/stageClient.js:471`) n'a
aucun cache. Chaque composant qui a besoin de savoir qui est l'utilisateur refait
l'aller-retour réseau. `ClubDetail.jsx` et `Layout.jsx` en déclenchent chacun
plusieurs, directement ou via `resolveMyPlayerAndClub()` — qui appelle lui-même
`auth.me()`.

Ce n'est pas propre à la page club : c'est un coût payé sur **toutes** les pages.
Seize requêtes authentifiées séquentielles avant que la page soit utilisable, ça
se voit à l'ouverture, et ça se voit encore plus sur le serveur quand plusieurs
personnes naviguent en même temps.

**Ce qu'il faut construire :** un cache de courte durée dans `auth.me()` —
une promesse partagée pour les appels concurrents, et une valeur mémorisée
ensuite. Un seul appel réseau par navigation au lieu de seize.

Le point délicat est l'invalidation. Le cache doit être vidé à la connexion, à la
déconnexion, au rafraîchissement de token, et après `updateMe()` — sinon on
affichera un profil périmé après une modification, ce qui serait pire que le
problème d'origine.

**Blocked by:** rien — peut démarrer tout de suite.

**Status:** ready-for-agent

- [ ] Un affichage de `/clubs/:id` déclenche **un seul** `GET /auth/me` (vérifié dans l'onglet réseau)
- [ ] Deux appels concurrents à `auth.me()` partagent la même requête réseau
- [ ] Le cache est vidé à `login`, `logout`, au refresh de token et après `updateMe()`
- [ ] `resolveMyPlayerAndClub()` bénéficie du cache sans changement d'appelant
- [ ] Aucun composant ne montre un profil périmé après édition du profil
- [ ] Tests : appels concurrents dédupliqués, invalidation effective après logout
- [ ] `npm run lint`, `npm run typecheck` passent
