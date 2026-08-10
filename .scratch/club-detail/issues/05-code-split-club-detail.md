# CD05 — Charger en différé les modules lourds de ClubDetail

**Urgence : 5/5 (la plus basse) — mais c'est le gain le plus visible pour un
visiteur.**

Ouvrir un profil de club télécharge, **avant tout clic**, l'onglet Posts étant
celui affiché par défaut :

- les quatre modules de graphiques Recharts, dont `generateCategoricalChart`
  (~384 ko à lui seul), plus `BarChart`, `LineChart`, `RadarChart`
- `OfferContractDialog`
- `ClubProfileEdit`, `ProfileEditShell`, `BannerPreviewEditor`, `VideoCoverPicker`
- `PlayerTrophyCabinet`
- la liste mondiale des pays (`allCountries`)

La quasi-totalité ne sert qu'à un président en train d'éditer. Un visiteur qui
regarde le mur d'un club paie le poids de l'éditeur complet.

**Ce qu'il faut construire :** `React.lazy` + `Suspense` sur les modules
d'édition et sur les graphiques, chargés à l'ouverture de l'onglet ou de la
modale concernée.

Deux pièges à éviter : ne pas différer ce qui est visible au premier rendu (sinon
on échange du poids contre un scintillement), et prévoir un état de chargement
correct dans les modales — un dialogue qui s'ouvre vide pendant 400 ms est pire
qu'un dialogue un peu lent à apparaître.

**Blocked by:** rien. À faire de préférence après CD03 pour éviter les conflits
sur le même fichier.

**Status:** ready-for-agent

- [ ] Les modules Recharts ne sont plus dans le chunk initial de `/clubs/:id`
- [ ] Les éditeurs (profil, bannière, cover, offre de contrat) sont chargés à l'ouverture
- [ ] L'onglet Posts s'affiche sans télécharger l'éditeur
- [ ] Chaque modale différée a un état de chargement visible
- [ ] Comparaison de la taille du chunk avant/après, notée dans le PR
- [ ] `npm run build` réussit, `npm run lint` et `npm run typecheck` passent
