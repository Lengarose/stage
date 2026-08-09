# 02 — Lecture vidéo intégrée avec repli

**What to build:** Sur chaque fiche de scouting, les liens vidéo ne sont plus du texte cliquable mais des lecteurs intégrés, pour que le club puisse juger le joueur sans quitter la page.

- **YouTube** : lecteur intégré natif, fiable.
- **Google Drive / OneDrive** : tentative d'intégration à partir du format de l'URL.
- **Tout le reste, ou un lien dont l'intégration échoue** : repli automatique sur un lien cliquable "Ouvrir la vidéo" qui s'ouvre dans un nouvel onglet.

Le repli est le comportement par défaut, pas un cas d'erreur : les permissions de partage Drive/OneDrive sont hors de notre contrôle, donc une fiche doit rester utilisable même si aucune vidéo ne s'intègre. Aucun lien ne doit jamais disparaître silencieusement de l'écran.

La détection se fait sur le format de l'URL. Elle vit dans un composant isolé et réutilisable, pour être testable indépendamment des fiches.

**Blocked by:** 01 — Créer et lister une fiche de scouting.

**Status:** ready-for-agent

- [ ] Un lien YouTube s'affiche en lecteur intégré et se lit dans la page
- [ ] Un lien Google Drive au format reconnu s'affiche en lecteur intégré
- [ ] Un lien OneDrive au format reconnu s'affiche en lecteur intégré
- [ ] Un lien non reconnu s'affiche en lien cliquable "Ouvrir la vidéo", pas en cadre vide
- [ ] Une intégration qui échoue au chargement retombe sur le lien cliquable
- [ ] Une fiche avec plusieurs liens de types différents affiche chacun correctement
- [ ] L'affichage reste lisible sur mobile
- [ ] `npm run lint`, `npm run typecheck` passent
