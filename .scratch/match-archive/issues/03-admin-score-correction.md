# 03 — Correction de score par l'admin

**What to build:** Depuis le détail d'un match, un admin peut corriger le score officiel quand la soumission était fausse — le cas typique après un litige tranché sur preuve.

Chaque correction est **tracée** : qui a corrigé, quand, l'ancien score, le nouveau, et le motif. Un admin doit pouvoir répondre « pourquoi ce score a-t-il changé » six mois plus tard.

**Décision verrouillée sur le recalcul :** la correction écrit le score et l'audit, rien de plus. Les statistiques et les classements se remettent à jour au **recalcul complet existant**, pas par un chemin de recalcul partiel — deux chemins de calcul finiraient par diverger, et le rebuild global existe déjà.

**Décision verrouillée sur les mises :** corriger un score ne règle, n'annule ni ne re-règle jamais une mise automatiquement. L'argent ne bouge que si l'admin le demande explicitement, en une action distincte. Un score corrigé par erreur ne doit pas pouvoir vider un portefeuille.

**Blocked by:** 02 — Détail d'un match et consultation des preuves.

**Status:** ready-for-agent

- [ ] Un admin peut corriger le score officiel d'un match depuis son détail
- [ ] Un motif est demandé et conservé
- [ ] La correction écrit une ligne dans le journal d'audit avec ancien score, nouveau score, auteur et motif
- [ ] La correction ne touche pas au règlement de la mise
- [ ] Le détail indique après coup que le score a été corrigé par un admin
- [ ] Un non-admin ne peut pas corriger un score (refus côté serveur)
- [ ] Un score invalide (négatif, non numérique) est refusé avec un message clair
- [ ] `npm run lint`, `npm run typecheck` et `node --check server/src/server.js` passent
