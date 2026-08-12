# 06 — Les vidéos appartiennent au joueur, pas au scout

**What to build:** Corrige une erreur de conception des tickets 01–02. Aujourd'hui c'est le scout qui colle les liens vidéo d'un joueur sur sa fiche. C'est faux : le scout n'a pas les vidéos du joueur, et rien ne garantit qu'il montre les bons matchs.

Chaque joueur gagne une **vitrine** sur son profil : ses propres liens vidéo, chacun avec une courte description, plus le poste qu'il préfère jouer. Le joueur seul gère cette section — il la remplit pour être repéré.

Le scout, lui, parcourt les profils, regarde ce que le joueur a publié, et **signale le joueur** à son club. La fiche de scouting ne porte plus de vidéos : elle affiche celles du profil du joueur, en lecture seule, et n'ajoute que le regard du scout (ses notes). Le vote de l'effectif et la décision du président (tickets 03–04) ne changent pas.

**Décisions verrouillées :**
- La fiche n'a plus de vidéos propres. Sa colonne `video_links` n'est plus ni écrite ni lue ; la colonne reste en base et ses données restent lisibles, comme les tables `recruitment_*`.
- Un joueur sans aucune vidéo publiée **n'est pas scoutable** — c'est la vitrine qui donne au club de quoi juger et voter. Le message de refus doit dire pourquoi.
- La vitrine est **publique**, comme le reste du profil (stats, poste, club) : c'est une vitrine, pas un dossier privé.

**Blocked by:** 01, 02, 03, 04, 05 — le pipeline complet existe déjà ; ce ticket en corrige la source des vidéos.

**Status:** ready-for-agent

- [ ] Un joueur peut ajouter, modifier et retirer ses propres vidéos depuis son profil
- [ ] Chaque vidéo porte une courte description saisie par le joueur
- [ ] Le joueur indique le poste qu'il préfère jouer dans cette vitrine
- [ ] Seul le joueur (ou un admin) peut modifier sa vitrine — refus côté serveur pour tout autre compte
- [ ] La vitrine est visible par tout le monde sur le profil du joueur
- [ ] Les vidéos utilisent le lecteur intégré du ticket 02, avec le même repli en lien cliquable
- [ ] Créer une fiche de scouting ne demande plus de liens vidéo au scout
- [ ] Une fiche affiche les vidéos publiées par le joueur ciblé, en lecture seule
- [ ] Signaler un joueur sans aucune vidéo est refusé côté serveur, avec un message qui explique pourquoi
- [ ] Les fiches existantes ne perdent pas leurs notes ni leur statut ; leurs anciens liens restent en base
- [ ] Le vote et la décision du président continuent de fonctionner à l'identique
- [ ] `npm test`, `npm run lint`, `npm run typecheck`, `npm run build` et `node --check server/src/server.js` passent
