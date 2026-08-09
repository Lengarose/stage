# 03 — Vote consultatif des membres

**What to build:** Le président ouvre un vote sur une fiche de scouting. Les membres du club votent pour ou contre le joueur repéré, et le score s'affiche sur la fiche. Chaque membre voit son propre vote et peut le changer tant que le vote est ouvert.

Le vote est **purement consultatif** : il informe la décision du président, il ne la contraint jamais. Aucun résultat de vote ne doit désactiver, masquer ou bloquer les actions de décision du président (ticket 04). C'est un avis d'équipe, pas un droit de veto.

Seuls les membres du club concerné votent. Un membre ne vote qu'une fois par fiche.

**Blocked by:** 01 — Créer et lister une fiche de scouting.

**Status:** ready-for-agent

- [ ] Le président peut ouvrir un vote sur une fiche
- [ ] Un membre du club peut voter pour ou contre, et changer son vote tant que le vote est ouvert
- [ ] Le score pour/contre est visible sur la fiche par tous les membres du club
- [ ] Un membre voit quel a été son propre vote
- [ ] Un membre ne peut pas voter deux fois sur la même fiche
- [ ] Un joueur hors du club ne peut pas voter (refus côté serveur)
- [ ] Un résultat de vote défavorable ne bloque ni ne masque aucune action du président
- [ ] `npm run lint`, `npm run typecheck` et `node --check server/src/server.js` passent
