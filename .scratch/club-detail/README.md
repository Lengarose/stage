# ClubDetail — tickets issus de l'analyse de la page live

Analyse menée sur `https://stageleagues.com/clubs/a48b6b7f-5d54-4db1-9328-ad25d7f44260`
(FC ZITO), onglet réseau + lecture du code.

Ordre d'attaque conseillé : 01 → 02 → 03 → 04 → 05.

| # | Ticket | Nature | Pourquoi cet ordre |
|---|---|---|---|
| 01 | [Cache `auth.me()`](issues/01-cache-auth-me.md) | Perf, toutes pages | 16 appels par affichage. Le plus gros gain, le plus petit risque. |
| 02 | [Pas d'écriture de langue au boot](issues/02-no-language-write-on-boot.md) | Écriture parasite | Explique le `PATCH` observé sur une page de lecture. Correctif court. |
| 03 | [Une seule source d'accès club](issues/03-single-club-access-source.md) | **Correction** | Le seul risque fonctionnel réel : deux réponses possibles à « suis-je président ? ». |
| 04 | [Dédupliquer les notifications](issues/04-dedupe-notifications.md) | Perf | Deux requêtes identiques. Petit, sans risque. |
| 05 | [Code-splitting ClubDetail](issues/05-code-split-club-detail.md) | Perf perçue | Le plus gros chantier, le moins urgent. Après 03 pour éviter les conflits. |

## Ce qui n'est *pas* dans ces tickets

`ClubDetail.jsx` fait 1490 lignes, 42 `useState` et 35 appels API. Le découper est
tentant mais ce serait un refactor à risque sans bénéfice mesurable pour les
utilisateurs. Les cinq tickets ci-dessus retirent les vrais défauts ; si le
fichier reste pénible ensuite, on rouvrira la question avec une raison concrète.

Le `POST /functions/transferWindowActions` déclenché à l'affichage a été repéré
mais pas encore expliqué. À investiguer pendant le ticket 02, qui touche au même
genre de symptôme.
