# 02 — Détail d'un match et consultation des preuves

**What to build:** Depuis l'archive, un admin ouvre un match et voit tout ce qui permet de trancher un litige, même des mois plus tard.

Le détail montre : identifiant du match, type, les deux camps avec les noms d'utilisateur et les e-mails associés, la date programmée et la date de jeu, **ce que chaque camp a soumis comme score**, le score final officiel, le statut, le montant de la mise et si elle a été réglée, et si le match a compté pour les classements.

La distinction entre scores soumis et score officiel est le cœur de l'écran : c'est exactement ce qu'un admin regarde quand deux joueurs ne sont pas d'accord.

Les captures d'écran fournies comme preuve s'ouvrent en grand dans une fenêtre, et peuvent être téléchargées. Une preuve doit rester consultable longtemps après le match.

**Blocked by:** 01 — Archive de matchs consultable et cherchable.

**Status:** ready-for-agent

- [ ] Le détail affiche tous les champs listés ci-dessus
- [ ] Les scores soumis par chaque camp sont montrés séparément du score officiel
- [ ] Le statut de règlement de la mise est explicite, y compris quand il n'y a pas de mise
- [ ] L'impact sur les classements est indiqué
- [ ] Les captures s'ouvrent en grand dans une fenêtre
- [ ] Une capture peut être téléchargée
- [ ] Un match sans preuve affiche clairement qu'il n'y en a pas, plutôt qu'un cadre vide
- [ ] Les preuves des deux camps sont accessibles, pas seulement celle du premier ayant soumis
- [ ] `npm run lint`, `npm run typecheck` et `node --check server/src/server.js` passent
