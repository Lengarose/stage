# CD03 — Une seule source pour « qui suis-je dans ce club ? »

**Urgence : 3/5 pour l'effort, mais c'est le seul ticket de la série qui porte un
risque de *correction*, pas de performance.**

**Le problème :** `ClubDetail.jsx` répond **deux fois** à la même question, à 170
lignes d'écart, avec des entrées différentes.

En haut (l.165-169) :

```js
const isOwner = isClubPresidentForUser({
  user: currentUser,
  club,
  includeLegacyOwnerEmail: accountMode === "club",
}) || isAdminTakeover;
```

Plus bas (l.332-336) :

```js
const isCanonicalPresidentForThisClub = isClubPresidentForUser({
  user,
  club: c,
  presidentClub,
});
```

Même fonction, deux jeux d'arguments : la première passe `includeLegacyOwnerEmail`
conditionné au mode de compte mais **pas** `presidentClub` ; la seconde passe
`presidentClub` mais **pas** le drapeau e-mail. Les deux peuvent diverger pour le
même utilisateur sur le même club.

C'est exactement la famille de bug déjà rencontrée : le président qui ne se
reconnaît pas, l'offre envoyée au mauvais club. Tant que la question a deux
réponses possibles dans le même fichier, elle finira par en donner deux
différentes.

Autour, `isMember`, `isCaptain`, `isPresident`, `isViceCaptain`, `canEdit`,
`canOpenOperations` sont recalculés à la main à partir de `role` et `club_roles`
alors que le serveur possède déjà `getClubAccess`. Le client réimplémente le
modèle de permissions du serveur, en moins complet.

**Ce qu'il faut construire :** un hook `useClubAccess(clubId)` qui répond **une
seule fois** — membre, capitaine, vice-capitaine, président, admin en prise de
contrôle — et dont `canEdit` / `canOpenOperations` sont dérivés. `ClubDetail` ne
calcule plus rien lui-même.

Un point à trancher pendant l'implémentation : `getClubAccess` côté serveur
est-il complet au point de rendre le calcul client inutile ? Si oui, le hook
devient un simple lecteur — c'est la meilleure issue. Sinon on garde le calcul
client mais **à un seul endroit**.

⚠️ Le rendu des rôles ne doit pas changer pour les utilisateurs existants. Vérifier
sur un club réel avec un président, un capitaine et un simple membre avant de
considérer le ticket fini.

**Blocked by:** rien, mais à faire après CD01 — le hook sera bien plus simple à
écrire une fois que `auth.me()` est cachable sans coût.

**Status:** ready-for-agent

- [ ] `isClubPresidentForUser` n'est plus appelé qu'à un seul endroit pour cette page
- [ ] `canEdit` et `canOpenOperations` dérivent du hook, plus de recalcul local
- [ ] Un président voit exactement les mêmes boutons qu'avant le refactor
- [ ] Un capitaine, un vice-capitaine, un membre simple et un visiteur : idem
- [ ] La prise de contrôle admin (`admin_takeover_club_id`) fonctionne toujours
- [ ] Tests sur le hook couvrant les cinq rôles + le visiteur non connecté
- [ ] `npm run lint`, `npm run typecheck` passent
