# 04 — Décision du président et envoi de l'offre

**What to build:** Sur chaque fiche de scouting, le président du club peut décider : envoyer une offre au joueur repéré, ou classer la fiche.

"Recruter" envoie une **offre de contrat classique** au joueur ciblé, en passant par le système d'offres existant — aucun nouveau mécanisme de contrat, aucune nouvelle table de contrat, aucun contournement des règles en place. Les règles existantes (fenêtre de transfert, contrat actif ailleurs, éligibilité) s'appliquent telles quelles : si elles refusent l'offre, le président voit un message d'erreur clair et la fiche reste ouverte.

Une fois l'offre partie, la fiche passe en statut "offerte" et garde une référence vers le contrat créé, pour qu'on puisse suivre l'issue. Le pipeline de scouting s'arrête là : l'acceptation ou le refus par le joueur suit le flux de contrat existant, inchangé.

Seul le président voit et utilise ces actions. Les autres membres voient la fiche et son statut, sans les boutons de décision.

**Blocked by:** 01 — Créer et lister une fiche de scouting.

**Status:** ready-for-agent

- [ ] Le président peut envoyer une offre au joueur ciblé depuis la fiche
- [ ] L'offre créée est une offre de contrat standard, visible dans les flux de contrat existants
- [ ] La fiche passe en statut "offerte" et référence le contrat créé
- [ ] Si les règles de contrat existantes refusent l'offre, l'erreur est affichée clairement et la fiche reste ouverte
- [ ] Le président peut classer une fiche sans envoyer d'offre
- [ ] Un membre non président ne voit pas les boutons de décision et ne peut pas déclencher l'offre (refus côté serveur)
- [ ] La décision est tracée dans le journal d'audit (convention §7 de AGENTS.md)
- [ ] `npm run lint`, `npm run typecheck` et `node --check server/src/server.js` passent
