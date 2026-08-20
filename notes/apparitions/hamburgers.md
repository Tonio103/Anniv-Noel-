# Hamburgers volants

## État actuel

Ajoutée cette session (« je veux des hamburgers qui volent car j'aime la
nourriture »). Une nuée de hamburgers procéduraux (pain, steak, salade,
fromage — pas une texture, une pile de formes) qui tourbillonne à un point
fixe du ciel. Taille et distance ajustées une fois en cours de route : la
première version était trop petite/loin pour se lire comme des hamburgers
plutôt que des points colorés.

## Fichiers concernés

- `src/world/apparitions.js` — `nueeHamburgers(chemin, palier)`,
  `hamburgerVolant(echelle)`

## Comment marche le positionnement

Scène `suitCamera`, mais comme `et`/`gargantua` : position calculée une
seule fois depuis le chemin (jamais depuis la caméra en direct) et la
racine `g` est bien celle qu'on déplace — pas de piège comme celui trouvé
sur Gargantua (voir `gargantua.md`).

## Problèmes connus / à faire

Aucun signalé après le réglage de taille/distance.

## Idées non explorées

Rien d'identifié.
