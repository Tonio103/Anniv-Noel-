# Kill Bill

## État actuel

Combinaison jaune, sabre, un adversaire masqué (façon Crazy 88), et
beaucoup de sang — la plainte la plus insistante et répétée de la session
(« ne combat personne » plusieurs fois de suite), résolue en deux temps :

1. **Bug réel trouvé** : sa chorégraphie était calée sur une portion de
   fenêtre (`u` jusqu'à 0,88) que la caméra ne montrait jamais — elle
   bascule en cadrage d'approche de halte dès `u ≈ 0,33` dans ce cas
   précis, parce que la halte suivante est très proche. Tout le combat a
   été recompressé pour finir avant ce seuil.
2. **Le sang a été massivement amplifié** (particules, taille, durée,
   taille de la mare) après un premier correctif jugé encore trop discret.

## Fichiers concernés

- `src/world/cinema.js` — `killBill(palier)`, `adversaireMasque(palier)`,
  `katana()`, `gerbeDeSang(N)`, `fontaineDeSang()`, `tacheDeSang()`

## Problèmes connus / à faire

Aucun signalé depuis le deuxième correctif — vérifiée à nouveau cette
session avec le nouvel arrêt du cerf (capture réelle : les deux
personnages et la mare sont bien cadrés, centrés).

## Idées non explorées

Rien d'identifié.
