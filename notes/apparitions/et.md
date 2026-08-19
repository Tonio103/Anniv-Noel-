# E.T. — la lune

## État actuel

Une lune (disque additif, propre à la scène — la vraie lune du ciel est à
plus de 30° de l'axe caméra en permanence, donc invisible, voir le
commentaire dans le code) devant laquelle passe la silhouette du vélo en
train de décoller. A eu deux régressions successives (« la lune bouge
encore avec la caméra », « ça fait deux lunes ») avant la vraie correction :
la position ne doit **jamais** être recalculée depuis la direction
instantanée de la caméra (instable pendant les transitions de cadrage) —
seulement depuis le chemin, fixe, calculée une fois quand la fenêtre
s'ouvre.

## Fichiers concernés

- `src/world/apparitions.js` — `etDevantLaLune(chemin)`, `siluetteVelo()`

## Problèmes connus / à faire

Aucun signalé depuis la correction. C'est la scène de référence pour le
bon patron à suivre : toute scène `suitCamera` qui doit rester à un endroit
fixe du ciel/décor doit positionner sa **racine** (`g.position`), pas
seulement des sous-groupes — c'est l'inverse qui a cassé Gargantua cette
session (voir `gargantua.md`).

## Idées non explorées

Rien d'identifié.
