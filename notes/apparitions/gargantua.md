# Interstellar — Gargantua

## État actuel

Le trou noir et son disque d'accrétion, avec un astronaute au sol pour
donner l'échelle. Cette session a ajouté une vraie signature visuelle liée
au thème : l'aberration chromatique du moteur (normalement un réglage
discret d'objectif, 1 à 3 pixels) devient, pendant cette scène, une
véritable distorsion — une lentille gravitationnelle plutôt qu'un réglage
d'objectif — qui suit l'enveloppe d'apparition du disque.

## Bug trouvé et corrigé cette session

**Gargantua ne se voyait jamais pendant l'arrêt du cerf.** Cause : sa
racine (`g`) ne bougeait jamais — seuls ses deux sous-groupes (le disque,
loin dans le ciel ; l'astronaute, près du sol) étaient positionnés
indépendamment. Le mécanisme qui tourne la caméra vers la scène active lit
`sc.objet.position` (la racine) par défaut : elle visait donc l'origine du
monde, très loin derrière, au lieu du trou noir. Corrigé en donnant à la
scène un `pointRegard` explicite (`g.userData.pointRegard = posDisque`),
lu en priorité par le mécanisme de regard — voir
`../systemes/camera-drone.md`. **Toute nouvelle scène `suitCamera` qui ne
positionne pas sa propre racine doit faire pareil**, sous peine du même bug
silencieux (pas d'erreur, juste rien à l'écran).

## Fichiers concernés

- `src/world/cinema.js` — `trouNoir(relief, chemin)`, `siluetteAstronaute()`
- `src/core/postfx.js` — `PostFX.distordre(force, dt)`

## Problèmes connus / à faire

Aucun signalé depuis la correction de visée.

## Idées non explorées

Rien d'identifié.
