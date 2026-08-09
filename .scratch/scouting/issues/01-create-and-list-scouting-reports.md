# 01 — Créer et lister une fiche de scouting

**What to build:** Un membre d'un club ouvre la page Scouting, choisit un joueur de la plateforme, colle un ou plusieurs liens vidéo, et enregistre. La fiche apparaît immédiatement dans la liste de scouting de son club, avec le nom du joueur ciblé, le nom du membre qui l'a scouté, et les liens vidéo affichés en texte cliquable (l'intégration en lecteur vient au ticket 02).

La cible peut être **n'importe quel joueur** de la plateforme, y compris un joueur déjà sous contrat ailleurs — aucune restriction ici, les règles de contrat existantes s'appliqueront au moment de l'offre (ticket 04).

Seuls les membres actuels d'un club voient et utilisent le Scouting. Un joueur sans club, ou un membre d'un autre club, n'a pas accès aux fiches de ce club — et cette vérification doit être faite **côté serveur**, pas seulement en masquant l'UI.

Nouvelle route `/scouting`. L'ancienne page `/recruitment` reste intacte et fonctionnelle pendant tout le build ; son remplacement est le ticket 05.

**Blocked by:** None — can start immediately.

**Status:** ready-for-agent

- [ ] Un membre d'un club peut créer une fiche avec un joueur ciblé et au moins un lien vidéo
- [ ] La fiche apparaît dans la liste du club avec joueur ciblé, "scouté par [membre]", et les liens
- [ ] Plusieurs liens vidéo peuvent être ajoutés sur une même fiche
- [ ] Un joueur sans club ne peut ni voir ni créer de fiche (refus côté serveur, pas seulement UI masquée)
- [ ] Un membre du club A ne peut pas lire les fiches du club B (refus côté serveur)
- [ ] Un joueur déjà sous contrat dans un autre club peut être scouté sans blocage
- [ ] La table est déclarée à la fois dans `schema.sql` et dans les migrations de démarrage (convention §6 de AGENTS.md)
- [ ] L'entité est enregistrée dans `ENTITY_NAMES` pour que `stageClient.entities` la résolve
- [ ] `npm run lint`, `npm run typecheck` et `node --check server/src/server.js` passent
