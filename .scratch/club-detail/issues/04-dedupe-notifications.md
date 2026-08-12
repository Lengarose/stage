# CD04 — Dédupliquer le chargement des notifications

**Urgence : 4/5.** Trois appels à l'endpoint notifications par affichage de page,
dont **deux strictement identiques** (`read=false&limit=100`).

Deux requêtes rigoureusement identiques dans la même seconde, ce n'est jamais
voulu : c'est deux composants qui ignorent l'existence l'un de l'autre. Le
symptôme est le même que CD01 et le remède aussi — une seule source, partagée.

**Ce qu'il faut construire :** identifier les appelants, les faire passer par le
provider de notifications existant plutôt que d'aller chercher la donnée
eux-mêmes. Si deux vues ont réellement besoin de filtres différents, alors le
troisième appel est légitime et on ne supprime que le doublon.

**Blocked by:** rien.

**Status:** ready-for-agent

- [ ] Plus aucun doublon exact dans l'onglet réseau à l'affichage d'une page
- [ ] Le badge de notifications non lues reste juste
- [ ] Les notifications temps réel (socket) continuent de mettre la liste à jour
- [ ] `npm run lint`, `npm run typecheck` passent
