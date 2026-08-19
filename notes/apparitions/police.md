# Police — poursuite

## État actuel

Une course-poursuite de voitures de police, sur sa propre « voie » à
distance du chemin, indépendante de la marche du cerf. Fonctionne bien,
n'a pas reçu de plainte cette session.

## Fichiers concernés

- `src/world/vehicules.js` — `coursePoursuite(chemin, relief, palier)`
  (la scène complète : voitures, gyrophares, sirène)
- `src/world/apparitions.js` — entrée `police` dans `planApparitions(L)` et
  `FABRIQUES`

## Problèmes connus / à faire

Aucun signalé. C'est une scène `suitChemin` (mobile) — elle est donc
exclue du contrôle de collision automatique (`build/collisions.mjs` ne
vérifie que les scènes statiques) et exclue du nouveau mécanisme d'arrêt du
cerf (voir `../systemes/camera-drone.md`), pour la même raison que le
T-Rex : l'arrêter la laisserait s'éloigner dans le vide pendant que le cerf
ne bouge plus.

## Idées non explorées

Rien d'identifié.
