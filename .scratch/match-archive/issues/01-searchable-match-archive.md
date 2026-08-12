# 01 — Archive de matchs consultable et cherchable

**What to build:** Un admin ouvre une nouvelle section d'administration et retrouve **n'importe quel match jamais joué**, sans limite de date.

La liste montre l'essentiel pour identifier un match d'un coup d'œil : type de match, joueur contre joueur ou club contre club, les deux camps, la date programmée, le score final, le statut, et s'il y avait une mise.

La recherche accepte ce qu'un admin a réellement sous la main quand quelqu'un se plaint : un nom d'utilisateur, une adresse e-mail, un gamertag, un nom de club. Les filtres couvrent le type de match, le statut et une plage de dates.

**Contexte important — ne rien reconstruire :** la table `matches` stocke déjà tout ce qu'il faut (ids, camps, noms, e-mails, date programmée, scores soumis de chaque côté, score final, statut, preuves, mise et son statut). Ce ticket est une **lecture** : requête + écran. Aucune migration de données, aucun champ existant à renommer.

**Blocked by:** None — can start immediately.

**Status:** ready-for-agent

- [ ] Un admin accède à l'archive depuis la navigation d'administration
- [ ] La liste retourne les matchs les plus récents en premier, sans limite de date en arrière
- [ ] Recherche par e-mail, par nom d'utilisateur, par gamertag et par nom de club
- [ ] Filtres par type de match, par statut et par plage de dates
- [ ] La liste indique clairement joueur-contre-joueur ou club-contre-club
- [ ] Score final et statut visibles dans la liste
- [ ] La présence d'une mise est visible dans la liste
- [ ] Un non-admin ne peut pas interroger l'archive (refus côté serveur, pas seulement UI masquée)
- [ ] La requête reste utilisable sur un grand volume (pagination, pas de chargement intégral)
- [ ] `npm run lint`, `npm run typecheck` et `node --check server/src/server.js` passent
