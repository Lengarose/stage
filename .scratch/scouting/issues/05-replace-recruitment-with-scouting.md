# 05 — Remplacer Recruitment par Scouting

**What to build:** Le Scouting devient la seule fonctionnalité de repérage de la plateforme. L'ancienne page Recruitment disparaît de l'application.

`/recruitment` redirige vers `/scouting` — les liens existants, favoris et liens partagés continuent de fonctionner au lieu de tomber sur une 404.

Tout le code et l'UI de Recruitment sont retirés : la page publique, ses contrôleurs et modèles côté serveur, ses routes API, ses entités côté client, l'onglet admin, les entrées de navigation (bureau et mobile), et les textes de traduction associés dans toutes les langues. Les références dans Club Operations (statistique "posts ouverts" et bouton de création) partent également, ainsi que l'ingestion des marques d'intérêt vers les candidatures de club — les demandes d'adhésion et les demandes d'essai restent des sources de candidature, elles ne sont pas touchées.

**Décision verrouillée : les tables `recruitment_posts` et `recruitment_interests` restent en base.** Aucun `DROP`, aucun renommage. Elles deviennent orphelines mais leurs données sont conservées et récupérables. La suppression physique sera décidée séparément, plus tard, une fois certain que rien d'utile n'est perdu.

Le rôle de staff "recruiter" et la permission `manage_recruitment` sont réexaminés : soit ils sont recyclés pour piloter l'accès au Scouting, soit ils sont retirés — ils ne doivent pas rester à référencer une fonctionnalité qui n'existe plus.

**Blocked by:** 01, 02, 03, 04 — le Scouting doit être complet et vérifié avant que l'ancienne fonctionnalité soit retirée.

**Status:** ready-for-agent

- [ ] `/recruitment` redirige vers `/scouting`
- [ ] La page Recruitment, ses contrôleurs, modèles, routes API et entités client sont retirés
- [ ] L'onglet admin Recruitment est retiré
- [ ] Les entrées de navigation Recruitment (bureau et mobile) sont retirées
- [ ] Les textes de traduction Recruitment devenus inutilisés sont retirés dans toutes les langues
- [ ] Club Operations n'affiche plus la statistique ni le bouton de création de post
- [ ] Les candidatures de club ne tirent plus des marques d'intérêt ; demandes d'adhésion et d'essai fonctionnent toujours
- [ ] La suppression d'un compte ne référence plus les tables retirées du code
- [ ] Le rôle "recruiter" et la permission `manage_recruitment` sont soit recyclés pour le Scouting, soit retirés
- [ ] Les tables `recruitment_posts` et `recruitment_interests` existent toujours en base, intactes
- [ ] Aucune référence morte à Recruitment ne subsiste dans le code
- [ ] `npm run lint`, `npm run typecheck`, `npm run build` et `node --check server/src/server.js` passent
