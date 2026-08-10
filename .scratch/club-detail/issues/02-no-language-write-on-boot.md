# CD02 — Arrêter d'écrire la langue à chaque démarrage

**Urgence : 2/5.** C'est l'écriture inexpliquée repérée pendant l'analyse : un
`PATCH /api/stage/players/<id>` part alors que l'utilisateur ne fait que
*consulter* une page club.

**D'où elle vient :** `src/lib/TranslationContext.jsx:57-71`. L'effet se déclenche
sur `[language]`, donc **à chaque montage du provider**, c'est-à-dire à chaque
chargement de l'application. Il fait un `auth.me()` puis un
`auth.updateMe({ language })` — même quand la langue n'a pas bougé d'un pouce.

Trois conséquences :

- une écriture en base à chaque ouverture de l'app, pour réécrire la même valeur ;
- un `auth.me()` de plus qui alimente le compteur de CD01 ;
- une course : si l'utilisateur change sa langue dans Settings pendant qu'un autre
  onglet démarre, l'onglet qui démarre peut réécrire l'ancienne langue par-dessus.

L'erreur est silencieuse (`.catch(() => {})`), donc personne ne l'a jamais vue.

**Ce qu'il faut construire :** n'écrire la langue que lorsqu'elle **change
réellement** par rapport à ce que le profil contient déjà. Le reste de l'effet
(localStorage, `document.documentElement.lang`, `dir`) est purement local et doit
rester à chaque montage.

**Blocked by:** rien. Se combine bien avec CD01 mais n'en dépend pas.

**Status:** ready-for-agent

- [ ] Ouvrir l'app sans toucher à la langue ne déclenche **aucun** `PATCH /players/:id`
- [ ] Changer la langue depuis Settings l'enregistre toujours dans le profil
- [ ] Changer la langue depuis le sélecteur du header l'enregistre toujours
- [ ] Un onglet qui démarre ne peut plus réécrire une langue changée ailleurs
- [ ] L'échec d'écriture n'est plus avalé en silence (au minimum un log)
- [ ] `npm run lint`, `npm run typecheck` passent
