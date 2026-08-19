# Duel de sabres laser (Star Wars)

## État actuel

Deux silhouettes encapuchonnées qui s'affrontent au sabre laser, un vert et
un rouge. Antoine n'avait pas reconnu la référence au premier passage — la
cause trouvée était bête : le cœur de la lame était codé en blanc fixe,
seul le halo autour portait la couleur, donc vert et rouge se ressemblaient
de loin. Corrigé (le cœur utilise vraiment la couleur passée en paramètre).
Cette session, l'écran s'assombrit aussi et se resserre (vignette) pendant
le duel, sur demande explicite (« l'écran doit s'assombrir pour se sentir
dans l'univers »).

## Fichiers concernés

- `src/world/cinema.js` — `duelSabres(palier)`, `lame(couleur, halos)`
- `src/world/encapuchonne.js` — `creerDuelliste(palier, opts)`, `GARDES`,
  `ECHANGES` (le corps et la chorégraphie, réutilisables si une autre scène
  de duel était voulue)
- `src/core/postfx.js` — `PostFX.assombrir(force, dt)`, branché depuis
  `Apparitions.maj()` via le champ `assombrit` de l'entrée `sabres` dans
  `planApparitions`

## Problèmes connus / à faire

Aucun signalé depuis les deux correctifs.

## Idées non explorées

Rien d'identifié.
